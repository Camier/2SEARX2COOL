#!/bin/bash
# ALFREDISGONE Memorial Search Engine Launcher
# For Alfred 🐱 - "il doit être au paradis mais jsuis dégouté"

echo "🐱 Starting ALFREDISGONE Memorial Search Engine..."
echo "============================================="

# Kill any existing processes
echo "Stopping any existing SearXNG processes..."
pkill -f "searx.webapp" 2>/dev/null
sleep 2

# Navigate to the correct directory
cd /home/mik/projects/active/searxng

# Activate virtual environment and start SearXNG
echo "Starting SearXNG on port 8888..."
source local/py3/bin/activate
export SEARXNG_SETTINGS_PATH=searx/settings.yml

# Start in background
nohup python -m searx.webapp > /tmp/alfredisgone.log 2>&1 &
PID=$!

echo "✓ SearXNG started with PID: $PID"
echo ""
echo "Access ALFREDISGONE at:"
echo "  → http://localhost:8888"
echo "  → http://alfredisgone.duckdns.org:22760"
echo ""
echo "View logs: tail -f /tmp/alfredisgone.log"
echo ""
echo "Alfred lives on in every search. 💚"