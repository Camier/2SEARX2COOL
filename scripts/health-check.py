#!/usr/bin/env python3
"""
Health Check Script for 2SEARX2COOL
Monitors all system components and provides real-time status
"""
import sys
import time
import json
import requests
import subprocess
from datetime import datetime
from pathlib import Path
import redis
import psutil


class HealthChecker:
    """System health monitoring for 2SEARX2COOL"""
    
    def __init__(self):
        self.checks = []
        self.status = {
            'timestamp': None,
            'overall': 'unknown',
            'components': {},
            'metrics': {}
        }
    
    def check_service_port(self, name, port, url=None):
        """Check if a service is running on a port"""
        try:
            # Check port binding
            for conn in psutil.net_connections():
                if conn.laddr.port == port and conn.status == 'LISTEN':
                    # If URL provided, check HTTP endpoint
                    if url:
                        response = requests.get(url, timeout=5)
                        if response.status_code == 200:
                            return True, "Running and responsive"
                    else:
                        return True, "Port is listening"
            return False, f"No service on port {port}"
        except Exception as e:
            return False, str(e)
    
    def check_redis(self):
        """Check Redis connectivity"""
        try:
            r = redis.Redis(host='localhost', port=6379, decode_responses=True)
            if r.ping():
                # Get some metrics
                info = r.info()
                self.status['metrics']['redis_memory'] = info.get('used_memory_human', 'unknown')
                self.status['metrics']['redis_clients'] = info.get('connected_clients', 0)
                return True, "Connected and responsive"
            return False, "Cannot ping Redis"
        except Exception as e:
            return False, f"Redis error: {str(e)}"
    
    def check_searxng(self):
        """Check SearXNG service"""
        success, message = self.check_service_port('SearXNG', 8888, 'http://localhost:8888')
        
        if success:
            try:
                # Test search functionality
                response = requests.get(
                    'http://localhost:8888/search',
                    params={'q': 'test', 'format': 'json'},
                    timeout=5
                )
                if response.status_code == 200:
                    return True, "Service running and search working"
            except:
                pass
        
        return success, message
    
    def check_orchestrator(self):
        """Check Orchestrator service"""
        success, message = self.check_service_port('Orchestrator', 8889, 'http://localhost:8889/health')
        
        if success:
            try:
                # Get engine count
                response = requests.get('http://localhost:8889/engines', timeout=5)
                if response.status_code == 200:
                    engines = response.json()
                    self.status['metrics']['engine_count'] = len(engines)
                    return True, f"Running with {len(engines)} engines"
            except:
                pass
        
        return success, message
    
    def check_engines(self):
        """Check music engines availability"""
        try:
            response = requests.get('http://localhost:8889/engines', timeout=5)
            if response.status_code == 200:
                engines = response.json()
                working_engines = []
                failed_engines = []
                
                # Test a few key engines
                test_engines = ['genius', 'spotify_web', 'soundcloud', 'bandcamp']
                for engine_name in test_engines:
                    if any(e['name'] == engine_name for e in engines):
                        working_engines.append(engine_name)
                    else:
                        failed_engines.append(engine_name)
                
                if failed_engines:
                    return False, f"Missing engines: {', '.join(failed_engines)}"
                else:
                    return True, f"All key engines available ({len(engines)} total)"
            return False, "Cannot retrieve engine list"
        except Exception as e:
            return False, f"Engine check error: {str(e)}"
    
    def check_electron_build(self):
        """Check Electron desktop build"""
        project_root = Path(__file__).parent.parent
        
        checks = {
            'package.json': project_root / 'package.json',
            'electron_main': project_root / 'out' / 'main' / 'index.js',
            'node_modules': project_root / 'node_modules'
        }
        
        missing = []
        for name, path in checks.items():
            if not path.exists():
                missing.append(name)
        
        if missing:
            return False, f"Missing: {', '.join(missing)}"
        
        # Check if build is recent
        main_js = checks['electron_main']
        if main_js.exists():
            mtime = datetime.fromtimestamp(main_js.stat().st_mtime)
            age = datetime.now() - mtime
            if age.days > 7:
                return True, f"Build is {age.days} days old"
        
        return True, "All components present"
    
    def check_system_resources(self):
        """Check system resource usage"""
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            self.status['metrics']['cpu_usage'] = f"{cpu_percent}%"
            
            # Memory usage
            memory = psutil.virtual_memory()
            self.status['metrics']['memory_usage'] = f"{memory.percent}%"
            self.status['metrics']['memory_available'] = f"{memory.available // (1024*1024)}MB"
            
            # Disk usage
            disk = psutil.disk_usage('/')
            self.status['metrics']['disk_usage'] = f"{disk.percent}%"
            
            # Check thresholds
            warnings = []
            if cpu_percent > 80:
                warnings.append(f"High CPU usage: {cpu_percent}%")
            if memory.percent > 80:
                warnings.append(f"High memory usage: {memory.percent}%")
            if disk.percent > 90:
                warnings.append(f"Low disk space: {disk.percent}% used")
            
            if warnings:
                return False, "; ".join(warnings)
            
            return True, "Resources within normal limits"
            
        except Exception as e:
            return False, f"Resource check error: {str(e)}"
    
    def run_checks(self):
        """Run all health checks"""
        self.status['timestamp'] = datetime.now().isoformat()
        
        # Define all checks
        checks = [
            ('Redis', self.check_redis),
            ('SearXNG', self.check_searxng),
            ('Orchestrator', self.check_orchestrator),
            ('Engines', self.check_engines),
            ('Electron Build', self.check_electron_build),
            ('System Resources', self.check_system_resources)
        ]
        
        all_healthy = True
        
        for name, check_func in checks:
            try:
                success, message = check_func()
                self.status['components'][name] = {
                    'status': 'healthy' if success else 'unhealthy',
                    'message': message
                }
                if not success:
                    all_healthy = False
            except Exception as e:
                self.status['components'][name] = {
                    'status': 'error',
                    'message': str(e)
                }
                all_healthy = False
        
        self.status['overall'] = 'healthy' if all_healthy else 'unhealthy'
    
    def print_report(self):
        """Print health check report"""
        print("\n🏥 2SEARX2COOL Health Check Report")
        print("=" * 60)
        print(f"Timestamp: {self.status['timestamp']}")
        print(f"Overall Status: {'✅ HEALTHY' if self.status['overall'] == 'healthy' else '❌ UNHEALTHY'}")
        
        print("\n📊 Component Status:")
        print("-" * 60)
        
        for component, info in self.status['components'].items():
            icon = '✅' if info['status'] == 'healthy' else '❌'
            print(f"{icon} {component:20} {info['message']}")
        
        if self.status['metrics']:
            print("\n📈 System Metrics:")
            print("-" * 60)
            for metric, value in self.status['metrics'].items():
                print(f"{metric:20} {value}")
        
        # Recommendations
        if self.status['overall'] == 'unhealthy':
            print("\n⚠️  Recommendations:")
            print("-" * 60)
            
            if self.status['components'].get('Redis', {}).get('status') != 'healthy':
                print("- Start Redis: redis-server")
            
            if self.status['components'].get('SearXNG', {}).get('status') != 'healthy':
                print("- Start SearXNG: ./start-integrated.sh")
            
            if self.status['components'].get('Electron Build', {}).get('status') != 'healthy':
                print("- Build Electron app: npm run build")
    
    def export_json(self, filename='health-status.json'):
        """Export status as JSON"""
        with open(filename, 'w') as f:
            json.dump(self.status, f, indent=2)
        print(f"\n💾 Status exported to {filename}")
    
    def monitor_mode(self, interval=5):
        """Run in continuous monitoring mode"""
        print("🔄 Starting continuous monitoring (Ctrl+C to stop)")
        print(f"   Checking every {interval} seconds")
        
        try:
            while True:
                self.run_checks()
                
                # Clear screen
                print("\033[2J\033[H")  # ANSI escape codes to clear screen
                
                self.print_report()
                time.sleep(interval)
                
        except KeyboardInterrupt:
            print("\n\n👋 Monitoring stopped")


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='2SEARX2COOL Health Check')
    parser.add_argument('--monitor', '-m', action='store_true',
                        help='Run in continuous monitoring mode')
    parser.add_argument('--interval', '-i', type=int, default=5,
                        help='Monitoring interval in seconds (default: 5)')
    parser.add_argument('--export', '-e', type=str,
                        help='Export status to JSON file')
    
    args = parser.parse_args()
    
    checker = HealthChecker()
    
    if args.monitor:
        checker.monitor_mode(args.interval)
    else:
        checker.run_checks()
        checker.print_report()
        
        if args.export:
            checker.export_json(args.export)
        
        # Exit with appropriate code
        sys.exit(0 if checker.status['overall'] == 'healthy' else 1)


if __name__ == '__main__':
    main()