@echo off
setlocal
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  call npm install
)

echo Starting Sunshine Travel Web at http://127.0.0.1:5174/
start "Sunshine Travel Web" cmd /k "cd /d ""%~dp0"" && npm run dev -- --port 5174"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:5174/"

