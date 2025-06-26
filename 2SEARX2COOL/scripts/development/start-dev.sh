#!/bin/bash

# SearXNG-Cool Development Startup Script - Consolidated Version
# Supports multiple modes via command-line flags

set -e

PROJECT_ROOT="/home/mik/SEARXNG/2SEARX2COOL"
SEARXNG_CORE_DIR="$PROJECT_ROOT/searxng-core/searxng-core"
ORCHESTRATOR_DIR="$PROJECT_ROOT/orchestrator"
CONFIG_DIR="$PROJECT_ROOT/config"

# Default settings
DEBUG_MODE=false
FIXED_MODE=false
NO_REDIS=false
VERBOSE=false

# Parse command line arguments
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --debug      Enable debug mode with verbose output"
    echo "  --fixed      Use fixed paths and skip some checks"
    echo "  --no-redis   Skip Redis connectivity check"
    echo "  -v, --verbose Enable verbose output"
    echo "  -h, --help   Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Normal startup"
    echo "  $0 --debug            # Debug mode with extra output"
    echo "  $0 --fixed            # Fixed mode for known issues"
    echo "  $0 --no-redis         # Skip Redis check"
    echo "  $0 --debug --no-redis # Combine multiple flags"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --debug)
            DEBUG_MODE=true
            VERBOSE=true
            shift
            ;;
        --fixed)
            FIXED_MODE=true
            shift
            ;;
        --no-redis)
            NO_REDIS=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
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

# Debug output function
debug() {
    if [ "$VERBOSE" = true ]; then
        echo "DEBUG: $*"
    fi
}

# Display startup mode
echo "🚀 Starting SearXNG-Cool Development Environment"
if [ "$DEBUG_MODE" = true ]; then
    echo "   Mode: DEBUG"
fi
if [ "$FIXED_MODE" = true ]; then
    echo "   Mode: FIXED"
fi
if [ "$NO_REDIS" = true ]; then
    echo "   Mode: NO-REDIS"
fi
echo "================================================"

# Check if Redis is running on port 6379
if [ "$NO_REDIS" = false ]; then
    echo "📡 Checking Redis connection..."
    if [ "$DEBUG_MODE" = true ]; then
        debug "Testing Redis with timeout..."
        if timeout 2 redis-cli -p 6379 ping 2>&1; then
            echo "✅ Redis is running"
        else
            echo "⚠️  Redis check failed, but continuing anyway..."
            debug "Redis might be running but not responding to ping"
        fi
    else
        if ! redis-cli -p 6379 ping >/dev/null 2>&1; then
            echo "❌ Redis is not running on port 6379"
            echo "Please start Redis with: redis-server --port 6379"
            exit 1
        fi
        echo "✅ Redis is running"
    fi
else
    echo "⚠️  Skipping Redis check (--no-redis flag)"
fi

# Check PostgreSQL connection
echo "🗄️  Checking PostgreSQL connection..."
if [ "$FIXED_MODE" = true ] || [ "$DEBUG_MODE" = true ]; then
    if PGPASSWORD=secure_password_here psql -U searxng_cool -d searxng_cool_auth -h localhost -c "SELECT 1;" >/dev/null 2>&1; then
        echo "✅ PostgreSQL is running"
    else
        echo "⚠️  PostgreSQL connection failed - continuing anyway"
        debug "Database might need to be created first"
    fi
else
    if ! psql -U searxng_cool -d searxng_cool_auth -h localhost -c "SELECT 1;" >/dev/null 2>&1; then
        echo "❌ PostgreSQL connection failed"
        echo "Please ensure PostgreSQL is running and database is configured"
        exit 1
    fi
    echo "✅ PostgreSQL is running"
fi

# Function to start SearXNG core
start_searxng() {
    echo "🔍 Starting SearXNG Core..."
    
    if [ "$FIXED_MODE" = true ]; then
        # Fixed mode - check actual structure
        debug "Checking SearXNG directory structure..."
        debug "SEARXNG_CORE_DIR: $SEARXNG_CORE_DIR"
        [ "$VERBOSE" = true ] && ls -la "$PROJECT_ROOT/searxng-core/" || true
        
        # Go to the actual searxng code directory
        cd "$PROJECT_ROOT/searxng-core/searxng-core"
        
        # Activate virtual environment (it's one level up)
        debug "Activating virtual environment..."
        source ../searxng-venv/bin/activate
    else
        cd "$SEARXNG_CORE_DIR"
        
        # Check if virtualenv exists
        if [ "$DEBUG_MODE" = true ] && [ ! -d "searxng-venv" ]; then
            debug "SearXNG virtual environment not found at $SEARXNG_CORE_DIR/searxng-venv"
            debug "Contents of searxng-core directory:"
            ls -la
        fi
        
        # Activate SearXNG virtual environment
        source searxng-venv/bin/activate
    fi
    
    # Set environment variables
    export SEARXNG_SETTINGS_PATH="$CONFIG_DIR/searxng-settings.yml"
    export SEARXNG_SECRET="35252cc1a9e34982a35fa65632c09f17"
    export SEARXNG_REDIS_URL="redis://localhost:6379/2"
    
    debug "SEARXNG_SETTINGS_PATH=$SEARXNG_SETTINGS_PATH"
    if [ "$DEBUG_MODE" = true ]; then
        debug "Checking if settings file exists..."
        ls -la "$SEARXNG_SETTINGS_PATH" || echo "Settings file not found!"
    fi
    
    if [ "$FIXED_MODE" = true ]; then
        # Check if searx module exists
        debug "Checking for searx module..."
        ls -la searx/webapp.py || echo "searx/webapp.py not found!"
        
        # Start SearXNG using module syntax
        debug "Starting SearXNG webapp..."
        python -m searx.webapp --host 127.0.0.1 --port 8888 &
    else
        # Start SearXNG in background
        debug "Starting SearXNG webapp..."
        python searx/webapp.py --host 127.0.0.1 --port 8888 &
    fi
    
    SEARXNG_PID=$!
    echo "✅ SearXNG Core started (PID: $SEARXNG_PID)"
    
    # Wait for SearXNG to be ready
    echo "⏳ Waiting for SearXNG to be ready..."
    for i in {1..30}; do
        if curl -s http://localhost:8888/ >/dev/null 2>&1; then
            echo "✅ SearXNG Core is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            echo "❌ SearXNG Core failed to start"
            if [ "$DEBUG_MODE" = true ]; then
                debug "Checking if process is still running..."
                ps -p $SEARXNG_PID || echo "Process died"
            fi
            if [ "$FIXED_MODE" = true ]; then
                # Check logs
                debug "Last 20 lines of output:"
                tail -20 /tmp/searxng-output.log 2>/dev/null || echo "No log file"
            fi
            kill $SEARXNG_PID 2>/dev/null || true
            return 1
        fi
        [ "$DEBUG_MODE" = true ] && echo -n "." || true
        sleep 1
    done
    [ "$DEBUG_MODE" = true ] && echo "" || true
}

