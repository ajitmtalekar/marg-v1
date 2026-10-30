import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { runTiles, cancelTiles } from "./tileRunner.js";
import { checkEnv } from "./envCheck.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadURL("http://localhost:5173/tiles");
}

ipcMain.handle("check-env", () => checkEnv());

ipcMain.on("run-tiles", (event) => {
  runTiles((evt) => {
    event.sender.send("tile-event", evt);
  });
});

ipcMain.handle("cancel-tiles", () => {
  return cancelTiles();
});

app.whenReady().then(createWindow);
