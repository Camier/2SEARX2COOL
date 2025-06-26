#!/usr/bin/env python3
"""
Socket.IO Test Client for 2SEARX2COOL
Tests proper Socket.IO connectivity with the orchestrator
"""

import socketio
import asyncio
import json
import time
import logging
from typing import Dict, Any

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SocketIOTestClient:
    def __init__(self, url: str = "http://localhost:8889"):
        self.url = url
        self.sio = socketio.Client(logger=True, engineio_logger=True)
        self.connected = False
        self.responses = {}
        
        # Register event handlers
        self.setup_handlers()
    
    def setup_handlers(self):
        """Setup Socket.IO event handlers"""
        
        @self.sio.event
        def connect():
            logger.info("✅ Connected to Socket.IO server")
            self.connected = True
        
        @self.sio.event
        def disconnect():
            logger.info("❌ Disconnected from Socket.IO server")
            self.connected = False
        
        @self.sio.event
        def status(data):
            logger.info(f"📨 Status received: {data}")
            self.responses['status'] = data
        
        @self.sio.event
        def pong(data):
            logger.info(f"🏓 Pong received: {data}")
            self.responses['pong'] = data
        
        @self.sio.event
        def search_status(data):
            logger.info(f"🔍 Search status: {data}")
            self.responses['search_status'] = data
        
        @self.sio.event
        def search_complete(data):
            logger.info(f"✅ Search complete: {data}")
            self.responses['search_complete'] = data
    
    def test_connection(self) -> Dict[str, Any]:
        """Test Socket.IO connection"""
        results = {
            'connection': {'status': 'failed'},
            'ping_pong': {'status': 'not_tested'},
            'search': {'status': 'not_tested'}
        }
        
        try:
            # Connect to server
            logger.info(f"Connecting to {self.url}...")
            self.sio.connect(self.url, wait_timeout=10)
            
            if self.connected:
                results['connection']['status'] = 'success'
                
                # Test ping/pong
                logger.info("Testing ping/pong...")
                start_time = time.time()
                self.sio.emit('ping')
                
                # Wait for pong response
                timeout = 5
                while 'pong' not in self.responses and time.time() - start_time < timeout:
                    time.sleep(0.1)
                
                if 'pong' in self.responses:
                    elapsed = time.time() - start_time
                    results['ping_pong'] = {
                        'status': 'success',
                        'response_time': elapsed,
                        'data': self.responses['pong']
                    }
                else:
                    results['ping_pong'] = {'status': 'timeout'}
                
                # Test search
                logger.info("Testing search via WebSocket...")
                self.responses.clear()
                search_data = {
                    'query': 'electronic music'
                }
                self.sio.emit('search_query', search_data)
                
                # Wait for search complete
                start_time = time.time()
                timeout = 10
                while 'search_complete' not in self.responses and time.time() - start_time < timeout:
                    time.sleep(0.1)
                
                if 'search_complete' in self.responses:
                    results['search'] = {
                        'status': 'success',
                        'search_status': self.responses.get('search_status'),
                        'search_complete': self.responses.get('search_complete')
                    }
                else:
                    results['search'] = {'status': 'timeout'}
            
            else:
                results['connection']['error'] = 'Failed to establish connection'
                
        except Exception as e:
            results['connection']['error'] = str(e)
            logger.error(f"Connection error: {e}")
        
        finally:
            if self.connected:
                self.sio.disconnect()
        
        return results

def main():
    """Run Socket.IO tests"""
    print("\n🔌 Testing Socket.IO Connection to 2SEARX2COOL Orchestrator\n")
    
    client = SocketIOTestClient()
    results = client.test_connection()
    
    print("\n📊 Test Results:")
    print(json.dumps(results, indent=2))
    
    # Overall status
    if results['connection']['status'] == 'success':
        print("\n✅ Socket.IO connection is working!")
        
        if results['ping_pong']['status'] == 'success':
            print(f"✅ Ping/Pong working (response time: {results['ping_pong'].get('response_time', 0):.3f}s)")
        else:
            print("❌ Ping/Pong failed")
        
        if results['search']['status'] == 'success':
            print("✅ Search via WebSocket working")
        else:
            print("❌ Search via WebSocket failed")
    else:
        print(f"\n❌ Socket.IO connection failed: {results['connection'].get('error', 'Unknown error')}")
        print("\n🔧 Troubleshooting tips:")
        print("1. Make sure orchestrator is running on port 8889")
        print("2. Check if Socket.IO is properly initialized in the orchestrator")
        print("3. Verify CORS settings allow connections from your client")
        print("4. Check orchestrator logs for any errors")

if __name__ == "__main__":
    main()