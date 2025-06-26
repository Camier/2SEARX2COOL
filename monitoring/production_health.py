#!/usr/bin/env python3
"""
Production Health Monitoring for 2SEARX2COOL
Monitors services, performance, and errors
"""

import subprocess
import requests
import json
import time
from datetime import datetime
from colorama import init, Fore, Style

init(autoreset=True)

class ProductionMonitor:
    def __init__(self):
        self.orchestrator_url = "http://localhost:8889"
        self.searxng_url = "http://localhost:8888"
        
    def check_service_status(self, service_name):
        """Check systemd service status"""
        try:
            result = subprocess.run(
                ['systemctl', 'is-active', service_name],
                capture_output=True,
                text=True
            )
            return result.stdout.strip() == 'active'
        except Exception:
            return False
    
    def check_endpoint_health(self, url, timeout=5):
        """Check if endpoint is responding"""
        try:
            resp = requests.get(url, timeout=timeout)
            return resp.status_code == 200, resp.elapsed.total_seconds() * 1000
        except Exception as e:
            return False, 0
    
    def get_cache_stats(self):
        """Get Redis cache statistics"""
        try:
            resp = requests.get(f"{self.orchestrator_url}/public/cache", timeout=5)
            if resp.status_code == 200:
                return resp.json()
        except Exception:
            pass
        return None
    
    def test_search_performance(self):
        """Test search response time"""
        try:
            start = time.time()
            resp = requests.get(
                f"{self.orchestrator_url}/public/search",
                params={"q": "test", "engines": "bandcamp"},
                timeout=10
            )
            elapsed = (time.time() - start) * 1000
            success = resp.status_code == 200
            return success, elapsed
        except Exception:
            return False, 0
    
    def get_error_count(self, service_name, minutes=5):
        """Count recent errors in systemd logs"""
        try:
            since = f"{minutes}min ago"
            result = subprocess.run(
                ['journalctl', '-u', service_name, '--since', since, '--no-pager', '-p', 'err'],
                capture_output=True,
                text=True
            )
            # Count lines that contain ERROR
            error_lines = [line for line in result.stdout.split('\n') if 'ERROR' in line]
            return len(error_lines)
        except Exception:
            return -1
    
    def print_status(self, label, status, details=""):
        """Print colored status line"""
        if status == "active" or status == True:
            color = Fore.GREEN
            icon = "✅"
        elif status == "warning":
            color = Fore.YELLOW
            icon = "⚠️"
        else:
            color = Fore.RED
            icon = "❌"
        
        print(f"{color}{icon} {label}: {status}{Style.RESET_ALL}")
        if details:
            print(f"   {details}")
    
    def run_health_check(self):
        """Run comprehensive health check"""
        print(f"\n{Fore.CYAN}{'='*60}")
        print(f"{Fore.CYAN}2SEARX2COOL Production Health Check")
        print(f"{Fore.CYAN}Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{Fore.CYAN}{'='*60}{Style.RESET_ALL}\n")
        
        # Check systemd services
        print(f"{Fore.YELLOW}System Services:{Style.RESET_ALL}")
        searxng_active = self.check_service_status('searxng.service')
        orchestrator_active = self.check_service_status('2searx2cool-orchestrator.service')
        
        self.print_status("SearXNG Service", "active" if searxng_active else "inactive")
        self.print_status("Orchestrator Service", "active" if orchestrator_active else "inactive")
        
        # Check endpoints
        print(f"\n{Fore.YELLOW}Endpoint Health:{Style.RESET_ALL}")
        searxng_ok, searxng_time = self.check_endpoint_health(f"{self.searxng_url}/search?q=test&format=json")
        orch_ok, orch_time = self.check_endpoint_health(f"{self.orchestrator_url}/public/status")
        
        self.print_status("SearXNG API", searxng_ok, f"Response time: {searxng_time:.0f}ms")
        self.print_status("Orchestrator API", orch_ok, f"Response time: {orch_time:.0f}ms")
        
        # Check search performance
        print(f"\n{Fore.YELLOW}Search Performance:{Style.RESET_ALL}")
        search_ok, search_time = self.test_search_performance()
        if search_ok:
            if search_time < 1000:
                status = "excellent"
            elif search_time < 3000:
                status = "good"
            else:
                status = "warning"
            self.print_status("Search Response", status, f"Time: {search_time:.0f}ms")
        else:
            self.print_status("Search Response", False, "Search failed")
        
        # Check cache
        print(f"\n{Fore.YELLOW}Cache System:{Style.RESET_ALL}")
        cache_stats = self.get_cache_stats()
        if cache_stats:
            hit_rate = cache_stats.get('hit_rate', 0)
            entries = cache_stats.get('cache_entries', 0)
            status = "good" if hit_rate > 30 else "warming up"
            self.print_status("Redis Cache", status, f"Hit rate: {hit_rate}%, Entries: {entries}")
        else:
            self.print_status("Redis Cache", False, "Unable to get cache stats")
        
        # Check recent errors
        print(f"\n{Fore.YELLOW}Error Monitoring (last 5 min):{Style.RESET_ALL}")
        searxng_errors = self.get_error_count('searxng.service', 5)
        orch_errors = self.get_error_count('2searx2cool-orchestrator.service', 5)
        
        if searxng_errors >= 0:
            status = "good" if searxng_errors < 5 else "warning" if searxng_errors < 20 else False
            self.print_status("SearXNG Errors", status, f"Count: {searxng_errors}")
        
        if orch_errors >= 0:
            status = "good" if orch_errors < 5 else "warning" if orch_errors < 20 else False
            self.print_status("Orchestrator Errors", status, f"Count: {orch_errors}")
        
        # Overall status
        print(f"\n{Fore.CYAN}{'='*60}")
        all_good = (searxng_active and orchestrator_active and searxng_ok and orch_ok and search_ok)
        if all_good:
            print(f"{Fore.GREEN}✅ System Status: HEALTHY")
        else:
            print(f"{Fore.YELLOW}⚠️  System Status: DEGRADED")
        print(f"{Fore.CYAN}{'='*60}{Style.RESET_ALL}\n")
        
        return all_good

def main():
    monitor = ProductionMonitor()
    
    # Run once or continuously
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--watch":
        print("Starting continuous monitoring (Ctrl+C to stop)...")
        try:
            while True:
                monitor.run_health_check()
                time.sleep(60)  # Check every minute
        except KeyboardInterrupt:
            print("\nMonitoring stopped.")
    else:
        monitor.run_health_check()

if __name__ == "__main__":
    main()