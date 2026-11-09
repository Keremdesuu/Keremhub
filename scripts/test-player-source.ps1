param([string]$VideoUrl = '')
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot
$output = Join-Path $project 'build/range-tests'
New-Item -ItemType Directory -Force -Path $output | Out-Null
# JVM-only declaration of Android's abstract contract, generated outside app sources.
$stub = Join-Path $output 'MediaDataSource.java'
[IO.File]::WriteAllText($stub, 'package android.media; public abstract class MediaDataSource implements java.io.Closeable { public abstract int readAt(long p, byte[] b, int o, int n) throws java.io.IOException; public abstract long getSize() throws java.io.IOException; }')
& javac --release 17 --add-modules jdk.httpserver -d $output $stub (Join-Path $project 'app/src/main/java/com/keremhub/app/RangeMediaSource.java') (Join-Path $PSScriptRoot 'RangeMediaSourceTest.java')
if ($LASTEXITCODE -ne 0) { throw 'Test compilation failed' }
& java --add-modules jdk.httpserver -cp $output com.keremhub.app.RangeMediaSourceTest $VideoUrl
if ($LASTEXITCODE -ne 0) { throw 'Player source tests failed' }
