#!/usr/bin/env python3
"""
SearXNG Music Engine Adapter
Converts custom 2SEARX2COOL music engines to SearXNG-compatible format
"""

import logging
import importlib
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime

logger = logging.getLogger(__name__)

class SearXNGMusicAdapter:
    """Adapter to make custom music engines compatible with SearXNG"""
    
    def __init__(self, engine_module_name: str, engine_path: str):
        self.engine_module_name = engine_module_name
        self.engine_path = engine_path
        self.engine_module = None
        self.custom_engine = None
        
    def load_engine(self) -> bool:
        """Load the custom engine module"""
        try:
            # Add engine directory to Python path
            engine_dir = Path(self.engine_path).parent
            if str(engine_dir) not in sys.path:
                sys.path.insert(0, str(engine_dir))
            
            # Import the engine module
            self.engine_module = importlib.import_module(self.engine_module_name)
            
            # Check if this is a class-based engine
            if hasattr(self.engine_module, 'Engine'):
                # Instantiate class-based engine
                self.custom_engine = self.engine_module.Engine({})
            elif any(hasattr(self.engine_module, attr) for attr in ['DiscogsEngine', 'BeatportEngine', 'MusicEngine']):
                # Find the engine class
                for attr_name in dir(self.engine_module):
                    attr = getattr(self.engine_module, attr_name)
                    if isinstance(attr, type) and attr_name.endswith('Engine'):
                        self.custom_engine = attr({})
                        break
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to load engine {self.engine_module_name}: {e}")
            return False
    
    def create_request_function(self) -> Callable:
        """Create a SearXNG-compatible request function"""
        def request(query, params):
            """SearXNG request function"""
            # Standard SearXNG request format
            params['url'] = self._get_search_url(query, params)
            params['headers'] = self._get_headers()
            
            # Handle paging
            if 'pageno' in params:
                params['url'] = self._add_paging(params['url'], params['pageno'])
            
            return params
        
        return request
    
    def create_response_function(self) -> Callable:
        """Create a SearXNG-compatible response function"""
        def response(resp):
            """SearXNG response function"""
            results = []
            
            try:
                # Try to use custom engine's parsing if available
                if self.custom_engine and hasattr(self.custom_engine, 'parse_response'):
                    custom_results = self.custom_engine.parse_response(resp.text)
                    # Convert custom format to SearXNG format
                    for item in custom_results:
                        results.append(self._convert_result(item))
                
                elif self.engine_module and hasattr(self.engine_module, 'response'):
                    # Use module-level response function
                    return self.engine_module.response(resp)
                    
                else:
                    # Fallback parsing
                    results = self._fallback_parse(resp)
                    
            except Exception as e:
                logger.error(f"Error parsing response: {e}")
            
            return results
        
        return response
    
    def _get_search_url(self, query: str, params: Dict) -> str:
        """Get the search URL for the engine"""
        # Try to get URL from custom engine
        if self.custom_engine and hasattr(self.custom_engine, 'get_search_url'):
            return self.custom_engine.get_search_url(query)
        
        # Try module-level URL
        if hasattr(self.engine_module, 'base_url'):
            return f"{self.engine_module.base_url}/search?q={query}"
        
        # Fallback URLs for known engines
        url_map = {
            'beatport': 'https://www.beatport.com/search?q={query}',
            'discogs': 'https://api.discogs.com/database/search?q={query}',
            'lastfm': 'https://www.last.fm/search?q={query}',
            'musicbrainz': 'https://musicbrainz.org/ws/2/release/?query={query}&fmt=json',
        }
        
        engine_name = self.engine_module_name.replace('_music', '').replace('_enhanced', '')
        return url_map.get(engine_name, f"https://example.com/search?q={query}")
    
    def _get_headers(self) -> Dict[str, str]:
        """Get request headers"""
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
        
        # Add custom headers if available
        if hasattr(self.engine_module, 'headers'):
            headers.update(self.engine_module.headers)
            
        return headers
    
    def _add_paging(self, url: str, pageno: int) -> str:
        """Add paging parameters to URL"""
        separator = '&' if '?' in url else '?'
        
        # Different engines use different paging params
        if 'musicbrainz' in url:
            offset = (pageno - 1) * 25
            return f"{url}{separator}offset={offset}"
        elif 'beatport' in url:
            return f"{url}{separator}page={pageno}"
        else:
            # Default paging
            return f"{url}{separator}page={pageno}"
    
    def _convert_result(self, item: Dict) -> Dict:
        """Convert custom engine result to SearXNG format"""
        result = {
            'template': 'music.html',  # Use music template
            'url': item.get('url', ''),
            'title': item.get('title', 'Unknown Title'),
            'content': item.get('description', ''),
        }
        
        # Add music-specific fields
        if 'artist' in item:
            result['artist'] = item['artist']
        if 'album' in item:
            result['album'] = item['album']
        if 'duration' in item:
            result['duration'] = item['duration']
        if 'thumbnail' in item:
            result['img_src'] = item['thumbnail']
        if 'release_date' in item:
            result['publishedDate'] = item['release_date']
            
        # Add metadata
        metadata = []
        if 'genre' in item:
            metadata.append(f"Genre: {item['genre']}")
        if 'label' in item:
            metadata.append(f"Label: {item['label']}")
        if metadata:
            result['metadata'] = ' • '.join(metadata)
            
        return result
    
    def _fallback_parse(self, resp) -> List[Dict]:
        """Fallback parsing when no custom parser is available"""
        # This is a basic implementation that won't work for most engines
        # but provides a structure
        return [{
            'template': 'music.html',
            'url': resp.url,
            'title': 'Music Search Result',
            'content': 'No parser available for this engine',
        }]
    
    def get_engine_attributes(self) -> Dict[str, Any]:
        """Get SearXNG engine attributes"""
        attrs = {
            'categories': ['music'],
            'paging': True,
            'time_range_support': False,
            'safesearch': False,
        }
        
        # Try to get attributes from custom engine
        if self.engine_module:
            for attr in ['categories', 'paging', 'time_range_support']:
                if hasattr(self.engine_module, attr):
                    attrs[attr] = getattr(self.engine_module, attr)
        
        return attrs


def create_searxng_engine(engine_name: str, engine_path: str) -> Dict[str, Any]:
    """Create a SearXNG-compatible engine module"""
    adapter = SearXNGMusicAdapter(engine_name, engine_path)
    
    if not adapter.load_engine():
        raise ValueError(f"Failed to load engine {engine_name}")
    
    # Create engine module with required functions
    engine = {
        'request': adapter.create_request_function(),
        'response': adapter.create_response_function(),
    }
    
    # Add engine attributes
    engine.update(adapter.get_engine_attributes())
    
    return engine