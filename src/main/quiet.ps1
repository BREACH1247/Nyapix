param([switch]$Once)
$ErrorActionPreference = 'Stop'
Add-Type @'
using System.Runtime.InteropServices;
using System;
using System.Text;
public static class NyapixQuiet {
  [DllImport("shell32.dll")] public static extern int SHQueryUserNotificationState(out int state);
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct MonitorInfo { public int Size; public Rect Monitor,Work; public int Flags; }
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window, out Rect rect);
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr window, int flags);
  [DllImport("user32.dll", CharSet=CharSet.Auto)] static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);
  [DllImport("user32.dll", CharSet=CharSet.Auto)] static extern int GetClassName(IntPtr window, StringBuilder name, int count);
  public static bool ForegroundFullscreen() {
    var window=GetForegroundWindow(); var name=new StringBuilder(256);GetClassName(window,name,256);
    if(name.ToString()=="Progman" || name.ToString()=="WorkerW" || name.ToString()=="Shell_TrayWnd")return false;
    Rect rect; var info=new MonitorInfo();info.Size=Marshal.SizeOf(info);
    if(!GetWindowRect(window,out rect) || !GetMonitorInfo(MonitorFromWindow(window,2),ref info))return false;
    return rect.Left<=info.Monitor.Left && rect.Top<=info.Monitor.Top && rect.Right>=info.Monitor.Right && rect.Bottom>=info.Monitor.Bottom;
  }
}
'@
do {
  $state = 5
  $result = [NyapixQuiet]::SHQueryUserNotificationState([ref]$state)
  @{ available = ($result -eq 0); quiet = ($result -eq 0 -and ($state -in @(1,3,4) -or [NyapixQuiet]::ForegroundFullscreen())); reason = $(if ($state -eq 4) { 'presentation' } elseif ($state -eq 1) { 'away' } else { 'fullscreen' }) } | ConvertTo-Json -Compress
  if (-not $Once) { Start-Sleep -Seconds 2 }
} while (-not $Once)
