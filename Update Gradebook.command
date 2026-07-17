#!/bin/bash
# Double-click this file (macOS) to update BC Gradebook to the latest version.
cd "$(dirname "$0")" || exit 1

echo "Checking for updates..."
if ! command -v git >/dev/null 2>&1; then
  echo "Git isn't available. The easiest fix is to update through GitHub Desktop"
  echo "(open the app and click 'Fetch origin', then 'Pull'), or install Git."
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi

git pull || { echo "Could not fetch updates — check your internet connection."; read -n 1 -s -r -p "Press any key to close..."; exit 1; }
npm install
echo ""
echo "You're up to date. Double-click 'Start Gradebook' to launch."
read -n 1 -s -r -p "Press any key to close..."
