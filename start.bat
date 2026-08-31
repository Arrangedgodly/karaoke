@echo off
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
    set PYCMD=python
) else (
    where python3 >nul 2>nul
    if %errorlevel%==0 (
        set PYCMD=python3
    ) else (
        echo.
        echo ERROR: Python was not found on this computer.
        echo This app needs Python installed to run it locally.
        echo Download it for free from https://www.python.org/downloads/
        echo IMPORTANT: during install, check the box that says "Add Python to PATH".
        echo.
        pause
        exit /b 1
    )
)

echo Starting the VOXCHAIN server...
echo A new window will open to run it - do NOT close that window while using the app.
echo.
start "VOXCHAIN - DO NOT CLOSE while using the app" cmd /k %PYCMD% -m http.server 8000
timeout /t 2 /nobreak >nul
start "" http://localhost:8000/
