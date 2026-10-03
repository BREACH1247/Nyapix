import { NyapixCat } from "../cat/engine.js";
import { labelFromDomKey } from "../shared/keys.js";

const canvas = document.getElementById("stage");
const pinEl = document.getElementById("pin");
const bubbleEl = document.getElementById("bubble");
const agentBadge = document.getElementById("agentBadge");

function api() {
  return window.nyapix || null;
}

let insets = { left: 0, top: 0, right: 0, bottom: /windows/i.test(navigator.userAgent) ? 48 : 0 };

function fit() {
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  cat.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cat.setDisplay(window.innerWidth, window.innerHeight, insets);
}

const cat = new NyapixCat(canvas);
const systemTheme = matchMedia("(prefers-color-scheme: dark)");
function applyTheme() {
  document.documentElement.dataset.theme = cat.settings.theme === "system" ? (systemTheme.matches ? "dark" : "light") : cat.settings.theme;
}
systemTheme.addEventListener("change", applyTheme);
let dragging = false;
let lastOver = false;
let lastPet = 0;
let quietState = {quiet:false};
let configuredSound = true;
let lastQuiet = false;

function placeHud() {
  const ui = cat.uiState();
  if (ui.pin) {
    pinEl.hidden = false;
    pinEl.textContent = ui.pin;
    pinEl.style.left = `${Math.max(8, Math.min(innerWidth - pinEl.offsetWidth - 8, ui.x))}px`;
    pinEl.style.top = `${Math.max(8, ui.y - 40)}px`;
  } else {
    pinEl.hidden = true;
  }
  if (ui.bubble) {
    bubbleEl.hidden = false;
    bubbleEl.textContent = ui.bubble;
    bubbleEl.style.left = `${Math.max(8, Math.min(innerWidth - bubbleEl.offsetWidth - 8, ui.x + ui.w * 0.05))}px`;
    bubbleEl.style.top = `${Math.max(8, ui.y - bubbleEl.offsetHeight - (ui.pin ? 48 : 14))}px`;
  } else {
    bubbleEl.hidden = true;
  }
  const phaseLabels = { thinking: "Thinking", responding: "Replying", waiting: "Needs you", error: "Needs attention", done: "Finished", interrupted: "Interrupted" };
  agentBadge.hidden = !ui.agent || !phaseLabels[ui.agent.phase] || cat.settings.agentEnabled === false;
  if (!agentBadge.hidden) {
    const label = ui.agent.phase === "thinking" && ui.agent.activity === "editing" ? "Editing" : ui.agent.phase === "thinking" && ui.agent.activity === "testing" ? "Testing" : phaseLabels[ui.agent.phase];
    agentBadge.textContent = `${ui.agent.source} · ${label}${ui.agent.activeCount > 1 ? ` · ${ui.agent.activeCount} active` : ""}`;
    agentBadge.dataset.phase = ui.agent.phase;
    agentBadge.style.left = `${Math.max(8, Math.min(innerWidth - agentBadge.offsetWidth - 8, ui.x))}px`;
    agentBadge.style.top = `${Math.max(8, Math.min(innerHeight - agentBadge.offsetHeight - 8, cat.y + cat.bodyH() + 2))}px`;
  }
}

function loop(now) {
  const quiet = !!(cat.settings.quietManual || (cat.settings.quietAuto && quietState.quiet) || (cat.settings.quietFocus && cat.pomodoro.running && cat.pomodoro.phase === "focus"));
  cat.quiet = quiet;
  cat.settings.soundEnabled = configuredSound && !quiet;
  if (quiet && !lastQuiet) { cat.audio.purrStop(); api()?.setIgnoreMouse(true); lastOver = false; }
  const dt = Math.min(0.05, (now - (loop.prev || now)) / 1000);
  loop.prev = now;
  cat.update(dt);
  if (!quiet) cat.draw();
  placeHud();
  canvas.style.visibility = quiet ? "hidden" : "visible";
  if (quiet) {
    pinEl.hidden = bubbleEl.hidden = agentBadge.hidden = true;
  }
  lastQuiet = quiet;
  requestAnimationFrame(loop);
}

function localPoint(e) {
  return { x: e.clientX, y: e.clientY };
}

