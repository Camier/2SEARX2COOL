#!/bin/bash
# Proper startup script for 2SEARX2COOL with correct Python paths

set -e

echo "🎵 Starting 2SEARX2COOL Services Properly..."

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Export Python path for proper imports
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
export SEARXNG_SETTINGS_PATH="$(pwd)/config/searxng-settings.yml"

# Ensure Redis is running
if ! pgrep -x "redis-server" > /dev/null; then
    echo "Starting Redis..."
    redis-server --daemonize yes
fi

# Kill any existing services
echo "Cleaning up old processes..."
pkill -f "searx.webapp" 2>/dev/null || true
pkill -f "orchestrator" 2>/dev/null || true
pkill -f "engine_service" 2>/dev/null || true
sleep 2

# Start SearXNG using the correct method
echo "Starting SearXNG Core on port 8888..."
cd "$SCRIPT_DIR"
python3 -m searx.webapp --host 127.0.0.1 --port 8888 > searxng.log 2>&1 &
SEARXNG_PID=$!
echo "SearXNG PID: $SEARXNG_PID"

# Wait for SearXNG to start
echo "Waiting for SearXNG to start..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:8888 > /dev/null; then
        echo "✅ SearXNG is running!"
        break
    fi
    sleep 1
done

# Start Orchestrator with correct module path
echo "Starting Orchestrator on port 8889..."
cd "$SCRIPT_DIR"
python3 -m orchestrator.app > orchestrator.log 2>&1 &
ORCHESTRATOR_PID=$!
echo "Orchestrator PID: $ORCHESTRATOR_PID"

# Wait for Orchestrator
echo "Waiting for Orchestrator to start..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:8889/health > /dev/null; then
        echo "✅ Orchestrator is running!"
        break
    fi
    sleep 1
done

# Start Engine Bridge
echo "Starting Engine Bridge Service..."
cd "$SCRIPT_DIR/engine-bridge"
python3 engine_service.py > ../engine-bridge.log 2>&1 &
BRIDGE_PID=$!
echo "Engine Bridge PID: $BRIDGE_PID"

echo ""
echo "✅ All services started!"
echo ""
echo "Services running:"
echo "- Redis: localhost:6379"
echo "- SearXNG Core: http://localhost:8888"
echo "- Orchestrator: http://localhost:8889"
echo "- Engine Bridge: JSON-RPC service"
echo ""
echo "Logs:"
echo "- SearXNG: searxng.log"
echo "- Orchestrator: orchestrator.log"
echo "- Engine Bridge: engine-bridge.log"
echo ""
echo "To test: curl http://localhost:8888/search?q=test"
echo "To stop: kill $SEARXNG_PID $ORCHESTRATOR_PID $BRIDGE_PID"
echo ""
echo "To start desktop app: npm run dev"