@echo off
REM Windows Deployment Fix Script for 2SEARX2COOL (Batch Version)
REM Purpose: Ensure successful deployment on Windows systems
REM Date: June 25, 2025

echo.
echo ========================================
echo  Windows Deployment Fix for 2SEARX2COOL
echo ========================================
echo.

REM Step 1: Clean existing installation
echo [1/6] Cleaning existing installation...
if exist node_modules (
    echo   - Removing node_modules...
    rmdir /s /q node_modules
)
if exist package-lock.json (
    echo   - Removing package-lock.json...
    del /f /q package-lock.json
)
if exist dist (
    echo   - Removing dist folder...
    rmdir /s /q dist
)
echo   Done!
echo.

REM Step 2: Install dependencies
echo [2/6] Installing dependencies...
echo   This may take several minutes...
call npm install --no-optional
if errorlevel 1 (
    echo.
    echo   ERROR: npm install failed!
    echo   Please check your Node.js installation and internet connection.
    pause
    exit /b 1
)
echo   Dependencies installed successfully!
echo.

REM Step 3: Build the application
echo [3/6] Building the application...
call npm run build
if errorlevel 1 (
    echo.
    echo   ERROR: Build failed!
    echo   Please check the error messages above.
    pause
    exit /b 1
)
echo   Build completed successfully!
echo.

REM Step 4: Create start script
echo [4/6] Creating start script...
echo @echo off > start-2searx2cool.bat
echo echo Starting 2SEARX2COOL... >> start-2searx2cool.bat
echo npm run dev >> start-2searx2cool.bat
echo   Start script created!
echo.

REM Step 5: Summary
echo ========================================
echo  DEPLOYMENT FIX COMPLETE!
echo ========================================
echo.
echo Next steps:
echo 1. Run "start-2searx2cool.bat" to start the application
echo 2. For production build: npm run build:win
echo 3. To create installer: npm run dist
echo.
echo If you encounter issues:
echo - Ensure Node.js 18+ is installed
echo - Check Windows Defender is not blocking Electron
echo - Run as Administrator if permission errors occur
echo.
pause