# Nyapix 0.1.0 — Windows beta

Pixel and real-time 3D cats and dogs for your desktop: idle routines, eye
tracking, typing/scroll reactions, accessories, saved looks, focus timers,
reminders, light/dark themes, Spotify playback reactions, and screen homes.

## Downloads

- **Nyapix-0.1.0-x64-nsis.exe**: recommended installer, per-user by default.
- **Nyapix-0.1.0-x64-portable.exe**: no installer; keep it at a stable location
  if connecting coding agents. Portable mode still saves preferences in AppData.
- **SHA256SUMS.txt**: verify downloads using PowerShell `Get-FileHash`.

Windows 10/11 x64. No separate Node.js installation is required by the packaged
app or its agent relay. Windows PowerShell is used for optional Spotify/quiet
features. Use GitHub Releases downloads, not GitHub's source ZIP, to run the app.

## Important beta limitations

- **Unsigned**: Windows may show an unknown-publisher/SmartScreen warning.
  Signing is not configured. Only download from BREACH1247/Nyapix releases.
  If your organization blocks unsigned apps, do not bypass its policy.
- **Codex live delivery is not yet verified.** Installed hooks and demo poses
  are not proof of connection. Review/trust hooks using `/hooks` when prompted.
  Agent integrations are experimental; relay and rendering tests pass, but the
  last real Codex test completed without delivering hooks.
- Spotify reacts to play/pause, not BPM. Desktop Spotify on Windows only.
- Quiet mode may hide the pet in fullscreen. Use tray **Show companion** to
  turn quiet modes off. Suppressed reminders are not replayed.
- No automatic update installation. Download the next installer from Releases.
- macOS/Linux packages are not included or advertised as tested.

## Install / update / uninstall

Run the installer, then launch Nyapix. Right-click the pet for quick controls;
double-click its tray icon for Settings. Quit the app before installing a newer
version. Preferences are retained. Disconnect agent integrations before
uninstalling from Windows Settings → Apps. See PRIVACY.md for retained-data details.

Report problems at https://github.com/BREACH1247/Nyapix/issues with Windows
version, app version, Pixel/3D mode, and reproduction steps. Never attach tokens,
private calendar URLs, agent transcripts, or your full settings file.
