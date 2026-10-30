import subprocess
import os
import sys, os

if "QGIS_PREFIX_PATH" not in os.environ:
    raise RuntimeError("QGIS environment not initialized")

print("Python:", sys.executable)
print("Prefix:", sys.prefix)


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

GDAL_TRANSLATE = os.path.join(QGIS_ROOT, "bin", "gdal_translate.exe")
GDAL2TILES_PY = os.path.join(QGIS_ROOT, "apps", "Python312", "Scripts", "gdal2tiles.py")
GDAL2TILES_EXE = os.path.join(QGIS_ROOT, "apps", "Python312", "Scripts", "gdal2tiles.exe")


INPUT_IMAGE = r"D:\programs\zoo-wayfinder\Master plan R15_With maftlal.pdf"
OUTPUT_PNG  = r"D:\programs\test\zoo_maptest.png"
OUTPUT_TIF  = r"D:\programs\test\zoo_map_geotest.tif"
TILES_DIR   = r"D:\programs\test\tilestest"


# Geo bounds
#west  = 72.92760
#north = 19.13706
#east  = 72.94321
#south = 19.12540


west  = 72.833260186449209
east  = 72.8418536
north = 18.981173884605585
south = 18.9754986

# ----------------- ENV FIX (CRITICAL) -----------------

os.environ["PATH"] = os.path.join(QGIS_ROOT, "bin") + ";" + os.environ["PATH"]

# ----------------- STEP 1: Georeference -----------------

subprocess.run([
    GDAL_TRANSLATE,
    "-of", "PNG",
    "-co", "WORLDFILE=YES",
    "-a_srs", "EPSG:4326",
    "-outsize", "12000" ,"0",
    INPUT_IMAGE,
    OUTPUT_PNG
], check=True)

# ----------------- STEP 2: Georeference -----------------
subprocess.run([
    GDAL_TRANSLATE,
    "-a_srs", "EPSG:4326",
    "-a_ullr",
    str(west), str(north),
    str(east), str(south),
    OUTPUT_PNG,
    OUTPUT_TIF
], check=True)

# ----------------- STEP 3: Generate tiles -----------------
#python "D:\Program Files\QGIS 3.40.12\apps\Python312\Scripts\gdal2tiles.py" -z 17-20 -r bilinear --xyz  "D:\programs\zoo-wayfinder\zoo_map_geo.tif" tiles

#subprocess.run([
#    GDAL2TILES_EXE,
#    "-z", "17-20",
#    "-r", "bilinear",
#    "--xyz",
#    "--webviewer=none",
#    OUTPUT_TIF,
#    TILES_DIR
#], check=True)
#

subprocess.run([
    os.path.join(QGIS_ROOT, "bin", "python.exe"),
    "-m", "osgeo_utils.gdal2tiles",
    "-z", "17-20",
    "-r", "bilinear",
    "--xyz",
    "--webviewer=none",
    OUTPUT_TIF,
    TILES_DIR
], check=True)

if not any(os.scandir(TILES_DIR)):
    raise RuntimeError("❌ Tile directory empty — GDAL failed")


print("✅ Tiles generated successfully")
