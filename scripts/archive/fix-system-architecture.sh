#!/bin/bash
# Fix 2SEARX2COOL Architecture Based on Discovery

set -e

echo "🔧 Fixing 2SEARX2COOL System Architecture"
echo "========================================"

PROJECT_ROOT="/home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED"
cd "$PROJECT_ROOT"

# 1. Fix SearXNG Core Setup
echo ""
echo "📁 1. Setting up SearXNG Core structure..."
echo "----------------------------------------"

# Option A: Use the existing searxng-wttr as searxng-core
if [ -d "/home/mik/SEARXNG/searxng-wttr" ]; then
    echo "Using existing searxng-wttr as base..."
    mkdir -p searxng-core
    ln -sfn /home/mik/SEARXNG/searxng-wttr searxng-core/searxng-core
    
    # Create virtual environment symlink
    if [ -d "/home/mik/SEARXNG/searxng-wttr/venv" ]; then
        ln -sfn /home/mik/SEARXNG/searxng-wttr/venv searxng-core/searxng-venv
    else
        echo "Creating new searxng-venv..."
        cd searxng-core
        python3 -m venv searxng-venv
        cd ..
    fi
else
    echo "ERROR: searxng-wttr not found. Need to set up SearXNG core manually."
    exit 1
fi

# 2. Fix Configuration
echo ""
echo "⚙️ 2. Setting up configuration..."
echo "--------------------------------"

# Ensure config directory exists
mkdir -p config

# Create searxng-settings.yml if it doesn't exist
if [ ! -f "config/searxng-settings.yml" ]; then
    echo "Creating searxng-settings.yml..."
    cat > config/searxng-settings.yml << 'EOF'
# SearXNG settings for 2SEARX2COOL
use_default_settings: true

general:
    debug: false
    instance_name: "2SEARX2COOL Music Search"

search:
    safe_search: 0
    autocomplete: "google"
    default_lang: "en"
    max_page: 5

server:
    port: 8888
    bind_address: "127.0.0.1"
    secret_key: "35252cc1a9e34982a35fa65632c09f17"
    limiter: false
    public_instance: false

ui:
    default_locale: "en"
    query_in_title: true
    infinite_scroll: true
    center_alignment: false
    cache_url: ""
    default_theme: "simple"
    theme_args:
        simple_style: "auto"

outgoing:
    request_timeout: 3.0
    useragent_suffix: ""
    pool_connections: 100
    pool_maxsize: 20
    enable_http2: true

# Music engines will be added by orchestrator
engines: []

categories_as_tabs:
    general:
    images:
    videos:
    news:
    music:
    files:
    science:

enabled_plugins:
    - 'Hash plugin'
    - 'Search on category select'
    - 'Self Information'
    - 'Tracker URL remover'
EOF
fi

# 3. Fix Virtual Environments
echo ""
echo "🐍 3. Setting up virtual environments..."
echo "---------------------------------------"

# Main project venv
if [ ! -d "venv" ]; then
    echo "Creating main project virtual environment..."
    python3 -m venv venv
fi

# 4. Fix Orchestrator
echo ""
echo "🎭 4. Fixing Orchestrator setup..."
echo "---------------------------------"

# Fix orchestrator port in app.py
if [ -f "orchestrator/app.py" ]; then
    echo "Updating orchestrator port to 8889..."
    sed -i 's/port=8095/port=8889/g' orchestrator/app.py
    sed -i 's/PORT = 8095/PORT = 8889/g' orchestrator/app.py
fi

# Create app_production.py if needed
if [ ! -f "orchestrator/app_production.py" ] && [ -f "orchestrator/app.py" ]; then
    echo "Creating app_production.py..."
    cp orchestrator/app.py orchestrator/app_production.py
    # Add production settings
    cat >> orchestrator/app_production.py << 'EOF'

# Production settings
if __name__ == "__main__":
    import eventlet
    eventlet.monkey_patch()
    from eventlet import wsgi
    wsgi.server(eventlet.listen(('127.0.0.1', 8889)), app)
EOF
fi

# 5. Create Fixed Startup Script
echo ""
echo "🚀 5. Creating fixed startup script..."
echo "-------------------------------------"

cat > start-fixed.sh << 'EOF'
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
if [ -f "../searxng-venv/bin/activate" ]; then
    source ../searxng-venv/bin/activate
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
EOF

chmod +x start-fixed.sh

# 6. Install Dependencies
echo ""
echo "📦 6. Installing dependencies..."
echo "-------------------------------"

# Activate main venv and install requirements
source venv/bin/activate

# Install common requirements
pip install flask flask-cors redis requests beautifulsoup4 lxml

# If there's a requirements.txt, install it
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
fi

# 7. Fix Engine Imports
echo ""
echo "🔧 7. Fixing engine imports..."
echo "-----------------------------"

# Ensure __init__.py exists in engines directory
touch engines/__init__.py
touch orchestrator/__init__.py

# 8. Summary
echo ""
echo "✅ Architecture fixes applied!"
echo "============================="
echo ""
echo "Summary of changes:"
echo "  ✓ Created searxng-core symlink structure"
echo "  ✓ Set up proper configuration"
echo "  ✓ Created virtual environments"
echo "  ✓ Fixed orchestrator port (8889)"
echo "  ✓ Created fixed startup script"
echo "  ✓ Installed base dependencies"
echo ""
echo "To start the services:"
echo "  ./start-fixed.sh"
echo ""
echo "To monitor services:"
echo "  python3 integration-plan/service-monitor.py --continuous"