param([string]$Repository='Keremdesuu/Keremhub')
$ErrorActionPreference='Stop'
$repoRoot=Split-Path $PSScriptRoot
$version=([IO.File]::ReadAllText((Join-Path $repoRoot 'VERSION'))).Trim()
if($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' -or $version -notmatch '^\d+\.\d+\.\d+$'){throw 'Invalid repository or version'}
$output=Join-Path $repoRoot "build/releases/$version"
$files=@("Keremhub-Web-$version.zip","Keremhub-Android-$version.apk","Keremhub-TizenOS-$version.wgt")
foreach($file in $files){if(!(Test-Path -LiteralPath (Join-Path $output $file))){throw "Missing download: $file"}}

# Retrieve the existing GitHub credential in memory; never print or persist it.
$env:GIT_TERMINAL_PROMPT='0'
$env:GCM_INTERACTIVE='never'
$credential=@{}
$lines="protocol=https`nhost=github.com`n`n" | & git -c credential.helper= -c credential.helper=manager credential fill
if($LASTEXITCODE -ne 0){throw 'GitHub login is required'}
foreach($line in $lines){$pair=$line -split '=',2;if($pair.Count -eq 2){$credential[$pair[0]]=$pair[1]}}
if(!$credential['password']){throw 'No GitHub credential available'}
$headers=@{Authorization='Bearer '+$credential['password'];Accept='application/vnd.github+json';'X-GitHub-Api-Version'='2022-11-28';'User-Agent'='Keremhub-release'}
$api="https://api.github.com/repos/$Repository"
$tag="v$version"
$body=@"
## Web, Android ve Tizen OS indirmeleri

| Platform | Indirme |
|---|---|
| Web / Raspberry Pi | [Keremhub-Web-$version.zip](https://github.com/$Repository/releases/download/$tag/Keremhub-Web-$version.zip) |
| Android | [Keremhub-Android-$version.apk](https://github.com/$Repository/releases/download/$tag/Keremhub-Android-$version.apk) |
| Tizen OS / Samsung | [Keremhub-TizenOS-$version.wgt](https://github.com/$Repository/releases/download/$tag/Keremhub-TizenOS-$version.wgt) |

Web ZIP: bes web servisi ve Raspberry TV koprusu. Ortam ayarlari, veritabanlari ve medya arsivleri dahil degildir.
Android APK: mevcut Android imza anahtariyla imzali.
Tizen WGT: mevcut Samsung sertifika profiliyle imzali.
"@
try{
    $release=$null
    try{$release=Invoke-RestMethod -Uri "$api/releases/tags/$tag" -Headers $headers}
    catch{if([int]$_.Exception.Response.StatusCode -ne 404){throw}}
    if(!$release){
        $payload=@{tag_name=$tag;name="Keremhub $version - Web, Android, Tizen OS";body=$body;draft=$true;prerelease=$false}|ConvertTo-Json
        $release=Invoke-RestMethod -Method Post -Uri "$api/releases" -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($payload))
    }
    foreach($name in $files){
        $file=Join-Path $output $name
        $assets=@(Invoke-RestMethod -Uri "$api/releases/$($release.id)/assets" -Headers $headers)
        foreach($old in $assets|Where-Object{$_.name -eq $name}){Invoke-RestMethod -Method Delete -Uri "$api/releases/assets/$($old.id)" -Headers $headers | Out-Null}
        $upload=($release.upload_url -replace '\{.*$','')+'?name='+[Uri]::EscapeDataString($name)
        $asset=Invoke-RestMethod -Method Post -Uri $upload -Headers $headers -ContentType 'application/octet-stream' -InFile $file -TimeoutSec 300
        if($asset.size -ne (Get-Item -LiteralPath $file).Length){throw "Upload size mismatch: $name"}
        Write-Output "Uploaded $name ($($asset.size) bytes)"
    }
    $payload=@{name="Keremhub $version - Web, Android, Tizen OS";body=$body;draft=$false;prerelease=$false}|ConvertTo-Json
    $published=Invoke-RestMethod -Method Patch -Uri "$api/releases/$($release.id)" -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($payload))
    Write-Output "Published: $($published.html_url)"
}finally{$credential.Clear();$headers.Clear();$lines=$null}
