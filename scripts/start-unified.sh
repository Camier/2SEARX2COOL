#!/bin/bash
# Unified Startup Script for 2SEARX2COOL
# Supports service mode, desktop mode, and hybrid mode

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default mode
MODE="${APP_MODE:-hybrid}"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --mode)
            MODE="$2"
            shift 2
            ;;
        --service)
            MODE="service"
            shift
            ;;
        --desktop)
            MODE="desktop"
            shift
            ;;
        --hybrid)
            MODE="hybrid"
            shift
            ;;
        --sync-config)
            SYNC_CONFIG=true
            shift
            ;;
        --dev)
            DEV_MODE=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --mode <service|desktop|hybrid>  Set application mode (default: hybrid)"
            echo "  --service                        Start in service mode only"
            echo "  --desktop                        Start in desktop mode only"
            echo "  --hybrid                         Start in hybrid mode (default)"
            echo "  --sync-config                    Sync configurations before starting"
            echo "  --dev                           Start in development mode"
            echo "  --help                          Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Export mode
export APP_MODE=$MODE

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}    2SEARX2COOL Unified Startup - Mode: ${YELLOW}$MODE${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo

# Change to project root
cd "$PROJECT_ROOT"

# Function to check if a service is running
check_service() {
    local name=$1
    local port=$2
    
    if lsof -i:$port >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $name is running on port $port"
        return 0
    else
        echo -e "${RED}✗${NC} $name is not running on port $port"
        return 1
    fi
}

# Function to start Redis
start_redis() {
    echo -e "${YELLOW}Starting Redis...${NC}"
    
    if ! command -v redis-server &> /dev/null; then
        echo -e "${RED}Redis is not installed. Please install Redis first.${NC}"
        exit 1
    fi
    
    if check_service "Redis" 6379; then
        echo "Redis is already running"
    else
        redis-server --daemonize yes
        sleep 2
        check_service "Redis" 6379 || {
            echo -e "${RED}Failed to start Redis${NC}"
            exit 1
        }
    fi
}

# Function to initialize database
init_database() {
    echo -e "${YELLOW}Initializing database...${NC}"
    
    # Check if PostgreSQL is running
    if ! pg_isready -q; then
        echo -e "${RED}PostgreSQL is not running. Please start PostgreSQL first.${NC}"
        exit 1
    fi
    
    # Create database if it doesn't exist
    if ! psql -lqt | cut -d \| -f 1 | grep -qw searxng_cool_music; then
        echo "Creating database..."
        createdb searxng_cool_music || {
            echo -e "${YELLOW}Database may already exist${NC}"
        }
    fi
    
    echo -e "${GREEN}✓${NC} Database ready"
}

# Function to sync configurations
sync_configurations() {
    echo -e "${YELLOW}Synchronizing configurations...${NC}"
    
    if [ -f "$SCRIPT_DIR/sync-config.js" ]; then
        node "$SCRIPT_DIR/sync-config.js"
    else
        echo -e "${YELLOW}Config sync script not found, skipping...${NC}"
    fi
}

# Function to start Python services
start_python_services() {
    echo -e "${YELLOW}Starting Python services...${NC}"
    
    # Load configuration
    source "$PROJECT_ROOT/config/unified/config_bridge.py" 2>/dev/null || true
    
    # Start SearXNG
    echo "Starting SearXNG..."
    cd "$PROJECT_ROOT/searxng-convivial"
    
    # Set environment variables
    export SEARXNG_SETTINGS_PATH="$PROJECT_ROOT/config/searxng-settings.yml"
    
    if [ "$DEV_MODE" = true ]; then
        # Development mode
        python -m searx.webapp &
        SEARXNG_PID=$!
    else
        # Production mode with gunicorn
        gunicorn searx.webapp:app \
            --bind 0.0.0.0:${SEARXNG_PORT:-8888} \
            --workers 4 \
            --timeout 120 \
            --daemon \
            --pid /tmp/searxng.pid
    fi
    
    sleep 3
    check_service "SearXNG" ${SEARXNG_PORT:-8888}
    
    # Start Orchestrator
    echo "Starting Orchestrator..."
    cd "$PROJECT_ROOT/orchestrator"
    
    if [ "$DEV_MODE" = true ]; then
        # Development mode
        python app.py &
        ORCHESTRATOR_PID=$!
    else
        # Production mode
        gunicorn app:app \
            --bind 0.0.0.0:${ORCHESTRATOR_PORT:-8889} \
            --workers 2 \
            --daemon \
            --pid /tmp/orchestrator.pid
    fi
    
    sleep 3
    check_service "Orchestrator" ${ORCHESTRATOR_PORT:-8889}
    
    cd "$PROJECT_ROOT"
}

# Function to start Electron app
start_electron_app() {
    echo -e "${YELLOW}Starting Electron desktop app...${NC}"
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    fi
    
    if [ "$DEV_MODE" = true ]; then
        # Development mode
        npm run dev
    else
        # Production mode
        npm start
    fi
}

# Function to show status
show_status() {
    echo
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                    Service Status                      ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    
    check_service "Redis" 6379
    check_service "SearXNG" ${SEARXNG_PORT:-8888}
    check_service "Orchestrator" ${ORCHESTRATOR_PORT:-8889}
    
    echo
    echo -e "${GREEN}Services are ready!${NC}"
    echo
    echo -e "Access points:"
    echo -e "  • SearXNG:      ${BLUE}http://localhost:${SEARXNG_PORT:-8888}${NC}"
    echo -e "  • Orchestrator: ${BLUE}http://localhost:${ORCHESTRATOR_PORT:-8889}${NC}"
    
    if [ "$MODE" != "service" ]; then
        echo -e "  • Desktop App:  ${BLUE}Starting...${NC}"
    fi
    
    echo
}

# Function to stop services
stop_services() {
    echo
    echo -e "${YELLOW}Stopping services...${NC}"
    
    # Stop Python services
    if [ -f /tmp/searxng.pid ]; then
        kill $(cat /tmp/searxng.pid) 2>/dev/null || true
        rm -f /tmp/searxng.pid
    fi
    
    if [ -f /tmp/orchestrator.pid ]; then
        kill $(cat /tmp/orchestrator.pid) 2>/dev/null || true
        rm -f /tmp/orchestrator.pid
    fi
    
    # Kill development mode processes if running
    [ ! -z "$SEARXNG_PID" ] && kill $SEARXNG_PID 2>/dev/null || true
    [ ! -z "$ORCHESTRATOR_PID" ] && kill $ORCHESTRATOR_PID 2>/dev/null || true
    
    echo -e "${GREEN}✓${NC} Services stopped"
}

# Set up signal handlers
trap stop_services EXIT INT TERM

# Main execution
main() {
    # Sync configurations if requested
    if [ "$SYNC_CONFIG" = true ]; then
        sync_configurations
        echo
    fi
    
    # Start services based on mode
    case $MODE in
        service)
            echo "Starting in SERVICE mode..."
            start_redis
            init_database
            start_python_services
            show_status
            
            # Keep script running
            echo -e "${YELLOW}Press Ctrl+C to stop services${NC}"
            while true; do
                sleep 1
            done
            ;;
            
        desktop)
            echo "Starting in DESKTOP mode..."
            # Assume services are running externally
            start_electron_app
            ;;
            
        hybrid)
            echo "Starting in HYBRID mode..."
            start_redis
            init_database
            start_python_services
            show_status
            
            # Wait a bit for services to stabilize
            sleep 2
            
            # Start Electron app
            start_electron_app
            ;;
            
        *)
            echo -e "${RED}Invalid mode: $MODE${NC}"
            exit 1
            ;;
    esac
}

# Run main function
main