#!/bin/bash
# ALFREDISGONE - Find free port and start

echo "🐱 Starting ALFREDISGONE Memorial Search Engine..."
pkill -f searx.webapp 2>/dev/null
sleep 2

cd /home/mik/projects/active/searxng
source local/py3/bin/activate

# Find a free port
for PORT in 8889 8890 8891 8892 8893 8894 8895; do
    if ! nc -z localhost $PORT 2>/dev/null; then
        echo "✓ Found free port: $PORT"
        
        # Update settings
        sed -i "s/port: [0-9]*/port: $PORT/" searx/settings.yml
        
        # Start SearXNG
        export SEARXNG_SETTINGS_PATH=$PWD/searx/settings.yml
        echo ""
        echo "ALFREDISGONE is starting on:"
        echo "→ http://localhost:$PORT"
        echo "→ http://$(hostname -I | awk '{print $1}'):$PORT"
        echo ""
        echo "For Alfred! 💚"
        
        python -m searx.webapp
        exit 0
    fi
done

echo "❌ No free ports found!"