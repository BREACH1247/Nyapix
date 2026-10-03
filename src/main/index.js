const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const Store = require("electron-store");
const { startSpotify } = require("./spotify.cjs");
const { startQuiet } = require("./quiet.cjs");
const { selectDisplay, petMenu } = require("./desktop-tools.cjs");
const { startInput } = require("./input");
const { AgentHub, startAgentBridge } = require("./agent-hub.cjs");
const { integrationStatus, setIntegration } = require("./agent-install.cjs");
const { startCalendar } = require("./calendar");

const DEFAULTS = {
  userName: "",
  petKind: "cat",
  renderMode: "pixel",
  theme: "system",
  petName: "", accessory: "collar", favorites: [], routinesEnabled: true,
  musicStyle: "sway", quietAuto: true, quietFocus: false, quietManual: false,
  homeDisplay: "primary", homeCorner: "bottom-right",
  spotifyEnabled: false,
  furColor: "#2b2b2b",
  bellyColor: "#f3ead8",
  innerEarColor: "#e59aa4",
  markColor: "#1a1a1a",
  eyeColor: "#f7f7f4",
  pupilColor: "#171717",
  noseColor: "#d77884",
  pattern: "solid",
  scale: 5,
  peekMode: false,
  pinnedMessage: "",
  stretchMinutes: 30,
  waterMinutes: 45,
  pomodoroFocus: 25,
  pomodoroBreak: 5,
  pomodoroEnabled: false,
  reminders: [],
  calendarUrl: "",
  calendarMinutes: 10,
  openAtLogin: false,
  paused: false,
  collarColor: "#6d958d",
  soundEnabled: true,
  agentEnabled: true,
  agentShowOutput: true,
  agentSound: false,
  petLooks: {},
};

const store = new Store({ defaults: DEFAULTS });

let overlay;
let settingsWin;
let tray;
let stopInput = () => {};
let calendar = null;
let quietMonitor;
const spotify = startSpotify((state) => {
  for (const win of [overlay, settingsWin]) if (win && !win.isDestroyed()) win.webContents.send("music", state);
});
let agentBridge;
let agentBridgeError = "";
const agentHub = new AgentHub({ getSettings: () => store.store, onChange: (snapshot, latest) => {
  if (overlay && !overlay.isDestroyed()) overlay.webContents.send("agent", { ...snapshot, latest });
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send("agents:changed", { ...agentSnapshot(), latest });
} });
function agentSnapshot() {
  return { ...agentHub.snapshot(), integrations: integrationStatus(), ready: !!agentBridge, error: agentBridgeError };
}

function iconImage() {
  try {
    const s = 16;
    const buf = Buffer.alloc(s * s * 4);
    const set = (x, y, r, g, b, a = 255) => {
      if (x < 0 || y < 0 || x >= s || y >= s) return;
      const i = (y * s + x) * 4;
      buf[i] = b;
      buf[i + 1] = g;
      buf[i + 2] = r;
      buf[i + 3] = a;
    };
    for (let y = 3; y <= 13; y++) {
      for (let x = 3; x <= 12; x++) {
        const dx = x - 7.5;
        const dy = y - 8;
        if (dx * dx + dy * dy < 28) set(x, y, 36, 36, 36);
      }
    }
    set(5, 2, 36, 36, 36);
    set(6, 3, 36, 36, 36);
    set(10, 2, 36, 36, 36);
    set(9, 3, 36, 36, 36);
    set(6, 7, 245, 245, 240);
    set(5, 7, 245, 245, 240);
    set(10, 7, 245, 245, 240);
    set(11, 7, 245, 245, 240);
    set(6, 7, 20, 20, 20);
    set(10, 7, 20, 20, 20);
    const img = nativeImage.createFromBitmap(buf, { width: s, height: s });
    if (!img.isEmpty()) return img;
  } catch {
    /* fall through */
  }
  return nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAPElEQVQ4T2NkYGD4z0ABYBw1gGE0DBgYRg0gEoxW/x8ZGRn/MzIy/mdgYPjPwMDA8J+BgYGBkZERbhgNA8YBAO0tBBn1mSYqAAAAAElFTkSuQmCC"
  );
}

