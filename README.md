# Nyapix

A tiny pixel or 3D companion for your desktop, with mouse and keyboard reactions,
gentle reminders, a focus timer, and customizable coats.

## Download the Windows beta

Get the installer or portable app from [GitHub Releases](https://github.com/BREACH1247/Nyapix/releases).
This release targets Windows 10/11 x64. It is unsigned and may trigger Windows
SmartScreen warnings; do not bypass your organization's security policy.
No separate Node.js installation is needed for the packaged app.
Read the [release notes](RELEASE-NOTES.md) and [privacy details](PRIVACY.md).
Agent integrations are experimental: live Codex event delivery remains unverified.

## macOS beta

Mac downloads are published separately in [GitHub Releases](https://github.com/BREACH1247/Nyapix/releases).
Choose the Apple Silicon (`arm64`) or Intel (`x64`) DMG. This initial beta targets
macOS 15+. It is ad-hoc signed, not Apple-notarized. See
[Mac installation, permissions, and limitations](MAC-RELEASE-NOTES.md).
On a Mac, `npm run dist:mac` builds the native DMG. The `mac-v*` tag workflow
builds and checks both architectures before publishing either download.

## Develop locally

For source development, install Node.js 22, run `npm ci`, then `npm start`.
Right-click the pet or use the tray menu to open settings.

Run `npm run preview` and open http://127.0.0.1:4173 for the live settings preview.
The playground at http://127.0.0.1:4173/preview/ lets you drag, pet, type, scroll,
and try agent reactions. Browser settings are temporary; desktop settings save automatically.

## Art and motion

Both companions offer articulated 32 × 32 pixel art and a real-time Three.js
3D mode. Switch styles in settings while keeping your companion's appearance.

The cat lives in `src/cat/art.js`; the dog in `src/cat/dog-art.js`. The dog has
independent floppy ears, head tilts, tail wagging, panting, sniffing, paw waves,
play bows, typing, drinking, and sleeping poses. Six dog coats and patterns,
a customizable collar, and separate saved looks make switching companions easy.

`src/cat/engine.js` handles eye tracking, blinking, breathing, mochi dragging,
walking, typing, heat, floating hearts, reminders, and agent reactions. Stretching
eases into its pose, and celebration hops begin with a small anticipation squash.

Settings have Companion, Rituals, Desktop, and Agents tabs, with a live preview
and reaction buttons. The preview can demonstrate reactions while the desktop
pet is paused; it does not start the real reminders or focus timer.

## Coding agents

Open the **Agents** tab in the desktop app and choose **Connect** for Claude Code,
Codex, or Cursor. This installs observational user-level hooks. Existing settings
and hooks are preserved, and a timestamped backup is created before a config is
changed. **Disconnect** removes only Nyapix's entries. Source builds require
Node.js on PATH; packaged builds use the bundled relay. If you move the portable
folder, reconnect your integrations to update their saved path.
Restart the connected harness. In Codex, use `/hooks` to review and trust the new
definitions; Nyapix never changes hook-trust or permission settings for you.

The connection uses documented lifecycle events:

- Claude Code: prompt/tool activity, permission requests, stop/failure, and session end.
- Codex: prompt/tool activity, permission requests, stop, interrupt, and session end.
- Cursor: prompt/tool activity, thought-completed status, assistant responses, stop, and session end.

Reply text comes from `last_assistant_message` for Claude Code/Codex and
`afterAgentResponse.text` for Cursor. This is event-based output, not token-by-token
streaming or a second chat client. Full chat input and history remain in the harness.
Only user-facing replies are copied; thinking text, prompts, tool contents, and
transcript paths are discarded. Output excerpts are capped at 800 characters in
the activity list and 220 in desktop bubbles. Disable **Show reply excerpts** to
clear existing excerpts and receive status-only updates. Completion sounds are
off by default and respect the master companion-sound setting.

The relay posts to an authenticated loopback-only connection. It keeps no response
logs: the last 20 events live in memory until cleared or Nyapix exits. Connection
metadata and the relay live under `~/.nyapix/`; hooks go in `~/.claude/settings.json`,
`~/.codex/hooks.json`, and `~/.cursor/hooks.json`. Nothing is installed by running
the preview or the test suite. Browser preview connection buttons are disabled.

Each session is tracked separately. A completed task cannot end another active
task's thinking pose. Quiet files never count as completion; a missing signal
expires to idle after 30 minutes. Hooks fail open when the app is closed. This
replaces the previous log-modification heuristic in the active application.

The integration follows the official [Claude Code hook reference](https://code.claude.com/docs/en/hooks),
[Codex hook reference](https://learn.chatgpt.com/docs/hooks), and
[Cursor hook reference](https://cursor.com/docs/hooks). Hook availability depends
on the installed harness version. Remote/cloud agents need a local connection;
this bridge does not connect to a remote machine.

## Verify and package

`npm run test:ui` runs the real Electron renderers in a hidden window with a
temporary settings bridge. It checks reactions, distinct coat patterns, tab
navigation, settings writes, reminder text, hit testing, layout, pet switching,
desktop rendering, dragging, and the preview focus timer.

`npm run test:agents` verifies provider payloads, concurrent tasks, privacy toggles,
configuration preservation, backups, fail-open relay behavior, and the actual
authenticated HTTP transport in temporary test directories. These checks use
representative documented payloads; they do not launch paid agent sessions.

`npm test` runs all seven suites. `npm run dist` builds the Windows x64 installer
and portable ZIP. Extract the entire ZIP before running `Nyapix.exe`.
`node scripts/verify-package.cjs` checks the packaged runtime
and relay, and `npm run release:checksums` generates SHA-256 checksums.
Pushing a version-matching `v*` tag runs these checks on GitHub Actions and
publishes an unsigned Windows prerelease. Mac releases use the separate workflow
above. Linux packages are not released.

## Appearance and music

## Companion controls

- Right-click the pet for style, pause, mute, focus timer, quiet mode, routines,
  screen/corner selection, and settings. The tray also opens Settings and can
  turn off quiet modes if the pet is hidden.
- Companion settings include a pet name, collar/bow/bandana, up to 12 saved looks,
  and optional idle grooming, tail chasing, toy carrying, and curled sleep.
- Music personalities: sway, head bob, or dance. These are playback-aware,
  not beat-synchronized.
- Desktop settings select a monitor and corner. Missing monitors fall back to
  the primary display. Pets remain on the chosen screen; dragging between
  monitors is not supported.
- Windows quiet mode detects foreground fullscreen windows, presentation mode,
  and away/locked state without reading window titles. Manual and Pomodoro
  quiet modes are available too. Quiet hides the pet and suppresses reminder
  pop-ups and sounds; suppressed scheduled reminders are not replayed.
- Agent editing/testing poses are inferred from tool metadata, with thinking
  as the fallback. No commands or tool arguments are forwarded. Existing
  connections can use **Agents → Update reactions** to update the relay.
  Hook installation is not proof of live delivery: Codex hook trust still
  needs review via `/hooks`, and the previous live Codex test did not deliver
  events. Demo reactions remain explicitly labeled.


Choose Pixel or 3D in Companion settings. Theme offers Light, Dark, or System;
the desktop app remembers these choices. Typing particles scale with pet size.

Vibe with Spotify is an opt-in, local Windows desktop-player integration. It
reads Spotify's Windows media-session title, artist, and playback state every
three seconds. It does not record audio, access your account, save listening
history, or modify playback. Browser Spotify and other operating systems are
not currently supported. Swaying follows play/pause, not the song's BPM or
audio energy. Agent work and other reactions take priority over dancing.
The browser preview includes a six-second demo, clearly separate from live
playback. If unavailable, toggle the connection off and on to retry.
