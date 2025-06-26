#!/usr/bin/env python3
"""
Parallel Engine Testing Framework
Tests all music engines concurrently for efficiency
"""

import asyncio
import aiohttp
import json
import sys
import time
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from typing import Dict, List, Tuple, Optional
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

class ParallelEngineTester:
    """Test multiple search engines in parallel"""
    
    def __init__(self, searxng_url: str = "http://localhost:8888"):
        self.searxng_url = searxng_url
        self.test_queries = [
            "daft punk",
            "bohemian rhapsody",
            "jazz standards",
            "electronic music 2024"
        ]
        self.results = {}
        self.engine_stats = {}
        
    async def test_engine_async(self, session: aiohttp.ClientSession, 
                               engine_name: str, query: str) -> Dict:
        """Test a single engine with a query asynchronously"""
        start_time = time.time()
        
        try:
            # Test through SearXNG API
            params = {
                'q': query,
                'engines': engine_name,
                'format': 'json'
            }
            
            async with session.get(
                f"{self.searxng_url}/search",
                params=params,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                
                elapsed = time.time() - start_time
                
                if response.status == 200:
                    data = await response.json()
                    results = data.get('results', [])
                    
                    return {
                        'engine': engine_name,
                        'query': query,
                        'status': 'success',
                        'result_count': len(results),
                        'response_time': elapsed,
                        'sample_results': results[:3] if results else []
                    }
                else:
                    return {
                        'engine': engine_name,
                        'query': query,
                        'status': 'error',
                        'error': f"HTTP {response.status}",
                        'response_time': elapsed
                    }
                    
        except asyncio.TimeoutError:
            return {
                'engine': engine_name,
                'query': query,
                'status': 'timeout',
                'response_time': 10.0
            }
        except Exception as e:
            return {
                'engine': engine_name,
                'query': query,
                'status': 'error',
                'error': str(e),
                'response_time': time.time() - start_time
            }
    
    async def test_engines_batch(self, engines: List[str]) -> List[Dict]:
        """Test multiple engines in parallel"""
        async with aiohttp.ClientSession() as session:
            tasks = []
            
            # Create tasks for all engine-query combinations
            for engine in engines:
                for query in self.test_queries:
                    task = self.test_engine_async(session, engine, query)
                    tasks.append(task)
            
            # Run all tests in parallel
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process results
            processed_results = []
            for result in results:
                if isinstance(result, Exception):
                    logger.error(f"Task failed: {result}")
                else:
                    processed_results.append(result)
                    
            return processed_results
    
    def analyze_results(self, results: List[Dict]) -> Dict:
        """Analyze test results and generate statistics"""
        stats = {
            'total_tests': len(results),
            'successful_tests': 0,
            'failed_tests': 0,
            'timeouts': 0,
            'engines': {}
        }
        
        for result in results:
            engine = result['engine']
            
            if engine not in stats['engines']:
                stats['engines'][engine] = {
                    'success_count': 0,
                    'error_count': 0,
                    'timeout_count': 0,
                    'total_results': 0,
                    'avg_response_time': 0,
                    'response_times': []
                }
            
            engine_stats = stats['engines'][engine]
            engine_stats['response_times'].append(result['response_time'])
            
            if result['status'] == 'success':
                stats['successful_tests'] += 1
                engine_stats['success_count'] += 1
                engine_stats['total_results'] += result.get('result_count', 0)
            elif result['status'] == 'timeout':
                stats['timeouts'] += 1
                engine_stats['timeout_count'] += 1
            else:
                stats['failed_tests'] += 1
                engine_stats['error_count'] += 1
        
        # Calculate average response times
        for engine, engine_stats in stats['engines'].items():
            if engine_stats['response_times']:
                engine_stats['avg_response_time'] = sum(engine_stats['response_times']) / len(engine_stats['response_times'])
            del engine_stats['response_times']  # Remove raw data from final stats
            
        return stats
    
    def test_engine_directly(self, engine_path: str) -> Dict:
        """Test an engine directly without SearXNG (for debugging)"""
        try:
            # This would test the engine module directly
            # Useful for isolating engine issues from SearXNG integration
            sys.path.insert(0, str(Path(engine_path).parent))
            engine_module = __import__(Path(engine_path).stem)
            
            # Test basic functionality
            if hasattr(engine_module, 'request') and hasattr(engine_module, 'response'):
                return {
                    'engine': Path(engine_path).stem,
                    'status': 'valid',
                    'has_request': True,
                    'has_response': True
                }
            else:
                return {
                    'engine': Path(engine_path).stem,
                    'status': 'invalid',
                    'error': 'Missing required functions'
                }
                
        except Exception as e:
            return {
                'engine': Path(engine_path).stem,
                'status': 'error',
                'error': str(e)
            }
    
    async def run_parallel_tests(self, engine_list: List[str]) -> Dict:
        """Main entry point for parallel testing"""
        logger.info(f"Starting parallel tests for {len(engine_list)} engines")
        
        # Run tests in batches to avoid overwhelming the system
        batch_size = 5
        all_results = []
        
        for i in range(0, len(engine_list), batch_size):
            batch = engine_list[i:i+batch_size]
            logger.info(f"Testing batch {i//batch_size + 1}: {batch}")
            
            batch_results = await self.test_engines_batch(batch)
            all_results.extend(batch_results)
            
            # Brief pause between batches
            await asyncio.sleep(1)
        
        # Analyze results
        stats = self.analyze_results(all_results)
        
        return {
            'summary': stats,
            'detailed_results': all_results
        }


async def main():
    """Main test runner"""
    # List of engines to test
    engines_to_test = [
        # Standard SearXNG music engines
        "bandcamp",
        "soundcloud", 
        "deezer",
        "genius",
        "mixcloud",
        
        # Custom 2SEARX2COOL engines (if integrated)
        "beatport",
        "discogs_music",
        "lastfm",
        "musicbrainz",
        "allmusic",
        "apple_music_web",
        "spotify_web",
        "youtube_music"
    ]
    
    tester = ParallelEngineTester()
    
    # First, check if SearXNG is running
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{tester.searxng_url}/search?q=test&format=json") as resp:
                if resp.status != 200:
                    logger.error("SearXNG is not responding properly")
                    return
    except Exception as e:
        logger.error(f"Cannot connect to SearXNG: {e}")
        return
    
    # Run parallel tests
    results = await tester.run_parallel_tests(engines_to_test)
    
    # Print summary
    print("\n" + "="*80)
    print("PARALLEL ENGINE TEST RESULTS")
    print("="*80)
    
    summary = results['summary']
    print(f"\nTotal Tests: {summary['total_tests']}")
    print(f"Successful: {summary['successful_tests']} ({summary['successful_tests']/summary['total_tests']*100:.1f}%)")
    print(f"Failed: {summary['failed_tests']}")
    print(f"Timeouts: {summary['timeouts']}")
    
    print("\n" + "-"*80)
    print("ENGINE PERFORMANCE SUMMARY")
    print("-"*80)
    print(f"{'Engine':<20} {'Success':<10} {'Errors':<10} {'Avg Time':<12} {'Results':<10}")
    print("-"*80)
    
    for engine, stats in sorted(summary['engines'].items()):
        success_rate = stats['success_count'] / (stats['success_count'] + stats['error_count'] + stats['timeout_count']) * 100
        print(f"{engine:<20} {stats['success_count']:<10} {stats['error_count']:<10} "
              f"{stats['avg_response_time']:<12.2f} {stats['total_results']:<10}")
    
    # Identify problematic engines
    print("\n" + "-"*80)
    print("PROBLEMATIC ENGINES")
    print("-"*80)
    
    for engine, stats in summary['engines'].items():
        if stats['error_count'] > 0 or stats['timeout_count'] > 0:
            print(f"⚠️  {engine}: {stats['error_count']} errors, {stats['timeout_count']} timeouts")
    
    # Save detailed results
    with open('engine_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n✅ Detailed results saved to engine_test_results.json")


if __name__ == "__main__":
    asyncio.run(main())