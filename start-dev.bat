@echo off
echo Starting ReclaimIt development environment...

REM Update app.json with current machine IP
echo Updating API URL in app.json with current IP...
PowerShell -ExecutionPolicy Bypass -File "%~dp0update-ip.ps1"

REM Start backend in a new terminal
start cmd /k "cd backend && npm run dev"

REM Start admin frontend in a new terminal
start cmd /k "cd admin-web && npm run dev"

REM Start mobile app in a new terminal
start cmd /k "cd mobile && npx expo start"

REM Start Python matching API in a new terminal
start cmd /k "cd AI && .venv\Scripts\activate && python matcher_api.py"

echo All services started.
