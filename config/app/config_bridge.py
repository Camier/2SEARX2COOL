# Auto-generated Python configuration bridge
# Generated at: 2025-06-24T10:13:54.191Z

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Service ports
SEARXNG_PORT = 8888
ORCHESTRATOR_PORT = 8889

# Redis configuration
REDIS_HOST = 'localhost'
REDIS_PORT = 6379
REDIS_CACHE_DB = 0
REDIS_WEBSOCKET_DB = 1
REDIS_SESSIONS_DB = 2

# Database
DATABASE_URL = '${DATABASE_URL:-postgresql:///searxng_cool_music}'

# API URLs
SEARXNG_URL = 'http://localhost:8888'
ORCHESTRATOR_URL = 'http://localhost:8889'
WEBSOCKET_URL = 'ws://localhost:8889'

# Operating mode
APP_MODE = 'hybrid'

# Paths
CONFIG_DIR = Path('/home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED/config')
UNIFIED_DIR = Path('/home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED/config/unified')
ROOT_DIR = Path('/home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED')
