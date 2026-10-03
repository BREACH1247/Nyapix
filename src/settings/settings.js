import { NyapixCat } from "../cat/engine.js";
import { initAgents } from "./agents.js";
import {
  DEFAULTS,
  PATTERNS,
  PRESETS,
  PETS,
  PET_DEFAULTS,
  DOG_PATTERNS,
  DOG_PRESETS,
} from "../shared/defaults.js";

const canvas = document.getElementById("preview");
const cat = new NyapixCat(canvas);
cat.previewFit = true;
cat.setDisplay(280, 250);
function centerPreview() {
  cat.x = Math.round((280 - cat.bodyW()) / 2);
  cat.y = 230 - cat.bodyH();
  cat.homeX = cat.x;
  cat.homeY = cat.y;
}
centerPreview();
window.__nyapixPreview = cat;

const fields = [
  "petName", "accessory", "musicStyle", "routinesEnabled", "quietAuto", "quietFocus", "quietManual", "homeDisplay", "homeCorner",
  "theme",
  "spotifyEnabled",
  "userName",
  "furColor",
  "bellyColor",
  "innerEarColor",
  "markColor",
  "eyeColor",
  "noseColor",
  "pattern",
  "scale",
  "pinnedMessage",
  "stretchMinutes",
  "waterMinutes",
  "pomodoroFocus",
  "pomodoroBreak",
  "pomodoroEnabled",
  "peekMode",
  "openAtLogin",
  "paused",
  "calendarUrl",
  "calendarMinutes",
  "collarColor",
  "soundEnabled",
  "agentEnabled",
  "agentShowOutput",
  "agentSound",
];
const lookKeys = [
  "accessory",
  "furColor",
  "bellyColor",
  "markColor",
  "innerEarColor",
  "eyeColor",
  "pupilColor",
  "noseColor",
  "pattern",
  "collarColor",
];
const pickLook = (settings) =>
  Object.fromEntries(lookKeys.map((key) => [key, settings[key]]));
const getPresets = () => (current.petKind === "dog" ? DOG_PRESETS : PRESETS);

const petBox = document.getElementById("pets");
function renderPets() {
  if (!petBox) return;
  petBox.innerHTML = "";
  for (const p of PETS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = p.label;
    b.setAttribute("aria-pressed", String(current.petKind === p.id));
    if ((current.petKind || "cat") === p.id) b.classList.add("on");
    b.addEventListener("click", () => {
      const looks = current.petLooks?.[p.id] || {
        ...pickLook(DEFAULTS),
        ...PET_DEFAULTS[p.id],
      };
      const next = {
        petKind: p.id,
        ...looks,
        petLooks: { ...current.petLooks, [current.petKind]: pickLook(current) },
      };
      patch(next);
      fill({ ...current, ...next });
    });
    petBox.append(b);
  }
}

const patternSel = document.getElementById("pattern");
const presetBox = document.getElementById("presets");
function renderLookOptions() {
  patternSel.replaceChildren();
  presetBox.replaceChildren();
  for (const p of current.petKind === "dog" ? DOG_PATTERNS : PATTERNS) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.label;
    patternSel.append(opt);
  }

  for (const p of getPresets()) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = p.label;
    b.dataset.preset = p.id;
    const dot = document.createElement("span");
    dot.className = "preset-dot";
    dot.style.background = p.furColor;
    b.prepend(dot);
    b.addEventListener("click", () => {
      const native = cat.nativeColors || {};
      const next =
        p.id === "original"
          ? {
              furColor: native.furColor || p.furColor,
              bellyColor: native.bellyColor || p.bellyColor,
              markColor: native.markColor || p.markColor,
              innerEarColor: native.innerEarColor || p.innerEarColor,
              noseColor: native.noseColor || p.noseColor,
              pattern: current.petKind === "dog" ? "solid" : "tabby",
            }
          : {
              furColor: p.furColor,
              bellyColor: p.bellyColor,
              markColor: p.markColor,
              pattern: p.pattern,
            };
      if (p.innerEarColor && p.id !== "original")
        next.innerEarColor = p.innerEarColor;
      if (p.noseColor && p.id !== "original") next.noseColor = p.noseColor;
      patch(next);
      fill(current);
    });
    presetBox.append(b);
  }
  // Keep earlier custom patterns selectable when upgrading an existing dog.
  if (
    ![...patternSel.options].some((option) => option.value === current.pattern)
  ) {
    const option = document.createElement("option");
    option.value = current.pattern;
    option.textContent = `Custom (${current.pattern})`;
    patternSel.append(option);
  }
}

