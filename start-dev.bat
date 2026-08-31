@echo off
echo Starting ReclaimIt development environment...

REM Update app.json with current machine IP
echo Updating API URL in app.json with current IP...
PowerShell -ExecutionPolicy Bypass -File "%~dp0update-ip.ps1"

REM Start backend in a new terminal
start cmd /k "cd backend && npm run dev"

@REM REM Start admin frontend in a new terminal
@REM start cmd /k "cd admin-web && npm run dev"

REM Start mobile app in a new terminal
start cmd /k "cd mobile && npx expo start"

echo All services started.
