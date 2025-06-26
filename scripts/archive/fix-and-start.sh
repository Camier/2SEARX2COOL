#!/bin/bash
# Fixed startup script for 2SEARX2COOL with SearXNG core

set -e

echo "🎵 Starting 2SEARX2COOL with SearXNG Core..."

# Set up Python path
export PYTHONPATH="${PYTHONPATH}:$(pwd):$(pwd)/searx"

# Ensure Redis is running
if ! pgrep -x "redis-server" > /dev/null; then
    echo "Starting Redis..."
    redis-server --daemonize yes
fi

# Start SearXNG on port 8888
echo "Starting SearXNG Core on port 8888..."
cd searx
python3 -m searx.webapp &
SEARXNG_PID=$!
cd ..

# Wait for SearXNG to start
sleep 3

# Start Orchestrator on port 8889
echo "Starting Orchestrator on port 8889..."
cd orchestrator
python3 app.py &
ORCHESTRATOR_PID=$!
cd ..

# Start Engine Bridge Service
echo "Starting Engine Bridge Service..."
cd engine-bridge
python3 engine_service.py &
BRIDGE_PID=$!
cd ..

echo ""
echo "✅ All services started!"
echo ""
echo "Services running:"
echo "- Redis: localhost:6379"
echo "- SearXNG Core: http://localhost:8888"
echo "- Orchestrator: http://localhost:8889"
echo "- Engine Bridge: JSON-RPC on stdin/stdout"
echo ""
echo "To start the desktop app:"
echo "npm run dev"
echo ""
echo "To stop all services:"
echo "kill $SEARXNG_PID $ORCHESTRATOR_PID $BRIDGE_PID"

# Keep script running
wait