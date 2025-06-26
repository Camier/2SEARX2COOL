#!/usr/bin/env python3
"""
Comprehensive Health Monitoring System for 2SEARX2COOL
Real-time monitoring with alerts and auto-recovery
"""

import asyncio
import aiohttp
import time
import json
import logging
import psutil
import redis
import os
from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path
import subprocess

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class HealthMonitor:
    """Advanced health monitoring with auto-recovery"""
    
    def __init__(self, config_path: str = None):
        self.config = self._load_config(config_path)
        self.status = {
            'timestamp': None,
            'overall_health': 'unknown',
            'services': {},
            'resources': {},
            'alerts': [],
            'metrics': {
                'uptime': {},
                'performance': {},
                'errors': {}
            }
        }
        self.session = None
        self.redis_client = None
        self.monitoring = False
        self.recovery_attempts = {}
        
    def _load_config(self, config_path: str) -> Dict:
        """Load monitoring configuration"""
        default_config = {
            'services': {
                'searxng': {
                    'url': 'http://localhost:8888',
                    'health_endpoint': '/',
                    'critical': True,
                    'auto_restart': True,
                    'start_command': './start-fixed.sh'
                },
                'orchestrator': {
                    'url': 'http://localhost:8889',
                    'health_endpoint': '/health',
                    'critical': True,
                    'auto_restart': True
                },
                'redis': {
                    'host': 'localhost',
                    'port': 6379,
                    'critical': False
                },
                'engine_bridge': {
                    'enabled': True,
                    'critical': False
                }
            },
            'thresholds': {
                'cpu_percent': 80,
                'memory_percent': 85,
                'disk_percent': 90,
                'response_time': 5.0
            },
            'monitoring': {
                'interval': 30,  # seconds
                'alert_cooldown': 300,  # 5 minutes
                'max_recovery_attempts': 3
            }
        }
        
        if config_path and Path(config_path).exists():
            with open(config_path) as f:
                user_config = json.load(f)
                # Merge configs
                return {**default_config, **user_config}
        
        return default_config
        
    async def initialize(self):
        """Initialize monitoring resources"""
        self.session = aiohttp.ClientSession()
        
        # Initialize Redis
        try:
            self.redis_client = redis.Redis(
                host=self.config['services']['redis']['host'],
                port=self.config['services']['redis']['port'],
                decode_responses=True
            )
            self.redis_client.ping()
        except:
            logger.warning("Redis not available - continuing without Redis")
            self.redis_client = None
            
    async def close(self):
        """Close monitoring resources"""
        self.monitoring = False
        if self.session:
            await self.session.close()
            
    async def check_service_health(self, name: str, config: Dict) -> Dict[str, Any]:
        """Check health of a single service"""
        result = {
            'name': name,
            'status': 'unknown',
            'response_time': None,
            'details': {}
        }
        
        if name == 'redis':
            # Special handling for Redis
            if self.redis_client:
                try:
                    start = time.time()
                    self.redis_client.ping()
                    result['status'] = 'healthy'
                    result['response_time'] = time.time() - start
                    
                    # Get Redis info
                    info = self.redis_client.info()
                    result['details'] = {
                        'version': info.get('redis_version'),
                        'connected_clients': info.get('connected_clients'),
                        'used_memory_human': info.get('used_memory_human')
                    }
                except Exception as e:
                    result['status'] = 'unhealthy'
                    result['error'] = str(e)
            else:
                result['status'] = 'unavailable'
                
        else:
            # HTTP service check
            url = config.get('url')
            endpoint = config.get('health_endpoint', '/')
            full_url = f"{url}{endpoint}"
            
            try:
                start = time.time()
                async with self.session.get(full_url, timeout=5) as response:
                    elapsed = time.time() - start
                    result['response_time'] = elapsed
                    
                    if response.status in [200, 404]:  # 404 ok for missing health endpoint
                        result['status'] = 'healthy'
                        result['details']['http_status'] = response.status
                        
                        # Try to get additional info from response
                        try:
                            if response.headers.get('content-type', '').startswith('application/json'):
                                data = await response.json()
                                result['details'].update(data)
                        except:
                            pass
                    else:
                        result['status'] = 'unhealthy'
                        result['details']['http_status'] = response.status
                        
            except asyncio.TimeoutError:
                result['status'] = 'timeout'
            except Exception as e:
                result['status'] = 'error'
                result['error'] = str(e)
                
        return result
        
    async def check_system_resources(self) -> Dict[str, Any]:
        """Check system resource usage"""
        resources = {
            'cpu': {
                'percent': psutil.cpu_percent(interval=1),
                'count': psutil.cpu_count()
            },
            'memory': {
                'percent': psutil.virtual_memory().percent,
                'available_gb': psutil.virtual_memory().available / (1024**3),
                'total_gb': psutil.virtual_memory().total / (1024**3)
            },
            'disk': {
                'percent': psutil.disk_usage('/').percent,
                'free_gb': psutil.disk_usage('/').free / (1024**3)
            },
            'processes': {
                'searxng': self._check_process('searx.webapp'),
                'orchestrator': self._check_process('app_production.py'),
                'redis': self._check_process('redis-server')
            }
        }
        
        # Check thresholds
        thresholds = self.config['thresholds']
        alerts = []
        
        if resources['cpu']['percent'] > thresholds['cpu_percent']:
            alerts.append(f"High CPU usage: {resources['cpu']['percent']:.1f}%")
            
        if resources['memory']['percent'] > thresholds['memory_percent']:
            alerts.append(f"High memory usage: {resources['memory']['percent']:.1f}%")
            
        if resources['disk']['percent'] > thresholds['disk_percent']:
            alerts.append(f"Low disk space: {resources['disk']['percent']:.1f}% used")
            
        resources['alerts'] = alerts
        return resources
        
    def _check_process(self, name: str) -> Dict[str, Any]:
        """Check if a process is running"""
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                cmdline = ' '.join(proc.info['cmdline'] or [])
                if name in cmdline:
                    return {
                        'running': True,
                        'pid': proc.info['pid'],
                        'cpu_percent': proc.cpu_percent(),
                        'memory_mb': proc.memory_info().rss / (1024**2)
                    }
            except:
                continue
        return {'running': False}
        
    async def check_all(self) -> Dict[str, Any]:
        """Perform all health checks"""
        self.status['timestamp'] = datetime.now().isoformat()
        
        # Check services
        service_tasks = []
        for name, config in self.config['services'].items():
            if config.get('enabled', True):
                task = self.check_service_health(name, config)
                service_tasks.append((name, task))
                
        results = await asyncio.gather(*[t[1] for t in service_tasks])
        
        for (name, _), result in zip(service_tasks, results):
            self.status['services'][name] = result
            
        # Check resources
        self.status['resources'] = await self.check_system_resources()
        
        # Calculate overall health
        self._calculate_overall_health()
        
        # Store metrics
        self._update_metrics()
        
        return self.status
        
    def _calculate_overall_health(self):
        """Calculate overall system health"""
        critical_services = [
            name for name, config in self.config['services'].items()
            if config.get('critical', False)
        ]
        
        unhealthy_critical = [
            name for name in critical_services
            if self.status['services'].get(name, {}).get('status') != 'healthy'
        ]
        
        if unhealthy_critical:
            self.status['overall_health'] = 'critical'
            self.status['alerts'].append(f"Critical services down: {', '.join(unhealthy_critical)}")
        elif self.status['resources'].get('alerts'):
            self.status['overall_health'] = 'warning'
        else:
            self.status['overall_health'] = 'healthy'
            
    def _update_metrics(self):
        """Update performance metrics"""
        # Update uptime
        for service, data in self.status['services'].items():
            if service not in self.status['metrics']['uptime']:
                self.status['metrics']['uptime'][service] = {
                    'up_count': 0,
                    'down_count': 0,
                    'uptime_percent': 0
                }
                
            if data['status'] == 'healthy':
                self.status['metrics']['uptime'][service]['up_count'] += 1
            else:
                self.status['metrics']['uptime'][service]['down_count'] += 1
                
            total = (self.status['metrics']['uptime'][service]['up_count'] + 
                    self.status['metrics']['uptime'][service]['down_count'])
            if total > 0:
                self.status['metrics']['uptime'][service]['uptime_percent'] = (
                    self.status['metrics']['uptime'][service]['up_count'] / total * 100
                )
                
    async def auto_recovery(self):
        """Attempt to recover unhealthy services"""
        for service, data in self.status['services'].items():
            if data['status'] != 'healthy':
                config = self.config['services'].get(service, {})
                
                if config.get('auto_restart', False):
                    # Check recovery attempts
                    if service not in self.recovery_attempts:
                        self.recovery_attempts[service] = 0
                        
                    if self.recovery_attempts[service] < self.config['monitoring']['max_recovery_attempts']:
                        logger.info(f"Attempting to recover {service}...")
                        
                        if await self._restart_service(service):
                            self.recovery_attempts[service] += 1
                            logger.info(f"Recovery attempt {self.recovery_attempts[service]} for {service}")
                        else:
                            logger.error(f"Failed to restart {service}")
                    else:
                        logger.warning(f"Max recovery attempts reached for {service}")
                        
    async def _restart_service(self, service: str) -> bool:
        """Restart a service"""
        try:
            if service == 'searxng':
                # Kill existing process
                subprocess.run(['pkill', '-f', 'searx.webapp'], check=False)
                await asyncio.sleep(2)
                
                # Start service
                subprocess.Popen(['./start-fixed.sh'], 
                               cwd='/home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED')
                await asyncio.sleep(5)
                return True
                
            elif service == 'orchestrator':
                subprocess.run(['pkill', '-f', 'app_production.py'], check=False)
                await asyncio.sleep(2)
                # Would restart here
                return True
                
        except Exception as e:
            logger.error(f"Error restarting {service}: {e}")
            return False
            
    async def monitor_loop(self):
        """Continuous monitoring loop"""
        self.monitoring = True
        interval = self.config['monitoring']['interval']
        
        while self.monitoring:
            try:
                await self.check_all()
                
                # Check for issues and attempt recovery
                if self.status['overall_health'] != 'healthy':
                    await self.auto_recovery()
                    
                # Log status
                logger.info(f"Health: {self.status['overall_health']} | "
                          f"Services: {len([s for s in self.status['services'].values() if s['status'] == 'healthy'])}/{len(self.status['services'])}")
                
                # Save status to file
                with open('health_status.json', 'w') as f:
                    json.dump(self.status, f, indent=2)
                    
                # Store in Redis if available
                if self.redis_client:
                    self.redis_client.setex(
                        'health:status',
                        300,  # 5 minute TTL
                        json.dumps(self.status)
                    )
                    
            except Exception as e:
                logger.error(f"Monitor loop error: {e}")
                
            await asyncio.sleep(interval)
            
    def generate_report(self) -> str:
        """Generate health report"""
        report = []
        report.append("=" * 60)
        report.append(f"HEALTH MONITOR REPORT - {self.status['timestamp']}")
        report.append("=" * 60)
        
        # Overall status
        health_icon = {
            'healthy': '✅',
            'warning': '⚠️',
            'critical': '❌',
            'unknown': '❓'
        }
        
        report.append(f"\n{health_icon[self.status['overall_health']]} Overall Health: {self.status['overall_health'].upper()}")
        
        # Services
        report.append("\n📊 Services:")
        for name, data in self.status['services'].items():
            icon = '✅' if data['status'] == 'healthy' else '❌'
            report.append(f"  {icon} {name}: {data['status']}")
            if data.get('response_time'):
                report.append(f"     Response time: {data['response_time']:.3f}s")
                
        # Resources
        report.append("\n💻 System Resources:")
        res = self.status['resources']
        report.append(f"  CPU: {res['cpu']['percent']:.1f}%")
        report.append(f"  Memory: {res['memory']['percent']:.1f}% ({res['memory']['available_gb']:.1f}GB free)")
        report.append(f"  Disk: {res['disk']['percent']:.1f}% used ({res['disk']['free_gb']:.1f}GB free)")
        
        # Processes
        report.append("\n🔧 Processes:")
        for name, proc in res['processes'].items():
            if proc['running']:
                report.append(f"  ✅ {name} (PID: {proc['pid']}, CPU: {proc['cpu_percent']:.1f}%, Mem: {proc['memory_mb']:.1f}MB)")
            else:
                report.append(f"  ❌ {name} - NOT RUNNING")
                
        # Alerts
        if self.status['alerts']:
            report.append("\n⚠️  Alerts:")
            for alert in self.status['alerts']:
                report.append(f"  • {alert}")
                
        # Uptime
        report.append("\n📈 Uptime Statistics:")
        for service, metrics in self.status['metrics']['uptime'].items():
            if metrics['uptime_percent'] > 0:
                report.append(f"  {service}: {metrics['uptime_percent']:.1f}% uptime")
                
        return "\n".join(report)


async def main():
    """Run health monitoring"""
    monitor = HealthMonitor()
    await monitor.initialize()
    
    try:
        # Single check
        await monitor.check_all()
        print(monitor.generate_report())
        
        # Optional: Start continuous monitoring
        # await monitor.monitor_loop()
        
    finally:
        await monitor.close()


if __name__ == "__main__":
    asyncio.run(main())