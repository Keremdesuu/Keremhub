param([string]$Sdk = "$env:LOCALAPPDATA\Android\Sdk", [switch]$Install)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$platform = Get-ChildItem -LiteralPath "$Sdk\platforms" -Directory | Sort-Object Name -Descending | Select-Object -First 1
$tools = Join-Path $Sdk 'build-tools\36.0.0'
$androidJar = Join-Path $platform.FullName 'android.jar'
$jdk = if ($env:JAVA_HOME) { $env:JAVA_HOME } else { Split-Path (Split-Path (Get-Command javac).Source) }
$build = Join-Path $projectRoot 'build'
foreach ($leaf in @('classes','dex','generated')) {
    $target = [IO.Path]::GetFullPath((Join-Path $build $leaf))
    $allowed = [IO.Path]::GetFullPath($build) + [IO.Path]::DirectorySeparatorChar
    if (!$target.StartsWith($allowed,[StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid build output path' }
    if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
}
New-Item -ItemType Directory -Force "$build\classes", "$build\dex", "$build\generated", "$projectRoot\signing" | Out-Null
function Invoke-Checked([string]$exe, [string[]]$arguments) { & $exe @arguments; if ($LASTEXITCODE -ne 0) { throw "$exe failed ($LASTEXITCODE)" } }
Invoke-Checked "$tools\aapt2.exe" @('compile', '--dir', "$projectRoot\app\src\main\res", '-o', "$build\resources.zip")
Invoke-Checked "$tools\aapt2.exe" @('link', '-o', "$build\unsigned.apk", '-I', $androidJar, '--manifest', "$projectRoot\app\src\main\AndroidManifest.xml", '--java', "$build\generated", '--auto-add-overlay', "$build\resources.zip")
$sources = @(Get-ChildItem "$projectRoot\app\src\main\java", "$build\generated" -Filter '*.java' -Recurse | ForEach-Object { '"' + $_.FullName.Replace('\','/') + '"' })
[IO.File]::WriteAllLines("$build\sources.txt", $sources, [Text.UTF8Encoding]::new($false))
Invoke-Checked "$jdk\bin\javac.exe" @('-encoding','UTF-8','--release','17','-classpath',$androidJar,'-d',"$build\classes", "@$build\sources.txt")
Invoke-Checked "$jdk\bin\jar.exe" @('--create','--file',"$build\classes.jar",'-C',"$build\classes",'.')
Invoke-Checked "$tools\d8.bat" @('--lib',$androidJar,'--min-api','26','--output',"$build\dex", "$build\classes.jar")
Copy-Item -LiteralPath "$build\unsigned.apk" -Destination "$build\with-dex.apk" -Force
Invoke-Checked "$jdk\bin\jar.exe" @('--update','--file',"$build\with-dex.apk",'-C',"$build\dex",'classes.dex','-C',"$projectRoot\app\src\main",'assets')
Invoke-Checked "$tools\zipalign.exe" @('-f','-p','4',"$build\with-dex.apk", "$build\aligned.apk")
$key = Join-Path $projectRoot 'signing\keremhub-development.jks'
if (!(Test-Path -LiteralPath $key)) { Invoke-Checked "$jdk\bin\keytool.exe" @('-genkeypair','-keystore',$key,'-storepass','android','-keypass','android','-alias','keremhub','-keyalg','RSA','-keysize','2048','-validity','10000','-dname','CN=Keremhub Development,O=Keremhub,C=TR') }
Invoke-Checked "$tools\apksigner.bat" @('sign','--ks',$key,'--ks-key-alias','keremhub','--ks-pass','pass:android','--key-pass','pass:android','--out',"$build\Keremhub.apk", "$build\aligned.apk")
Invoke-Checked "$tools\apksigner.bat" @('verify','--verbose',"$build\Keremhub.apk")
Write-Host "APK: $build\Keremhub.apk"
if ($Install) { $env:ANDROID_USER_HOME = "$projectRoot\.android"; New-Item -ItemType Directory -Force $env:ANDROID_USER_HOME | Out-Null; Invoke-Checked "$Sdk\platform-tools\adb.exe" @('install','-r',"$build\Keremhub.apk") }
