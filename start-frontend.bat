@echo off
title Dexter UI (frontend :8080)
cd /d "%~dp0dexter-front"
echo.
echo  [DEXTER] Starting frontend on http://localhost:8080
echo.
npm run dev
pause
