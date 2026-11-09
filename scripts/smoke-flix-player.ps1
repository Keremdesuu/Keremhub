param([string]$Sdk = "$env:LOCALAPPDATA\Android\Sdk", [string]$Serial = 'emulator-5554')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'smoke-native.ps1') -Sdk $Sdk -Serial $Serial -LibraryOnly
function LastFrame {
    $lines = (Device @('logcat','-d','-s','KeremhubPlayer:I','*:S'))
    return ($lines | Where-Object { $_ -match 'First frame episode \d+ in \d+ ms' } | Select-Object -Last 1)
}
function AwaitFrame([string]$Before) {
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    do {
        $line = LastFrame
        if ($line -and $line -ne $Before) { Write-Host "PASS $line"; return $line }
        Start-Sleep -Milliseconds 500
    } while ([DateTime]::UtcNow -lt $deadline)
    throw 'No new rendered video frame within 30 seconds'
}
function AssertControls([string]$Name) {
    # A fresh emulator may show Android's first-use fullscreen coaching overlay.
    $remote='/sdcard/flix-fullscreen-coach.xml'
    Device @('shell','uiautomator','dump',$remote) | Out-Null
    [xml]$raw=(Device @('shell','cat',$remote)) -join "`n"
    $coach=$raw.SelectNodes('//node') | Where-Object { $_.'resource-id' -eq 'com.android.systemui:id/ok' } | Select-Object -First 1
    if($coach -and $coach.bounds -match '\[(\d+),(\d+)\]\[(\d+),(\d+)\]'){
        $cx=[int](([int]$Matches[1]+[int]$Matches[3])/2);$cy=[int](([int]$Matches[2]+[int]$Matches[4])/2)
        Device @('shell','input','tap',"$cx","$cy") | Out-Null
    }
    $ui = State
    foreach ($label in @($script:previousLabel,$script:nextLabel)) {
        $node = $ui.SelectNodes('//node') | Where-Object { $_.'content-desc' -eq $label } | Select-Object -First 1
        if (!$node) { throw "Missing episode button: $label" }
        if ($node.bounds -notmatch '\[(\d+),(\d+)\]\[(\d+),(\d+)\]' -or [int]$Matches[3] -le [int]$Matches[1]) { throw 'Episode button has no visible bounds' }
    }
    Capture $Name
}
$previousLabel = [string][char]0xD6 + 'nceki b' + [char]0xF6 + 'l' + [char]0xFC + 'm'
$nextLabel = 'Sonraki b' + [char]0xF6 + 'l' + [char]0xFC + 'm'
Device @('install','-r',(Join-Path $project 'build/Keremhub.apk')) | Out-Host
Device @('shell','am','force-stop','com.keremhub.app') | Out-Null
Device @('shell','settings','put','system','accelerometer_rotation','0') | Out-Null
Device @('shell','settings','put','system','user_rotation','0') | Out-Null
Device @('shell','am','start','-W','-n','com.keremhub.app/.MainActivity') | Out-Null
Tap ('Keremflix a' + [char]0xE7)
$before = LastFrame
Tap 'Oynat'
$first = AwaitFrame $before
if ($first -notmatch 'First frame episode (\d+)') { throw 'Missing episode ID' }
$firstId = $Matches[1]
Device @('shell','input','keyevent','85') | Out-Null
AssertControls 'flix-player-automatic-landscape'
$initialUi = State
if ($initialUi.hierarchy.rotation -ne '1') { throw 'Playback did not open automatically in landscape' }
Tap 'Tam ekran'
AssertControls 'flix-player-portrait'
$before = LastFrame
Tap $nextLabel
$second = AwaitFrame $before
if ($second -match "First frame episode $firstId in") { throw 'Next button did not change episode' }
Device @('shell','input','keyevent','85') | Out-Null
AssertControls 'flix-player-next'
Tap 'Tam ekran'
AssertControls 'flix-player-landscape'
$before = LastFrame
Tap $previousLabel
$third = AwaitFrame $before
if ($third -notmatch "First frame episode $firstId in") { throw 'Previous button did not return to original episode' }
Device @('shell','input','keyevent','85') | Out-Null
AssertControls 'flix-player-previous-landscape'
$landscapeUi = State
if ($landscapeUi.hierarchy.rotation -ne '1') { throw 'Episode switch lost landscape orientation' }
# Exit fullscreen, then return once to the originating page (no intervening player history).
Device @('shell','input','keyevent','4') | Out-Null
Device @('shell','input','keyevent','4') | Out-Null
$ui = State
if ($ui.SelectNodes('//node') | Where-Object { $_.'content-desc' -eq 'Ortadan oynat / duraklat' }) { throw 'Back returned to another episode player' }
$crash = (Device @('logcat','-d','-b','crash','-t','200')) -join "`n"
if ($crash -match 'Process: com\.keremhub\.app') { throw $crash }
Write-Host 'PASS real video frames, next/previous, portrait/landscape controls, preserved fullscreen and back history'
