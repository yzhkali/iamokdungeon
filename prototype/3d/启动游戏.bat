@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 没事地下城 - 本地服务器(诊断版)
echo ============================================
echo   没事地下城 - 本地服务器
echo ============================================
echo.
echo 这个窗口无论如何都不会自动关闭。
echo 如果下面出现红色/英文报错,请截图发给 Claude。
echo.
echo 正在尝试启动 PowerShell 服务器...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"

echo.
echo ============================================
echo 服务器已停止,或启动失败(看上面的信息)。
echo ============================================
echo.
echo 按任意键关闭这个窗口...
pause >nul
