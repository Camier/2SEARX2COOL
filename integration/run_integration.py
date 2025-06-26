#!/usr/bin/env python3
"""
Master Integration Runner for 2SEARX2COOL
Coordinates all integration components
"""

import asyncio
import json
import logging
import sys
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from engine_bridge_connector import EngineBridgeConnector
from test_electron_communication import ElectronCommunicationTester
from health_monitor import HealthMonitor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class IntegrationRunner:
    """Master integration coordinator"""
    
    def __init__(self):
        self.connector = None
        self.monitor = None
        self.results = {
            'health_check': {},
            'communication_test': {},
            'integration_test': {},
            'overall_status': 'pending'
        }
        
    async def initialize(self):
        """Initialize all components"""
        logger.info("Initializing integration components...")
        
        # Initialize health monitor
        self.monitor = HealthMonitor()
        await self.monitor.initialize()
        
        # Initialize engine bridge connector
        self.connector = EngineBridgeConnector()
        await self.connector.initialize()
        
    async def run_health_check(self):
        """Run comprehensive health check"""
        logger.info("Running health check...")
        health_status = await self.monitor.check_all()
        self.results['health_check'] = health_status
        
        # Print health report
        print("\n" + self.monitor.generate_report())
        
        return health_status['overall_health'] == 'healthy'
        
    async def run_communication_tests(self):
        """Test Electron communication channels"""
        logger.info("Testing communication channels...")
        
        tester = ElectronCommunicationTester()
        comm_results = await tester.test_all()
        self.results['communication_test'] = comm_results
        
        # Print communication report
        print("\n" + tester.generate_report())
        
        return comm_results['overall'] in ['excellent', 'good (HTTP only)']
        
    async def run_integration_tests(self):
        """Test actual integration functionality"""
        logger.info("Running integration tests...")
        
        integration_results = {
            'unified_search': {},
            'engine_listing': {},
            'status_check': {}
        }
        
        try:
            # Test 1: Unified search
            logger.info("Testing unified search...")
            search_results = await self.connector.unified_search(
                "electronic music",
                categories=['music']
            )
            
            integration_results['unified_search'] = {
                'status': 'success' if search_results['total_count'] > 0 else 'no_results',
                'total_results': search_results['total_count'],
                'sources': search_results['sources']
            }
            
            # Test 2: List all engines
            logger.info("Testing engine listing...")
            engines = await self.connector.list_all_engines()
            
            integration_results['engine_listing'] = {
                'status': 'success',
                'searxng_count': len(engines['searxng']),
                'custom_count': len(engines['custom'])
            }
            
            # Test 3: Status check
            logger.info("Testing status check...")
            status = await self.connector.get_status()
            
            integration_results['status_check'] = {
                'status': 'success',
                'services': status['services']
            }
            
        except Exception as e:
            logger.error(f"Integration test error: {e}")
            integration_results['error'] = str(e)
            
        self.results['integration_test'] = integration_results
        
        # Print integration results
        print("\n" + "=" * 60)
        print("INTEGRATION TEST RESULTS")
        print("=" * 60)
        
        for test_name, result in integration_results.items():
            if isinstance(result, dict) and 'status' in result:
                icon = "✅" if result['status'] == 'success' else "❌"
                print(f"{icon} {test_name}: {result['status']}")
                
                # Print details
                for key, value in result.items():
                    if key != 'status':
                        print(f"   {key}: {value}")
                        
        return all(
            r.get('status') == 'success' 
            for r in integration_results.values() 
            if isinstance(r, dict)
        )
        
    async def determine_overall_status(self, health_ok: bool, comm_ok: bool, integration_ok: bool):
        """Determine overall integration status"""
        if health_ok and comm_ok and integration_ok:
            self.results['overall_status'] = 'excellent'
        elif health_ok and (comm_ok or integration_ok):
            self.results['overall_status'] = 'good'
        elif health_ok:
            self.results['overall_status'] = 'partial'
        else:
            self.results['overall_status'] = 'poor'
            
    async def run_all(self):
        """Run all integration tests"""
        logger.info("Starting 2SEARX2COOL integration tests...")
        
        try:
            await self.initialize()
            
            # Run tests
            health_ok = await self.run_health_check()
            comm_ok = await self.run_communication_tests()
            integration_ok = await self.run_integration_tests()
            
            # Determine overall status
            await self.determine_overall_status(health_ok, comm_ok, integration_ok)
            
            # Save results
            with open('integration_results.json', 'w') as f:
                json.dump(self.results, f, indent=2)
                
            # Print summary
            print("\n" + "=" * 60)
            print("INTEGRATION SUMMARY")
            print("=" * 60)
            
            status_icons = {
                'excellent': '🎉',
                'good': '✅',
                'partial': '⚠️',
                'poor': '❌'
            }
            
            print(f"\n{status_icons[self.results['overall_status']]} Overall Status: {self.results['overall_status'].upper()}")
            
            if self.results['overall_status'] == 'excellent':
                print("\n✨ All systems operational! The integration is working perfectly.")
                print("\nNext steps:")
                print("  1. Start the Electron app to test the full stack")
                print("  2. Monitor health with: python integration/health_monitor.py")
                print("  3. Run continuous monitoring for production")
            else:
                print("\n⚠️  Some issues detected. Check the detailed reports above.")
                
            print("\n📄 Detailed results saved to integration_results.json")
            
        except Exception as e:
            logger.error(f"Integration runner error: {e}")
            raise
        finally:
            # Cleanup
            if self.connector:
                await self.connector.close()
            if self.monitor:
                await self.monitor.close()
                
    async def run_continuous_monitoring(self):
        """Run continuous monitoring mode"""
        logger.info("Starting continuous monitoring...")
        
        try:
            await self.initialize()
            
            # Start monitoring loop
            await self.monitor.monitor_loop()
            
        finally:
            if self.connector:
                await self.connector.close()
            if self.monitor:
                await self.monitor.close()


async def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='2SEARX2COOL Integration Runner')
    parser.add_argument('--monitor', action='store_true',
                        help='Run in continuous monitoring mode')
    parser.add_argument('--health-only', action='store_true',
                        help='Run health check only')
    
    args = parser.parse_args()
    
    runner = IntegrationRunner()
    
    if args.monitor:
        await runner.run_continuous_monitoring()
    elif args.health_only:
        await runner.initialize()
        await runner.run_health_check()
        await runner.monitor.close()
    else:
        await runner.run_all()


if __name__ == "__main__":
    asyncio.run(main())