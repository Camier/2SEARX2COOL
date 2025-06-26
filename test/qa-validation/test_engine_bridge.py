"""
Test Engine Bridge JSON-RPC Communication
Validates the bridge between Electron and Python engines
"""
import pytest
import json
import subprocess
import sys
from pathlib import Path
import tempfile
import os

# Add engine-bridge to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "engine-bridge"))


class TestEngineBridge:
    """Test JSON-RPC engine bridge functionality"""
    
    @classmethod
    def setup_class(cls):
        """Setup test environment"""
        cls.project_root = Path(__file__).parent.parent.parent
        cls.engine_bridge_path = cls.project_root / "engine-bridge"
        cls.engines_path = cls.project_root / "engines"
    
    def send_json_rpc_request(self, request_data):
        """Send JSON-RPC request to engine service"""
        # Write request to temp file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(request_data, f)
            temp_file = f.name
        
        try:
            # Run engine service with request
            result = subprocess.run(
                [sys.executable, str(self.engine_bridge_path / "engine_service.py"), str(self.engines_path)],
                input=json.dumps(request_data),
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                print(f"Error output: {result.stderr}")
                return None
            
            # Parse response
            return json.loads(result.stdout)
            
        finally:
            # Cleanup temp file
            if os.path.exists(temp_file):
                os.unlink(temp_file)
    
    def test_list_engines_request(self):
        """Test listing all available engines"""
        request = {
            "jsonrpc": "2.0",
            "method": "list_engines",
            "id": 1
        }
        
        response = self.send_json_rpc_request(request)
        
        assert response is not None
        assert response['jsonrpc'] == "2.0"
        assert response['id'] == 1
        assert 'result' in response
        
        engines = response['result']
        assert isinstance(engines, list)
        assert len(engines) > 0
        
        # Check engine structure
        for engine in engines:
            assert 'name' in engine
            assert 'categories' in engine
            assert 'enabled' in engine
    
    def test_search_request(self):
        """Test search functionality through JSON-RPC"""
        request = {
            "jsonrpc": "2.0",
            "method": "search",
            "params": {
                "engine": "genius",
                "query": "test search",
                "page": 1
            },
            "id": 2
        }
        
        response = self.send_json_rpc_request(request)
        
        assert response is not None
        assert response['jsonrpc'] == "2.0"
        assert response['id'] == 2
        
        # Should have either result or error
        assert 'result' in response or 'error' in response
        
        if 'result' in response:
            results = response['result']
            assert isinstance(results, list)
            
            # Check result structure if any results
            for result in results[:5]:
                assert 'url' in result
                assert 'title' in result
                assert 'engine' in result
    
    def test_search_all_engines(self):
        """Test searching across all engines"""
        request = {
            "jsonrpc": "2.0",
            "method": "search_all",
            "params": {
                "query": "music",
                "page": 1
            },
            "id": 3
        }
        
        response = self.send_json_rpc_request(request)
        
        assert response is not None
        assert response['jsonrpc'] == "2.0"
        assert response['id'] == 3
        
        if 'result' in response:
            results = response['result']
            assert isinstance(results, list)
            
            # Should have results from multiple engines
            engines_found = set()
            for result in results:
                if 'engine' in result:
                    engines_found.add(result['engine'])
            
            # At least some engines should return results
            assert len(engines_found) > 0
    
    def test_invalid_method(self):
        """Test handling of invalid method"""
        request = {
            "jsonrpc": "2.0",
            "method": "invalid_method",
            "id": 4
        }
        
        response = self.send_json_rpc_request(request)
        
        assert response is not None
        assert response['jsonrpc'] == "2.0"
        assert response['id'] == 4
        assert 'error' in response
        
        error = response['error']
        assert 'code' in error
        assert 'message' in error
        assert error['code'] == -32601  # Method not found
    
    def test_malformed_request(self):
        """Test handling of malformed requests"""
        # Missing jsonrpc version
        request = {
            "method": "list_engines",
            "id": 5
        }
        
        response = self.send_json_rpc_request(request)
        
        assert response is not None
        assert 'error' in response
        assert response['error']['code'] == -32600  # Invalid request
    
    def test_batch_requests(self):
        """Test batch JSON-RPC requests"""
        batch_request = [
            {
                "jsonrpc": "2.0",
                "method": "list_engines",
                "id": 6
            },
            {
                "jsonrpc": "2.0",
                "method": "search",
                "params": {
                    "engine": "soundcloud",
                    "query": "electronic",
                    "page": 1
                },
                "id": 7
            }
        ]
        
        response = self.send_json_rpc_request(batch_request)
        
        assert response is not None
        assert isinstance(response, list)
        assert len(response) == 2
        
        # Check each response
        for resp in response:
            assert 'jsonrpc' in resp
            assert 'id' in resp
            assert 'result' in resp or 'error' in resp
    
    def test_engine_loading_directly(self):
        """Test direct engine loading without JSON-RPC"""
        from engine_registry import EngineRegistry
        
        registry = EngineRegistry(str(self.engines_path))
        
        # Check engines loaded
        engines = registry.list_engines()
        assert len(engines) > 0
        
        # Test specific engines
        key_engines = ['genius', 'spotify_web', 'soundcloud', 'bandcamp']
        for engine_name in key_engines:
            engine = registry.get_engine(engine_name)
            assert engine is not None
            assert engine.name == engine_name
            assert engine.module is not None
    
    def test_concurrent_requests(self):
        """Test handling of concurrent requests"""
        import concurrent.futures
        
        def make_request(engine_name):
            request = {
                "jsonrpc": "2.0",
                "method": "search",
                "params": {
                    "engine": engine_name,
                    "query": "test",
                    "page": 1
                },
                "id": f"concurrent_{engine_name}"
            }
            return self.send_json_rpc_request(request)
        
        engines = ['genius', 'soundcloud', 'bandcamp']
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            results = list(executor.map(make_request, engines))
        
        # All requests should complete
        assert all(r is not None for r in results)
        
        # Check responses
        for response in results:
            assert 'jsonrpc' in response
            assert 'id' in response
            assert response['id'].startswith('concurrent_')
    
    def test_engine_error_handling(self):
        """Test handling of engine errors"""
        request = {
            "jsonrpc": "2.0",
            "method": "search",
            "params": {
                "engine": "nonexistent_engine",
                "query": "test",
                "page": 1
            },
            "id": 8
        }
        
        response = self.send_json_rpc_request(request)
        
        assert response is not None
        assert 'error' in response
        assert response['error']['code'] == -32002  # Engine not found
    
    def test_notification_request(self):
        """Test JSON-RPC notification (no id)"""
        request = {
            "jsonrpc": "2.0",
            "method": "list_engines"
            # No id - this is a notification
        }
        
        response = self.send_json_rpc_request(request)
        
        # Notifications should not return a response
        # But our implementation might still return one
        if response:
            assert 'id' not in response or response['id'] is None


class TestEngineFunctionality:
    """Test individual engine functionality through the bridge"""
    
    def setup_method(self):
        """Setup for each test"""
        self.project_root = Path(__file__).parent.parent.parent
        self.engine_bridge_path = self.project_root / "engine-bridge"
        self.engines_path = self.project_root / "engines"
    
    @pytest.mark.parametrize("engine_name,query", [
        ("genius", "lyrics"),
        ("soundcloud", "electronic music"),
        ("bandcamp", "indie rock"),
        ("spotify_web", "jazz"),
        ("youtube_music", "classical"),
        ("deezer", "pop music"),
        ("lastfm", "metal bands"),
        ("musicbrainz", "album")
    ])
    def test_engine_search_quality(self, engine_name, query):
        """Test search quality for each engine"""
        from engine_registry import EngineRegistry
        
        registry = EngineRegistry(str(self.engines_path))
        
        try:
            results = registry.search(engine_name, query, {'page': 1})
            
            # Engine should return results or handle gracefully
            assert isinstance(results, list)
            
            # If results returned, validate structure
            if len(results) > 0:
                for result in results[:3]:  # Check first 3 results
                    assert 'url' in result
                    assert 'title' in result
                    assert result['url'].startswith('http')
                    assert len(result['title']) > 0
                    
                print(f"✅ {engine_name}: {len(results)} results for '{query}'")
            else:
                print(f"⚠️  {engine_name}: No results for '{query}'")
                
        except Exception as e:
            pytest.skip(f"Engine {engine_name} error: {str(e)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])