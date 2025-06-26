#!/usr/bin/env python3
"""
Engine Bridge Connector - Connects the engine-bridge to SearXNG
Enables the desktop app to communicate with both SearXNG and custom engines
"""

import asyncio
import aiohttp
import json
import logging
from typing import Dict, Any, List, Optional
from urllib.parse import urlencode
import sys
import os

# Add engine-bridge to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'engine-bridge'))

from protocol import JsonRpcProtocol
from engine_registry import EngineRegistry

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class EngineBridgeConnector:
    """Connects engine-bridge with SearXNG for unified search"""
    
    def __init__(self, searxng_url: str = "http://localhost:8888", 
                 orchestrator_url: str = "http://localhost:8889"):
        self.searxng_url = searxng_url
        self.orchestrator_url = orchestrator_url
        self.protocol = JsonRpcProtocol()
        self.session = None
        
        # Engine registry for custom engines
        engines_dir = os.path.join(os.path.dirname(__file__), '..', 'engines')
        self.registry = EngineRegistry(engines_dir)
        
        # Register handlers
        self._register_handlers()
        
    def _register_handlers(self):
        """Register JSON-RPC handlers"""
        self.protocol.register_handler("unified_search", self.unified_search)
        self.protocol.register_handler("search_searxng", self.search_searxng)
        self.protocol.register_handler("search_custom", self.search_custom_engines)
        self.protocol.register_handler("get_status", self.get_status)
        self.protocol.register_handler("list_all_engines", self.list_all_engines)
        
    async def initialize(self):
        """Initialize async session"""
        self.session = aiohttp.ClientSession()
        logger.info("Engine Bridge Connector initialized")
        
    async def close(self):
        """Close async session"""
        if self.session:
            await self.session.close()
            
    async def unified_search(self, query: str, categories: List[str] = None, 
                           engines: List[str] = None) -> Dict[str, Any]:
        """
        Unified search across SearXNG and custom engines
        """
        results = {
            'query': query,
            'results': [],
            'sources': {
                'searxng': {'status': 'pending', 'count': 0},
                'custom': {'status': 'pending', 'count': 0}
            },
            'errors': []
        }
        
        # Run searches in parallel
        tasks = []
        
        # Search SearXNG
        if not engines or any(e in self._get_searxng_engines() for e in engines):
            tasks.append(self._search_searxng_async(query, categories, engines))
            
        # Search custom engines
        custom_engines = engines if engines else list(self.registry.engines.keys())
        if custom_engines:
            tasks.append(self._search_custom_async(query, custom_engines))
            
        # Wait for all searches
        if tasks:
            search_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process SearXNG results
            if len(search_results) > 0 and not isinstance(search_results[0], Exception):
                searxng_data = search_results[0]
                results['results'].extend(searxng_data.get('results', []))
                results['sources']['searxng'] = {
                    'status': 'success',
                    'count': len(searxng_data.get('results', [])),
                    'engines': searxng_data.get('engines_used', [])
                }
            elif len(search_results) > 0:
                results['sources']['searxng']['status'] = 'error'
                results['errors'].append(str(search_results[0]))
                
            # Process custom engine results
            if len(search_results) > 1 and not isinstance(search_results[1], Exception):
                custom_data = search_results[1]
                results['results'].extend(custom_data.get('results', []))
                results['sources']['custom'] = {
                    'status': 'success',
                    'count': len(custom_data.get('results', [])),
                    'engines': list(custom_data.get('engine_results', {}).keys())
                }
            elif len(search_results) > 1:
                results['sources']['custom']['status'] = 'error'
                results['errors'].append(str(search_results[1]))
                
        # Sort results by relevance (you can implement custom scoring)
        results['total_count'] = len(results['results'])
        
        return results
        
    async def _search_searxng_async(self, query: str, categories: List[str] = None,
                                   engines: List[str] = None) -> Dict[str, Any]:
        """Search using SearXNG"""
        params = {'q': query}
        
        if categories:
            params['categories'] = ','.join(categories)
        if engines:
            # Filter only SearXNG engines
            searxng_engines = [e for e in engines if e in self._get_searxng_engines()]
            if searxng_engines:
                params['engines'] = ','.join(searxng_engines)
                
        url = f"{self.searxng_url}/search?{urlencode(params)}"
        
        try:
            async with self.session.get(url, timeout=10) as response:
                if response.status == 200:
                    # Parse HTML response to extract results
                    html = await response.text()
                    return self._parse_searxng_html(html)
                else:
                    raise Exception(f"SearXNG returned status {response.status}")
        except Exception as e:
            logger.error(f"SearXNG search error: {e}")
            raise
            
    async def _search_custom_async(self, query: str, engines: List[str]) -> Dict[str, Any]:
        """Search using custom engines"""
        results = {
            'results': [],
            'engine_results': {}
        }
        
        # Search each engine in parallel
        tasks = []
        for engine_name in engines:
            if engine_name in self.registry.engines:
                task = self._search_single_engine(engine_name, query)
                tasks.append((engine_name, task))
                
        if tasks:
            engine_results = await asyncio.gather(*[t[1] for t in tasks], return_exceptions=True)
            
            for (engine_name, _), result in zip(tasks, engine_results):
                if not isinstance(result, Exception) and result:
                    results['engine_results'][engine_name] = len(result)
                    # Add engine source to each result
                    for r in result:
                        r['source'] = f"custom:{engine_name}"
                    results['results'].extend(result)
                    
        return results
        
    async def _search_single_engine(self, engine_name: str, query: str) -> List[Dict]:
        """Search a single custom engine"""
        try:
            result = self.registry.search(engine_name, query)
            if result['status'] == 'success':
                return result['results']
            return []
        except Exception as e:
            logger.error(f"Engine {engine_name} error: {e}")
            return []
            
    def _parse_searxng_html(self, html: str) -> Dict[str, Any]:
        """Parse SearXNG HTML response"""
        results = []
        engines_used = []
        
        # Extract results (simplified - you might want to use BeautifulSoup)
        result_count = html.count('result result-default')
        
        # Extract engines used
        if 'id="engines_msg-table"' in html:
            engines_section = html.split('id="engines_msg-table"')[1].split('</table>')[0]
            for line in engines_section.split('\n'):
                if 'class="engine-name"' in line and '<a href="/stats' in line:
                    engine = line.split('engine=')[1].split('"')[0]
                    engines_used.append(engine)
                    
        # For now, return metadata only
        # In production, you'd parse actual results
        return {
            'results': [{'title': f'Result {i+1}', 'url': '#', 'source': 'searxng'} 
                       for i in range(min(result_count, 10))],
            'engines_used': engines_used,
            'result_count': result_count
        }
        
    def _get_searxng_engines(self) -> List[str]:
        """Get list of SearXNG engines"""
        # This should be dynamically fetched, but for now use known engines
        return [
            'google', 'duckduckgo', 'bing', 'wikipedia', 'startpage',
            'bandcamp', 'soundcloud', 'genius', 'mixcloud', 'deezer',
            'beatport', 'lastfm', 'musicbrainz'
        ]
        
    async def search_searxng(self, query: str, **params) -> Dict[str, Any]:
        """Direct SearXNG search"""
        return await self._search_searxng_async(query, 
                                               params.get('categories'),
                                               params.get('engines'))
        
    async def search_custom_engines(self, query: str, engines: List[str] = None) -> Dict[str, Any]:
        """Direct custom engine search"""
        if not engines:
            engines = list(self.registry.engines.keys())
        return await self._search_custom_async(query, engines)
        
    async def get_status(self) -> Dict[str, Any]:
        """Get system status"""
        status = {
            'timestamp': asyncio.get_event_loop().time(),
            'services': {
                'searxng': await self._check_searxng(),
                'orchestrator': await self._check_orchestrator(),
                'custom_engines': {
                    'count': len(self.registry.engines),
                    'enabled': len([e for e in self.registry.engines.values() if e.get('enabled', True)])
                }
            }
        }
        return status
        
    async def _check_searxng(self) -> Dict[str, Any]:
        """Check SearXNG status"""
        try:
            async with self.session.get(f"{self.searxng_url}/", timeout=5) as response:
                return {
                    'status': 'online' if response.status == 200 else 'error',
                    'response_time': response.headers.get('X-Response-Time', 'unknown')
                }
        except:
            return {'status': 'offline'}
            
    async def _check_orchestrator(self) -> Dict[str, Any]:
        """Check orchestrator status"""
        try:
            async with self.session.get(f"{self.orchestrator_url}/health", timeout=5) as response:
                return {
                    'status': 'online' if response.status in [200, 404] else 'error'
                }
        except:
            return {'status': 'offline'}
            
    async def list_all_engines(self) -> Dict[str, Any]:
        """List all available engines from both sources"""
        return {
            'searxng': self._get_searxng_engines(),
            'custom': self.registry.list_engines()
        }


async def main():
    """Test the connector"""
    connector = EngineBridgeConnector()
    await connector.initialize()
    
    try:
        # Test unified search
        print("Testing unified search...")
        results = await connector.unified_search("electronic music", categories=['music'])
        print(f"Found {results['total_count']} results")
        print(f"Sources: {results['sources']}")
        
        # Test status
        print("\nChecking system status...")
        status = await connector.get_status()
        print(json.dumps(status, indent=2))
        
    finally:
        await connector.close()


if __name__ == "__main__":
    asyncio.run(main())