let current = { ...DEFAULTS };

function readForm() {
  const next = { ...current };
  for (const id of fields) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.type === "checkbox") next[id] = el.checked;
    else if (el.type === "number" || id === "scale")
      next[id] = Number(el.value);
    else next[id] = el.value;
  }
  document.getElementById("scaleVal").textContent = `${next.scale}x`;
  return next;
}

function fill(data) {
  current = { ...DEFAULTS, ...data };
  renderLookOptions();
  if (![...document.getElementById("homeDisplay").options].some(o => o.value === current.homeDisplay)) {
    const option = new Option("Saved screen (currently unavailable)", current.homeDisplay);
    document.getElementById("homeDisplay").append(option);
  }
  renderFavorites();
  for (const id of fields) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.type === "checkbox") el.checked = !!current[id];
    else el.value = current[id] ?? "";
  }
  document.getElementById("scaleVal").textContent = `${current.scale}x`;
  renderPets();
  renderReminders();
  renderCalendar();
  updatePreview();
}

function updatePreview() {
  applyTheme();
  for (const button of document.querySelectorAll("[data-render-mode]")) {
    button.setAttribute("aria-pressed", String(button.dataset.renderMode === current.renderMode));
  }
  document.querySelector(".art-note").textContent = current.renderMode === "3d"
    ? "REAL-TIME 3D · A little toy brought to life."
    : "32 × 32 · Pixel by pixel. Full of personality.";
  cat.setSettings({
    ...current,
    paused: false,
    peekMode: false,
    pomodoroEnabled: false,
  });
  centerPreview();
  const dog = current.petKind === "dog";
  document.querySelectorAll("[data-dog-only]").forEach((el) => {
    el.hidden = !dog;
  });
  document.getElementById("reactions").classList.toggle("dog-reactions", dog);
  document.getElementById("petDescription").textContent = dog
    ? "Floppy ears, happy tail, and your biggest little fan."
    : "Curious eyes, tiny paws, and a little mischief.";
  for (const button of presetBox.children) {
    const preset = getPresets().find((p) => p.id === button.dataset.preset);
    const selected =
      preset &&
      ["furColor", "bellyColor", "markColor", "pattern"].every(
        (key) => preset[key] === current[key],
      );
    button.classList.toggle("on", !!selected);
    button.setAttribute("aria-pressed", String(!!selected));
  }
}

function renderReminders() {
  const box = document.getElementById("reminderList");
  box.innerHTML = "";
  for (const [i, rem] of (current.reminders || []).entries()) {
    const chip = document.createElement("div");
    chip.className = "chip";
    const text = document.createElement("span");
    text.textContent = `${rem.time} · ${rem.message}`;
    chip.append(text);
    const x = document.createElement("button");
    x.type = "button";
    x.textContent = "x";
    x.setAttribute("aria-label", `Remove reminder at ${rem.time}`);
    x.addEventListener("click", () => {
      current.reminders = current.reminders.filter((_, j) => j !== i);
      patch({ reminders: current.reminders });
      renderReminders();
    });
    chip.append(x);
    box.append(chip);
  }
}

