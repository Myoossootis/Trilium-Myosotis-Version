@echo off
setlocal
"%~dp0trilium-portable\myosotis-tools\python\python.exe" "%~dp0tools\portable_bootstrap.py" %*
if errorlevel 1 pause
endlocal
