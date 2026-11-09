param([string]$Sdk="$env:LOCALAPPDATA\Android\Sdk")
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot
$output=Join-Path $project 'build\flix-feature-test'
New-Item -ItemType Directory -Force $output,"$output\classes","$output\dex" | Out-Null
$env:ANDROID_USER_HOME=Join-Path $project '.android'
Invoke-RestMethod -Method POST 'http://127.0.0.1:18765/test-reset' | Out-Null
$adb=Join-Path $Sdk 'platform-tools\adb.exe'
$tools=Join-Path $Sdk 'build-tools\36.0.0'
$androidJar=(Get-ChildItem "$Sdk\platforms" -Filter android.jar -Recurse | Select-Object -First 1).FullName
$jdk=Split-Path (Split-Path (Get-Command javac).Source)
function Checked([string]$exe,[string[]]$arguments){ & $exe @arguments; if($LASTEXITCODE -ne 0){throw "$exe failed"} }
$manifest='<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.keremhub.test"><uses-sdk android:minSdkVersion="26" android:targetSdkVersion="35"/><application android:label="Keremflix feature tests"/><instrumentation android:name="com.keremhub.test.FlixFeatureTest" android:targetPackage="com.keremhub.app" android:functionalTest="true"/></manifest>'
[IO.File]::WriteAllText("$output\AndroidManifest.xml",$manifest)
Checked "$tools\aapt2.exe" @('link','-o',"$output\base.apk",'-I',$androidJar,'--manifest',"$output\AndroidManifest.xml")
Checked "$jdk\bin\javac.exe" @('-encoding','UTF-8','--release','17','-classpath',"$androidJar;$project\build\classes",'-d',"$output\classes","$PSScriptRoot\FlixFeatureTest.java")
Checked "$jdk\bin\jar.exe" @('--create','--file',"$output\test.jar",'-C',"$output\classes",'.')
Checked "$tools\d8.bat" @('--lib',$androidJar,'--min-api','26','--output',"$output\dex","$output\test.jar")
Checked "$jdk\bin\jar.exe" @('--update','--file',"$output\base.apk",'-C',"$output\dex",'classes.dex')
Checked "$tools\zipalign.exe" @('-f','4',"$output\base.apk","$output\aligned.apk")
Checked "$tools\apksigner.bat" @('sign','--ks',"$project\signing\keremhub-development.jks",'--ks-key-alias','keremhub','--ks-pass','pass:android','--key-pass','pass:android','--out',"$output\test.apk","$output\aligned.apk")
Checked $adb @('-s','emulator-5554','reverse','tcp:18765','tcp:18765')
Checked $adb @('-s','emulator-5554','install','-r',"$project\build\Keremhub.apk")
Checked $adb @('-s','emulator-5554','install','-r',"$output\test.apk")
Checked $adb @('-s','emulator-5554','shell','am','force-stop','com.keremhub.app')
Checked $adb @('-s','emulator-5554','shell','settings','put','system','user_rotation','0')
$result=& $adb -s emulator-5554 shell am instrument -w com.keremhub.test/com.keremhub.test.FlixFeatureTest
$result | Write-Host
Checked $adb @('-s','emulator-5554','pull','/sdcard/Android/data/com.keremhub.app/files/flix-feature-qa',"$output\screenshots")
if(($result -join "`n") -notmatch 'PASS metadata/reset'){throw 'Feature instrumentation failed'}
$state=Invoke-RestMethod 'http://127.0.0.1:18765/test-state'
if(!$state.matched -or !$state.reset -or $state.writes.Count -ne 2){throw 'Unexpected mock writes'}
Write-Host 'PASS exact metadata POST and progress DELETE payloads; no writes forwarded to LAN server'