let saveQueue = Promise.resolve();
function renderFavorites() {
  const box = document.getElementById("favorites"); box.replaceChildren();
  for (const favorite of (current.favorites || []).slice(0,12)) {
    const chip = document.createElement("div"); chip.className = "chip";
    const apply = document.createElement("button"); apply.type = "button"; apply.textContent = favorite.name;
    apply.addEventListener("click", () => {
      const next = {petKind: favorite.petKind === "dog" ? "dog" : "cat", ...pickLook(favorite.look)};
      patch(next); fill(current);
    });
    const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "×"; remove.setAttribute("aria-label", `Remove ${favorite.name}`);
    remove.addEventListener("click", () => {patch({favorites: current.favorites.filter(f => f.id !== favorite.id)});renderFavorites();});
    chip.append(apply,remove);box.append(chip);
  }
}
document.getElementById("saveFavorite").addEventListener("click", () => {
  const input = document.getElementById("favoriteName");
  const name = input.value.trim() || `${current.petName || current.petKind} look`;
  if ((current.favorites || []).length >= 12) { document.getElementById("saveStatus").textContent = "12 saved looks · remove one to save another"; return; }
  patch({favorites:[...(current.favorites || []),{id:crypto.randomUUID(),name,petKind:current.petKind,look:pickLook(current)}]});
  input.value = "";renderFavorites();
});
for(const button of document.querySelectorAll("[data-routine]")) button.addEventListener("click", () => {
  cat.agentInfo = null; cat.think = false; cat.startRoutine(button.dataset.routine); demoUntil = performance.now() + 6000;
});
const systemTheme = matchMedia("(prefers-color-scheme: dark)");
function applyTheme() {
  document.documentElement.dataset.theme = current.theme === "system" ? (systemTheme.matches ? "dark" : "light") : current.theme || "light";
}
systemTheme.addEventListener("change", applyTheme);
let musicDemoUntil = 0;
let liveMusic = { state: "disabled", playing: false };
document.getElementById("musicDemo").addEventListener("click", () => {
  musicDemoUntil = performance.now() + 6000;
  cat.mode = "idle"; cat.think = false; cat.agentInfo = null;
});
for (const button of document.querySelectorAll("[data-render-mode]")) {
  button.addEventListener("click", () => patch({ renderMode: button.dataset.renderMode }));
}
async function patch(data) {
  current = { ...current, ...data };
  current.petLooks = {
    ...current.petLooks,
    [current.petKind]: pickLook(current),
  };
  data = { ...data, petLooks: current.petLooks };
  updatePreview();
  const status = document.getElementById("saveStatus");
  if (!window.nyapixSettings) {
    status.textContent = "Preview · changes stay here";
    return;
  }
  status.textContent = "Saving…";
  saveQueue = saveQueue
    .catch(() => {})
    .then(() => window.nyapixSettings.set(data));
  const pending = saveQueue;
  try {
    await pending;
    if (pending === saveQueue) status.textContent = "All changes saved";
  } catch {
    if (pending === saveQueue)
      status.textContent = "Couldn't save · try changing again";
  }
}

for (const id of fields) {
  const el = document.getElementById(id);
  el?.addEventListener("input", () => {
    if (!el.validity.valid) return;
    patch(readForm());
  });
}

document.getElementById("addRem").addEventListener("click", () => {
  const time = document.getElementById("remTime").value;
  const message = document.getElementById("remText").value.trim();
  if (!time || !message) return;
  current.reminders = [...(current.reminders || []), { time, message }];
  document.getElementById("remText").value = "";
  patch({ reminders: current.reminders });
  renderReminders();
});

function formatWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return "";
  return d.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function renderCalendar(info) {
  const status = document.getElementById("calStatus");
  const box = document.getElementById("calEvents");
  if (!status || !box) return;
  if (!current.calendarUrl) {
    status.textContent =
      "Paste the secret iCal link to let Nyapix see your events.";
    box.innerHTML = "";
    return;
  }
  if (!info) {
    status.textContent = "syncing…";
    return;
  }
  if (info?.error) {
    status.textContent = info.error;
    box.innerHTML = "";
    return;
  }
  const events = info?.events || [];
  status.textContent = events.length
    ? `${events.length} upcoming`
    : "synced · nothing soon";
  box.innerHTML = "";
  for (const ev of events.slice(0, 6)) {
    const row = document.createElement("div");
    row.className = "chip";
    row.textContent = `${formatWhen(ev.start)}${ev.allDay ? " · all day" : ""} · ${ev.title}`;
    box.append(row);
  }
}

