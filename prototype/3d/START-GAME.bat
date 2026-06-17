@echo off
cd /d "%~dp0"
title IamOK Dungeon - Local Server
echo ============================================
echo   IamOK Dungeon - Local Server
echo ============================================
echo.
echo This window will NOT close automatically.
echo If you see a red/yellow error below, screenshot it for Claude.
echo.
echo Starting PowerShell server...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"

echo.
echo ============================================
echo Server stopped, or failed to start (see above).
echo ============================================
echo.
echo Press any key to close this window...
pause >nul
