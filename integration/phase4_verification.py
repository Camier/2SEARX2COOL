#!/usr/bin/env python3
"""
Phase 4 Production Readiness Verification
Tests all critical fixes and improvements
"""

import asyncio
import json
import time
import requests
import socketio
from typing import Dict, Any
from colorama import init, Fore, Style

init(autoreset=True)

class Phase4Verifier:
    def __init__(self):
        self.base_url = "http://localhost:8889"
        self.searxng_url = "http://localhost:8888"
        self.results = {
            "websocket": {"status": "pending"},
            "public_api": {"status": "pending"},
            "searxng_json": {"status": "pending"},
            "search_performance": {"status": "pending"},
            "cache_system": {"status": "pending"}
        }
    
    def print_header(self, text: str):
        print(f"\n{Fore.CYAN}{'='*60}")
        print(f"{Fore.CYAN}{text.center(60)}")
        print(f"{Fore.CYAN}{'='*60}{Style.RESET_ALL}")
    
    def print_result(self, test: str, passed: bool, details: str = ""):
        icon = "✅" if passed else "❌"
        color = Fore.GREEN if passed else Fore.RED
        print(f"{color}{icon} {test}: {'PASSED' if passed else 'FAILED'}{Style.RESET_ALL}")
        if details:
            print(f"   {details}")
    
    def test_websocket(self):
        """Test WebSocket connectivity"""
        self.print_header("Testing WebSocket Connectivity")
        
        sio = socketio.Client()
        connected = False
        responses = {}
        
        @sio.event
        def connect():
            nonlocal connected
            connected = True
        
        @sio.event
        def pong(data):
            responses['pong'] = data
        
        try:
            sio.connect(self.base_url, wait_timeout=5)
            
            if connected:
                # Test ping/pong
                start = time.time()
                sio.emit('ping')
                time.sleep(0.5)
                
                if 'pong' in responses:
                    latency = (time.time() - start) * 1000
                    self.results['websocket'] = {
                        "status": "success",
                        "latency_ms": round(latency, 2)
                    }
                    self.print_result("WebSocket Connection", True, f"Latency: {latency:.1f}ms")
                else:
                    self.results['websocket'] = {"status": "no_pong"}
                    self.print_result("WebSocket Connection", False, "No pong response")
            else:
                self.results['websocket'] = {"status": "connection_failed"}
                self.print_result("WebSocket Connection", False, "Failed to connect")
                
            sio.disconnect()
            
        except Exception as e:
            self.results['websocket'] = {"status": "error", "error": str(e)}
            self.print_result("WebSocket Connection", False, str(e))
    
    def test_public_api(self):
        """Test public API endpoints"""
        self.print_header("Testing Public API Endpoints")
        
        # Test status endpoint
        try:
            resp = requests.get(f"{self.base_url}/public/status", timeout=5)
            status_ok = resp.status_code == 200
            self.print_result("Public API Status", status_ok, f"Status: {resp.status_code}")
            
            # Test search endpoint
            search_resp = requests.get(
                f"{self.base_url}/public/search",
                params={"q": "test music", "engines": "bandcamp,soundcloud"},
                timeout=10
            )
            search_ok = search_resp.status_code == 200
            data = search_resp.json()
            
            if search_ok and data.get('success'):
                self.print_result(
                    "Public API Search", 
                    True, 
                    f"Found {data.get('total_results', 0)} results in {data.get('response_time_ms', 0)}ms"
                )
                self.results['public_api'] = {
                    "status": "success",
                    "results": data.get('total_results', 0),
                    "time_ms": data.get('response_time_ms', 0)
                }
            else:
                self.print_result("Public API Search", False, "Search failed")
                self.results['public_api'] = {"status": "failed"}
                
        except Exception as e:
            self.print_result("Public API", False, str(e))
            self.results['public_api'] = {"status": "error", "error": str(e)}
    
    def test_searxng_json(self):
        """Test SearXNG JSON format support"""
        self.print_header("Testing SearXNG JSON Support")
        
        try:
            resp = requests.get(
                f"{self.searxng_url}/search",
                params={"q": "electronic music", "format": "json", "engines": "bandcamp"},
                timeout=10
            )
            
            if resp.status_code == 200:
                data = resp.json()
                results_count = len(data.get('results', []))
                self.print_result(
                    "SearXNG JSON Format", 
                    True, 
                    f"Got {results_count} results"
                )
                self.results['searxng_json'] = {
                    "status": "success",
                    "results": results_count
                }
            else:
                self.print_result("SearXNG JSON Format", False, f"Status: {resp.status_code}")
                self.results['searxng_json'] = {"status": "failed", "code": resp.status_code}
                
        except Exception as e:
            self.print_result("SearXNG JSON Format", False, str(e))
            self.results['searxng_json'] = {"status": "error", "error": str(e)}
    
    def test_search_performance(self):
        """Test search performance with multiple engines"""
        self.print_header("Testing Search Performance")
        
        engines = ["bandcamp", "soundcloud", "genius", "lastfm", "musicbrainz"]
        query = "electronic ambient music"
        
        try:
            start = time.time()
            resp = requests.get(
                f"{self.base_url}/public/search",
                params={"q": query, "engines": ",".join(engines)},
                timeout=30
            )
            elapsed = (time.time() - start) * 1000
            
            if resp.status_code == 200:
                data = resp.json()
                self.print_result(
                    "Multi-Engine Search", 
                    elapsed < 5000,  # Should complete in under 5 seconds
                    f"Searched {len(engines)} engines in {elapsed:.0f}ms"
                )
                self.results['search_performance'] = {
                    "status": "success",
                    "engines": len(engines),
                    "time_ms": round(elapsed),
                    "results": data.get('total_results', 0)
                }
            else:
                self.print_result("Multi-Engine Search", False, f"Status: {resp.status_code}")
                self.results['search_performance'] = {"status": "failed"}
                
        except Exception as e:
            self.print_result("Multi-Engine Search", False, str(e))
            self.results['search_performance'] = {"status": "error", "error": str(e)}
    
    def generate_report(self):
        """Generate final verification report"""
        self.print_header("Phase 4 Verification Report")
        
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results.values() if r.get('status') == 'success')
        
        print(f"\n{Fore.YELLOW}Total Tests: {total_tests}")
        print(f"{Fore.GREEN}Passed: {passed_tests}")
        print(f"{Fore.RED}Failed: {total_tests - passed_tests}{Style.RESET_ALL}")
        
        print(f"\n{Fore.CYAN}Detailed Results:{Style.RESET_ALL}")
        print(json.dumps(self.results, indent=2))
        
        overall_status = "READY" if passed_tests == total_tests else "NOT READY"
        color = Fore.GREEN if overall_status == "READY" else Fore.RED
        
        print(f"\n{color}{'='*60}")
        print(f"{color}Production Status: {overall_status}")
        print(f"{color}{'='*60}{Style.RESET_ALL}")
        
        return overall_status == "READY"
    
    def test_cache_system(self):
        """Test Redis caching functionality"""
        self.print_header("Testing Cache System")
        
        try:
            # Get cache stats
            resp = requests.get(f"{self.base_url}/public/cache", timeout=5)
            
            if resp.status_code == 200:
                stats = resp.json()
                connected = stats.get('status') == 'connected'
                has_entries = stats.get('cache_entries', 0) > 0
                
                self.print_result(
                    "Redis Cache", 
                    connected, 
                    f"Entries: {stats.get('cache_entries', 0)}, Hit Rate: {stats.get('hit_rate', 0)}%"
                )
                
                self.results['cache_system'] = {
                    "status": "success" if connected else "failed",
                    "entries": stats.get('cache_entries', 0),
                    "hit_rate": stats.get('hit_rate', 0)
                }
            else:
                self.print_result("Redis Cache", False, f"Status: {resp.status_code}")
                self.results['cache_system'] = {"status": "failed"}
                
        except Exception as e:
            self.print_result("Redis Cache", False, str(e))
            self.results['cache_system'] = {"status": "error", "error": str(e)}
    
    def run_all_tests(self):
        """Run all verification tests"""
        self.test_websocket()
        self.test_public_api()
        self.test_searxng_json()
        self.test_search_performance()
        self.test_cache_system()
        return self.generate_report()

def main():
    print(f"{Fore.MAGENTA}{'='*60}")
    print(f"{Fore.MAGENTA}{'2SEARX2COOL Phase 4 Production Verification'.center(60)}")
    print(f"{Fore.MAGENTA}{'='*60}{Style.RESET_ALL}")
    
    verifier = Phase4Verifier()
    ready = verifier.run_all_tests()
    
    if ready:
        print(f"\n{Fore.GREEN}🎉 System is ready for production deployment!")
    else:
        print(f"\n{Fore.YELLOW}⚠️  Some issues need to be resolved before production deployment.")
    
    return 0 if ready else 1

if __name__ == "__main__":
    exit(main())