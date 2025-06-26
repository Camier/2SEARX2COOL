#!/usr/bin/env python3
"""
Unified Configuration Loader for Python Services
Loads configuration from the unified configuration system
Supports both standalone service mode and integrated desktop mode
"""

import os
import json
import yaml
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime


@dataclass
class ServiceConfig:
    """Service configuration data class"""
    searxng_port: int
    searxng_host: str
    orchestrator_port: int
    orchestrator_host: str
    redis_url: str
    database_url: str
    jwt_secret: str
    cors_origins: list


class UnifiedConfigLoader:
    """
    Unified configuration loader for Python services
    Reads configuration from YAML files and unified JSON config
    """
    
    def __init__(self, config_dir: Optional[str] = None):
        """Initialize configuration loader"""
        if config_dir is None:
            # Default to config directory relative to this file
            self.config_dir = Path(__file__).parent.parent
        else:
            self.config_dir = Path(config_dir)
        
        self.unified_dir = self.config_dir / "unified"
        
        # Configuration file paths
        self.config_files = {
            'music_engines': self.config_dir / 'music_engines.yml',
            'orchestrator': self.config_dir / 'orchestrator.yml',
            'searxng_settings': self.config_dir / 'searxng-settings.yml',
            'unified': self.unified_dir / 'unified-config.json',
            'app_settings': self.unified_dir / 'app-settings.json',
            'user_preferences': self.unified_dir / 'user-preferences.json'
        }
        
        # Cache for loaded configurations
        self._cache = {}
        
        # Operating mode
        self.mode = os.environ.get('APP_MODE', 'hybrid')
        
    def load_yaml(self, file_path: Path) -> Dict[str, Any]:
        """Load YAML configuration file"""
        try:
            with open(file_path, 'r') as f:
                return yaml.safe_load(f) or {}
        except FileNotFoundError:
            print(f"Warning: Configuration file not found: {file_path}")
            return {}
        except Exception as e:
            print(f"Error loading YAML file {file_path}: {e}")
            return {}
    
    def load_json(self, file_path: Path) -> Dict[str, Any]:
        """Load JSON configuration file"""
        try:
            with open(file_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"Warning: Configuration file not found: {file_path}")
            return {}
        except Exception as e:
            print(f"Error loading JSON file {file_path}: {e}")
            return {}
    
    def load_music_engines_config(self) -> Dict[str, Any]:
        """Load music engines configuration"""
        if 'music_engines' not in self._cache:
            self._cache['music_engines'] = self.load_yaml(self.config_files['music_engines'])
        return self._cache['music_engines']
    
    def load_orchestrator_config(self) -> Dict[str, Any]:
        """Load orchestrator configuration"""
        if 'orchestrator' not in self._cache:
            config = self.load_yaml(self.config_files['orchestrator'])
            
            # Check if we have unified config that might override settings
            unified = self.load_unified_config()
            if unified and 'service' in unified:
                # Override with unified config values if available
                if 'orchestrator' in unified['service']:
                    orch_unified = unified['service']['orchestrator']
                    if 'port' in orch_unified:
                        config.setdefault('SERVER', {})['PORT'] = orch_unified['port']
                    if 'host' in orch_unified:
                        config.setdefault('SERVER', {})['HOST'] = orch_unified['host']
            
            self._cache['orchestrator'] = config
        
        return self._cache['orchestrator']
    
    def load_searxng_settings(self) -> Dict[str, Any]:
        """Load SearXNG settings"""
        if 'searxng_settings' not in self._cache:
            self._cache['searxng_settings'] = self.load_yaml(self.config_files['searxng_settings'])
        return self._cache['searxng_settings']
    
    def load_unified_config(self) -> Dict[str, Any]:
        """Load unified configuration"""
        if 'unified' not in self._cache:
            self._cache['unified'] = self.load_json(self.config_files['unified'])
        return self._cache['unified']
    
    def load_app_settings(self) -> Dict[str, Any]:
        """Load application settings"""
        if 'app_settings' not in self._cache:
            self._cache['app_settings'] = self.load_json(self.config_files['app_settings'])
        return self._cache['app_settings']
    
    def get_service_config(self) -> ServiceConfig:
        """Get service configuration"""
        # Load configurations
        orchestrator = self.load_orchestrator_config()
        unified = self.load_unified_config()
        app_settings = self.load_app_settings()
        
        # Extract values with fallbacks
        searxng_port = 8888
        orchestrator_port = 8889
        
        # Try to get ports from unified config first
        if unified:
            if 'service' in unified:
                searxng_port = unified['service'].get('searxng', {}).get('port', searxng_port)
                orchestrator_port = unified['service'].get('orchestrator', {}).get('port', orchestrator_port)
        
        # Fall back to app settings
        if app_settings:
            searxng_port = app_settings.get('serverPort', searxng_port)
            orchestrator_port = app_settings.get('orchestratorPort', orchestrator_port)
        
        # Get other settings from orchestrator config
        redis_url = orchestrator.get('REDIS', {}).get('REDIS_URL', 'redis://localhost:6379/0')
        database_url = orchestrator.get('DATABASE', {}).get('SQLALCHEMY_DATABASE_URI', 
                                                           'postgresql:///searxng_cool_music')
        jwt_secret = orchestrator.get('JWT', {}).get('JWT_SECRET_KEY', 
                                                    '35252cc1a9e34982a35fa65632c09f17')
        cors_origins = orchestrator.get('CORS', {}).get('ORIGINS', 
                                                       ['http://localhost:3000', 'http://localhost:8095'])
        
        return ServiceConfig(
            searxng_port=searxng_port,
            searxng_host='0.0.0.0',
            orchestrator_port=orchestrator_port,
            orchestrator_host='0.0.0.0',
            redis_url=redis_url,
            database_url=database_url,
            jwt_secret=jwt_secret,
            cors_origins=cors_origins
        )
    
    def get_redis_config(self) -> Dict[str, Any]:
        """Get Redis configuration"""
        unified = self.load_unified_config()
        
        # Default Redis config
        redis_config = {
            'host': 'localhost',
            'port': 6379,
            'databases': {
                'cache': 0,
                'websocket': 1,
                'sessions': 2
            }
        }
        
        # Override with unified config if available
        if unified and 'shared' in unified and 'redis' in unified['shared']:
            redis_config.update(unified['shared']['redis'])
        
        return redis_config
    
    def get_music_engine_config(self, engine_name: str) -> Optional[Dict[str, Any]]:
        """Get configuration for a specific music engine"""
        music_config = self.load_music_engines_config()
        
        if 'engines' in music_config and engine_name in music_config['engines']:
            return music_config['engines'][engine_name]
        
        return None
    
    def get_enabled_music_engines(self) -> list:
        """Get list of enabled music engines"""
        music_config = self.load_music_engines_config()
        enabled_engines = []
        
        if 'engines' in music_config:
            for engine_name, engine_config in music_config['engines'].items():
                if engine_config.get('enabled', False):
                    enabled_engines.append(engine_name)
        
        return enabled_engines
    
    def get_cache_config(self) -> Dict[str, Any]:
        """Get cache configuration"""
        music_config = self.load_music_engines_config()
        return music_config.get('cache', {})
    
    def get_search_enhancement_config(self) -> Dict[str, Any]:
        """Get search enhancement configuration"""
        music_config = self.load_music_engines_config()
        return music_config.get('search_enhancement', {})
    
    def get_fallback_chains(self) -> Dict[str, list]:
        """Get fallback chains for different search types"""
        music_config = self.load_music_engines_config()
        return music_config.get('fallback_chains', {})
    
    def is_desktop_mode(self) -> bool:
        """Check if running in desktop mode"""
        return self.mode in ['desktop', 'hybrid']
    
    def is_service_mode(self) -> bool:
        """Check if running in service mode"""
        return self.mode in ['service', 'hybrid']
    
    def reload(self):
        """Reload all configurations"""
        self._cache.clear()
    
    def get_api_urls(self) -> Dict[str, str]:
        """Get API URLs for services"""
        service_config = self.get_service_config()
        
        return {
            'searxng': f"http://localhost:{service_config.searxng_port}",
            'orchestrator': f"http://localhost:{service_config.orchestrator_port}",
            'websocket': f"ws://localhost:{service_config.orchestrator_port}"
        }
    
    def validate(self) -> Dict[str, Any]:
        """Validate configuration"""
        errors = []
        warnings = []
        
        # Check if required files exist
        for name, path in self.config_files.items():
            if not path.exists() and name not in ['unified', 'app_settings', 'user_preferences']:
                errors.append(f"Required configuration file missing: {path}")
        
        # Validate service config
        try:
            service_config = self.get_service_config()
            
            # Check port conflicts
            if service_config.searxng_port == service_config.orchestrator_port:
                errors.append("SearXNG and Orchestrator ports must be different")
            
            # Check port ranges
            for port_name, port_value in [
                ('SearXNG', service_config.searxng_port),
                ('Orchestrator', service_config.orchestrator_port)
            ]:
                if not (1024 <= port_value <= 65535):
                    errors.append(f"{port_name} port must be between 1024 and 65535")
        
        except Exception as e:
            errors.append(f"Error validating service configuration: {e}")
        
        # Check music engines
        enabled_engines = self.get_enabled_music_engines()
        if not enabled_engines:
            warnings.append("No music engines are enabled")
        
        # Check Redis connectivity (optional)
        redis_config = self.get_redis_config()
        if not redis_config.get('host'):
            errors.append("Redis host is not configured")
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
            'mode': self.mode,
            'timestamp': datetime.now().isoformat()
        }


