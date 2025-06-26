#!/bin/bash
# Simple Memory Bank Architecture Implementation Script
# This script implements the simplified Memory Bank Architecture for the SearxNG project

echo "Implementing Memory Bank Architecture..."
echo "-----------------------------------------"

# Step 1: Create basic directories
echo "Creating basic directory structure..."
mkdir -p docs scripts configs
echo "✅ Directory structure created"

# Step 2: Create simple README files
echo "Creating README files..."
echo "# SearxNG Documentation" > docs/README.md
echo "This directory contains all documentation files for the SearxNG project." >> docs/README.md

echo "# SearxNG Scripts" > scripts/README.md
echo "This directory contains all executable scripts for the SearxNG project." >> scripts/README.md

echo "# SearxNG Configurations" > configs/README.md
echo "This directory contains all configuration files for the SearxNG project." >> configs/README.md
echo "✅ README files created"

# Step 3: Move critical files
echo "Moving critical configuration files..."
if [ -f settings.yml ]; then
  cp settings.yml configs/
  echo "✅ Moved settings.yml to configs/"
else
  echo "⚠️ settings.yml not found in current directory"
fi

if [ -f docker-compose.yml ]; then
  cp docker-compose.yml configs/
  echo "✅ Moved docker-compose.yml to configs/"
else
  echo "⚠️ docker-compose.yml not found in current directory"
fi

echo "Moving critical script files..."
if [ -f fix_browser_tests.sh ]; then
  cp fix_browser_tests.sh scripts/
  echo "✅ Moved fix_browser_tests.sh to scripts/"
else
  echo "⚠️ fix_browser_tests.sh not found in current directory"
fi

if [ -f restart-searxng.sh ]; then
  cp restart-searxng.sh scripts/
  echo "✅ Moved restart-searxng.sh to scripts/"
else
  echo "⚠️ restart-searxng.sh not found in current directory"
fi

echo "Moving critical documentation files..."
if [ -f PROJECT_STATUS_20250517.md ]; then
  cp PROJECT_STATUS_20250517.md docs/status_current.md
  echo "✅ Moved PROJECT_STATUS_20250517.md to docs/status_current.md"
else
  echo "⚠️ PROJECT_STATUS_20250517.md not found in current directory"
fi

if [ -f SEARXNG_DEV_ENVIRONMENT_GUIDE.md ]; then
  cp SEARXNG_DEV_ENVIRONMENT_GUIDE.md docs/guide_dev_environment.md
  echo "✅ Moved SEARXNG_DEV_ENVIRONMENT_GUIDE.md to docs/guide_dev_environment.md"
else
  echo "⚠️ SEARXNG_DEV_ENVIRONMENT_GUIDE.md not found in current directory"
fi

if [ -f WSL_BROWSER_TESTING_GUIDE.md ]; then
  cp WSL_BROWSER_TESTING_GUIDE.md docs/guide_browser_testing.md
  echo "✅ Moved WSL_BROWSER_TESTING_GUIDE.md to docs/guide_browser_testing.md"
else
  echo "⚠️ WSL_BROWSER_TESTING_GUIDE.md not found in current directory"
fi

# Step 4: Create INDEX.md
echo "Creating INDEX.md..."
cat > INDEX.md << EOL
# SearxNG Project Documentation Index

## Status Documents
- [Current Status](docs/status_current.md) - Latest project status
- [Checkpoint May 16](SEARXNG_CHECKPOINT_20250516.md) - Previous checkpoint

## Guides
- [Development Environment Guide](docs/guide_dev_environment.md) - Setting up the dev environment
- [Browser Testing Guide](docs/guide_browser_testing.md) - How to run browser tests

## Configuration
- [Main Configuration](configs/settings.yml) - SearxNG configuration file
- [Docker Compose](configs/docker-compose.yml) - Docker configuration

## Scripts
- [Browser Tests Setup](scripts/fix_browser_tests.sh) - Setup for browser testing
- [Restart Service](scripts/restart-searxng.sh) - Restart the SearxNG service
EOL
echo "✅ INDEX.md created"

echo ""
echo "Implementation complete! ✨"
echo "Please run ./verify_memory_bank.sh to verify the implementation."