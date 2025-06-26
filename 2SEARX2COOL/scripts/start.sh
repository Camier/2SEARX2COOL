#!/bin/bash

# SearXNG-Cool Startup Script - Consolidated Version
# Supports multiple startup modes via --mode option

set -e

PROJECT_ROOT="/home/mik/SEARXNG/2SEARX2COOL"

# Default mode
MODE="simple"

# Parse command line arguments
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --mode=MODE     Startup mode (default: simple)"
    echo "                  Available modes:"
    echo "                    minimal - No checks, quick startup"
    echo "                    simple  - Basic startup with cleanup"
    echo "                    wsl2    - WSL2 mode with external access"
    echo "  -h, --help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Default simple mode"
    echo "  $0 --mode=minimal     # Minimal startup"
    echo "  $0 --mode=wsl2        # WSL2 external access mode"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --mode=*)
            MODE="${1#*=}"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate mode
case $MODE in
    minimal|simple|wsl2)
        ;;
    *)
        echo "Invalid mode: $MODE"
        echo "Valid modes are: minimal, simple, wsl2"
        exit 1
        ;;
esac

# Common cleanup function
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

# Set trap for cleanup
trap cleanup EXIT INT TERM

# Mode-specific startup functions
start_minimal() {
    echo "🚀 Starting SearXNG-Cool (Minimal Mode)"
    echo "======================================"

    # Start SearXNG Core
    echo "🔍 Starting SearXNG Core..."
    cd "$PROJECT_ROOT/searxng-core/searxng-core"
    source searxng-venv/bin/activate
    export SEARXNG_SETTINGS_PATH="$PROJECT_ROOT/config/searxng-settings.yml"
    export SEARXNG_SECRET="35252cc1a9e34982a35fa65632c09f17"
    python searx/webapp.py --host 127.0.0.1 --port 8888 &
    SEARXNG_PID=$!
    echo "✅ SearXNG Core started (PID: $SEARXNG_PID)"

    # Start Orchestrator
    echo "🎭 Starting Flask Orchestrator..."
    cd "$PROJECT_ROOT/orchestrator"
    source "$PROJECT_ROOT/venv/bin/activate"
    python app.py &
    ORCHESTRATOR_PID=$!
    echo "✅ Orchestrator started (PID: $ORCHESTRATOR_PID)"

    echo ""
    echo "🎉 Services started!"
    echo "🔍 SearXNG Core: http://localhost:8888"
    echo "🎭 Orchestrator: http://localhost:8095"
    echo ""
    echo "Press Ctrl+C to stop"
    echo ""

    # Wait
    wait
}

start_simple() {
    echo "🚀 Starting SearXNG-Cool Services..."

    # Kill any existing processes
    echo "Cleaning up old processes..."
    pkill -f "searx.webapp" 2>/dev/null || true
    pkill -f "app.py" 2>/dev/null || true
    pkill -f "app_minimal.py" 2>/dev/null || true
    sleep 2

    # Start SearXNG
    echo "Starting SearXNG Core on port 8888..."
    cd "$PROJECT_ROOT/searxng-core/searxng-core"
    source ../searxng-venv/bin/activate
    export SEARXNG_SETTINGS_PATH="$PROJECT_ROOT/config/searxng-settings.yml"
    python -m searx.webapp --host 127.0.0.1 --port 8888 &
    SEARXNG_PID=$!
    echo "SearXNG started with PID: $SEARXNG_PID"

    # Wait a bit
    sleep 5

    # Start Orchestrator
    echo "Starting Flask Orchestrator on port 8095..."
    cd "$PROJECT_ROOT/orchestrator"
    source "$PROJECT_ROOT/venv/bin/activate"

    # Check which app file exists
    if [ -f "app.py" ]; then
        python app.py &
        ORCHESTRATOR_PID=$!
        echo "Orchestrator (app.py) started with PID: $ORCHESTRATOR_PID"
    elif [ -f "app_minimal.py" ]; then
        python app_minimal.py &
        ORCHESTRATOR_PID=$!
        echo "Orchestrator (app_minimal.py) started with PID: $ORCHESTRATOR_PID"
    else
        echo "ERROR: No app file found!"
        kill $SEARXNG_PID
        exit 1
    fi

    # Wait a bit for services to start
    sleep 5

    # Test the services
    echo ""
    echo "Testing services..."
    echo -n "SearXNG Core (8888): "
    curl -s http://localhost:8888/ >/dev/null && echo "✅ OK" || echo "❌ FAILED"

    echo -n "Orchestrator (8095): "
    curl -s http://localhost:8095/health >/dev/null && echo "✅ OK" || echo "❌ FAILED"

    echo ""
    echo "Services should be running at:"
    echo "- SearXNG Core: http://localhost:8888"
    echo "- Orchestrator: http://localhost:8095"
    echo ""
    echo "To stop: kill $SEARXNG_PID $ORCHESTRATOR_PID"
    echo "Or press Ctrl+C"

    # Keep running
    wait
}

start_wsl2() {
    # First stop any existing SearXNG instances
    echo "🛑 Stopping current SearXNG instances..."
    pkill -f "python.*searx.webapp" || true
    sleep 2

    echo "🚀 Starting SearXNG with WSL2 external access..."
    cd "$PROJECT_ROOT/searxng-core/searxng-core"

    # Get WSL2 IP
    WSL_IP=$(ip addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}')

    # Activate venv if available
    if [ -f "searxng-venv/bin/activate" ]; then
        source searxng-venv/bin/activate
    fi

    # Set env vars
    export SEARXNG_SETTINGS_PATH="$PROJECT_ROOT/config/searxng-settings.yml"
    export SEARXNG_SECRET="35252cc1a9e34982a35fa65632c09f17"
    export SEARXNG_REDIS_URL="redis://localhost:6380/2"

    # Start with 0.0.0.0 binding
    python -m searx.webapp --host 0.0.0.0 --port 8888 &
    SEARXNG_PID=$!

    echo "✅ SearXNG started with PID: $SEARXNG_PID"
    echo ""
    echo "🌐 Access URLs:"
    echo "   Local:    http://localhost:8888"
    echo "   Windows:  http://$WSL_IP:8888"
    echo ""
    
    # Note: In WSL2 mode, we don't start the orchestrator by default
    # as the focus is on external access to SearXNG
    echo "Note: Orchestrator not started in WSL2 mode"
    echo "To start orchestrator manually, run:"
    echo "  cd $PROJECT_ROOT/orchestrator"
    echo "  source $PROJECT_ROOT/venv/bin/activate"
    echo "  python app.py"
    echo ""
    echo "Press Ctrl+C to stop"

    wait $SEARXNG_PID
}

# Display startup information
echo "Starting SearXNG-Cool in $MODE mode"
echo "===================================="

# Execute based on mode
case $MODE in
    minimal)
        start_minimal
        ;;
    simple)
        start_simple
        ;;
    wsl2)
        start_wsl2
        ;;
esac