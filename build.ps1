param([string]$Sdk="$env:LOCALAPPDATA\Android\Sdk",[switch]$Install)
$ErrorActionPreference='Stop'
& node (Join-Path $PSScriptRoot 'scripts/version.mjs') --check
if($LASTEXITCODE -ne 0){throw 'Run npm run version:sync before building'}
& (Join-Path $PSScriptRoot 'apps/android/build.ps1') -Sdk $Sdk -Install:$Install
