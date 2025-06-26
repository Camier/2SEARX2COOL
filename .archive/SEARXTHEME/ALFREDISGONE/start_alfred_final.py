#!/usr/bin/env python3
# ALFREDISGONE Direct Flask Startup
import os
import sys

# Add searx to path
sys.path.insert(0, '/home/mik/projects/active/searxng')

# Set environment
os.environ['SEARXNG_SETTINGS_PATH'] = '/home/mik/projects/active/searxng/searx/settings.yml'

# Import and run
from searx import webapp

print("🐱 Starting ALFREDISGONE Memorial Search Engine...")
print("================================================")
print("")
print("Access at:")
print("  → http://localhost:8888")
print("  → http://alfredisgone.duckdns.org:34628")
print("")
print("For Alfred! 💚")
print("")

# Run Flask app directly
webapp.app.run(host='0.0.0.0', port=8888, debug=False)