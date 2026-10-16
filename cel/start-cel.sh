#!/usr/bin/env bash
# Cel — spreadsheet (made by JJ van Schelven)
# Starts Cel on Linux or macOS: http://localhost:8081
# Usage: ./start-cel.sh    (first time: chmod +x start-cel.sh)
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found. Install it first:"
  echo "  Ubuntu/Debian: sudo apt install nodejs"
  echo "  Arch:          sudo pacman -S nodejs"
  echo "  Fedora:        sudo dnf install nodejs"
  exit 1
fi
URL="http://localhost:8081"
# open the browser shortly after the server has started
( sleep 1; if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"; elif command -v open >/dev/null 2>&1; then open "$URL"; else echo "Open $URL in your browser"; fi ) >/dev/null 2>&1 &
exec node server.js 8081
