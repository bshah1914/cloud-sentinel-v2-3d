@echo off
title CloudSentinel - First Time Setup
color 0A
echo ============================================
echo    CloudSentinel - First Time Setup
echo ============================================
echo.

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed!
    echo Download from: https://python.org/downloads
    echo IMPORTANT: Check "Add Python to PATH" during install
    pause
    exit /b 1
)
echo [OK] Python found

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Download from: https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js found

:: Install Backend Dependencies
echo.
echo [1/2] Installing backend dependencies...
cd /d "%~dp0"
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Backend install failed
    pause
    exit /b 1
)
echo [OK] Backend dependencies installed

:: Install Frontend Dependencies
echo.
echo [2/2] Installing frontend dependencies...
cd /d "%~dp0frontend"
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Frontend install failed
    pause
    exit /b 1
)
echo [OK] Frontend dependencies installed

echo.
echo ============================================
echo    Setup Complete!
echo    Run start.bat to launch CloudSentinel
echo ============================================
pause
