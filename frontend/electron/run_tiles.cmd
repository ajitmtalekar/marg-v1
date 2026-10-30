@echo off
set QGIS_ROOT=D:\Program Files\QGIS 3.40.12

set QGIS_PREFIX_PATH=%QGIS_ROOT%
set PYTHONHOME=%QGIS_ROOT%\apps\Python312
set GDAL_DATA=%QGIS_ROOT%\share\gdal
set PROJ_LIB=%QGIS_ROOT%\share\proj

set PATH=%QGIS_ROOT%\apps\Python312;
set PATH=%QGIS_ROOT%\apps\Python312\Scripts;
set PATH=%QGIS_ROOT%\bin;
set PATH=%PATH%

"%QGIS_ROOT%\bin\python.exe" tilesgenerate.py
pause
