#!/usr/bin/env python3
"""
Engine Service - Main service to run music search engines
"""
import sys
import os
import time
from pathlib import Path
from typing import Dict, Any, List

# Add parent directory to path to import protocol and registry
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from protocol import JsonRpcProtocol
from engine_registry import EngineRegistry


class EngineService:
    """Main service that handles engine operations"""
    
    def __init__(self, engines_dir: str):
        self.engines_dir = engines_dir
        self.registry = EngineRegistry(engines_dir)
        self.protocol = JsonRpcProtocol()
        
        # Register JSON-RPC handlers
        self.protocol.register_handler("ping", self.handle_ping)
        self.protocol.register_handler("list_engines", self.handle_list_engines)
        self.protocol.register_handler("search", self.handle_search)
        self.protocol.register_handler("search_all", self.handle_search_all)
        self.protocol.register_handler("get_engine_info", self.handle_get_engine_info)
        self.protocol.register_handler("enable_engine", self.handle_enable_engine)
        self.protocol.register_handler("disable_engine", self.handle_disable_engine)
    
    def handle_ping(self) -> Dict[str, Any]:
        """Health check endpoint"""
        return {
            "status": "ok",
            "timestamp": time.time(),
            "engines_count": len(self.registry.engines)
        }
    
    def handle_list_engines(self) -> List[Dict[str, Any]]:
        """List all available engines"""
        return self.registry.list_engines()
    
    def handle_search(self, engine: str, query: str, **params) -> Dict[str, Any]:
        """Search using a specific engine"""
        start_time = time.time()
        
        try:
            results = self.registry.search(engine, query, params)
            
            return {
                "success": True,
                "engine": engine,
                "query": query,
                "results": results,
                "count": len(results),
                "response_time": time.time() - start_time
            }
        except Exception as e:
            return {
                "success": False,
                "engine": engine,
                "query": query,
                "error": str(e),
                "response_time": time.time() - start_time
            }
    
    def handle_search_all(self, query: str, **params) -> Dict[str, Any]:
        """Search using all enabled engines"""
        start_time = time.time()
        
        try:
            results = self.registry.search_all(query, params)
            
            # Group results by engine
            results_by_engine = {}
            for result in results:
                engine = result.get('engine', 'unknown')
                if engine not in results_by_engine:
                    results_by_engine[engine] = []
                results_by_engine[engine].append(result)
            
            return {
                "success": True,
                "query": query,
                "results": results,
                "results_by_engine": results_by_engine,
                "total_count": len(results),
                "engine_count": len(results_by_engine),
                "response_time": time.time() - start_time
            }
        except Exception as e:
            return {
                "success": False,
                "query": query,
                "error": str(e),
                "response_time": time.time() - start_time
            }
    
    def handle_get_engine_info(self, engine: str) -> Dict[str, Any]:
        """Get detailed information about an engine"""
        engine_info = self.registry.get_engine(engine)
        if not engine_info:
            return {
                "success": False,
                "error": f"Engine '{engine}' not found"
            }
        
        return {
            "success": True,
            "engine": engine_info.to_dict()
        }
    
    def handle_enable_engine(self, engine: str) -> Dict[str, Any]:
        """Enable an engine"""
        engine_info = self.registry.get_engine(engine)
        if not engine_info:
            return {
                "success": False,
                "error": f"Engine '{engine}' not found"
            }
        
        engine_info.enabled = True
        return {
            "success": True,
            "engine": engine,
            "enabled": True
        }
    
    def handle_disable_engine(self, engine: str) -> Dict[str, Any]:
        """Disable an engine"""
        engine_info = self.registry.get_engine(engine)
        if not engine_info:
            return {
                "success": False,
                "error": f"Engine '{engine}' not found"
            }
        
        engine_info.enabled = False
        return {
            "success": True,
            "engine": engine,
            "enabled": False
        }
    
    def run(self):
        """Run the service"""
        print(f"Engine Service started with {len(self.registry.engines)} engines", file=sys.stderr)
        print(f"Available engines: {', '.join(self.registry.engines.keys())}", file=sys.stderr)
        
        # Run the protocol loop
        self.protocol.run()


def main():
    # Determine engines directory
    if len(sys.argv) > 1:
        engines_dir = sys.argv[1]
    else:
        # Default to engines directory relative to this script
        engines_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "engines")
    
    # Create and run service
    service = EngineService(engines_dir)
    service.run()


if __name__ == "__main__":
    main()
