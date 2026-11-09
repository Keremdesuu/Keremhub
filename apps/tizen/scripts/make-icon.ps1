$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    & node scripts/make-icon.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Icon generation failed.' }
} finally { Pop-Location }
