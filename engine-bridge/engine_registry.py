"""
Engine Registry - Discovers and loads music search engines
"""
import os
import sys
import importlib.util
import inspect
from typing import Dict, List, Optional, Any
from pathlib import Path
import json


class EngineInfo:
    """Information about an engine"""
    def __init__(self, name: str, module_path: str, categories: List[str], about: Dict[str, Any]):
        self.name = name
        self.module_path = module_path
        self.categories = categories
        self.about = about
        self.module = None
        self.enabled = True
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "module_path": self.module_path,
            "categories": self.categories,
            "about": self.about,
            "enabled": self.enabled
        }


class EngineRegistry:
    """Manages discovery and loading of search engines"""
    
    def __init__(self, engines_dir: str):
        self.engines_dir = Path(engines_dir)
        self.engines: Dict[str, EngineInfo] = {}
        self._discover_engines()
    
    def _discover_engines(self):
        """Discover all available engines in the engines directory"""
        if not self.engines_dir.exists():
            raise ValueError(f"Engines directory not found: {self.engines_dir}")
        
        # Add engines directory to Python path
        sys.path.insert(0, str(self.engines_dir))
        
        for file_path in self.engines_dir.glob("*.py"):
            if file_path.name.startswith("__") or file_path.name == "base_music.py":
                continue
            
            try:
                engine_info = self._load_engine_info(file_path)
                if engine_info:
                    self.engines[engine_info.name] = engine_info
            except Exception as e:
                print(f"Failed to load engine {file_path.name}: {e}", file=sys.stderr)
    
    def _load_engine_info(self, file_path: Path) -> Optional[EngineInfo]:
        """Load engine information from a Python file"""
        module_name = file_path.stem
        
        # Load the module
        spec = importlib.util.spec_from_file_location(module_name, file_path)
        if not spec or not spec.loader:
            return None
        
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        
        # Check if it's a valid engine
        if not hasattr(module, 'request') or not hasattr(module, 'response'):
            return None
        
        # Extract engine information
        categories = getattr(module, 'categories', ['general'])
        about = getattr(module, 'about', {})
        
        engine_info = EngineInfo(
            name=module_name,
            module_path=str(file_path),
            categories=categories,
            about=about
        )
        engine_info.module = module
        
        return engine_info
    
    def get_engine(self, name: str) -> Optional[EngineInfo]:
        """Get engine by name"""
        return self.engines.get(name)
    
    def list_engines(self) -> List[Dict[str, Any]]:
        """List all available engines"""
        return [engine.to_dict() for engine in self.engines.values()]
    
    def get_enabled_engines(self) -> List[EngineInfo]:
        """Get all enabled engines"""
        return [engine for engine in self.engines.values() if engine.enabled]
    
    def search(self, engine_name: str, query: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Execute search on a specific engine"""
        engine = self.get_engine(engine_name)
        if not engine or not engine.enabled:
            raise ValueError(f"Engine '{engine_name}' not found or disabled")
        
        if not engine.module:
            raise ValueError(f"Engine '{engine_name}' module not loaded")
        
        # Try to use SearXNG instance first
        searxng_url = "http://localhost:8888/search"
        
        # Prepare search parameters for SearXNG
        search_params = {
            'q': query,
            'format': 'json',
            'engines': engine_name,
            'pageno': params.get('page', 1),
            'language': params.get('language', 'all'),
            'time_range': params.get('time_range', ''),
            'safesearch': params.get('safesearch', 0)
        }
        
        try:
            # Try to use SearXNG instance
            import requests
            response = requests.get(searxng_url, params=search_params, timeout=5)
            response.raise_for_status()
            
            # Parse JSON response
            data = response.json()
            results = data.get('results', [])
            
            # Add engine name to each result
            for result in results:
                result['engine'] = engine_name
            
            return results
            
        except Exception as e:
            # Fallback to direct engine execution
            print(f"SearXNG not available, using direct engine execution: {e}", file=sys.stderr)
            
            # Prepare request parameters
            request_params = {
                'query': query,
                'pageno': params.get('page', 1),
                'language': params.get('language', 'all'),
                'time_range': params.get('time_range'),
                'safesearch': params.get('safesearch', 0)
            }
            
            # Call engine's request function
            request_result = engine.module.request(query, request_params)
            
            # For direct execution, we need to handle HTTP requests
            if 'url' in request_result:
                try:
                    import requests
                    resp = requests.get(
                        request_result['url'],
                        headers=request_result.get('headers', {}),
                        timeout=10
                    )
                    
                    # Call engine's response function with real response
                    results = engine.module.response(resp)
                    
                    # Add engine name to each result
                    for result in results:
                        result['engine'] = engine_name
                    
                    return results
                    
                except Exception as direct_error:
                    print(f"Direct engine execution failed: {direct_error}", file=sys.stderr)
                    return []
            else:
                # Some engines might not need HTTP requests
                # Create a minimal response object
                class MinimalResponse:
                    def __init__(self):
                        self.text = ""
                        self.status_code = 200
                        self.url = ""
                
                results = engine.module.response(MinimalResponse())
                
                # Add engine name to each result
                for result in results:
                    result['engine'] = engine_name
                
                return results
    
    def search_all(self, query: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Execute search on all enabled engines"""
        all_results = []
        
        for engine in self.get_enabled_engines():
            try:
                results = self.search(engine.name, query, params)
                all_results.extend(results)
            except Exception as e:
                print(f"Engine {engine.name} failed: {e}", file=sys.stderr)
        
        return all_results
