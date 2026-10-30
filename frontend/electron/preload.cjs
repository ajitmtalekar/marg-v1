const { contextBridge, ipcRenderer } = require("electron");

console.log("✅ PRELOAD LOADED (CJS)");

contextBridge.exposeInMainWorld("tiles", {
  checkEnv: () => ipcRenderer.invoke("check-env"),
  run: () => ipcRenderer.send("run-tiles"),
  cancel: () => ipcRenderer.invoke("cancel-tiles"),
  onEvent: (cb) =>
    ipcRenderer.on("tile-event", (_, evt) => cb(evt))
});
