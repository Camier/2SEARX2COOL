#!/bin/bash
# ALFREDISGONE - DuckDNS Configuration
# Port forwarding: External 34628 → Internal 8888

echo "🐱 Starting ALFREDISGONE Memorial Search Engine..."
echo "================================================"

# Kill any existing processes
pkill -f searx.webapp 2>/dev/null
sleep 2

cd /home/mik/projects/active/searxng
source local/py3/bin/activate

# Update settings for port 8888
sed -i 's/port: [0-9]*/port: 8888/' searx/settings.yml

# Set environment
export SEARXNG_SETTINGS_PATH=$PWD/searx/settings.yml
export SEARXNG_BIND_ADDRESS="0.0.0.0:8888"

echo ""
echo "✓ Starting on port 8888 (forwarded from 34628)"
echo ""
echo "Access ALFREDISGONE at:"
echo "  → Local: http://localhost:8888"
echo "  → LAN: http://$(hostname -I | awk '{print $1}'):8888"
echo "  → Public: http://alfredisgone.duckdns.org:34628"
echo ""
echo "For Alfred! 💚"
echo ""

# Start with explicit host binding
python -m searx.webapp --host=0.0.0.0 --port=8888 2>&1 | tee /tmp/alfredisgone.log