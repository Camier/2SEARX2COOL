#!/bin/bash

# 2SEARX2COOL Integrated Startup Script
# Starts all necessary services for the integrated desktop application

echo "🎵 Starting 2SEARX2COOL Integrated..."

# Check if Redis is running
if ! pgrep -x "redis-server" > /dev/null; then
    echo "Starting Redis..."
    redis-server --daemonize yes
fi

# Function to start a service if not running
start_service() {
    local name=$1
    local port=$2
    local command=$3
    
    if ! lsof -i:$port > /dev/null 2>&1; then
        echo "Starting $name on port $port..."
        eval "$command"
        sleep 2
    else
        echo "$name already running on port $port"
    fi
}

# Start main SearXNG instance
start_service "SearXNG Main" 8888 "cd /home/mik/SEARXNG && python -m searx.webapp &"

# Start Orchestrator
start_service "Orchestrator" 8889 "cd orchestrator && python app.py &"

# Start Engine Bridge Service
echo "Starting Engine Bridge Service..."
cd engine-bridge
python engine_service.py ../engines &

echo "

✅ All services started!

Services running:
- Redis: localhost:6379
- SearXNG: http://localhost:8888
- Orchestrator: http://localhost:8889
- Engine Bridge: JSON-RPC on stdin/stdout

To start the desktop app:
npm run dev

To build for production:
npm run build
"