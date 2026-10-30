import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let currentProcess = null;

export function runTiles(onEvent) {
  if (currentProcess) {
    onEvent({ type: "error", message: "Process already running" });
    return;
  }

  const cmdPath = path.join(__dirname, "run_tiles.cmd");

  currentProcess = spawn("cmd.exe", ["/c", cmdPath], {
    windowsHide: true
  });

  currentProcess.stdout.on("data", (data) => {
    const text = data.toString();
    onEvent({ type: "log", message: text });

    // 🔹 Parse GDAL progress: 0...10...20...
    const matches = [...text.matchAll(/(\d+)\.\.\./g)];
    if (matches.length) {
      const last = parseInt(matches[matches.length - 1][1], 10);
      if (!isNaN(last)) {
        onEvent({ type: "progress", value: last });
      }
    }
  });

  currentProcess.stderr.on("data", (data) => {
    onEvent({ type: "log", message: data.toString() });
  });

  currentProcess.on("close", (code) => {
    onEvent({ type: "exit", code });
    currentProcess = null;
  });
}

export function cancelTiles() {
  if (currentProcess) {
    currentProcess.kill("SIGTERM");
    currentProcess = null;
    return true;
  }
  return false;
}
