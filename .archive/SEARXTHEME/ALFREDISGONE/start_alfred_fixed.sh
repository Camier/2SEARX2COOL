#!/bin/bash
# ALFREDISGONE Fixed Launcher for WSL2 + VPN

echo "🐱 Starting ALFREDISGONE Memorial..."

# Kill any stuck processes
pkill -f searx.webapp 2>/dev/null
sleep 2

cd /home/mik/projects/active/searxng
source local/py3/bin/activate

# Force specific settings
export SEARXNG_SETTINGS_PATH=$PWD/searx/settings.yml
export SEARXNG_BIND_ADDRESS="0.0.0.0:8888"

echo "Starting on all interfaces (0.0.0.0:8888)..."
python -m searx.webapp

# If that fails, try localhost only:
# export SEARXNG_BIND_ADDRESS="127.0.0.1:8888"
# python -m searx.webapp