# Function to start Orchestrator
start_orchestrator() {
    echo "🎭 Starting Flask Orchestrator..."
    cd "$ORCHESTRATOR_DIR"
    
    # Check if virtualenv exists
    if [ "$DEBUG_MODE" = true ] && [ ! -d "$PROJECT_ROOT/venv" ]; then
        debug "Main virtual environment not found at $PROJECT_ROOT/venv"
    fi
    
    # Activate main virtual environment
    source "$PROJECT_ROOT/venv/bin/activate"
    
    if [ "$DEBUG_MODE" = true ] || [ "$FIXED_MODE" = true ]; then
        debug "Checking orchestrator files..."
        ls -la app.py || ls -la app_minimal.py || echo "No app files found!"
        
        # Check which app file to use
        if [ -f "app.py" ]; then
            APP_FILE="app.py"
        elif [ -f "app_minimal.py" ]; then
            APP_FILE="app_minimal.py"
        else
            echo "❌ No Flask app file found!"
            return 1
        fi
        
        # Start orchestrator with error output
        debug "Starting Flask app with $APP_FILE..."
        python $APP_FILE 2>&1 &
    else
        # Start orchestrator
        python app.py &
    fi
    
    ORCHESTRATOR_PID=$!
    echo "✅ Orchestrator started (PID: $ORCHESTRATOR_PID)"
    
    # Wait for orchestrator to be ready
    echo "⏳ Waiting for Orchestrator to be ready..."
    for i in {1..20}; do
        if curl -s http://localhost:8095/health >/dev/null 2>&1; then
            echo "✅ Orchestrator is ready"
            break
        fi
        if [ $i -eq 20 ]; then
            echo "❌ Orchestrator failed to start"
            if [ "$DEBUG_MODE" = true ]; then
                debug "Checking if process is still running..."
                ps -p $ORCHESTRATOR_PID || echo "Process died"
            fi
            kill $ORCHESTRATOR_PID 2>/dev/null || true
            kill $SEARXNG_PID 2>/dev/null || true
            return 1
        fi
        [ "$DEBUG_MODE" = true ] && echo -n "." || true
        sleep 1
    done
    [ "$DEBUG_MODE" = true ] && echo "" || true
}

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
    echo "👋 Development environment stopped"
}

# Set trap for cleanup
trap cleanup EXIT INT TERM

# Start services
if [ "$FIXED_MODE" = true ]; then
    echo "Starting SearXNG first..."
fi

if start_searxng; then
    if [ "$FIXED_MODE" = true ]; then
        echo "Starting Orchestrator..."
    fi
    
    if start_orchestrator; then
        echo ""
        echo "🎉 SearXNG-Cool Development Environment is running!"
        echo "================================================"
        echo "🔍 SearXNG Core:     http://localhost:8888"
        echo "🎭 Orchestrator:     http://localhost:8095"
        echo "📊 Health Check:     http://localhost:8095/health"
        echo "🔐 Auth Status:      http://localhost:8095/auth/status"
        echo "📡 API Status:       http://localhost:8095/api/status"
        echo "🌐 WebSocket Status: http://localhost:8095/ws/status"
        echo ""
        
        if [ "$NO_REDIS" = true ]; then
            echo "⚠️  Note: Redis connectivity check was skipped"
            echo "    Some features may not work properly"
            echo ""
        fi
        
        if [ "$FIXED_MODE" = true ]; then
            echo "🔧 Debugging Tips:"
            echo "- Check processes: ps aux | grep -E 'searx|flask'"
            echo "- Check ports: netstat -tlnp | grep -E '8888|8095'"
            echo "- SearXNG logs: Check console output above"
            echo "- Orchestrator logs: Check console output above"
            echo ""
        fi
        
        echo "Press Ctrl+C to stop all services"
        
        # Keep script running
        wait
    else
        echo "❌ Failed to start Orchestrator"
        exit 1
    fi
else
    echo "❌ Failed to start SearXNG Core"
    exit 1
fi