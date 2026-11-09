param([Parameter(ValueFromRemainingArguments = $true)][string[]]$SdbArguments)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$sdb = Join-Path $projectRoot '.tools/sdk/data/tools/sdb.exe'
if (-not (Test-Path -LiteralPath $sdb)) { throw 'Yerel SDB aracı bulunamadı.' }
& $sdb @SdbArguments
exit $LASTEXITCODE
