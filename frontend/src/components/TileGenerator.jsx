import { useEffect, useState } from "react";

export default function TileGenerator() {
  const [logs, setLogs] = useState("");
  const [env, setEnv] = useState(null);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!window.tiles) return;

    window.tiles.checkEnv().then(setEnv);

    window.tiles.onEvent((evt) => {
      if (evt.type === "log") {
        setLogs((p) => p + evt.message);
      }
      if (evt.type === "progress") {
        setProgress(evt.value);
      }
      if (evt.type === "exit") {
        setRunning(false);
      }
    });
  }, []);

  if (!window.tiles) {
    return (
      <div className="p-4 text-red-600">
        ❌ Must be opened inside Electron
      </div>
    );
  }

  if (!env) return <div className="p-4">Checking environment…</div>;

  const ready = env.qgis && env.python;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Tile Generator</h2>

      {!ready && (
        <div className="text-red-500">
          ❌ Environment not ready
          <pre className="mt-2">{env.errors.join("\n")}</pre>
        </div>
      )}

      {ready && (
        <div className="flex gap-3">
          <button
            disabled={running}
            className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
            onClick={() => {
              setLogs("");
              setProgress(0);
              setRunning(true);
              window.tiles.run();
            }}
          >
            ▶ Run Tile Generation
          </button>

          <button
            disabled={!running}
            className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50"
            onClick={() => window.tiles.cancel()}
          >
            ⛔ Cancel
          </button>
        </div>
      )}

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded h-4">
        <div
          className="bg-blue-600 h-4 rounded transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="text-sm">{progress}%</div>

      {/* Logs */}
      <div className="bg-black text-green-400 p-3 h-96 overflow-auto font-mono text-sm">
        <pre>{logs}</pre>
      </div>
    </div>
  );
}
