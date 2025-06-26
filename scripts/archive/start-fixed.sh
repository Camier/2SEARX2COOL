#!/bin/bash
# Fixed startup script for 2SEARX2COOL

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    if [ ! -z "$ORCHESTRATOR_PID" ]; then
        kill $ORCHESTRATOR_PID 2>/dev/null || true
        echo "✅ Orchestrator stopped"
    fi
    if [ ! -z "$SEARXNG_PID" ]; then
        kill $SEARXNG_PID 2>/dev/null || true
        echo "✅ SearXNG Core stopped"
    fi
    echo "👋 Services stopped"
}

trap cleanup EXIT INT TERM

echo "🚀 Starting 2SEARX2COOL Services (Fixed)"
echo "========================================"

# Kill any existing processes
echo "Cleaning up old processes..."
pkill -f "searx.webapp" 2>/dev/null || true
pkill -f "app.py" 2>/dev/null || true
pkill -f "app_production.py" 2>/dev/null || true
sleep 2

# Start SearXNG
echo ""
echo "🔍 Starting SearXNG Core on port 8888..."
cd "$PROJECT_ROOT/searxng-core/searxng-core"
# Use absolute path for venv because we're in a symlinked directory
if [ -f "$PROJECT_ROOT/searxng-core/searxng-venv/bin/activate" ]; then
    source "$PROJECT_ROOT/searxng-core/searxng-venv/bin/activate"
elif [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi
export SEARXNG_SETTINGS_PATH="$PROJECT_ROOT/config/searxng-settings.yml"
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
python -m searx.webapp --host 127.0.0.1 --port 8888 &
SEARXNG_PID=$!
echo "SearXNG started with PID: $SEARXNG_PID"
cd "$PROJECT_ROOT"

# Wait for SearXNG to start
echo "Waiting for SearXNG to start..."
sleep 5

# Start Orchestrator
echo ""
echo "🎭 Starting Flask Orchestrator on port 8889..."
source "$PROJECT_ROOT/venv/bin/activate"
export PYTHONPATH="${PYTHONPATH}:$PROJECT_ROOT:$PROJECT_ROOT/orchestrator"

# Add engine path to PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:$PROJECT_ROOT/engines"

cd "$PROJECT_ROOT/orchestrator"
if [ -f "app_production.py" ]; then
    python app_production.py &
    ORCHESTRATOR_PID=$!
    echo "Orchestrator (production) started with PID: $ORCHESTRATOR_PID"
elif [ -f "app.py" ]; then
    python app.py &
    ORCHESTRATOR_PID=$!
    echo "Orchestrator started with PID: $ORCHESTRATOR_PID"
else
    echo "ERROR: No orchestrator app file found!"
    kill $SEARXNG_PID
    exit 1
fi
cd "$PROJECT_ROOT"

# Wait for services to start
sleep 5

# Test the services
echo ""
echo "📊 Testing services..."
echo "---------------------"
echo -n "SearXNG Core (8888): "
curl -s http://localhost:8888/ >/dev/null && echo "✅ OK" || echo "❌ FAILED"

echo -n "Orchestrator (8889): "
curl -s http://localhost:8889/health >/dev/null && echo "✅ OK" || echo "❌ FAILED"

echo ""
echo "🎉 Services should be running at:"
echo "  🔍 SearXNG Core: http://localhost:8888"
echo "  🎭 Orchestrator: http://localhost:8889"
echo ""
echo "To stop: Press Ctrl+C"
echo ""

# Keep running
wait
