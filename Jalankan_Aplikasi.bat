@echo off
title BukuKas Usaha - Local Server
cd /d "%~dp0"
echo ========================================================
echo   Membuka BukuKas Usaha di http://localhost:8080
echo   Mode: Auto-Save Langsung ke File Excel
echo ========================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause