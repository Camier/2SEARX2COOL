#!/bin/bash
# Run orchestrator in development mode with relaxed authentication

echo "🚀 Starting 2SEARX2COOL Orchestrator in Development Mode"
echo "📌 Features: No auth required, CORS allows all origins, WebSocket open"
echo ""

# Navigate to orchestrator directory
cd orchestrator

# Kill any existing orchestrator process
pkill -f "app_development.py" 2>/dev/null
pkill -f "port 8889" 2>/dev/null

# Activate virtual environment
source venv/bin/activate

# Export Flask app
export FLASK_APP=app_development.py
export FLASK_ENV=development

# Install python-socketio if needed
pip install python-socketio eventlet >/dev/null 2>&1

# Start the development server
echo "Starting orchestrator on port 8889..."
python app_development.py