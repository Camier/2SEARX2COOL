# Windows Deployment Fix Script for 2SEARX2COOL
# Purpose: Ensure successful deployment on Windows systems
# Date: June 25, 2025

Write-Host "🔧 Starting Windows Deployment Fix for 2SEARX2COOL" -ForegroundColor Cyan

# Step 1: Clean existing installation
Write-Host "`n📦 Step 1: Cleaning existing installation..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "  - Removing node_modules..." -ForegroundColor Gray
    Remove-Item -Recurse -Force node_modules
}
if (Test-Path "package-lock.json") {
    Write-Host "  - Removing package-lock.json..." -ForegroundColor Gray
    Remove-Item -Force package-lock.json
}
if (Test-Path "dist") {
    Write-Host "  - Removing dist folder..." -ForegroundColor Gray
    Remove-Item -Recurse -Force dist
}

# Step 2: Verify package.json is fixed
Write-Host "`n🔍 Step 2: Verifying package.json..." -ForegroundColor Yellow
$packageJson = Get-Content package.json | ConvertFrom-Json
if ($packageJson.optionalDependencies -and $packageJson.optionalDependencies.usb) {
    Write-Host "  ❌ ERROR: USB dependency still present in package.json!" -ForegroundColor Red
    Write-Host "  Please ensure you have the latest code from WSL/Linux" -ForegroundColor Red
    exit 1
} else {
    Write-Host "  ✅ package.json is clean (no USB dependency)" -ForegroundColor Green
}

# Step 3: Install dependencies
Write-Host "`n📥 Step 3: Installing dependencies..." -ForegroundColor Yellow
Write-Host "  This may take a few minutes..." -ForegroundColor Gray
npm install --no-optional
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ npm install failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ Dependencies installed successfully" -ForegroundColor Green

# Step 4: Verify critical dependencies
Write-Host "`n🔍 Step 4: Verifying critical dependencies..." -ForegroundColor Yellow
$criticalDeps = @(
    "@electron/rebuild",
    "@tanstack/react-query",
    "electron",
    "electron-builder",
    "react",
    "express",
    "socket.io"
)
foreach ($dep in $criticalDeps) {
    if (Test-Path "node_modules/$dep") {
        Write-Host "  ✅ $dep installed" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $dep missing!" -ForegroundColor Red
        $failed = $true
    }
}
if ($failed) {
    Write-Host "`n❌ Some critical dependencies are missing. Please run npm install again." -ForegroundColor Red
    exit 1
}

# Step 5: Build the application
Write-Host "`n🏗️ Step 5: Building the application..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ Build completed successfully" -ForegroundColor Green

# Step 6: Test the development server
Write-Host "`n🧪 Step 6: Testing development server..." -ForegroundColor Yellow
Write-Host "  Starting dev server (press Ctrl+C after verification)..." -ForegroundColor Gray
Write-Host "  The app should open automatically in a new window" -ForegroundColor Gray
Write-Host "`n  Expected behavior:" -ForegroundColor Cyan
Write-Host "  - Electron window opens" -ForegroundColor White
Write-Host "  - Search interface loads" -ForegroundColor White
Write-Host "  - No GPU/display errors" -ForegroundColor White
Write-Host "  - Music player controls visible" -ForegroundColor White
Write-Host "`n  Press any key to start the dev server..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

npm run dev

# Final summary
Write-Host "`n✅ Windows Deployment Fix Complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. If the dev server worked, you can build for production: npm run build:win" -ForegroundColor White
Write-Host "2. To create installer: npm run dist" -ForegroundColor White
Write-Host "3. For development: npm run dev" -ForegroundColor White
Write-Host "`nTroubleshooting:" -ForegroundColor Yellow
Write-Host "- If Electron doesn't open: Check Windows Defender/Antivirus" -ForegroundColor Gray
Write-Host "- If build fails: Ensure Visual Studio Build Tools are installed" -ForegroundColor Gray
Write-Host "- If music doesn't play: Audio device detection is optional on Windows" -ForegroundColor Gray