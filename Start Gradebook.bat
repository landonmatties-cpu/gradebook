@echo off
REM Double-click this file (Windows) to launch BC Gradebook.
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Install it from https://nodejs.org ^(choose the LTS button^), then try again.
  pause
  exit /b
)

if not exist node_modules (
  echo First-time setup: installing components. This can take a couple of minutes...
  call npm install
  if errorlevel 1 (
    echo Setup failed - check your internet connection.
    pause
    exit /b
  )
)

echo Launching BC Gradebook...
call npm start