async function loadCalendar(force) {
  if (!window.nyapixSettings) return;
  const info = force
    ? await window.nyapixSettings.calendarSync()
    : await window.nyapixSettings.calendarUpcoming();
  renderCalendar(info);
}

document
  .getElementById("calendarUrl")
  ?.addEventListener("change", () => loadCalendar(true));
document
  .getElementById("syncCal")
  ?.addEventListener("click", () => loadCalendar(true));

let demoUntil = 0;
let pointerSeen = false;
const moods = {
  groom: "A LITTLE SELF CARE", chase: "ALMOST CAUGHT IT", toy: "BROUGHT YOU SOMETHING", edit: "TINY PAWS AT WORK", test: "CHECKING IT TWICE",
  idle: "JUST HANGING OUT",
  knead: "HARD AT WORK",
  think: "A LITTLE DEEP IN THOUGHT",
  hop: "YOU DID IT!",
  stretch: "A BIG LITTLE STRETCH",
  water: "STAY HYDRATED",
  paper: "ON A ROLL",
  sleep: "DO NOT DISTURB",
  hunt: "SOMETHING TO CHASE",
  home: "HEADING HOME",
  wave: "HELLO, FAVORITE HUMAN",
  sniff: "ON SNIFF PATROL",
  reply: "A REPLY FOR YOU",
  waiting: "YOUR TURN, HUMAN",
};
for (const button of document.querySelectorAll("[data-tab]")) {
  button.addEventListener("click", () => {
    for (const tab of document.querySelectorAll("[data-tab]")) {
      const active = tab === button;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-pressed", String(active));
    }
    for (const panel of document.querySelectorAll("[data-panel]"))
      panel.hidden = panel.dataset.panel !== button.dataset.tab;
  });
}
for (const button of document.querySelectorAll("[data-reaction]")) {
  button.addEventListener("click", () => {
    cat.think = false;
    cat.agentInfo = null;
    cat.mode = "idle";
    cat.modeT = 0;
    cat.idleT = 0;
    cat.pet = 0;
    cat.hop = 0;
    cat.paper = 0;
    cat.bubbleT = 0;
    cat._agentDoneAt = 0;
    centerPreview();
    const reaction = button.dataset.reaction;
    if (reaction === "pet") {
      cat.pet = 1.5;
      for (let i = 0; i < 4; i++) cat.spawnHeart();
    }
    if (reaction === "type") {
      cat.key({ label: "A" });
      cat.keys = 4;
    }
    if (reaction === "think") cat.setAgent("think");
    if (reaction === "hop") cat.setAgent("done");
    if (reaction === "stretch") cat.remindStretch();
    if (reaction === "water") cat.remindWater();
    if (reaction === "paper") cat.wheel(300);
    if (reaction === "sleep") {
      cat.mode = "sleep";
      cat.idleT = 91;
    }
    if (["wave", "sniff"].includes(reaction)) cat.mode = reaction;
    demoUntil = performance.now() + 4500;
    for (const item of document.querySelectorAll("[data-reaction]"))
      item.classList.toggle("active", item === button);
  });
}
canvas.addEventListener("pointermove", (event) => {
  const bounds = canvas.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) * canvas.width) / bounds.width;
  const y = ((event.clientY - bounds.top) * canvas.height) / bounds.height;
  pointerSeen = true;
  // Preview tracks eyes without chasing the pointer out of its small scene.
  cat.mouseSeen = true;
  cat.mouse.x = x;
  cat.mouse.y = y;
  cat.petHead(x, y);
});
canvas.addEventListener("pointerleave", () => {
  pointerSeen = false;
});
function frame(now) {
  const dt = Math.min(0.05, (now - (frame.prev || now)) / 1000);
  frame.prev = now;
  if (!pointerSeen) {
    cat.mouseSeen = true;
    cat.mouse.x = 140 + Math.sin(now / 1500) * 40;
    cat.mouse.y = 110;
  }
  if (demoUntil && now > demoUntil) {
    cat.think = false;
    cat.agentInfo = null;
    cat.mode = "idle";
    cat.modeT = 0;
    demoUntil = 0;
    for (const item of document.querySelectorAll("[data-reaction]"))
      item.classList.remove("active");
  }
  cat.update(dt);
  const musicDemo = now < musicDemoUntil;
  cat.music = musicDemo ? { playing: true } : liveMusic;
  cat.settings.spotifyEnabled = musicDemo || current.spotifyEnabled;
  document.getElementById("musicStatus").textContent = musicDemo ? "Preview groove · not connected to playback"
    : !current.spotifyEnabled ? "Off · enable to follow Spotify"
    : !window.nyapixSettings ? "Available in the desktop app. Try the groove preview here."
    : liveMusic.state === "unsupported" ? "Spotify connection currently supports Windows only."
    : liveMusic.state === "unavailable" ? "Could not read Spotify. Toggle off and on to retry."
    : liveMusic.state === "connecting" ? "Connecting to the desktop player…"
    : liveMusic.title ? (liveMusic.playing ? "Playing: " : "Paused: ") + liveMusic.title + " · " + liveMusic.artist
    : "Waiting for Spotify desktop playback…";
  centerPreview();
  cat.draw();
  document.getElementById("renderStatus").textContent = current.renderMode !== "3d" ? "Lightweight, crisp pixel art."
    : cat.renderError || cat.render3D?.lost ? "3D is unavailable right now. Your companion is using pixel art."
    : cat.renderLoading ? "Waking up your 3D companion…" : "Animated locally on your device. Same colors, same companion.";
  document.getElementById("modeLabel").textContent =
    moods[cat.mode] || "A LITTLE COMPANY";
  document.getElementById("previewBubble").textContent =
    cat.bubbleT > 0
      ? cat.bubble
      : cat.pet > 0.2
        ? "More of that, please ♡"
        : current.petName ? `${current.petName} is happy to be here.` : "Happy to be here.";
  requestAnimationFrame(frame);
}