canvas.addEventListener("pointermove", (e) => {
  const p = localPoint(e);
  const over = cat.hitTest(p.x, p.y);
  if (over !== lastOver) {
    lastOver = over;
    api()?.setIgnoreMouse(!over && !dragging);
  }
  if (dragging) cat.moveDrag(p.x, p.y);
  else if (over) {
    const t = performance.now();
    if (t - lastPet > 30) {
      cat.petHead(p.x, p.y);
      lastPet = t;
    }
  }
});

canvas.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  const p = localPoint(e);
  if (!cat.hitTest(p.x, p.y)) return;
  dragging = true;
  canvas.setPointerCapture(e.pointerId);
  cat.startDrag(p.x, p.y);
  api()?.setIgnoreMouse(false);
});

canvas.addEventListener("pointerup", (e) => {
  if (!dragging) return;
  dragging = false;
  cat.endDrag();
  const p = localPoint(e);
  const over = cat.hitTest(p.x, p.y);
  api()?.setIgnoreMouse(!over);
});

canvas.addEventListener("dblclick", () => api()?.openSettings());

canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (cat.hitTest(e.clientX, e.clientY)) api()?.openMenu();
});

window.addEventListener("resize", fit);

async function boot() {
  const bridge = api();
  if (bridge?.getSettings) {
    bridge.onMusic?.((state) => { cat.music = state; });
    if (bridge.getMusic) cat.music = await bridge.getMusic();
    cat.setSettings(await bridge.getSettings());
    configuredSound = cat.settings.soundEnabled !== false;
    bridge.onRoutine?.(name => cat.startRoutine(name));
    bridge.onQuiet?.(state => { quietState = state; });
    if (bridge.getQuiet) quietState = await bridge.getQuiet();
    applyTheme();
    bridge.onSettings?.((s) => { configuredSound = s.soundEnabled !== false; cat.setSettings(s); applyTheme(); });
    bridge.onCursor?.((p) => cat.setMouse(p.x, p.y));
    bridge.onKey?.((data) => { if (!cat.quiet) cat.key(data || {}); });
    bridge.onWheel?.((w) => { if (!cat.quiet) cat.wheel(w?.delta || 80); });
    bridge.onAgent?.((status) => cat.setAgent(status));
    if (bridge.getAgents) cat.setAgentEvent(await bridge.getAgents());
    bridge.onNudge?.(() => {
      cat.mode = "hop";
      cat.modeT = 0;
      if (cat.settings.soundEnabled !== false) {
        if (cat.settings.petKind === "dog") cat.audio.bark(); else cat.audio.meow(1.1);
      }
    });
    bridge.onCalendar?.((ev) => {
      const title = String(ev?.title || "event");
      const mins = Number(ev?.minutes);
      if (!Number.isFinite(mins) || mins <= 0) cat.remindMessage(title);
      else cat.remindMessage(`${title} in ${mins} min`);
    });
    bridge.onDisplayChanged?.((next) => {
      if (next && typeof next.bottom === "number") insets = next;
      fit();
      cat.placeDefault();
    });
    if (bridge.getInsets) {
      try {
        const next = await bridge.getInsets();
        if (next && typeof next.bottom === "number") insets = next;
      } catch {
        /* keep fallback */
      }
    }
  } else {
    window.addEventListener("mousemove", (e) => cat.setMouse(e.clientX, e.clientY));
    window.addEventListener("keydown", (e) => cat.key({ label: labelFromDomKey(e.key), repeat: e.repeat }));
    window.addEventListener("wheel", (e) => cat.wheel(e.deltaY), { passive: true });
  }

  let stretchAcc = 0;
  let waterAcc = 0;
  const fired = new Set();
  setInterval(() => {
    if (cat.settings.paused) return;
    stretchAcc += 1;
    waterAcc += 1;
    const sm = cat.settings.stretchMinutes || 0;
    const wm = cat.settings.waterMinutes || 0;
    if (sm && stretchAcc >= sm * 60) {
      stretchAcc = 0;
      cat.remindStretch();
    }
    if (wm && waterAcc >= wm * 60) {
      waterAcc = 0;
      cat.remindWater();
    }
    const now = new Date();
    const stamp = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    const day = now.toDateString();
    for (const rem of cat.settings.reminders || []) {
      const key = `${day}-${rem.time}`;
      if (rem.time === stamp && !fired.has(key)) {
        fired.add(key);
        cat.remindMessage(rem.message || "reminder!");
      }
    }
  }, 1000);

  fit();
  requestAnimationFrame(loop);
}

boot();
