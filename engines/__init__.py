# Music engines package
import sys
import os

# Add searx compatibility to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import compatibility layer
try:
    import searx
except ImportError:
    import searx_compat as searx
    sys.modules['searx'] = searx
    sys.modules['searx.utils'] = searx.utils
    sys.modules['searx.engines'] = searx.engines
    sys.modules['searx.network'] = searx.network
    sys.modules['searx.locales'] = searx.locales
    sys.modules['searx.external_urls'] = searx.external_urls
    sys.modules['searx.enginelib'] = searx.enginelib
    sys.modules['searx.enginelib.traits'] = searx.enginelib.traits
    sys.modules['searx.favicons'] = searx.favicons
    sys.modules['searx.favicons.cache'] = searx.favicons.cache
    sys.modules['searx.search'] = searx.search
    sys.modules['searx.settings'] = searx.settings