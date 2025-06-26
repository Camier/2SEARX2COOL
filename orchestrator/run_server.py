#!/usr/bin/env python3
"""
Run the orchestrator server
"""
import sys
import os

# MUST monkey patch before any other imports for eventlet to work with Redis
import eventlet
eventlet.monkey_patch()

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, socketio

if __name__ == '__main__':
    app = create_app()
    socketio.run(app, host='0.0.0.0', port=8889, debug=True)