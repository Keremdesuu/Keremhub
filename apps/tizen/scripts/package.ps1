param([string]$TizenCli = '', [string]$CertificateProfile = '')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$appPath = Join-Path $projectRoot 'app'
$outputPath = Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
$version = ([xml](Get-Content -LiteralPath (Join-Path $appPath 'config.xml') -Raw)).widget.version
$packageName = if ($CertificateProfile) { "Keremflix-$version.wgt" } else { "Keremflix-$version-unsigned.wgt" }
$packagePath = Join-Path $outputPath $packageName
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path -LiteralPath $packagePath) { Remove-Item -LiteralPath $packagePath }
[System.IO.Compression.ZipFile]::CreateFromDirectory($appPath, $packagePath)
if ($CertificateProfile) {
    if (-not $TizenCli -and (Test-Path -LiteralPath (Join-Path $projectRoot '.tools/sdk/data/jdk/bin/java.exe'))) {
        & (Join-Path $PSScriptRoot 'tizen.ps1') -CliArguments @('package','-t','wgt','-s',$CertificateProfile,'--',$packagePath)
    } else {
      if (-not $TizenCli) {
        $cliCommand = Get-Command tizen -ErrorAction SilentlyContinue
        if (-not $cliCommand) { throw 'Tizen CLI not found. Provide -TizenCli with the path to tizen.bat.' }
        $TizenCli = $cliCommand.Source
      }
      & $TizenCli package -t wgt -s $CertificateProfile -- $packagePath
    }
    if ($LASTEXITCODE -ne 0) { throw 'Samsung certificate signing failed.' }
    $signedZip = [System.IO.Compression.ZipFile]::OpenRead($packagePath)
    try {
        if (-not $signedZip.GetEntry('author-signature.xml') -or -not $signedZip.GetEntry('signature1.xml')) { throw 'The package is missing its signatures.' }
    } finally { $signedZip.Dispose() }
    Write-Host "Signed package: $packagePath"
} else {
    Write-Host "Unsigned package: $packagePath"
    Write-Host 'Sign this package with a Samsung certificate profile before installing it on a monitor.'
}
