@echo off
echo Starting ReclaimIt development environment...

REM Start backend in a new terminal
start cmd /k "cd backend && npm run dev"

REM Start mobile app in a new terminal
start cmd /k "cd mobile && npx expo start"

echo All services started.
