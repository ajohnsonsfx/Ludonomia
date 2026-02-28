@echo off
echo Cleaning up old server instances...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM cargo-tauri.exe >nul 2>&1
taskkill /F /IM ludonomia.exe >nul 2>&1

echo Starting Ludonomia Dev Server...
echo Close this window or press Ctrl+C to stop the server.
npx tauri dev
