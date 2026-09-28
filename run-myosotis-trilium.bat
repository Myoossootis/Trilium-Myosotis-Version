@echo off
setlocal
rem Start the bundled Windows x64 Trilium runtime from its own directory so
rem its portable data folders are kept beside the program, never in AppData.
set "APP_DIR=%~dp0trilium-portable"
set "SEED_DB=%~dp0trilium-seed-data\document.db"
if not exist "%APP_DIR%\trilium-data\document.db" if exist "%SEED_DB%" (
    if not exist "%APP_DIR%\trilium-data" mkdir "%APP_DIR%\trilium-data"
    copy /Y "%SEED_DB%" "%APP_DIR%\trilium-data\document.db" >NUL
)
pushd "%APP_DIR%"
call trilium-portable.bat
popd
endlocal
