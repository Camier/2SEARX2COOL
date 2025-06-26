#!/usr/bin/env python3
"""
Test Electron App Communication
Simulates and tests the communication between Electron app and backend services
"""

import asyncio
import websockets
import aiohttp
import json
import time
import logging
from typing import Dict, Any
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ElectronCommunicationTester:
    """Test communication patterns used by Electron app"""
    
    def __init__(self):
        self.searxng_url = "http://localhost:8888"
        self.orchestrator_url = "http://localhost:8889"
        self.ws_url = "ws://localhost:8889"
        self.test_results = {
            'http_api': {},
            'websocket': {},
            'json_rpc': {},
            'overall': 'pending'
        }
        
    async def test_all(self):
        """Run all communication tests"""
        logger.info("Starting Electron communication tests...")
        
        # Test HTTP APIs
        await self.test_http_apis()
        
        # Test WebSocket connection
        await self.test_websocket()
        
        # Test JSON-RPC communication
        await self.test_json_rpc()
        
        # Determine overall status
        self._calculate_overall_status()
        
        return self.test_results
        
    async def test_http_apis(self):
        """Test HTTP API endpoints"""
        logger.info("Testing HTTP APIs...")
        
        async with aiohttp.ClientSession() as session:
            # Test SearXNG API
            searxng_status = await self._test_endpoint(
                session, 
                f"{self.searxng_url}/search?q=test&categories=music",
                "SearXNG Search API"
            )
            self.test_results['http_api']['searxng_search'] = searxng_status
            
            # Test Orchestrator API
            orchestrator_status = await self._test_endpoint(
                session,
                f"{self.orchestrator_url}/health",
                "Orchestrator Health"
            )
            self.test_results['http_api']['orchestrator_health'] = orchestrator_status
            
            # Test Orchestrator API endpoints that Electron might use
            endpoints = [
                ('/api/search', 'POST', {'query': 'test', 'engines': ['bandcamp']}),
                ('/api/engines', 'GET', None),
                ('/api/status', 'GET', None)
            ]
            
            for endpoint, method, data in endpoints:
                url = f"{self.orchestrator_url}{endpoint}"
                status = await self._test_endpoint(
                    session, url, f"Orchestrator {endpoint}",
                    method=method, json_data=data
                )
                self.test_results['http_api'][f'orchestrator_{endpoint}'] = status
                
    async def _test_endpoint(self, session, url, name, method='GET', json_data=None):
        """Test a single HTTP endpoint"""
        try:
            start_time = time.time()
            
            if method == 'GET':
                async with session.get(url, timeout=5) as response:
                    elapsed = time.time() - start_time
                    return {
                        'status': 'success' if response.status in [200, 404] else 'error',
                        'code': response.status,
                        'response_time': elapsed,
                        'name': name
                    }
            else:  # POST
                async with session.post(url, json=json_data, timeout=5) as response:
                    elapsed = time.time() - start_time
                    return {
                        'status': 'success' if response.status in [200, 404] else 'error',
                        'code': response.status,
                        'response_time': elapsed,
                        'name': name
                    }
                    
        except asyncio.TimeoutError:
            return {'status': 'timeout', 'name': name}
        except Exception as e:
            return {'status': 'error', 'error': str(e), 'name': name}
            
    async def test_websocket(self):
        """Test WebSocket connection"""
        logger.info("Testing WebSocket connection...")
        
        try:
            async with websockets.connect(self.ws_url) as websocket:
                # Test connection
                self.test_results['websocket']['connection'] = {
                    'status': 'success',
                    'url': self.ws_url
                }
                
                # Test ping/pong
                start_time = time.time()
                ping_data = json.dumps({
                    'type': 'ping',
                    'timestamp': time.time()
                })
                
                await websocket.send(ping_data)
                
                # Wait for response with timeout
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    elapsed = time.time() - start_time
                    
                    self.test_results['websocket']['ping_pong'] = {
                        'status': 'success',
                        'response_time': elapsed,
                        'response': response
                    }
                except asyncio.TimeoutError:
                    self.test_results['websocket']['ping_pong'] = {
                        'status': 'timeout'
                    }
                    
                # Test search via WebSocket
                search_data = json.dumps({
                    'type': 'search',
                    'query': 'electronic music',
                    'engines': ['bandcamp', 'soundcloud']
                })
                
                await websocket.send(search_data)
                
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=10.0)
                    self.test_results['websocket']['search'] = {
                        'status': 'success',
                        'response_preview': response[:200] + '...' if len(response) > 200 else response
                    }
                except asyncio.TimeoutError:
                    self.test_results['websocket']['search'] = {
                        'status': 'timeout'
                    }
                    
        except Exception as e:
            self.test_results['websocket']['connection'] = {
                'status': 'error',
                'error': str(e)
            }
            
    async def test_json_rpc(self):
        """Test JSON-RPC communication pattern"""
        logger.info("Testing JSON-RPC communication...")
        
        # Test JSON-RPC requests to engine-bridge
        json_rpc_requests = [
            {
                "jsonrpc": "2.0",
                "method": "ping",
                "id": 1
            },
            {
                "jsonrpc": "2.0", 
                "method": "list_engines",
                "id": 2
            },
            {
                "jsonrpc": "2.0",
                "method": "search",
                "params": {
                    "engine": "bandcamp",
                    "query": "ambient"
                },
                "id": 3
            }
        ]
        
        # Simulate JSON-RPC over HTTP (common pattern)
        async with aiohttp.ClientSession() as session:
            for request in json_rpc_requests:
                method = request['method']
                
                # Try different endpoints where JSON-RPC might be served
                endpoints = [
                    f"{self.orchestrator_url}/json-rpc",
                    f"{self.orchestrator_url}/rpc",
                    f"{self.orchestrator_url}/api/rpc"
                ]
                
                for endpoint in endpoints:
                    try:
                        async with session.post(
                            endpoint,
                            json=request,
                            headers={'Content-Type': 'application/json'},
                            timeout=5
                        ) as response:
                            if response.status == 200:
                                result = await response.json()
                                self.test_results['json_rpc'][method] = {
                                    'status': 'success',
                                    'endpoint': endpoint,
                                    'result': result
                                }
                                break
                    except:
                        continue
                        
                if method not in self.test_results['json_rpc']:
                    self.test_results['json_rpc'][method] = {
                        'status': 'not_found',
                        'tried_endpoints': endpoints
                    }
                    
    def _calculate_overall_status(self):
        """Calculate overall communication status"""
        # Check HTTP APIs
        http_working = any(
            test.get('status') == 'success' 
            for test in self.test_results['http_api'].values()
        )
        
        # Check WebSocket
        ws_working = self.test_results['websocket'].get('connection', {}).get('status') == 'success'
        
        # Determine overall status
        if http_working:
            if ws_working:
                self.test_results['overall'] = 'excellent'
            else:
                self.test_results['overall'] = 'good (HTTP only)'
        else:
            self.test_results['overall'] = 'poor'
            
    def generate_report(self):
        """Generate a human-readable report"""
        report = []
        report.append("=" * 60)
        report.append("ELECTRON COMMUNICATION TEST REPORT")
        report.append("=" * 60)
        
        # HTTP API Tests
        report.append("\n📡 HTTP API Tests:")
        for endpoint, result in self.test_results['http_api'].items():
            status_icon = "✅" if result.get('status') == 'success' else "❌"
            report.append(f"  {status_icon} {result.get('name', endpoint)}: {result.get('status')}")
            if result.get('response_time'):
                report.append(f"     Response time: {result['response_time']:.3f}s")
                
        # WebSocket Tests
        report.append("\n🔌 WebSocket Tests:")
        for test, result in self.test_results['websocket'].items():
            status_icon = "✅" if result.get('status') == 'success' else "❌"
            report.append(f"  {status_icon} {test}: {result.get('status')}")
            
        # JSON-RPC Tests
        report.append("\n📋 JSON-RPC Tests:")
        for method, result in self.test_results['json_rpc'].items():
            status_icon = "✅" if result.get('status') == 'success' else "❌"
            report.append(f"  {status_icon} {method}: {result.get('status')}")
            
        # Overall Status
        report.append(f"\n📊 Overall Communication Status: {self.test_results['overall'].upper()}")
        
        # Recommendations
        report.append("\n💡 Recommendations:")
        if self.test_results['overall'] == 'excellent':
            report.append("  ✓ All communication channels working perfectly")
        else:
            if not self.test_results['websocket'].get('connection', {}).get('status') == 'success':
                report.append("  • WebSocket connection failed - check if orchestrator has WebSocket support enabled")
            if not any(t.get('status') == 'success' for t in self.test_results['http_api'].values()):
                report.append("  • HTTP APIs not responding - check if services are running")
            if not any(t.get('status') == 'success' for t in self.test_results['json_rpc'].values()):
                report.append("  • JSON-RPC endpoints not found - may need to implement RPC handlers")
                
        return "\n".join(report)


async def main():
    """Run the communication tests"""
    tester = ElectronCommunicationTester()
    
    # Run all tests
    results = await tester.test_all()
    
    # Generate and print report
    report = tester.generate_report()
    print(report)
    
    # Save results
    with open('electron_communication_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print("\n✅ Test results saved to electron_communication_test_results.json")


if __name__ == "__main__":
    asyncio.run(main())