# Nyapix 0.1.2 — macOS beta

Pixel and 3D cats and dogs, custom appearances, reminders, focus timers,
idle routines, monitor homes, and experimental local agent reactions.

## Downloads

- **Nyapix-0.1.2-mac-arm64.dmg**: Apple Silicon (M-series) Macs.
- **Nyapix-0.1.2-mac-x64.dmg**: Intel Macs.
- **SHA256SUMS-mac.txt**: download checksums.

This initial beta requires **macOS 15 or newer**. Open the DMG, drag Nyapix
to Applications, eject the disk, and launch Nyapix from Applications.
No separate Node.js installation or Apple Developer account is needed.

## macOS security and optional permissions

The app is **ad-hoc signed, not Developer ID-signed or Apple-notarized**.
The signature checks file integrity but does not verify the publisher's identity.
macOS may block first launch. Only if you trust this download, follow
[Apple's per-app approval guidance](https://support.apple.com/102445).
Do not disable Gatekeeper globally or bypass your organization's policies.

Basic companionship, cursor following, and focus tools do not require global
keyboard monitoring. For global typing/scroll reactions, use Nyapix's menu-bar
menu → **Enable keyboard / scroll reactions…**, grant Accessibility access
in System Settings, and grant Input Monitoring if macOS requests it. Quit and
reopen Nyapix afterward. Permission is optional and is never granted automatically.

## What is and is not verified

Release automation checks both architectures on macOS 15 runners: core/UI tests,
native-module loading, pixel rendering, local relay delivery, ad-hoc signature
integrity, DMG verification, and the app copied out of the DMG.
Apple Silicon additionally runs the full 3D, polish, and routines test suites.
This does not replace testing a quarantined download on a person's Mac.
**Intel 3D rendering is not verified**: the Intel CI machine cannot create a
WebGL context. Its packaged tests instead verify the automatic pixel fallback.
On an Intel Mac, 3D requires a working WebGL graphics driver; pixel mode remains
available. No graphics-security overrides are enabled in the app.
Global input capture is not tested when macOS permission is unavailable.

- Spotify reactions and automatic fullscreen/presentation detection remain
  Windows-only. Manual quiet mode and focus-session quiet mode are available.
- Agent integrations remain experimental. Synthetic relay delivery is checked;
  live Codex hook delivery has not been verified. Install to Applications before
  connecting agents; reconnect them if you move the app.
- No automatic updater. Quit Nyapix before replacing it with a newer version.
- Permissions may need to be granted again after an ad-hoc-signed update.

Disconnect agent integrations before uninstalling, then quit Nyapix and move
the app to Trash. Preferences are retained; see [privacy details](PRIVACY.md).
Report problems at https://github.com/BREACH1247/Nyapix/issues with your Mac's
chip, macOS version, and reproduction steps. Never attach private settings or tokens.
