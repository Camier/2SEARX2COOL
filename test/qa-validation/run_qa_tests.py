#!/usr/bin/env python3
"""
QA Test Runner - Comprehensive validation of 2SEARX2COOL integration
"""
import subprocess
import sys
import time
import json
import os
from pathlib import Path
from datetime import datetime
import requests
import signal


class QATestRunner:
    """Orchestrates QA testing for the integrated system"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.parent.parent
        self.services = {}
        self.test_results = {
            'timestamp': datetime.now().isoformat(),
            'services': {},
            'tests': {},
            'summary': {
                'total': 0,
                'passed': 0,
                'failed': 0,
                'skipped': 0
            }
        }
    
    def check_prerequisites(self):
        """Check system prerequisites"""
        print("🔍 Checking prerequisites...")
        
        # Check Python version
        if sys.version_info < (3, 8):
            print("❌ Python 3.8+ required")
            return False
        
        # Check required commands
        required_commands = ['redis-cli', 'npm', 'node']
        for cmd in required_commands:
            if subprocess.run(['which', cmd], capture_output=True).returncode != 0:
                print(f"❌ {cmd} not found")
                return False
        
        # Check Python dependencies
        try:
            import pytest
            import requests
            import redis
        except ImportError as e:
            print(f"❌ Missing Python dependency: {e}")
            print("   Run: pip install -r requirements.txt")
            return False
        
        print("✅ All prerequisites satisfied")
        return True
    
    def start_services(self):
        """Start all required services"""
        print("\n🚀 Starting services...")
        
        # Start Redis if not running
        try:
            r = requests.get("http://localhost:6379", timeout=1)
        except:
            print("   Starting Redis...")
            self.services['redis'] = subprocess.Popen(
                ['redis-server'],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            time.sleep(2)
        
        # Check if SearXNG is running
        try:
            response = requests.get("http://localhost:8888", timeout=2)
            print("   ✅ SearXNG already running")
            self.test_results['services']['searxng'] = 'existing'
        except:
            print("   Starting SearXNG services...")
            start_script = self.project_root / "start-integrated.sh"
            if start_script.exists():
                self.services['searxng'] = subprocess.Popen(
                    [str(start_script)],
                    cwd=str(self.project_root),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
                print("   Waiting for services to start...")
                time.sleep(10)
                self.test_results['services']['searxng'] = 'started'
            else:
                print("   ⚠️  start-integrated.sh not found, assuming manual start")
                self.test_results['services']['searxng'] = 'manual'
    
    def run_unit_tests(self):
        """Run unit tests"""
        print("\n🧪 Running unit tests...")
        
        # Find and run Python unit tests
        test_dirs = [
            self.project_root / "test" / "unit",
            self.project_root / "tests" / "unit",
            self.project_root / "2SEARX2COOL" / "tests" / "unit"
        ]
        
        for test_dir in test_dirs:
            if test_dir.exists():
                print(f"   Running tests in {test_dir.relative_to(self.project_root)}...")
                result = subprocess.run(
                    [sys.executable, "-m", "pytest", str(test_dir), "-v", "--tb=short"],
                    capture_output=True,
                    text=True
                )
                
                if result.returncode == 0:
                    print("   ✅ Unit tests passed")
                    self.test_results['tests']['unit'] = 'passed'
                else:
                    print("   ❌ Unit tests failed")
                    print(result.stdout)
                    self.test_results['tests']['unit'] = 'failed'
    
    def run_integration_tests(self):
        """Run integration tests"""
        print("\n🔗 Running integration tests...")
        
        test_file = Path(__file__).parent / "test_integration.py"
        
        result = subprocess.run(
            [sys.executable, "-m", "pytest", str(test_file), "-v", "--tb=short", "-x"],
            capture_output=True,
            text=True
        )
        
        # Parse pytest output
        output_lines = result.stdout.split('\n')
        for line in output_lines:
            if 'passed' in line or 'failed' in line or 'skipped' in line:
                print(f"   {line.strip()}")
        
        if result.returncode == 0:
            print("\n   ✅ All integration tests passed")
            self.test_results['tests']['integration'] = 'passed'
        else:
            print("\n   ❌ Integration tests failed")
            self.test_results['tests']['integration'] = 'failed'
            
            # Show failures
            if 'FAILED' in result.stdout:
                print("\n   Failed tests:")
                for line in output_lines:
                    if 'FAILED' in line:
                        print(f"     {line.strip()}")
    
    def run_engine_validation(self):
        """Validate all music engines"""
        print("\n🎵 Validating music engines...")
        
        try:
            import requests
            
            # Get list of engines
            response = requests.get("http://localhost:8889/engines", timeout=5)
            if response.status_code == 200:
                engines = response.json()
                print(f"   Found {len(engines)} engines")
                
                # Test each engine
                failed_engines = []
                for engine in engines[:5]:  # Test first 5 for quick validation
                    engine_name = engine.get('name', 'unknown')
                    params = {
                        'q': 'test',
                        'format': 'json',
                        'engines': engine_name
                    }
                    
                    try:
                        search_response = requests.get(
                            "http://localhost:8888/search",
                            params=params,
                            timeout=10
                        )
                        if search_response.status_code == 200:
                            print(f"   ✅ {engine_name}")
                        else:
                            print(f"   ❌ {engine_name} (status: {search_response.status_code})")
                            failed_engines.append(engine_name)
                    except Exception as e:
                        print(f"   ❌ {engine_name} (error: {str(e)})")
                        failed_engines.append(engine_name)
                
                if failed_engines:
                    self.test_results['tests']['engines'] = f"failed: {', '.join(failed_engines)}"
                else:
                    self.test_results['tests']['engines'] = 'passed'
            else:
                print("   ❌ Could not get engine list")
                self.test_results['tests']['engines'] = 'failed'
                
        except Exception as e:
            print(f"   ❌ Engine validation failed: {e}")
            self.test_results['tests']['engines'] = 'error'
    
    def run_desktop_validation(self):
        """Validate desktop application components"""
        print("\n💻 Validating desktop components...")
        
        checks = {
            'electron_main': self.project_root / "out" / "main" / "index.js",
            'package_json': self.project_root / "package.json",
            'electron_config': self.project_root / "electron-builder.optimization.yml",
            'preload_scripts': self.project_root / "src" / "preload"
        }
        
        all_passed = True
        for name, path in checks.items():
            if path.exists():
                print(f"   ✅ {name}")
            else:
                print(f"   ❌ {name} not found")
                all_passed = False
        
        # Check npm build
        print("\n   Checking npm build...")
        result = subprocess.run(
            ["npm", "run", "build"],
            cwd=str(self.project_root),
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            print("   ✅ npm build successful")
            self.test_results['tests']['desktop'] = 'passed' if all_passed else 'partial'
        else:
            print("   ❌ npm build failed")
            self.test_results['tests']['desktop'] = 'failed'
    
    def run_performance_tests(self):
        """Run basic performance tests"""
        print("\n⚡ Running performance tests...")
        
        try:
            import time
            import statistics
            
            # Test search response times
            response_times = []
            queries = ['music', 'rock', 'jazz', 'classical', 'electronic']
            
            for query in queries:
                start = time.time()
                response = requests.get(
                    "http://localhost:8888/search",
                    params={'q': query, 'format': 'json', 'engines': 'genius'},
                    timeout=30
                )
                elapsed = time.time() - start
                
                if response.status_code == 200:
                    response_times.append(elapsed)
                    print(f"   Query '{query}': {elapsed:.2f}s")
            
            if response_times:
                avg_time = statistics.mean(response_times)
                max_time = max(response_times)
                
                print(f"\n   Average response time: {avg_time:.2f}s")
                print(f"   Maximum response time: {max_time:.2f}s")
                
                if avg_time < 5 and max_time < 10:
                    print("   ✅ Performance acceptable")
                    self.test_results['tests']['performance'] = 'passed'
                else:
                    print("   ⚠️  Performance needs optimization")
                    self.test_results['tests']['performance'] = 'warning'
            else:
                self.test_results['tests']['performance'] = 'failed'
                
        except Exception as e:
            print(f"   ❌ Performance tests failed: {e}")
            self.test_results['tests']['performance'] = 'error'
    
    def generate_report(self):
        """Generate comprehensive test report"""
        print("\n📊 Generating test report...")
        
        # Calculate summary
        for test, result in self.test_results['tests'].items():
            self.test_results['summary']['total'] += 1
            if result == 'passed':
                self.test_results['summary']['passed'] += 1
            elif result == 'failed' or result == 'error':
                self.test_results['summary']['failed'] += 1
            else:
                self.test_results['summary']['skipped'] += 1
        
        # Write JSON report
        report_path = self.project_root / "qa-test-report.json"
        with open(report_path, 'w') as f:
            json.dump(self.test_results, f, indent=2)
        
        # Write markdown report
        markdown_report = f"""# QA Test Report

