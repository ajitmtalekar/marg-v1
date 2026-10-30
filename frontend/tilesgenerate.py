import subprocess
import os
import sys

# ----------------- QGIS ENV SETUP -----------------

QGIS_ROOT = r"D:\Program Files\QGIS 3.40.12"

os.environ.update({
    "QGIS_PREFIX_PATH": QGIS_ROOT,
    "GDAL_DATA": os.path.join(QGIS_ROOT, "share", "gdal"),
    "PROJ_LIB": os.path.join(QGIS_ROOT, "share", "proj"),
    "PATH": (
        os.path.join(QGIS_ROOT, "bin") + ";" +
        os.path.join(QGIS_ROOT, "apps", "Python312", "Scripts") + ";" +
        os.environ["PATH"]
    )
})

print("Python:", sys.executable)
print("Using QGIS from:", QGIS_ROOT)

GDAL_TRANSLATE = os.path.join(QGIS_ROOT, "bin", "gdal_translate.exe")
GDAL_WARP      = os.path.join(QGIS_ROOT, "bin", "gdalwarp.exe")

# ----------------- INPUT / OUTPUT -----------------

INPUT_IMAGE = r"D:\programs\Marg-wayfinder\Master plan R15_With maftlal.pdf"

OUTPUT_PNG      = r"D:\programs\test\map_step1.png"
OUTPUT_4326_TIF = r"D:\programs\test\map_4326.tif"
OUTPUT_3857_TIF = r"D:\programs\test\map_3857.tif"

TILES_DIR       = r"D:\programs\test\tilestest"

# ----------------- GEO BOUNDS (WGS84) -----------------
# MUST BE EXACT

west  = 72.833260186449209
east  = 72.8418536
north = 18.981173884605585
south = 18.9754986

# ----------------- STEP 1: Convert PDF → PNG -----------------

subprocess.run([
    GDAL_TRANSLATE,
    "-of", "PNG",
    "-outsize", "12000", "0",
    INPUT_IMAGE,
    OUTPUT_PNG
], check=True)

print("Step 1 complete: PDF → PNG")

# ----------------- STEP 2: Assign WGS84 Bounds (EPSG:4326) -----------------

subprocess.run([
    GDAL_TRANSLATE,
    "-a_srs", "EPSG:4326",
    "-a_ullr",
    str(west), str(north),
    str(east), str(south),
    OUTPUT_PNG,
    OUTPUT_4326_TIF
], check=True)

print("Step 2 complete: Bounds assigned in EPSG:4326")

# ----------------- STEP 3: Reproject to EPSG:3857 -----------------
# 🔥 THIS IS THE CRITICAL FIX

subprocess.run([
    GDAL_WARP,
    "-t_srs", "EPSG:3857",
    "-r", "bilinear",
    "-dstalpha",
    OUTPUT_4326_TIF,
    OUTPUT_3857_TIF
], check=True)

print("Step 3 complete: Reprojected to EPSG:3857")

# ----------------- STEP 4: Generate XYZ Tiles -----------------

subprocess.run([
    os.path.join(QGIS_ROOT, "bin", "python.exe"),
    "-m", "osgeo_utils.gdal2tiles",
    "-z", "17-20",
    "--xyz",
    "--webviewer=none",
    OUTPUT_3857_TIF,
    TILES_DIR
], check=True)

if not any(os.scandir(TILES_DIR)):
    raise RuntimeError("❌ Tile directory empty — GDAL failed")

print("✅ Tiles generated successfully (EPSG:3857)")
