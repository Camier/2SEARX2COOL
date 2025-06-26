#!/bin/bash
# ALFREDISGONE Memorial Search Engine - Multi-Access Launcher
# For Alfred 🐱 - "il doit être au paradis mais jsuis dégouté"

echo "🐱 ALFREDISGONE Memorial Search Engine Launcher"
echo "=============================================="
echo ""

# Kill any existing processes
pkill -f "searx.webapp" 2>/dev/null
sleep 2

# Navigate to the correct directory
cd /home/mik/projects/active/searxng

# Activate virtual environment
source local/py3/bin/activate

# Option selection
echo "Choose access method for ALFREDISGONE:"
echo "1) Local only (localhost:8888) - Most reliable with VPN"
echo "2) LAN access (0.0.0.0:8888) - Share with devices on your network" 
echo "3) Tailscale (100.x.x.x:8888) - Share securely with chosen devices"
echo "4) DuckDNS (alfredisgone.duckdns.org) - Public access"
echo ""
read -p "Select option (1-4): " choice

case $choice in
    1)
        export SEARXNG_BIND_ADDRESS="127.0.0.1:8888"
        ACCESS_URL="http://localhost:8888"
        ;;
    2)
        export SEARXNG_BIND_ADDRESS="0.0.0.0:8888"
        # Get LAN IP
        LAN_IP=$(hostname -I | awk '{print $1}')
        ACCESS_URL="http://$LAN_IP:8888"
        ;;
    3)
        # Tailscale is better than DuckDNS for private sharing
        export SEARXNG_BIND_ADDRESS="0.0.0.0:8888"
        TAILSCALE_IP=$(tailscale ip -4 2>/dev/null || echo "Install Tailscale first")
        ACCESS_URL="http://$TAILSCALE_IP:8888"
        ;;
    4)
        export SEARXNG_BIND_ADDRESS="0.0.0.0:8888"
        ACCESS_URL="http://alfredisgone.duckdns.org:22760"
        echo "⚠️  Note: You'll need port forwarding 22760→8888 on your router"
        ;;
esac

# Force environment settings
export SEARXNG_SETTINGS_PATH=$PWD/searx/settings.yml
export SEARXNG_DEBUG=0

echo ""
echo "Starting ALFREDISGONE..."
echo "Access at: $ACCESS_URL"
echo ""

# Start with explicit host and port
python -m searx.webapp --host ${SEARXNG_BIND_ADDRESS%:*} --port ${SEARXNG_BIND_ADDRESS#*:} 2>&1 | tee /tmp/alfredisgone.log