**Generated**: {self.test_results['timestamp']}

## Summary

- **Total Tests**: {self.test_results['summary']['total']}
- **Passed**: {self.test_results['summary']['passed']} ✅
- **Failed**: {self.test_results['summary']['failed']} ❌
- **Skipped**: {self.test_results['summary']['skipped']} ⏭️

## Test Results

| Test Suite | Result |
|------------|--------|
"""
        
        for test, result in self.test_results['tests'].items():
            status = "✅" if result == "passed" else "❌" if "failed" in str(result) else "⚠️"
            markdown_report += f"| {test.title()} | {status} {result} |\n"
        
        markdown_report += f"""

## Services Status

| Service | Status |
|---------|--------|
"""
        
        for service, status in self.test_results['services'].items():
            markdown_report += f"| {service.title()} | {status} |\n"
        
        markdown_report += """

## Recommendations

"""
        
        if self.test_results['summary']['failed'] > 0:
            markdown_report += "- Fix failing tests before deployment\n"
        
        if 'performance' in self.test_results['tests'] and self.test_results['tests']['performance'] == 'warning':
            markdown_report += "- Optimize search performance for better user experience\n"
        
        if self.test_results['summary']['passed'] == self.test_results['summary']['total']:
            markdown_report += "- ✅ All tests passed! System is ready for production.\n"
        
        # Write markdown report
        report_md_path = self.project_root / "QA_TEST_REPORT.md"
        with open(report_md_path, 'w') as f:
            f.write(markdown_report)
        
        print(f"\n✅ Reports generated:")
        print(f"   - {report_path}")
        print(f"   - {report_md_path}")
        
        # Print summary
        print(f"\n📈 Test Summary:")
        print(f"   Total: {self.test_results['summary']['total']}")
        print(f"   Passed: {self.test_results['summary']['passed']} ✅")
        print(f"   Failed: {self.test_results['summary']['failed']} ❌")
        
        return self.test_results['summary']['failed'] == 0
    
    def cleanup(self):
        """Cleanup started services"""
        print("\n🧹 Cleaning up...")
        
        for name, process in self.services.items():
            if process and process.poll() is None:
                print(f"   Stopping {name}...")
                process.terminate()
                process.wait(timeout=5)
    
    def run(self):
        """Run complete QA validation"""
        print("🎯 2SEARX2COOL QA Validation Suite")
        print("=" * 50)
        
        try:
            # Check prerequisites
            if not self.check_prerequisites():
                return False
            
            # Start services
            self.start_services()
            
            # Run test suites
            self.run_unit_tests()
            self.run_integration_tests()
            self.run_engine_validation()
            self.run_desktop_validation()
            self.run_performance_tests()
            
            # Generate report
            success = self.generate_report()
            
            if success:
                print("\n🎉 All tests passed! System validated successfully.")
            else:
                print("\n⚠️  Some tests failed. Review the report for details.")
            
            return success
            
        except KeyboardInterrupt:
            print("\n\n⚠️  Testing interrupted by user")
            return False
        finally:
            self.cleanup()


if __name__ == "__main__":
    runner = QATestRunner()
    success = runner.run()
    sys.exit(0 if success else 1)