async function boot() {
  if (window.nyapixSettings?.displays) {
    try {
      const displays = await window.nyapixSettings.displays();
      for (const display of displays) document.getElementById("homeDisplay").append(new Option(display.label, display.id));
    } catch { /* Browser or older desktop host. */ }
  }
  window.nyapixSettings?.onSettings?.(fill);
  if (window.nyapixSettings?.getMusic) {
    window.nyapixSettings.onMusic((state) => { liveMusic = state; });
    try { liveMusic = await window.nyapixSettings.getMusic(); } catch { /* Older desktop host. */ }
  }
  if (window.nyapixSettings) fill(await window.nyapixSettings.get());
  else {
    const petKind = new URLSearchParams(location.search).get("pet") === "dog" ? "dog" : "cat";
    const renderMode = new URLSearchParams(location.search).get("mode") === "3d" ? "3d" : "pixel";
    fill({ ...DEFAULTS, ...(petKind === "dog" ? { petKind, ...PET_DEFAULTS.dog } : {}), renderMode });
  }
  const tab = new URLSearchParams(location.search).get("tab");
  if (["look", "reminders", "desktop", "agents"].includes(tab)) document.querySelector(`[data-tab="${tab}"]`).click();
  loadCalendar(false);
  initAgents({
    pet: cat,
    onDemo: () => {
      demoUntil = performance.now() + 6000;
    },
  });
  requestAnimationFrame(frame);
}

boot();
