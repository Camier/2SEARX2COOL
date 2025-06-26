#!/bin/bash
# Test services independently

echo "🧪 Testing 2SEARX2COOL Services"
echo "=============================="

# Kill any existing processes
echo "Cleaning up..."
pkill -f "searx.webapp" 2>/dev/null || true
pkill -f "app_production.py" 2>/dev/null || true
sleep 2

# Test SearXNG
echo ""
echo "📍 Testing SearXNG Core..."
cd /home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED/searxng-core/searxng-core
source /home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED/searxng-core/searxng-venv/bin/activate
export SEARXNG_SETTINGS_PATH="/home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED/config/searxng-settings.yml"
python -m searx.webapp --host 127.0.0.1 --port 8888 > /tmp/searxng.log 2>&1 &
SEARXNG_PID=$!

echo "Waiting for SearXNG to start (PID: $SEARXNG_PID)..."
sleep 10

echo "Testing SearXNG endpoint..."
if curl -s -f -X GET http://localhost:8888/ > /dev/null; then
    echo "✅ SearXNG is running on port 8888!"
    echo "Sample response:"
    curl -s http://localhost:8888/ | head -5
else
    echo "❌ SearXNG failed to start"
    echo "Last 20 lines of log:"
    tail -20 /tmp/searxng.log
fi

# Kill SearXNG
kill $SEARXNG_PID 2>/dev/null || true

# Test Orchestrator
echo ""
echo "📍 Testing Orchestrator..."
cd /home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED
source venv/bin/activate
export PYTHONPATH="${PYTHONPATH}:/home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED:/home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED/orchestrator"
cd orchestrator
python app_production.py > /tmp/orchestrator.log 2>&1 &
ORCH_PID=$!

echo "Waiting for Orchestrator to start (PID: $ORCH_PID)..."
sleep 5

echo "Testing Orchestrator endpoint..."
if curl -s -f -X GET http://localhost:8889/ > /dev/null; then
    echo "✅ Orchestrator is running on port 8889!"
    echo "Response:"
    curl -s http://localhost:8889/ | python -m json.tool
else
    echo "❌ Orchestrator failed to start"
    echo "Last 20 lines of log:"
    tail -20 /tmp/orchestrator.log
fi

# Kill Orchestrator
kill $ORCH_PID 2>/dev/null || true

echo ""
echo "✅ Test complete!"