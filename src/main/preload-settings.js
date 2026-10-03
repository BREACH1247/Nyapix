const { ipcRenderer, contextBridge } = require("electron");

contextBridge.exposeInMainWorld("nyapixSettings", {
  platform: process.platform,
  displays: () => ipcRenderer.invoke("display:list"),
  onSettings: cb => ipcRenderer.on("settings:changed", (_e, settings) => cb(settings)),
  getMusic: () => ipcRenderer.invoke("music:get"),
  onMusic: (cb) => ipcRenderer.on("music", (_e, state) => cb(state)),
  get: () => ipcRenderer.invoke("settings:get"),
  set: (patch) => ipcRenderer.invoke("settings:set", patch),
  calendarUpcoming: () => ipcRenderer.invoke("calendar:upcoming"),
  calendarSync: () => ipcRenderer.invoke("calendar:sync"),
  agents: () => ipcRenderer.invoke("agents:get"),
  connectAgent: (provider, enabled) =>
    ipcRenderer.invoke("agents:connect", provider, enabled),
  clearAgents: () => ipcRenderer.invoke("agents:clear"),
  onAgents: (cb) => {
    const listener = (_e, snapshot) => cb(snapshot);
    ipcRenderer.on("agents:changed", listener);
    return () => ipcRenderer.removeListener("agents:changed", listener);
  },
});
