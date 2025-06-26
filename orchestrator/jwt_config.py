"""
JWT Configuration Helper
Provides utilities for conditionally applying JWT authentication
"""

from functools import wraps
from flask import current_app
from flask_jwt_extended import jwt_required as flask_jwt_required, verify_jwt_in_request
from flask_jwt_extended.exceptions import NoAuthorizationError
import logging

logger = logging.getLogger(__name__)

# List of endpoints that don't require authentication in development mode
DEV_PUBLIC_ENDPOINTS = [
    'api.search',
    'api.engines', 
    'api.status',
    'websocket.websocket_status',
    'index',
    'status',
    'get_config'
]

def conditional_jwt_required(fn):
    """
    Decorator that conditionally applies JWT authentication based on:
    1. Application debug mode
    2. Endpoint whitelist
    3. Development disable auth setting
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        # Check if auth is disabled in development config
        config = current_app.config.get('SEARXNG_CONFIG', {})
        disable_auth = config.get('DEVELOPMENT', {}).get('DISABLE_AUTH', False)
        
        # If auth is explicitly disabled, skip JWT
        if disable_auth:
            logger.info(f"Auth disabled for {fn.__name__} (DEVELOPMENT.DISABLE_AUTH=true)")
            return fn(*args, **kwargs)
        
        # In production mode (DEBUG=False), always require JWT
        if not current_app.debug and not disable_auth:
            return flask_jwt_required()(fn)(*args, **kwargs)
        
        # In debug mode, check if endpoint is whitelisted
        endpoint = current_app.view_functions.get(fn.__name__)
        if endpoint and fn.__name__ in DEV_PUBLIC_ENDPOINTS:
            logger.info(f"Bypassing JWT for development endpoint: {fn.__name__}")
            return fn(*args, **kwargs)
        
        # Try to verify JWT, but allow access even if it fails in dev mode
        try:
            verify_jwt_in_request()
        except NoAuthorizationError:
            logger.warning(f"No JWT provided for {fn.__name__}, allowing access in dev mode")
        except Exception as e:
            logger.warning(f"JWT verification failed for {fn.__name__}: {e}, allowing access in dev mode")
        
        return fn(*args, **kwargs)
    
    return wrapper

def is_jwt_optional():
    """Check if JWT is optional based on debug mode"""
    return current_app.debug