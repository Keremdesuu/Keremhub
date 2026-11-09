param(
    [string]$Sdk = "$env:LOCALAPPDATA\Android\Sdk",
    [string]$Serial = 'emulator-5554',
    [switch]$Install,
    [switch]$LibraryOnly,
    [string]$TapLabel,
    [string]$SnapshotName,
    [int]$Key = 0,
    [ValidateSet('','portrait','landscape')][string]$Orientation = ''
)
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot
$env:ANDROID_USER_HOME = Join-Path $project '.android'
$adb = Join-Path $Sdk 'platform-tools\adb.exe'
$capture = Join-Path $project 'build\native-qa'
New-Item -ItemType Directory -Force -Path $capture | Out-Null
function Device {
    $result = & $adb -s $Serial @args
    if ($LASTEXITCODE -ne 0) { throw "adb failed: $($args -join ' ')" }
    return $result
}
function State {
    for ($stateAttempt = 0; $stateAttempt -lt 5; $stateAttempt++) {
        $script:dumpNo++
        $remote = "/sdcard/keremhub-qa-$PID-$($script:dumpNo).xml"
        try {
            Device @('shell','uiautomator','dump',$remote) | Out-Null
            [xml]$ui = (Device @('shell','cat',$remote)) -join "`n"
            if ($ui.SelectNodes('//node[@package="com.keremhub.app"]').Count -gt 0) { return $ui }
        } catch { if ($stateAttempt -eq 4) { throw } }
    }
    throw 'The native application did not become foreground-ready.'
}
function Tap([string]$Label) {
    $match = @()
    for ($attempt = 0; $attempt -lt 5 -and $match.Count -eq 0; $attempt++) {
        $ui = State
        $match = @($ui.SelectNodes('//node') | Where-Object { $_.'content-desc' -eq $Label -or $_.text -eq $Label })
    }
    if ($match.Count -eq 0) { throw "Visible native element not found: $Label" }
    $node = $match | Where-Object { $_.clickable -eq 'true' } | Select-Object -First 1
    if ($null -eq $node) { $node = $match[0] }
    if ($node.bounds -notmatch '\[(\d+),(\d+)\]\[(\d+),(\d+)\]') { throw "Missing bounds: $Label" }
    $x = [int](([int]$Matches[1] + [int]$Matches[3]) / 2)
    $y = [int](([int]$Matches[2] + [int]$Matches[4]) / 2)
    Device @('shell','input','tap',"$x","$y") | Out-Null
}
function Capture([string]$Name) {
    $ui = State
    Device @('shell','screencap','-p',"/sdcard/$Name.png") | Out-Null
    Device @('pull',"/sdcard/$Name.png",(Join-Path $capture "$Name.png")) | Out-Null
    if ($ui.SelectNodes('//node[@class="android.webkit.WebView"]').Count -gt 0) { throw "Unexpected WebView on $Name" }
    $nodes = @($ui.SelectNodes('//node') | Where-Object { $_.package -eq 'com.keremhub.app' })
    if ($nodes.Count -eq 0) { throw "App not in foreground: $Name" }
    Write-Host "PASS $Name ($($nodes.Count) native views)"
}
if ($LibraryOnly) { return }
if ($Orientation) {
    if (-not $Serial.StartsWith('emulator-')) { throw 'Orientation override is restricted to test emulators.' }
    Device @('shell','settings','put','system','accelerometer_rotation','0') | Out-Null
    $rotation = if ($Orientation -eq 'landscape') { '1' } else { '0' }
    Device @('shell','settings','put','system','user_rotation',$rotation) | Out-Null
}
if ($TapLabel -or $SnapshotName -or $Key -ne 0) {
    if ($Key -ne 0) { Device @('shell','input','keyevent',"$Key") | Out-Null }
    if ($TapLabel) { Tap $TapLabel }
    if ($SnapshotName) { Capture $SnapshotName }
    $ui = State
    $ui.SelectNodes('//node') | Where-Object { $_.'content-desc' -ne '' -or ($_.text -ne '' -and $_.clickable -eq 'true') } | ForEach-Object {
        [pscustomobject]@{ text=$_.text; label=$_.'content-desc'; bounds=$_.bounds }
    } | ConvertTo-Json -Compress | Write-Host
    return
}
if ($Install) { Device @('install','-r',(Join-Path $project 'build\Keremhub.apk')) | Out-Host }
Device @('shell','am','force-stop','com.keremhub.app') | Out-Null
Device @('shell','am','start','-W','-n','com.keremhub.app/.MainActivity') | Out-Host
$suffix = if ($Orientation) { "-$Orientation" } else { '' }
Capture ("portal$suffix")
foreach ($service in @('Keremflix','xxxkerem','Kerem Kitabevi','Kerem Drive')) {
    Tap ("$service a" + [char]0xE7)
    Capture ($service.Replace(' ','-') + $suffix)
    # All service entry pages return to the remembered native portal.
    Device @('shell','input','keyevent','4') | Out-Null
}
$crash = (Device @('logcat','-d','-b','crash','-t','200')) -join "`n"
if ($crash -match 'Process: com\.keremhub\.app') { throw $crash }
Write-Host 'PASS startup + four native services; no package crash in crash buffer.'
