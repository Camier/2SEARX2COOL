#!/bin/bash
# Install systemd services for 2SEARX2COOL

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="/etc/systemd/system"

echo "🚀 Installing 2SEARX2COOL systemd services..."

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run with sudo: sudo $0"
    exit 1
fi

# Copy service files
echo "📋 Copying service files..."
cp "$SCRIPT_DIR/searxng.service" "$SERVICE_DIR/"
cp "$SCRIPT_DIR/2searx2cool-orchestrator.service" "$SERVICE_DIR/"

# Reload systemd daemon
echo "🔄 Reloading systemd daemon..."
systemctl daemon-reload

# Enable services
echo "🔧 Enabling services..."
systemctl enable searxng.service
systemctl enable 2searx2cool-orchestrator.service

# Create necessary directories
echo "📁 Creating required directories..."
mkdir -p /home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED/orchestrator/logs
mkdir -p /home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED/searxng-wttr/searx/cache
mkdir -p /home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED/searxng-wttr/searx/favicons

# Set proper ownership
chown -R mik:mik /home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED/orchestrator/logs
chown -R mik:mik /home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED/searxng-wttr/searx/cache
chown -R mik:mik /home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED/searxng-wttr/searx/favicons

echo "✅ Services installed successfully!"
echo ""
echo "📌 To start services:"
echo "   sudo systemctl start searxng"
echo "   sudo systemctl start 2searx2cool-orchestrator"
echo ""
echo "📊 To check status:"
echo "   sudo systemctl status searxng"
echo "   sudo systemctl status 2searx2cool-orchestrator"
echo ""
echo "📜 To view logs:"
echo "   sudo journalctl -u searxng -f"
echo "   sudo journalctl -u 2searx2cool-orchestrator -f"