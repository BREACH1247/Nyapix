const { ipcRenderer, contextBridge } = require("electron");

contextBridge.exposeInMainWorld("nyapix", {
  openMenu: () => ipcRenderer.send("pet-menu"),
  onRoutine: cb => ipcRenderer.on("routine", (_e, name) => cb(name)),
  onQuiet: cb => ipcRenderer.on("quiet", (_e, state) => cb(state)),
  getQuiet: () => ipcRenderer.invoke("quiet:get"),
  getMusic: () => ipcRenderer.invoke("music:get"),
  onMusic: (cb) => ipcRenderer.on("music", (_e, state) => cb(state)),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setIgnoreMouse: (ignore) => ipcRenderer.send("ignore-mouse", ignore),
  openSettings: () => ipcRenderer.send("open-settings"),
  onSettings: (cb) => ipcRenderer.on("settings", (_e, data) => cb(data)),
  onCursor: (cb) => ipcRenderer.on("cursor", (_e, data) => cb(data)),
  onKey: (cb) => ipcRenderer.on("key", (_e, data) => cb(data || {})),
  onWheel: (cb) => ipcRenderer.on("wheel", (_e, data) => cb(data)),
  onAgent: (cb) => ipcRenderer.on("agent", (_e, status) => cb(status)),
  onNudge: (cb) => ipcRenderer.on("nudge", () => cb()),
  onCalendar: (cb) =>
    ipcRenderer.on("calendar-remind", (_e, data) => cb(data || {})),
  onDisplayChanged: (cb) =>
    ipcRenderer.on("display-changed", (_e, insets) => cb(insets || {})),
  getInsets: () => ipcRenderer.invoke("display:insets"),
  getAgents: () => ipcRenderer.invoke("agents:get"),
});
