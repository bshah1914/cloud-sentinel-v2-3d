@echo off
title CloudSentinel - One Click Deploy
color 0A
echo.
echo  =============================================
echo    CloudSentinel v3.0 - One Click Deployment
echo    Enterprise Multi-Cloud Security Platform
echo  =============================================
echo.

:: Check Docker
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Docker is not installed!
    echo  Download Docker Desktop from:
    echo  https://www.docker.com/products/docker-desktop
    echo.
    echo  After installing, restart your PC and run this again.
    pause
    exit /b 1
)
echo  [OK] Docker found

:: Check Docker running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Docker Desktop is not running!
    echo  Please start Docker Desktop and wait until it's ready.
    pause
    exit /b 1
)
echo  [OK] Docker is running

:: Build and deploy
echo.
echo  [1/3] Building containers... (this may take 2-5 minutes first time)
echo.
docker-compose build --no-cache
if %errorlevel% neq 0 (
    echo  [ERROR] Build failed!
    pause
    exit /b 1
)
echo.
echo  [OK] Build complete

echo.
echo  [2/3] Starting CloudSentinel...
docker-compose up -d
if %errorlevel% neq 0 (
    echo  [ERROR] Failed to start containers!
    pause
    exit /b 1
)
echo  [OK] Containers started

:: Wait for backend to be ready
echo.
echo  [3/3] Waiting for services to be ready...
timeout /t 5 /nobreak >nul

:: Open browser
start http://localhost:7001

echo.
echo  =============================================
echo    CloudSentinel is LIVE!
echo  =============================================
echo.
echo    URL:    http://localhost:7001
echo    Login:  admin / admin123
echo.
echo    Commands:
echo      docker-compose logs -f    View logs
echo      docker-compose stop       Stop app
echo      docker-compose start      Start app
echo      docker-compose down       Remove containers
echo.
echo  =============================================
pause
