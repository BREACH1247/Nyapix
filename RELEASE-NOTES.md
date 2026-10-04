# Nyapix 0.1.3 — Windows beta

## New: interactive fetch

Right-click your pet → **Play fetch / put toy away**. Drag the purple toy and
release to throw it. Your cat or dog chases it, picks it up, and returns to its
starting position. The toy stays ready for another throw. Works in Pixel and 3D.
Throws stay on the selected screen; quiet mode, pausing, and agent reactions
cancel the game. Use the same menu item to put the toy away.

Pixel and real-time 3D cats and dogs for your desktop: idle routines, eye
tracking, typing/scroll reactions, accessories, saved looks, focus timers,
reminders, light/dark themes, Spotify playback reactions, and screen homes.

## Downloads

- **Nyapix-0.1.3-x64-nsis.exe**: recommended installer, per-user by default.
- **Nyapix-0.1.3-x64-portable.zip**: extract the entire folder, then run
  `Nyapix.exe`. Keep the folder at a stable location if connecting coding agents.
  This no-install edition still saves preferences in AppData.
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
- Mac downloads are in the separate macOS beta release. Linux is not released.

## Install / update / uninstall

Run the installer, then launch Nyapix. Right-click the pet for quick controls;
double-click its tray icon for Settings. Quit the app before installing a newer
version. Preferences are retained. Disconnect agent integrations before
uninstalling from Windows Settings → Apps. See PRIVACY.md for retained-data details.

Report problems at https://github.com/BREACH1247/Nyapix/issues with Windows
version, app version, Pixel/3D mode, and reproduction steps. Never attach tokens,
private calendar URLs, agent transcripts, or your full settings file.
