"""
Public API Routes - No authentication required
For development and testing purposes
"""

import requests
from flask import Blueprint, request, jsonify
import yaml
import os
import logging

logger = logging.getLogger(__name__)

public_api_bp = Blueprint('public_api', __name__)

# Load configuration
config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'config', 'orchestrator.yml')
with open(config_path, 'r') as f:
    config = yaml.safe_load(f)

SEARXNG_BASE_URL = config['SEARXNG']['CORE_URL']

@public_api_bp.route('/search', methods=['GET', 'POST'])
def public_search():
    """
    Public search endpoint - no authentication required
    """
    # Get search parameters
    if request.method == 'POST':
        data = request.get_json() or {}
        query = data.get('q', '')
        categories = data.get('categories', '')
        engines = data.get('engines', '')
        language = data.get('language', 'en')
        format_type = data.get('format', 'json')
    else:
        query = request.args.get('q', '')
        categories = request.args.get('categories', '')
        engines = request.args.get('engines', '')
        language = request.args.get('language', 'en')
        format_type = request.args.get('format', 'json')
    
    if not query:
        return jsonify({
            'error': 'Query parameter "q" is required'
        }), 400
    
    try:
        # Use music search service for aggregated results
        from services.music_search_service import MusicSearchService
        search_service = MusicSearchService()
        
        # Parse engines parameter
        engine_list = engines.split(',') if engines else None
        
        results = search_service.search(query, engine_list)
        return jsonify(results)
        
    except Exception as e:
        logger.error(f"Search error: {e}")
        # Fallback to direct SearXNG search
        try:
            search_params = {
                'q': query,
                'format': format_type,
                'language': language
            }
            
            if categories:
                search_params['categories'] = categories
            if engines:
                search_params['engines'] = engines
            
            resp = requests.get(f"{SEARXNG_BASE_URL}/search", params=search_params)
            
            if resp.status_code == 200:
                return jsonify({
                    'success': True,
                    'query': query,
                    'results': resp.json() if format_type == 'json' else resp.text
                })
            else:
                return jsonify({
                    'error': 'Search request failed',
                    'status_code': resp.status_code
                }), resp.status_code
        
        except Exception as e2:
            return jsonify({
                'error': f'Search error: {str(e2)}'
            }), 500

@public_api_bp.route('/engines', methods=['GET'])
def public_engines():
    """
    Get available search engines - public endpoint
    """
    try:
        from services.music_search_service import MusicSearchService
        search_service = MusicSearchService()
        engine_status = search_service.get_engine_status()
        return jsonify(engine_status)
    except Exception as e:
        # Fallback to SearXNG config
        try:
            resp = requests.get(f"{SEARXNG_BASE_URL}/config")
            if resp.status_code == 200:
                return resp.json()
            else:
                return jsonify({'error': 'Failed to fetch engines'}), 500
        except Exception as e2:
            return jsonify({'error': str(e2)}), 500

@public_api_bp.route('/status')
def public_status():
    """
    Public API service status
    """
    return jsonify({
        'service': 'public_api',
        'status': 'healthy',
        'endpoints': ['/public/search', '/public/engines', '/public/status', '/public/cache'],
        'authentication': 'not_required',
        'mode': 'development'
    })

@public_api_bp.route('/cache')
def public_cache_stats():
    """
    Get cache statistics
    """
    try:
        from services.cache_service import get_cache_service
        cache = get_cache_service()
        stats = cache.get_stats()
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500