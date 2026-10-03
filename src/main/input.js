const { spawn } = require("child_process");

function labelsFromUiohook(UiohookKey) {
  const out = {};
  const short = {
    Backspace: "⌫",
    Tab: "⇥",
    Enter: "↵",
    CapsLock: "⇪",
    Escape: "esc",
    Space: "␣",
    ArrowLeft: "←",
    ArrowUp: "↑",
    ArrowRight: "→",
    ArrowDown: "↓",
    Delete: "del",
    Shift: "⇧",
    ShiftRight: "⇧",
    Ctrl: "ctrl",
    CtrlRight: "ctrl",
    Alt: "alt",
    AltRight: "alt",
    Meta: process.platform === 'darwin' ? '⌘' : 'win',
    MetaRight: process.platform === 'darwin' ? '⌘' : 'win',
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Backslash: "\\",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Backquote: "`",
  };
  for (const [name, code] of Object.entries(UiohookKey || {})) {
    if (typeof code !== "number") continue;
    if (name.length === 1 || /^\d$/.test(name)) out[code] = name.toUpperCase();
    else if (name.startsWith("F") && /^F\d+$/.test(name)) out[code] = name.toLowerCase();
    else if (name.startsWith("Numpad") && name.length === 7) out[code] = name.slice(-1);
    else out[code] = short[name] || name.slice(0, 4).toLowerCase();
  }
  return out;
}

function vkLabel(vk) {
  if (vk >= 0x41 && vk <= 0x5a) return String.fromCharCode(vk);
  if (vk >= 0x30 && vk <= 0x39) return String.fromCharCode(vk);
  const map = {
    8: "⌫",
    9: "⇥",
    13: "↵",
    16: "⇧",
    17: "ctrl",
    18: "alt",
    20: "⇪",
    27: "esc",
    32: "␣",
    37: "←",
    38: "↑",
    39: "→",
    40: "↓",
    46: "del",
  };
  return map[vk] || "";
}

function startInput(win, screen) {
  const sendCursor = () => {
    if (!win || win.isDestroyed()) return;
    const p = screen.getCursorScreenPoint();
    const b = win.getBounds();
    win.webContents.send("cursor", { x: p.x - b.x, y: p.y - b.y, sx: p.x, sy: p.y });
  };
  const cursorTimer = setInterval(sendCursor, 16);

  let stopKeys = () => {};
  let hooked = false;
  try {
    // Do not start a native event tap without the user's macOS permission.
    // libuiohook can terminate the process when an event tap is denied.
    if (process.platform === 'darwin' && !require('electron').systemPreferences.isTrustedAccessibilityClient(false)) {
      return () => clearInterval(cursorTimer);
    }
    const { uIOhook, UiohookKey } = require("uiohook-napi");
    const labels = labelsFromUiohook(UiohookKey);
    uIOhook.on("keydown", (e) => {
      win?.webContents.send("key", { label: labels[e.keycode] || "", keycode: e.keycode });
    });
    uIOhook.on("wheel", (e) => {
      const rotation = e.rotation || e.amount || 1;
      win?.webContents.send("wheel", { delta: rotation * 80 });
    });
    uIOhook.start();
    hooked = true;
    stopKeys = () => {
      try {
        uIOhook.stop();
      } catch {
        /* ignore */
      }
    };
  } catch {
    hooked = false;
  }

  if (!hooked && process.platform === "win32") {
    stopKeys = startWinPoll(win);
  }

  return () => {
    clearInterval(cursorTimer);
    stopKeys();
  };
}

function startWinPoll(win) {
  const ps = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NyapixKeys {
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int v);
}
"@
$prev = @{}
while ($true) {
  foreach ($k in 8..190) {
    $down = ([NyapixKeys]::GetAsyncKeyState($k) -band 0x8000) -ne 0
    if ($down -and -not $prev[$k]) { Write-Output $k }
    $prev[$k] = $down
  }
  Start-Sleep -Milliseconds 25
}
`;
  const child = spawn("powershell.exe", ["-NoProfile", "-Command", ps], {
    windowsHide: true,
  });
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    for (const part of String(chunk).trim().split(/\s+/)) {
      const vk = Number(part);
      if (!vk) continue;
      win?.webContents.send("key", { label: vkLabel(vk), keycode: vk });
    }
  });
  child.on("error", () => {});
  return () => {
    try {
      child.kill();
    } catch {
      /* ignore */
    }
  };
}

module.exports = { startInput };
