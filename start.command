#!/bin/bash
cd "$(dirname "$0")"

if command -v python3 >/dev/null 2>&1; then
    PYCMD=python3
elif command -v python >/dev/null 2>&1; then
    PYCMD=python
else
    echo ""
    echo "ERROR: Python was not found on this computer."
    echo "This app needs Python installed to run it locally."
    echo "Download it for free from https://www.python.org/downloads/"
    echo ""
    read -p "Press Enter to close this window..."
    exit 1
fi

echo "Starting the Karaoke Chain Builder server..."
echo "Do not close this window while using the app - closing it stops the app."
echo ""

( sleep 2 && open "http://localhost:8000/" ) &
$PYCMD -m http.server 8000
