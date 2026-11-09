param([string]$MonitorIp = '192.168.1.2', [string]$CertificateProfile = 'KeremflixSamsung')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$sdb = Join-Path $projectRoot '.tools/sdk/data/tools/sdb.exe'
$serial = "${MonitorIp}:26101"
$appId = 'Keremflix1.Keremflix'
$version = ([xml](Get-Content -LiteralPath (Join-Path $projectRoot 'app/config.xml') -Raw)).widget.version
$packageName = "Keremflix-$version.wgt"
$remote = "/home/owner/share/tmp/sdk_tools/tmp/$packageName"
if (-not (Test-Path -LiteralPath $sdb)) { throw 'Local SDB tools not found.' }
& npm.cmd --prefix $projectRoot run build
if ($LASTEXITCODE -ne 0) { throw 'Application build failed.' }
& $sdb connect $serial
if ($LASTEXITCODE -ne 0) { throw 'Monitor connection failed.' }
& (Join-Path $PSScriptRoot 'package.ps1') -CertificateProfile $CertificateProfile
if ($LASTEXITCODE -ne 0) { throw 'Package signing failed.' }
& (Join-Path $PSScriptRoot 'tizen.ps1') -CliArguments @('install-permit','-s',$serial)
if ($LASTEXITCODE -ne 0) { throw 'Application install permission failed.' }
$packagePath = Join-Path $projectRoot "dist/$packageName"
& $sdb -s $serial push $packagePath $remote
if ($LASTEXITCODE -ne 0) { throw 'Package transfer failed.' }
$installation = & $sdb -s $serial shell 0 vd_appinstall $appId $remote
$installation | Write-Output
if (($installation -join "`n") -notmatch 'install completed') { throw 'Monitor did not confirm installation.' }
$launch = & $sdb -s $serial shell 0 execute $appId
$launch | Write-Output
if (($launch -join "`n") -notmatch 'successfully launched') { throw 'Monitor did not confirm application launch.' }
