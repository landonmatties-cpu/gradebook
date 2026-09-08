@echo off
REM Double-click this file (Windows) to launch BC Gradebook.
REM It runs in your web browser via Node - no Electron, no install needed.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Install it from https://nodejs.org ^(choose the LTS button^), then try again.
  pause
  exit /b
)

echo Starting BC Gradebook - your browser will open in a moment.
echo Keep this window open while you use it; close it to quit.
node server.js
