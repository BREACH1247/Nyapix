# Nyapix privacy

Nyapix has no analytics service, advertising SDK, account system, or listening-history upload.

## What the app uses

- Global mouse position, key events, and scrolling animate the pet. Key labels
  exist briefly in memory for typing effects; Nyapix does not save a key log.
  Input listeners can still receive events while reactions are paused or hidden.
  Quit Nyapix from its tray to stop input listeners completely.
- Preferences, favorite looks, and an optional calendar URL are stored locally
  in `%APPDATA%\Nyapix`. Preferences are not encrypted; treat private calendar
  URLs as secrets and do not include your settings file in bug reports.
  On macOS, preferences are in `~/Library/Application Support/Nyapix` instead.
  Global typing/scroll reactions on macOS require optional system permission;
  Nyapix does not automatically grant or bypass that permission.
- Spotify support reads title, artist, and playback state from Windows media
  sessions when enabled. It does not record audio or access a Spotify account.
- Agent connections add opt-in local hooks and an authenticated loopback bridge.
  The relay forwards status, session identifiers, a derived activity label, and
  a limited final/reply excerpt. It does not forward prompts, command arguments,
  private reasoning, or whole transcripts. Recent agent messages remain in memory.
  Turn off output sharing in Agents to redact excerpts, or disconnect an agent.
- Quiet-mode detection reads Windows notification state and foreground window
  geometry/class, not window titles, screen contents, or documents.

## Network access

An optional calendar URL is fetched directly from its HTTPS provider. Agent
events use only the local loopback network. Checking releases opens GitHub in
your browser; GitHub's own policies apply. This beta has no automatic updater.

## Removal

Disconnect agents in Nyapix before uninstalling; this preserves unrelated hooks
and removes Nyapix's registrations. Existing hook configuration backups and the
relay live in your home directory. Uninstall preserves preferences so upgrades
do not erase your pet. After quitting/uninstalling, delete `%APPDATA%\Nyapix`
and `%USERPROFILE%\.nyapix` if you want to remove Nyapix's remaining local data.
Do not delete `.codex`, `.claude`, or `.cursor` directories.
On macOS, the equivalent retained locations are `~/Library/Application Support/Nyapix`
and `~/.nyapix`. Revoke Nyapix's Accessibility/Input Monitoring access in System
Settings if previously granted.
