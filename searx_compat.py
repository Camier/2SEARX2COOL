"""
Minimal SearX compatibility layer for music engines
This provides just enough SearX functionality to make the engines work
"""

import logging
from typing import Dict, List, Any
from urllib.parse import urlencode

# Basic logger setup
logger = logging.getLogger('searx')

# Mock engine module attributes that engines expect
engines = type('engines', (), {
    'categories': {
        'music': ['music'],
        'general': ['general'],
        'images': ['images']
    }
})()

# Mock search module
search = type('search', (), {
    'SearchQuery': type('SearchQuery', (), {})
})()

# Utility functions that engines commonly use
def extract_text(element):
    """Extract text from an element (simplified)"""
    if hasattr(element, 'text'):
        return element.text
    return str(element)

def extract_url(url_string: str, search_url: str = None):
    """Extract and validate URL"""
    if url_string.startswith('http'):
        return url_string
    if search_url and url_string.startswith('/'):
        from urllib.parse import urljoin
        return urljoin(search_url, url_string)
    return url_string

def get_engine_from_settings(engine_name: str):
    """Mock function to get engine settings"""
    return {
        'name': engine_name,
        'engine': engine_name,
        'shortcut': engine_name[:2],
        'categories': ['music'],
        'timeout': 10.0,
        'disabled': False
    }

# Common imports that engines expect
utils = type('utils', (), {
    'extract_text': extract_text,
    'extract_url': extract_url,
    'get_engine_from_settings': get_engine_from_settings,
    'searx_useragent': lambda: 'Mozilla/5.0 (compatible; SearXNG)',
    'gen_useragent': lambda: 'Mozilla/5.0 (compatible; SearXNG)',
})()

# External URLs support
external_urls = type('external_urls', (), {
    'get_earth_coordinates_url': lambda lat, lon: f"https://www.openstreetmap.org/?mlat={lat}&mlon={lon}",
    'get_wikipedia_url': lambda lang, title: f"https://{lang}.wikipedia.org/wiki/{title}",
})()

# Network module mock
network = type('network', (), {
    'get': lambda url, **kwargs: type('Response', (), {'text': '', 'status_code': 200})(),
    'post': lambda url, **kwargs: type('Response', (), {'text': '', 'status_code': 200})(),
    'raise_for_httperror': lambda resp: None,
})()

# Locales support
locales = type('locales', (), {
    'language_codes': ['en', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'ja', 'zh'],
    'region_codes': ['US', 'GB', 'FR', 'DE', 'ES', 'IT', 'BR', 'RU', 'JP', 'CN'],
    'LOCALE_NAMES': {
        'en': 'English',
        'fr': 'Français',
        'de': 'Deutsch',
        'es': 'Español',
    },
    'get_locale': lambda lang: lang,
    'get_lang_components': lambda lang: (lang.split('-')[0], lang.split('-')[1] if '-' in lang else ''),
    'get_official_locales': lambda: ['en-US', 'fr-FR', 'de-DE', 'es-ES'],
    'get_engine_locales': lambda engine: ['en', 'fr', 'de', 'es'],
    'get_translation_locales': lambda: ['en', 'fr', 'de', 'es'],
})()

# Engine traits support  
enginelib = type('enginelib', (), {
    'traits': type('traits', (), {
        'EngineTraits': type('EngineTraits', (), {
            'supported_languages': ['en', 'fr', 'de', 'es'],
            'regions': ['US', 'GB', 'FR', 'DE'],
            'all_locale': 'all',
            'custom': {},
            'data_type': 'supported_languages',
        }),
        'get': lambda engine: enginelib.traits.EngineTraits(),
    })()
})()

# Favicons support
favicons = type('favicons', (), {
    'cache': type('cache', (), {
        'get_favicon': lambda domain: f"/favicon/{domain}.ico"
    })()
})()

# Settings module
settings = {
    'search': {
        'safe_search': 0,
        'default_lang': 'en',
        'max_page': 10,
        'max_request_timeout': 30.0,
        'suspend_time_if_empty': 300,
    },
    'server': {
        'secret_key': 'ultrasecretkey',
        'base_url': 'http://localhost:8888',
        'public_instance': False,
    },
    'general': {
        'instance_name': 'SearXNG',
        'contact_url': '',
        'donation_url': '',
        'privacypolicy_url': '',
        'enable_metrics': True,
    },
    'ui': {
        'default_theme': 'simple',
        'infinite_scroll': True,
        'cache_url': '',
    },
    'outgoing': {
        'useragent_suffix': '',
        'max_request_timeout': None,
    }
}

# Additional imports some engines might need
data = {}
version = "1.0.0"
searx_dir = "."
static_path = "./static"