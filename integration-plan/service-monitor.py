#!/usr/bin/env python3
"""
Service Health Monitor for 2SEARX2COOL Integration
Provides real-time status of all services and components
"""

import requests
import psutil
import time
import json
from datetime import datetime
from typing import Dict, List, Tuple
import subprocess
import socket

class ServiceMonitor:
    def __init__(self):
        self.services = {
            'redis': {'port': 6379, 'type': 'tcp'},
            'searxng': {'port': 8888, 'type': 'http', 'endpoint': '/'},
            'orchestrator': {'port': 8889, 'type': 'http', 'endpoint': '/health'},
            'postgres': {'port': 5432, 'type': 'tcp'},
        }
        
        self.processes = {
            'redis-server': 'Redis Server',
            'searx.webapp': 'SearXNG Web Application',
            'orchestrator': 'Flask Orchestrator',
            'engine_service': 'Engine Bridge Service',
            'electron': 'Electron Desktop App'
        }
        
    def check_port(self, port: int) -> bool:
        """Check if a port is open"""
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex(('127.0.0.1', port))
        sock.close()
        return result == 0
        
    def check_http_endpoint(self, port: int, endpoint: str) -> Tuple[bool, str]:
        """Check if HTTP endpoint is responding"""
        try:
            url = f"http://127.0.0.1:{port}{endpoint}"
            response = requests.get(url, timeout=2)
            return response.status_code == 200, f"Status: {response.status_code}"
        except requests.exceptions.ConnectionError:
            return False, "Connection refused"
        except requests.exceptions.Timeout:
            return False, "Timeout"
        except Exception as e:
            return False, str(e)
            
    def check_process(self, process_name: str) -> List[Dict]:
        """Check if process is running"""
        processes = []
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                cmdline = ' '.join(proc.info['cmdline'] or [])
                if process_name in cmdline:
                    processes.append({
                        'pid': proc.info['pid'],
                        'name': proc.info['name'],
                        'cpu': proc.cpu_percent(interval=0.1),
                        'memory': proc.memory_info().rss / 1024 / 1024  # MB
                    })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        return processes
        
    def check_engines(self) -> Dict:
        """Check engine loading status"""
        try:
            # Try to get engine list from engine-bridge
            # This would need actual implementation based on engine-bridge API
            return {'status': 'unknown', 'message': 'Engine check not implemented'}
        except:
            return {'status': 'error', 'message': 'Could not check engines'}
            
    def generate_report(self) -> Dict:
        """Generate comprehensive status report"""
        report = {
            'timestamp': datetime.now().isoformat(),
            'services': {},
            'processes': {},
            'system': {
                'cpu_percent': psutil.cpu_percent(interval=1),
                'memory_percent': psutil.virtual_memory().percent,
                'disk_usage': psutil.disk_usage('/').percent
            }
        }
        
        # Check services
        for service, config in self.services.items():
            if config['type'] == 'tcp':
                status = self.check_port(config['port'])
                report['services'][service] = {
                    'status': 'running' if status else 'stopped',
                    'port': config['port']
                }
            elif config['type'] == 'http':
                status, message = self.check_http_endpoint(config['port'], config['endpoint'])
                report['services'][service] = {
                    'status': 'running' if status else 'stopped',
                    'port': config['port'],
                    'endpoint': config['endpoint'],
                    'message': message
                }
                
        # Check processes
        for process_key, process_name in self.processes.items():
            procs = self.check_process(process_key)
            report['processes'][process_name] = {
                'running': len(procs) > 0,
                'count': len(procs),
                'details': procs
            }
            
        return report
        
    def print_status(self):
        """Print formatted status report"""
        report = self.generate_report()
        
        print("\n" + "="*60)
        print(f"🔍 2SEARX2COOL Service Monitor - {report['timestamp']}")
        print("="*60)
        
        print("\n📊 System Resources:")
        print(f"  CPU: {report['system']['cpu_percent']}%")
        print(f"  Memory: {report['system']['memory_percent']}%")
        print(f"  Disk: {report['system']['disk_usage']}%")
        
        print("\n🌐 Services:")
        for service, status in report['services'].items():
            icon = "✅" if status['status'] == 'running' else "❌"
            print(f"  {icon} {service.capitalize()}: {status['status']} (port {status['port']})")
            if 'message' in status and status['status'] != 'running':
                print(f"     └─ {status['message']}")
                
        print("\n⚙️  Processes:")
        for process, info in report['processes'].items():
            icon = "✅" if info['running'] else "❌"
            print(f"  {icon} {process}: {'Running' if info['running'] else 'Stopped'}")
            if info['running']:
                for proc in info['details']:
                    print(f"     └─ PID {proc['pid']}: CPU {proc['cpu']:.1f}%, Mem {proc['memory']:.1f}MB")
                    
        print("\n" + "="*60)
        
    def continuous_monitor(self, interval=5):
        """Run continuous monitoring"""
        print("Starting continuous monitoring (Ctrl+C to stop)...")
        try:
            while True:
                self.print_status()
                time.sleep(interval)
        except KeyboardInterrupt:
            print("\nMonitoring stopped.")

if __name__ == "__main__":
    monitor = ServiceMonitor()
    
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--continuous":
        monitor.continuous_monitor()
    else:
        monitor.print_status()
        
        # Save report to file
        report = monitor.generate_report()
        with open('service-status.json', 'w') as f:
            json.dump(report, f, indent=2)
        print("\n📄 Report saved to service-status.json")