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

echo "Launching BC Gradebook..."
npm start
