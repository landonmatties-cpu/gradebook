@echo off
REM Double-click this file (Windows) to update BC Gradebook to the latest version.
cd /d "%~dp0"

echo Checking for updates...
where git >nul 2>nul
if errorlevel 1 (
  echo Git isn't available. The easiest fix is to update through GitHub Desktop
  echo ^(open the app and click "Fetch origin", then "Pull"^), or install Git.
  pause
  exit /b
)

git pull
if errorlevel 1 (
  echo Could not fetch updates - check your internet connection.
  pause
  exit /b
)
call npm install
echo.
echo You're up to date. Double-click "Start Gradebook" to launch.
pause
