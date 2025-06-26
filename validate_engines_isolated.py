#!/usr/bin/env python3
"""
Validate music engines in isolation
Tests each engine independently before SearXNG integration
"""

import sys
import json
import importlib.util
from pathlib import Path
from typing import Dict, List, Optional
import requests
from urllib.parse import quote_plus
import concurrent.futures
import time

class IsolatedEngineValidator:
    """Validate engines without SearXNG dependency"""
    
    def __init__(self):
        self.test_query = "daft punk"
        self.results = {}
        
    def validate_engine_structure(self, engine_path: Path) -> Dict:
        """Validate basic engine structure"""
        result = {
            'path': str(engine_path),
            'name': engine_path.stem,
            'valid_structure': False,
            'errors': [],
            'warnings': []
        }
        
        try:
            # Load module
            spec = importlib.util.spec_from_file_location(engine_path.stem, engine_path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            
            # Check required functions
            required = ['request', 'response']
            for func in required:
                if not hasattr(module, func):
                    result['errors'].append(f"Missing required function: {func}")
            
            # Check required attributes
            required_attrs = ['categories']
            for attr in required_attrs:
                if not hasattr(module, attr):
                    result['warnings'].append(f"Missing attribute: {attr}")
            
            # Check metadata
            if hasattr(module, 'about'):
                about = module.about
                if 'website' not in about:
                    result['warnings'].append("Missing 'website' in about")
            else:
                result['warnings'].append("Missing 'about' metadata")
            
            result['valid_structure'] = len(result['errors']) == 0
            
            # Test request function
            if hasattr(module, 'request'):
                try:
                    params = module.request(self.test_query, {'pageno': 1})
                    if 'url' not in params:
                        result['errors'].append("request() didn't return 'url' in params")
                    else:
                        result['test_url'] = params['url']
                except Exception as e:
                    result['errors'].append(f"request() error: {str(e)}")
            
            return result
            
        except Exception as e:
            result['errors'].append(f"Failed to load module: {str(e)}")
            return result
    
    def test_engine_request(self, engine_path: Path) -> Dict:
        """Test actual HTTP request from engine"""
        result = {
            'name': engine_path.stem,
            'request_test': False,
            'response_code': None,
            'error': None
        }
        
        try:
            # Load and test the engine
            spec = importlib.util.spec_from_file_location(engine_path.stem, engine_path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            
            # Get request params
            params = module.request(self.test_query, {'pageno': 1})
            url = params.get('url')
            headers = params.get('headers', {})
            
            if not url:
                result['error'] = "No URL generated"
                return result
            
            # Make actual request
            response = requests.get(url, headers=headers, timeout=5)
            result['response_code'] = response.status_code
            result['request_test'] = response.status_code == 200
            
            # Test response parsing
            if result['request_test'] and hasattr(module, 'response'):
                try:
                    # Create mock response object
                    class MockResp:
                        def __init__(self, text, url):
                            self.text = text
                            self.url = url
                            self.status_code = 200
                    
                    mock_resp = MockResp(response.text, url)
                    parsed_results = module.response(mock_resp)
                    
                    result['parse_success'] = True
                    result['result_count'] = len(parsed_results) if isinstance(parsed_results, list) else 0
                    
                except Exception as e:
                    result['parse_error'] = str(e)
                    result['parse_success'] = False
            
        except requests.Timeout:
            result['error'] = "Request timeout"
        except Exception as e:
            result['error'] = str(e)
        
        return result
    
    def validate_all_engines(self, engine_dir: Path, parallel: bool = True) -> Dict:
        """Validate all engines in directory"""
        engine_files = list(engine_dir.glob("*.py"))
        
        print(f"🔍 Found {len(engine_files)} engine files to validate")
        
        if parallel:
            # Parallel validation
            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                # Structure validation
                structure_futures = {
                    executor.submit(self.validate_engine_structure, f): f 
                    for f in engine_files
                }
                
                structure_results = {}
                for future in concurrent.futures.as_completed(structure_futures):
                    file = structure_futures[future]
                    try:
                        result = future.result()
                        structure_results[file.stem] = result
                    except Exception as e:
                        structure_results[file.stem] = {'error': str(e)}
                
                # Request validation (only for valid engines)
                valid_engines = [
                    f for f in engine_files 
                    if f.stem in structure_results and structure_results[f.stem].get('valid_structure')
                ]
                
                request_futures = {
                    executor.submit(self.test_engine_request, f): f 
                    for f in valid_engines
                }
                
                request_results = {}
                for future in concurrent.futures.as_completed(request_futures):
                    file = request_futures[future]
                    try:
                        result = future.result()
                        request_results[file.stem] = result
                    except Exception as e:
                        request_results[file.stem] = {'error': str(e)}
        else:
            # Sequential validation
            structure_results = {}
            request_results = {}
            
            for file in engine_files:
                structure_results[file.stem] = self.validate_engine_structure(file)
                if structure_results[file.stem].get('valid_structure'):
                    request_results[file.stem] = self.test_engine_request(file)
        
        return {
            'structure_validation': structure_results,
            'request_validation': request_results
        }
    
    def generate_report(self, results: Dict) -> None:
        """Generate validation report"""
        print("\n" + "="*80)
        print("ENGINE VALIDATION REPORT")
        print("="*80)
        
        structure_results = results['structure_validation']
        request_results = results['request_validation']
        
        # Summary
        total = len(structure_results)
        valid_structure = sum(1 for r in structure_results.values() if r.get('valid_structure'))
        successful_requests = sum(1 for r in request_results.values() if r.get('request_test'))
        
        print(f"\n📊 Summary:")
        print(f"   Total engines: {total}")
        print(f"   Valid structure: {valid_structure} ({valid_structure/total*100:.1f}%)")
        print(f"   Successful requests: {successful_requests} ({successful_requests/len(request_results)*100:.1f}% of valid)")
        
        # Detailed results
        print("\n" + "-"*80)
        print("DETAILED RESULTS")
        print("-"*80)
        
        for engine_name in sorted(structure_results.keys()):
            struct = structure_results[engine_name]
            request = request_results.get(engine_name, {})
            
            status = "✅" if struct.get('valid_structure') and request.get('request_test') else "❌"
            print(f"\n{status} {engine_name}")
            
            if struct.get('errors'):
                print(f"   Errors: {', '.join(struct['errors'])}")
            if struct.get('warnings'):
                print(f"   Warnings: {', '.join(struct['warnings'])}")
            
            if engine_name in request_results:
                if request.get('request_test'):
                    print(f"   ✓ HTTP {request.get('response_code')} - Success")
                    if 'result_count' in request:
                        print(f"   ✓ Parsed {request['result_count']} results")
                else:
                    print(f"   ✗ Request failed: {request.get('error', 'Unknown error')}")
        
        # Recommendations
        print("\n" + "-"*80)
        print("RECOMMENDATIONS")
        print("-"*80)
        
        ready_engines = [
            name for name, struct in structure_results.items()
            if struct.get('valid_structure') and request_results.get(name, {}).get('request_test')
        ]
        
        print(f"\n✅ Ready for integration ({len(ready_engines)} engines):")
        for engine in ready_engines:
            print(f"   - {engine}")
        
        problematic = [
            name for name, struct in structure_results.items()
            if not struct.get('valid_structure') or not request_results.get(name, {}).get('request_test')
        ]
        
        if problematic:
            print(f"\n⚠️  Need fixes ({len(problematic)} engines):")
            for engine in problematic:
                print(f"   - {engine}")


def main():
    """Main validation runner"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Validate music engines')
    parser.add_argument('--engine-dir', default='/home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED/adapted_engines',
                        help='Directory containing engines to validate')
    parser.add_argument('--sequential', action='store_true',
                        help='Run validation sequentially instead of parallel')
    parser.add_argument('--output', help='Save results to JSON file')
    
    args = parser.parse_args()
    
    engine_dir = Path(args.engine_dir)
    if not engine_dir.exists():
        print(f"❌ Engine directory not found: {engine_dir}")
        return 1
    
    validator = IsolatedEngineValidator()
    
    print(f"🚀 Starting engine validation in {engine_dir}")
    start_time = time.time()
    
    results = validator.validate_all_engines(engine_dir, parallel=not args.sequential)
    
    elapsed = time.time() - start_time
    print(f"\n⏱️  Validation completed in {elapsed:.2f} seconds")
    
    validator.generate_report(results)
    
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\n💾 Results saved to {args.output}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())