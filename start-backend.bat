@echo off
title Dexter API (backend :3000)
cd /d "%~dp0ai-scientist"
echo.
echo  [DEXTER] Starting backend API on http://localhost:3000
echo  [DEXTER] Fill in .env.local with OPENAI_API_KEY and TAVILY_API_KEY first
echo.
npm run dev
pause
