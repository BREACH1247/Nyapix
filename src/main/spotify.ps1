param([switch]$Once)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
function Await-Media($operation, $resultType) {
  $task = $asTask.MakeGenericMethod($resultType).Invoke($null, @($operation))
  if (-not $task.Wait(5000)) { throw 'Media session timed out' }
  $task.Result
}
try {
  $manager = Await-Media ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
  do {
    $sessions = @($manager.GetSessions() | Where-Object { $_.SourceAppUserModelId -match 'Spotify' })
    $session = $sessions | Sort-Object { $_.GetPlaybackInfo().PlaybackStatus -eq 'Playing' } -Descending | Select-Object -First 1
    if ($session) {
      $media = Await-Media ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
      @{ state = 'ready'; playing = ($session.GetPlaybackInfo().PlaybackStatus -eq 'Playing'); title = $media.Title; artist = $media.Artist } | ConvertTo-Json -Compress
    } else { '{"state":"waiting","playing":false}' }
    if (-not $Once) { Start-Sleep -Seconds 3 }
  } while (-not $Once)
} catch { '{"state":"unavailable","playing":false}'; exit 1 }
