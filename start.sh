#!/bin/bash
# Unified 2SEARX2COOL Startup Script

# Default values
MODE="dev"
SERVICE="all"
DRY_RUN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --mode=*)
            MODE="${1#*=}"
            shift
            ;;
        --service=*)
            SERVICE="${1#*=}"
            shift
            ;;
        --help)
            echo "Usage: $0 [--mode=dev|prod|debug] [--service=all|searxng|orchestrator|bridge]"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to start SearXNG
start_searxng() {
    echo "Starting SearXNG..."
    cd "$BASE_DIR/searxng-wttr"
    export SEARXNG_SETTINGS_PATH="$BASE_DIR/config/searxng-settings.yml"
    
    if [ "$MODE" = "prod" ]; then
        python -m searx.webapp &
    else
        python -m searx.webapp --debug &
    fi
}

# Function to start Orchestrator
start_orchestrator() {
    echo "Starting Orchestrator..."
    cd "$BASE_DIR/orchestrator"
    
    if [ "$MODE" = "prod" ]; then
        python run_server.py &
    else
        python run_server.py --debug &
    fi
}

# Function to start Engine Bridge
start_bridge() {
    echo "Starting Engine Bridge..."
    cd "$BASE_DIR/integration"
    node engine-bridge.js &
}

# Start services based on selection
case $SERVICE in
    all)
        start_searxng
        sleep 2
        start_orchestrator
        sleep 1
        start_bridge
        ;;
    searxng)
        start_searxng
        ;;
    orchestrator)
        start_orchestrator
        ;;
    bridge)
        start_bridge
        ;;
esac

echo "Services started in $MODE mode"
wait
