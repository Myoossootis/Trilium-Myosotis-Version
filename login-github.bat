@echo off
setlocal
"%~dp0trilium-portable\myosotis-tools\gh.exe" auth login --hostname github.com --git-protocol https --web
if errorlevel 1 goto end
echo GitHub login completed. Open the GitHub database sync plugin in Trilium.
:end
pause
endlocal
