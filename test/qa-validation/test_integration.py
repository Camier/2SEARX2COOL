"""
Comprehensive Integration Testing Suite for 2SEARX2COOL
Tests both web service and desktop modes
"""
import pytest
import asyncio
import json
import subprocess
import time
import requests
from pathlib import Path
import sys
import os

# Add project directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "engine-bridge"))


class TestIntegrationCore:
    """Core integration tests for the unified system"""
    
    @classmethod
    def setup_class(cls):
        """Setup test environment"""
        cls.base_url = "http://localhost:8888"
        cls.orchestrator_url = "http://localhost:8889"
        cls.services_started = False
        
        # Check if services are already running
        try:
            requests.get(cls.base_url, timeout=2)
            cls.services_started = True
        except:
            print("Services not running, will be started by test runner")
    
    def test_searxng_service_health(self):
        """Test that SearXNG service is healthy"""
        try:
            response = requests.get(f"{self.base_url}/healthz", timeout=5)
            assert response.status_code == 200
        except requests.exceptions.ConnectionError:
            # Try basic endpoint
            response = requests.get(self.base_url, timeout=5)
            assert response.status_code == 200
    
    def test_orchestrator_health(self):
        """Test that orchestrator service is healthy"""
        response = requests.get(f"{self.orchestrator_url}/health", timeout=5)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
    
    def test_redis_connection(self):
        """Test Redis connectivity"""
        import redis
        r = redis.Redis(host='localhost', port=6379, decode_responses=True)
        assert r.ping()
    
    def test_engine_bridge_loading(self):
        """Test that engine bridge can load engines"""
        from engine_registry import EngineRegistry
        
        engines_dir = Path(__file__).parent.parent.parent / "engines"
        registry = EngineRegistry(str(engines_dir))
        
        # Check that engines are loaded
        engines = registry.list_engines()
        assert len(engines) > 0
        
        # Check for key music engines
        engine_names = [e['name'] for e in engines]
        expected_engines = ['genius', 'spotify_web', 'soundcloud', 'bandcamp']
        for engine in expected_engines:
            assert engine in engine_names, f"Engine {engine} not found"
    
    def test_search_via_searxng(self):
        """Test search through SearXNG API"""
        params = {
            'q': 'test',
            'format': 'json',
            'engines': 'genius',
            'categories': 'music'
        }
        
        response = requests.get(f"{self.base_url}/search", params=params, timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        assert 'results' in data
        assert isinstance(data['results'], list)
    
    def test_json_rpc_bridge(self):
        """Test JSON-RPC bridge communication"""
        from engine_service import process_request
        
        # Test list engines request
        request = {
            "jsonrpc": "2.0",
            "method": "list_engines",
            "id": 1
        }
        
        response = process_request(request, Path(__file__).parent.parent.parent / "engines")
        assert response['jsonrpc'] == "2.0"
        assert 'result' in response
        assert isinstance(response['result'], list)
        assert len(response['result']) > 0
    
    def test_music_engine_search(self):
        """Test music-specific engine search"""
        engines_to_test = ['genius', 'bandcamp', 'soundcloud']
        
        for engine in engines_to_test:
            params = {
                'q': 'rock music',
                'format': 'json',
                'engines': engine
            }
            
            response = requests.get(f"{self.base_url}/search", params=params, timeout=15)
            assert response.status_code == 200
            
            data = response.json()
            assert 'results' in data
            print(f"Engine {engine} returned {len(data['results'])} results")


class TestMusicEngines:
    """Test all music engines individually"""
    
    def setup_method(self):
        """Setup for each test"""
        self.base_url = "http://localhost:8888"
        self.test_queries = {
            'general': 'music',
            'artist': 'Beatles',
            'song': 'Hey Jude',
            'album': 'Abbey Road'
        }
    
    @pytest.mark.parametrize("engine", [
        'allmusic', 'apple_music', 'bandcamp', 'bandcamp_enhanced',
        'beatport', 'deezer', 'discogs', 'free_music_archive',
        'genius', 'itunes', 'jamendo', 'lastfm', 'mp3com',
        'musicbrainz', 'musixmatch', 'napster', 'pandora',
        'qobuz', 'soundcloud', 'soundcloud_tracks', 'soundcloud_enhanced',
        'spotify_web', 'spotify_api', 'tidal', 'youtube_music',
        'youtube_music_enhanced'
    ])
    def test_individual_engine(self, engine):
        """Test each music engine individually"""
        params = {
            'q': self.test_queries['general'],
            'format': 'json',
            'engines': engine,
            'categories': 'music'
        }
        
        try:
            response = requests.get(f"{self.base_url}/search", params=params, timeout=20)
            assert response.status_code == 200
            
            data = response.json()
            assert 'results' in data
            
            # Engine should return at least some results or handle gracefully
            if len(data['results']) == 0:
                print(f"Warning: Engine {engine} returned no results")
            else:
                # Validate result structure
                for result in data['results'][:5]:  # Check first 5 results
                    assert 'url' in result
                    assert 'title' in result
                    
        except requests.exceptions.Timeout:
            pytest.skip(f"Engine {engine} timed out")
        except Exception as e:
            pytest.fail(f"Engine {engine} failed with error: {str(e)}")


class TestElectronDesktop:
    """Test Electron desktop application features"""
    
    def test_electron_build_configuration(self):
        """Test Electron build configuration"""
        config_path = Path(__file__).parent.parent.parent / "electron-builder.optimization.yml"
        assert config_path.exists()
        
        # Check package.json has electron scripts
        package_json = Path(__file__).parent.parent.parent / "package.json"
        with open(package_json) as f:
            data = json.load(f)
        
        assert 'scripts' in data
        assert 'dev' in data['scripts']
        assert 'build' in data['scripts']
        assert 'dist' in data['scripts']
    
    def test_electron_main_process(self):
        """Test Electron main process file exists"""
        main_path = Path(__file__).parent.parent.parent / "out" / "main" / "index.js"
        assert main_path.exists()
    
    def test_desktop_features_config(self):
        """Test desktop-specific features configuration"""
        # Check for system tray configuration
        src_path = Path(__file__).parent.parent.parent / "src"
        
        # Check for main process files
        assert (src_path / "main").exists()
        
        # Check for preload scripts
        preload_dir = src_path / "preload"
        assert preload_dir.exists()


class TestConfiguration:
    """Test unified configuration system"""
    
    def test_config_structure(self):
        """Test configuration directory structure"""
        config_dir = Path(__file__).parent.parent.parent / "config"
        assert config_dir.exists()
        
        # Check for key configuration files
        expected_files = [
            'settings.yml',
            'music_engines.yml',
            'desktop.config.json'
        ]
        
        for file in expected_files:
            config_file = config_dir / file
            assert config_file.exists(), f"Configuration file {file} not found"
    
    def test_environment_config(self):
        """Test environment configuration"""
        env_file = Path(__file__).parent.parent.parent / ".env"
        env_example = Path(__file__).parent.parent.parent / ".env.example"
        
        assert env_example.exists()
        
        if env_file.exists():
            with open(env_file) as f:
                content = f.read()
            
            # Check for required environment variables
            required_vars = [
                'SEARXNG_PORT',
                'ORCHESTRATOR_PORT',
                'REDIS_PORT'
            ]
            
            for var in required_vars:
                assert var in content


class TestDevelopmentTools:
    """Test development and refactoring tools"""
    
    def test_refactoring_script(self):
        """Test refactoring automation script"""
        script_path = Path(__file__).parent.parent.parent / "run-refactoring.js"
        assert script_path.exists()
        assert script_path.stat().st_mode & 0o111  # Check executable
    
    def test_linting_configuration(self):
        """Test linting and code quality tools"""
        root = Path(__file__).parent.parent.parent
        
        # Check ESLint configuration
        assert (root / ".eslintrc.json").exists()
        
        # Check Prettier configuration
        assert (root / ".prettierrc").exists()
        
        # Check lint-staged configuration
        assert (root / ".lintstagedrc.js").exists()
    
    def test_testing_framework(self):
        """Test testing framework configuration"""
        root = Path(__file__).parent.parent.parent
        
        # Check Vitest configuration
        assert (root / "vitest.config.ts").exists()
        
        # Check Playwright configuration
        assert (root / "playwright.config.ts").exists()


class TestPerformanceAndStability:
    """Test performance and stability aspects"""
    
    def test_concurrent_searches(self):
        """Test system under concurrent load"""
        import concurrent.futures
        
        def search_request(query):
            params = {
                'q': query,
                'format': 'json',
                'engines': 'genius,soundcloud',
                'categories': 'music'
            }
            response = requests.get("http://localhost:8888/search", params=params, timeout=30)
            return response.status_code == 200
        
        queries = [f"test query {i}" for i in range(10)]
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            results = list(executor.map(search_request, queries))
        
        # At least 80% should succeed
        success_rate = sum(results) / len(results)
        assert success_rate >= 0.8
    
    def test_cache_functionality(self):
        """Test Redis caching functionality"""
        import redis
        r = redis.Redis(host='localhost', port=6379, decode_responses=True)
        
        # Make same search twice
        params = {
            'q': 'cache test query',
            'format': 'json',
            'engines': 'genius'
        }
        
        # First request
        start1 = time.time()
        response1 = requests.get("http://localhost:8888/search", params=params, timeout=30)
        time1 = time.time() - start1
        
        # Second request (should be cached)
        start2 = time.time()
        response2 = requests.get("http://localhost:8888/search", params=params, timeout=30)
        time2 = time.time() - start2
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        # Second request should be faster (cached)
        # Allow some variance but expect significant speedup
        if time1 > 1:  # Only check if first request took significant time
            assert time2 < time1 * 0.5, f"Cache not effective: {time1:.2f}s vs {time2:.2f}s"


class TestErrorHandling:
    """Test error handling and recovery"""
    
    def test_invalid_engine_handling(self):
        """Test handling of invalid engine names"""
        params = {
            'q': 'test',
            'format': 'json',
            'engines': 'nonexistent_engine'
        }
        
        response = requests.get("http://localhost:8888/search", params=params, timeout=10)
        # Should not crash, return valid response
        assert response.status_code in [200, 400]
    
    def test_malformed_query_handling(self):
        """Test handling of malformed queries"""
        test_queries = [
            '',  # Empty query
            'a' * 1000,  # Very long query
            '<script>alert("test")</script>',  # XSS attempt
            '"; DROP TABLE engines; --',  # SQL injection attempt
        ]
        
        for query in test_queries:
            params = {
                'q': query,
                'format': 'json',
                'engines': 'genius'
            }
            
            response = requests.get("http://localhost:8888/search", params=params, timeout=10)
            # Should handle gracefully
            assert response.status_code in [200, 400]
            
            # Should return valid JSON
            try:
                data = response.json()
                assert isinstance(data, dict)
            except:
                pytest.fail(f"Invalid JSON response for query: {query}")


class TestCrossPlatformCompatibility:
    """Test cross-platform compatibility"""
    
    def test_platform_specific_builds(self):
        """Test platform-specific build configurations"""
        package_json = Path(__file__).parent.parent.parent / "package.json"
        with open(package_json) as f:
            data = json.load(f)
        
        # Check for platform-specific build scripts
        scripts = data.get('scripts', {})
        assert 'dist:win' in scripts
        assert 'dist:mac' in scripts
        assert 'dist:linux' in scripts
    
    def test_path_handling(self):
        """Test cross-platform path handling"""
        from pathlib import Path
        
        # Test that paths work correctly
        test_paths = [
            Path(__file__).parent.parent.parent / "engines",
            Path(__file__).parent.parent.parent / "config",
            Path(__file__).parent.parent.parent / "src"
        ]
        
        for path in test_paths:
            assert path.exists()
            # Paths should be properly resolved
            assert path.resolve() == path.absolute()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])