#!/usr/bin/env python3
"""
Simple HTTP server for the production dashboard
"""

import http.server
import socketserver
import os

PORT = 8090
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        # Add CORS headers for API access
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

print(f"🎵 2SEARX2COOL Dashboard Server")
print(f"📁 Serving from: {DIRECTORY}")
print(f"🌐 Access at: http://localhost:{PORT}/dashboard.html")
print(f"Press Ctrl+C to stop\n")

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")