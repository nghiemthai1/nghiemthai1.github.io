@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve-local.ps1"
echo.
echo The local preview server has stopped.
echo Review any message above, then press any key to close this window.
pause >nul
