param([Parameter(ValueFromRemainingArguments = $true)][string[]]$CliArguments)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$sdkRoot = Join-Path $projectRoot '.tools/sdk/data'
$java = Join-Path $sdkRoot 'jdk/bin/java.exe'
$cliRoot = Join-Path $sdkRoot 'tools/ide'
if (-not (Test-Path -LiteralPath $java)) { throw 'Yerel Tizen araçları bulunamadı.' }
$classPath = (Join-Path $cliRoot 'conf-ncli') + ';' + (Join-Path $cliRoot 'lib-ncli/*')
$spawner = Join-Path $cliRoot 'lib-ncli/spawner'
& $java '-Duser.language=en' '-Duser.country=US' '-Dlog4j.configuration=log4j-progress.xml' "-Djava.library.path=$spawner" '-cp' $classPath 'org.tizen.ncli.ide.shell.Main' @CliArguments
exit $LASTEXITCODE
