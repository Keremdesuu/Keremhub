param([string]$TizenPackage='')
$ErrorActionPreference='Stop'
$repoRoot=Split-Path $PSScriptRoot
$version=([IO.File]::ReadAllText((Join-Path $repoRoot 'VERSION'))).Trim()
if($version -notmatch '^\d+\.\d+\.\d+$'){throw 'Invalid release version'}
& node (Join-Path $PSScriptRoot 'version.mjs') --check
if($LASTEXITCODE -ne 0){throw 'Version check failed'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$output=Join-Path $repoRoot "build/releases/$version"
New-Item -ItemType Directory -Force $output | Out-Null
$android=Join-Path $repoRoot 'apps/android/build/Keremhub.apk'
if(!$TizenPackage){$TizenPackage=Join-Path $repoRoot "apps/tizen/dist/Keremflix-$version.wgt"}
foreach($file in @($android,$TizenPackage)){if(!(Test-Path -LiteralPath $file -PathType Leaf)){throw "Build package missing: $file"}}
$tizenZip=[IO.Compression.ZipFile]::OpenRead($TizenPackage)
try{
    if(!$tizenZip.GetEntry('author-signature.xml') -or !$tizenZip.GetEntry('signature1.xml')){throw 'Tizen package must be signed before publishing'}
    $reader=[IO.StreamReader]::new($tizenZip.GetEntry('config.xml').Open())
    try{$tizenManifest=[xml]$reader.ReadToEnd()}finally{$reader.Dispose()}
    if($tizenManifest.widget.version -ne $version){throw 'Tizen package version mismatch'}
}finally{$tizenZip.Dispose()}

$stage=[IO.Path]::GetFullPath((Join-Path $output '_web-stage'))
$allowed=[IO.Path]::GetFullPath($output)+[IO.Path]::DirectorySeparatorChar
if(!$stage.StartsWith($allowed,[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid staging path'}
if(Test-Path -LiteralPath $stage){
    if((Get-Item -LiteralPath $stage).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Staging directory cannot be a link'}
    Remove-Item -LiteralPath $stage -Recurse -Force
}
New-Item -ItemType Directory -Force $stage | Out-Null
$sources=@(& git -C $repoRoot -c "safe.directory=$repoRoot" ls-files)
if($LASTEXITCODE -ne 0){throw 'Cannot enumerate tracked sources'}
foreach($relative in $sources){
    $destination=$null
    if($relative.StartsWith('services/')){$destination=$relative}
    elseif($relative -match '^apps/tizen/(server|deploy|app)/'){$destination=$relative.Replace('apps/tizen/','tv-bridge/')}
    if(!$destination){continue}
    if($destination -match '(^|/)(node_modules|data|uploads|\.private|\.tools)(/|$)|(^|/)\.env$|\.(db|sqlite|p12|pfx|jks)$'){throw "Runtime/secret file in web package: $destination"}
    $target=Join-Path $stage $destination
    New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
    Copy-Item -LiteralPath (Join-Path $repoRoot $relative) -Destination $target
}
[IO.File]::WriteAllText((Join-Path $stage 'VERSION'),$version+"`n")
$readme=@"
# Keremhub Web $version

Raspberry Pi web uygulamalari ve Samsung TV sunucu koprusu.

- services/keremhub-portal: ana portal, port 3000
- services/keremflix: film/dizi/anime ve mobil API, port 3200
- services/xxxkerem: video/fotograf, port 3300
- services/keremkitabevi: kitaplik ve Kobo, port 3002
- services/kerem-drive: dosya yonetimi, port 3400
- tv-bridge: TV sunucu API'si, altyazi donusturme ve onizleme, port 3210

Node.js 24+ kullanin. Her servisin kendi README ve deploy klasorunu izleyin.
Ilgili servis klasorunde npm ci ve npm run build calistirin.
.env.example dosyalarini yerel ayarlarla doldurun. Veritabanlari ve medya dahil degildir.

Mevcut Raspberry kurulumunda servis kaynaklarini mevcut uygulama klasorlerine esleyin.
tv-bridge, mevcut /home/kerempi/keremflix-tizen klasorunun sunucu icerigidir.
KEREMFLIX_DB mevcut Keremflix veritabanini, KEREMFLIX_UPSTREAM Keremflix API'sini gostermelidir.
TV koprusu icin Python 3, ffmpeg ve ffprobe gerekir.
Mevcut .env dosyalarini, veritabanlarini ve medya arsivlerini koruyun.

Android APK ve Samsung Tizen WGT ayni GitHub surumunde ayri indirmelerdir:
https://github.com/Keremdesuu/Keremhub/releases/tag/v$version
"@
[IO.File]::WriteAllText((Join-Path $stage 'README.md'),$readme,[Text.UTF8Encoding]::new($false))
$web=Join-Path $output "Keremhub-Web-$version.zip"
if(Test-Path -LiteralPath $web){Remove-Item -LiteralPath $web}
[IO.Compression.ZipFile]::CreateFromDirectory($stage,$web)
Copy-Item -LiteralPath $android -Destination (Join-Path $output "Keremhub-Android-$version.apk") -Force
Copy-Item -LiteralPath $TizenPackage -Destination (Join-Path $output "Keremhub-TizenOS-$version.wgt") -Force
Get-ChildItem -LiteralPath $output -File | Select-Object Name,Length
