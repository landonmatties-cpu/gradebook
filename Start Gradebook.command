#!/bin/bash
# Double-click this file (macOS) to launch BC Gradebook.
cd "$(dirname "$0")" || exit 1

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js is not installed."
  echo "Install it from https://nodejs.org (choose the LTS button), then try again."
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First-time setup: installing components. This can take a couple of minutes..."
  npm install || { echo "Setup failed — check your internet connection."; read -n 1 -s -r -p "Press any key to close..."; exit 1; }
fi

# macOS marks files downloaded from the internet as "quarantined," which makes
# Gatekeeper show a false "Electron will damage your computer" warning when we
# run from source. Clearing that tag on our local copy of Electron is safe and
# stops the warning. (Harmless / no-op on other systems.)
if [ -d "node_modules/electron/dist/Electron.app" ]; then
  xattr -dr com.apple.quarantine "node_modules/electron/dist/Electron.app" 2>/dev/null
fi

echo "Launching BC Gradebook..."
npm start
