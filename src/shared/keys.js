const SHORT = {
  Backspace: "⌫",
  Tab: "⇥",
  Enter: "↵",
  CapsLock: "⇪",
  Escape: "esc",
  Space: "␣",
  PageUp: "pgup",
  PageDown: "pgdn",
  ArrowLeft: "←",
  ArrowUp: "↑",
  ArrowRight: "→",
  ArrowDown: "↓",
  Delete: "del",
  Insert: "ins",
  Home: "home",
  End: "end",
  Shift: "⇧",
  ShiftRight: "⇧",
  Ctrl: "ctrl",
  CtrlRight: "ctrl",
  Alt: "alt",
  AltRight: "alt",
  Meta: "win",
  MetaRight: "win",
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

export function labelFromUiohook(name) {
  if (!name) return "";
  if (name.length === 1) return name.toUpperCase();
  if (/^\d$/.test(name)) return name;
  if (name.startsWith("Numpad") && name.length === 7) return name.slice(-1);
  if (name.startsWith("F") && /^F\d+$/.test(name)) return name.toLowerCase();
  return SHORT[name] || name.slice(0, 4).toLowerCase();
}

export function labelFromDomKey(key) {
  if (!key) return "";
  if (key.length === 1) return key.toUpperCase();
  const map = {
    " ": "␣",
    Enter: "↵",
    Backspace: "⌫",
    Tab: "⇥",
    Escape: "esc",
    Shift: "⇧",
    Control: "ctrl",
    Alt: "alt",
    Meta: "win",
    ArrowLeft: "←",
    ArrowUp: "↑",
    ArrowRight: "→",
    ArrowDown: "↓",
    Delete: "del",
    CapsLock: "⇪",
  };
  return map[key] || key.slice(0, 4);
}

export function labelFromVk(vk) {
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
    91: "win",
  };
  return map[vk] || "";
}

export function invertUiohookKey(UiohookKey) {
  const out = {};
  for (const [name, code] of Object.entries(UiohookKey || {})) {
    if (typeof code === "number") out[code] = labelFromUiohook(name);
  }
  return out;
}