# Singleton instance
_config_loader = None


def get_config_loader(config_dir: Optional[str] = None) -> UnifiedConfigLoader:
    """Get singleton configuration loader instance"""
    global _config_loader
    
    if _config_loader is None:
        _config_loader = UnifiedConfigLoader(config_dir)
    
    return _config_loader


# Convenience functions
def load_service_config() -> ServiceConfig:
    """Load service configuration"""
    return get_config_loader().get_service_config()


def load_music_engines_config() -> Dict[str, Any]:
    """Load music engines configuration"""
    return get_config_loader().load_music_engines_config()


def load_orchestrator_config() -> Dict[str, Any]:
    """Load orchestrator configuration"""
    return get_config_loader().load_orchestrator_config()


def load_searxng_settings() -> Dict[str, Any]:
    """Load SearXNG settings"""
    return get_config_loader().load_searxng_settings()


if __name__ == "__main__":
    # Test configuration loading
    loader = get_config_loader()
    
    print("=== Configuration Validation ===")
    validation = loader.validate()
    print(f"Valid: {validation['valid']}")
    print(f"Mode: {validation['mode']}")
    
    if validation['errors']:
        print("\nErrors:")
        for error in validation['errors']:
            print(f"  - {error}")
    
    if validation['warnings']:
        print("\nWarnings:")
        for warning in validation['warnings']:
            print(f"  - {warning}")
    
    print("\n=== Service Configuration ===")
    service_config = loader.get_service_config()
    print(f"SearXNG Port: {service_config.searxng_port}")
    print(f"Orchestrator Port: {service_config.orchestrator_port}")
    print(f"Redis URL: {service_config.redis_url}")
    print(f"Database URL: {service_config.database_url}")
    
    print("\n=== Enabled Music Engines ===")
    engines = loader.get_enabled_music_engines()
    for engine in engines:
        print(f"  - {engine}")
    
    print("\n=== API URLs ===")
    api_urls = loader.get_api_urls()
    for service, url in api_urls.items():
        print(f"  {service}: {url}")