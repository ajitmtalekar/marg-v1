import fs from "fs";           // ✅ Node-only (OK)
import path from "path";      // ✅ Node-only (OK)

const QGIS_ROOT = "D:\\Program Files\\QGIS 3.40.12";

export function checkEnv() {
  const result = {
    qgis: false,
    python: false,
    osgeo4w: false,
    errors: []
  };

  if (fs.existsSync(QGIS_ROOT)) {          // ✅ correct
    result.qgis = true;
  } else {
    result.errors.push("QGIS not found");
  }

  if (fs.existsSync(path.join(QGIS_ROOT, "bin", "python.exe"))) {  // ✅ correct
    result.python = true;
  } else {
    result.errors.push("QGIS Python missing");
  }

  if (process.env.OSGEO4W_ROOT) {           // ✅ correct (Node ONLY)
    result.osgeo4w = true;
  }

  return result;
}