function workInsets() {
  const d = selectedDisplay();
  const b = d.bounds;
  const w = d.workArea;
  return {
    left: Math.max(0, w.x - b.x),
    top: Math.max(0, w.y - b.y),
    right: Math.max(0, b.x + b.width - (w.x + w.width)),
    bottom: Math.max(0, b.y + b.height - (w.y + w.height)),
  };
}

function virtualScreen() {
  return selectedDisplay().bounds;
}

function selectedDisplay() {
  return selectDisplay(screen.getAllDisplays(), screen.getPrimaryDisplay(), store.get("homeDisplay"));
}
function displayChoices() {
  return screen.getAllDisplays().map((d,i) => ({ id: String(d.id), label: d.label || `Screen ${i + 1}`, primary: d.id === screen.getPrimaryDisplay().id }));
}
function quickPatch(patch) {
  store.set(patch);
  overlay?.webContents.send("settings", store.store);
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send("settings:changed", store.store);
  if (patch.homeDisplay || patch.homeCorner) resizeOverlay();
}
function showPetMenu() {
  const s = store.store;
  Menu.buildFromTemplate(petMenu(s,displayChoices(),{patch:quickPatch,routine:name=>overlay?.webContents.send("routine",name),settings:createSettings,quit:()=>app.quit()})).popup({window:overlay});
}

function createOverlay() {
  const bounds = virtualScreen();
  overlay = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    fullscreenable: false,
    hasShadow: false,
    focusable: false,
    type: process.platform === "darwin" ? "panel" : "toolbar",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload-overlay.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.setMenuBarVisibility(false);
  overlay.loadFile(path.join(__dirname, "../overlay/index.html"));
  overlay.webContents.setBackgroundThrottling(false);
  overlay.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error("Nyapix overlay failed to load", code, desc, url);
  });
  overlay.webContents.on("render-process-gone", (_e, details) => {
    console.error("Nyapix overlay crashed", details);
  });
  overlay.once("ready-to-show", () => overlay.showInactive());
}

function createSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 1040,
    height: 820,
    minWidth: 620,
    minHeight: 560,
    backgroundColor: "#f7f5f0",
    autoHideMenuBar: true,
    icon: iconImage(),
    webPreferences: {
      preload: path.join(__dirname, "preload-settings.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  settingsWin.loadFile(path.join(__dirname, "../settings/index.html"));
}

function createTray() {
  tray = new Tray(iconImage());
  tray.setToolTip("Nyapix");
  const menu = () =>
    Menu.buildFromTemplate([
      { label: "Nyapix", enabled: false },
      { type: "separator" },
      { label: "Settings", click: () => createSettings() },
      { label: "Show companion / end quiet mode", click: () => quickPatch({quietManual:false,quietAuto:false,quietFocus:false}) },
      {
        label: store.get("peekMode") ? "Disable peek mode" : "Peek mode",
        click: () => {
          quickPatch({peekMode:!store.get("peekMode")});
          tray.setContextMenu(menu());
        },
      },
      {
        label: store.get("paused") ? "Resume" : "Pause reactions",
        click: () => {
          quickPatch({paused:!store.get("paused")});
          tray.setContextMenu(menu());
        },
      },
      { type: "separator" },
      { label: "Quit Nyapix", click: () => app.quit() },
    ]);
  tray.setContextMenu(menu());
  tray.on("click", () => overlay?.webContents.send("nudge"));
  tray.on("double-click", () => createSettings());
}

function wireIpc() {
  ipcMain.handle("quiet:get", () => quietMonitor?.snapshot() || {available:false,quiet:false});
  ipcMain.handle("display:list", () => displayChoices());
  ipcMain.on("pet-menu", showPetMenu);
  ipcMain.handle("music:get", () => spotify.snapshot());
  ipcMain.handle("settings:get", () => store.store);
  ipcMain.handle("settings:set", (_e, patch) => {
    const prevUrl = store.get("calendarUrl");
    const prevMins = store.get("calendarMinutes");
    store.set(patch);
    if (patch.homeDisplay || patch.homeCorner) resizeOverlay();
    if (Object.prototype.hasOwnProperty.call(patch, "spotifyEnabled")) spotify.setEnabled(patch.spotifyEnabled);
    if (patch.agentEnabled === false) agentHub.clear();
    if (patch.agentShowOutput === false) agentHub.redact();
    if (Object.prototype.hasOwnProperty.call(patch, "openAtLogin")) {
      app.setLoginItemSettings({ openAtLogin: !!patch.openAtLogin });
    }
    overlay?.webContents.send("settings", store.store);
    const urlChanged = Object.prototype.hasOwnProperty.call(patch, "calendarUrl") && patch.calendarUrl !== prevUrl;
    const minsChanged =
      Object.prototype.hasOwnProperty.call(patch, "calendarMinutes") && Number(patch.calendarMinutes) !== Number(prevMins);
    if (urlChanged || minsChanged) calendar?.refresh();
    return store.store;
  });
  ipcMain.handle("calendar:upcoming", () => calendar?.upcoming() || { events: [], error: "", syncedAt: 0 });
  ipcMain.handle("calendar:sync", async () => {
    await calendar?.refresh();
    return calendar?.upcoming() || { events: [], error: "", syncedAt: 0 };
  });
  ipcMain.handle("display:insets", () => workInsets());
  ipcMain.handle("agents:get", () => agentSnapshot());
  ipcMain.handle("agents:connect", (_event, provider, enabled) => {
    try { setIntegration(provider, !!enabled, {runtimePath: app.isPackaged ? (process.env.PORTABLE_EXECUTABLE_FILE || process.execPath) : null}); if (!enabled) agentHub.disconnect(provider); return { ok: true, ...agentSnapshot() }; }
    catch (error) { return { ok: false, error: error.message }; }
  });
  ipcMain.handle("agents:clear", () => { agentHub.clear(); return agentSnapshot(); });
  ipcMain.on("ignore-mouse", (_e, ignore) => {
    if (!overlay) return;
    overlay.setIgnoreMouseEvents(!!ignore, { forward: true });
  });
  ipcMain.on("open-settings", () => createSettings());
}

app.commandLine.appendSwitch("enable-transparent-visuals");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => createSettings());
  app.whenReady().then(() => {
    if (process.platform === "win32") app.setAppUserModelId("dev.nyapix.app");
    app.setLoginItemSettings({ openAtLogin: !!store.get("openAtLogin") });
    wireIpc();
    createOverlay();
    createTray();
    quietMonitor = startQuiet(state => { if (overlay && !overlay.isDestroyed()) overlay.webContents.send("quiet", state); });
    spotify.setEnabled(store.get("spotifyEnabled"));
    if (!store.get("hasLaunched")) {
      store.set("hasLaunched", true);
      createSettings();
    }
    stopInput = startInput(overlay, screen);
    startAgentBridge(agentHub).then((bridge) => {
      agentBridge = bridge;
      if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send("agents:changed", agentSnapshot());
    }).catch((error) => { agentBridgeError = error.message; });
    calendar = startCalendar({
      getSettings: () => store.store,
      onRemind: (ev) => overlay?.webContents.send("calendar-remind", ev),
    });
    screen.on("display-metrics-changed", resizeOverlay);
    screen.on("display-added", resizeOverlay);
    screen.on("display-removed", resizeOverlay);
  });
}

function resizeOverlay() {
  if (!overlay) return;
  overlay.setBounds(virtualScreen());
  overlay.webContents.send("display-changed", workInsets());
}

app.on("window-all-closed", (e) => e.preventDefault());
app.on("before-quit", () => {
  quietMonitor?.stop();
  spotify.stop();
  stopInput();
  agentBridge?.stop();
  calendar?.stop();
});
app.on("activate", () => {
  if (!overlay) createOverlay();
});
