#!/bin/bash
# Double-click this file (macOS) to launch BC Gradebook.
# It runs in your web browser via Node — no Electron, no install, no Gatekeeper
# "will damage your computer" warning.
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed."
  echo "Install it from https://nodejs.org (choose the LTS button), then try again."
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi

echo "Starting BC Gradebook — your browser will open in a moment."
echo "Keep this window open while you use it; close it to quit."
node server.js
