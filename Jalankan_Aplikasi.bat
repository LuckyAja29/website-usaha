@echo off
title BukuKas Usaha - Server
cd /d "%~dp0"

echo ===================================================================
echo   Menjalankan Server BukuKas Usaha...
echo   Mode: Auto-Save Langsung ke File Excel di Komputer (Tanpa Download)
echo ===================================================================
echo.

:: Jalankan PowerShell Server di background atau jendela ini
powershell -NoProfile -ExecutionPolicy Bypass -Command "$listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add('http://127.0.0.1:8080/'); $listener.Prefixes.Add('http://localhost:8080/'); try { $listener.Start() } catch { Write-Host 'Port 8080 sudah digunakan atau server sudah berjalan.' -ForegroundColor Yellow }; Start-Process 'http://localhost:8080'; Write-Host '============================================================' -ForegroundColor Cyan; Write-Host '  Server BukuKas Usaha Aktif di http://localhost:8080' -ForegroundColor Green; Write-Host '  Aplikasi telah dibuka di browser Anda.' -ForegroundColor Green; Write-Host '  JANGAN TUTUP jendela ini selama menggunakan aplikasi.' -ForegroundColor Yellow; Write-Host '============================================================' -ForegroundColor Cyan; & '%~dp0server.ps1'"

pause
