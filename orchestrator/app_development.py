#!/usr/bin/env python3
"""
2SEARX2COOL Development Orchestrator
A version with relaxed authentication for testing
"""

import os
import sys
import yaml
import logging
from datetime import timedelta
from flask import Flask, request, jsonify, Response
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager, create_access_token
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import redis
import requests
from urllib.parse import urljoin

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# --- 1. Extension Initialization ---
from database import db
migrate = Migrate()
jwt = JWTManager()
socketio = SocketIO()

# Redis connection variables
redis_client = None
redis_pool = None

def load_config():
    """Load configuration with validation"""
    from config_loader import load_config as config_load
    try:
        config = config_load()
        logger.info("✅ Configuration loaded successfully")
        return config
    except Exception as e:
        logger.error(f"❌ Failed to load configuration: {e}")
        sys.exit(1)

def get_redis():
    """Get Redis connection with production-grade connection pooling"""
    global redis_client, redis_pool
    if redis_client is None:
        try:
            redis_pool = redis.ConnectionPool(
                host='localhost',
                port=6379,
                db=0,
                decode_responses=True,
                socket_connect_timeout=10,
                socket_timeout=10,
                socket_keepalive=True,
                socket_keepalive_options={},
                connection_pool_class_kwargs={
                    'max_connections': 50,
                    'retry_on_timeout': True
                }
            )
            redis_client = redis.Redis(connection_pool=redis_pool)
            redis_client.ping()
            logger.info("✅ Redis connection established")
        except Exception as e:
            logger.error(f"❌ Redis connection failed: {e}")
            redis_client = None
    return redis_client

def create_app():
    """Application Factory: Creates and configures the Flask app."""
    
    app = Flask(__name__, static_folder=None)
    
    # --- 2. Configuration Loading ---
    config = load_config()
    
    # Flask configuration
    try:
        app.config['SQLALCHEMY_DATABASE_URI'] = config['DATABASE']['SQLALCHEMY_DATABASE_URI']
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = config['DATABASE']['SQLALCHEMY_TRACK_MODIFICATIONS']
        app.config['JWT_SECRET_KEY'] = config['JWT']['JWT_SECRET_KEY']
        app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(seconds=int(config['JWT']['JWT_ACCESS_TOKEN_EXPIRES']))
        app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
            'pool_timeout': 20,
            'pool_recycle': 299,
            'pool_pre_ping': True,
            'pool_size': 10,
            'max_overflow': 20
        }
        app.config['SECRET_KEY'] = config['JWT']['JWT_SECRET_KEY']
        app.config['DEBUG'] = True  # Force debug mode for development
    except KeyError as e:
        logger.error(f"❌ Missing configuration key: {e}")
        sys.exit(1)
    
    # Store config for later use
    app.config['SEARXNG_CONFIG'] = config
    
    # --- 3. Initialize Extensions ---
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    
    # Configure CORS for development - allow all origins
    CORS(app, resources={
        r"/*": {
            "origins": "*",
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True
        }
    })
    
    # Initialize SocketIO without authentication requirement
    redis_url = config['REDIS']['REDIS_URL']
    try:
        socketio.init_app(
            app, 
            message_queue=redis_url,
            async_mode='eventlet',
            cors_allowed_origins="*",  # Allow all origins in development
            logger=True,
            engineio_logger=True,
            ping_timeout=60,
            ping_interval=25,
            always_connect=True  # Important: bypass auth for Socket.IO
        )
        logger.info("✅ Development SocketIO initialized (no auth required)")
    except Exception as e:
        logger.error(f"❌ SocketIO initialization failed: {e}")
        socketio.init_app(app, async_mode='threading', cors_allowed_origins="*")
    
    # --- 4. Import and Register Blueprints & Models ---
    with app.app_context():
        from . import models
        
        blueprints_loaded = {}
        
        # Register blueprints
        try:
            from .blueprints.auth.routes import auth_bp
            app.register_blueprint(auth_bp, url_prefix='/auth')
            blueprints_loaded['auth'] = True
        except Exception as e:
            logger.warning(f"⚠️ Auth blueprint failed: {e}")
        
        try:
            from .blueprints.api.routes import api_bp
            app.register_blueprint(api_bp, url_prefix='/api')
            blueprints_loaded['api'] = True
        except Exception as e:
            logger.warning(f"⚠️ Api blueprint failed: {e}")
        
        try:
            from .blueprints.websocket.routes import websocket_bp, register_websocket_events
            app.register_blueprint(websocket_bp)
            register_websocket_events(socketio)
            blueprints_loaded['websocket'] = True
            logger.info("✅ WebSocket blueprint registered (no auth)")
        except Exception as e:
            logger.warning(f"⚠️ WebSocket blueprint failed: {e}")
        
        app.config['BLUEPRINTS_LOADED'] = blueprints_loaded
    
    # --- 5. Register Routes ---
    register_routes(app)
    
    # --- 6. Development Token Generator ---
    @app.route('/dev/token')
    def dev_token():
        """Generate a development token for testing"""
        token = create_access_token(
            identity='dev_user',
            additional_claims={'role': 'admin'}
        )
        return jsonify({
            'access_token': token,
            'token_type': 'bearer',
            'expires_in': app.config['JWT_ACCESS_TOKEN_EXPIRES'].seconds,
            'usage': 'Include in headers as: Authorization: Bearer <token>'
        })
    
    return app

def register_routes(app):
    """Register application routes"""
    
    @app.route('/')
    def index():
        """Health check endpoint"""
        return jsonify({
            'status': 'healthy',
            'service': '2searx2cool-orchestrator-dev',
            'version': '1.0.0',
            'mode': 'development',
            'features': {
                'websocket': True,
                'websocket_auth': False,  # No auth required
                'redis': redis_client is not None,
                'cors': 'all_origins'
            }
        })
    
    @app.route('/api/status')
    def api_status():
        """API status - no auth required in dev mode"""
        return jsonify({
            'status': 'operational',
            'mode': 'development',
            'auth_required': False,
            'websocket_ready': True
        })
    
    @app.route('/api/search')
    def api_search():
        """Search endpoint - no auth required in dev mode"""
        query = request.args.get('q', '')
        engines = request.args.get('engines', '').split(',') if request.args.get('engines') else []
        
        # Import music search service
        try:
            from services.music_search_service import MusicSearchService
            search_service = MusicSearchService()
            results = search_service.search(query, engines)
            return jsonify(results)
        except Exception as e:
            logger.error(f"Search error: {e}")
            return jsonify({
                'error': str(e),
                'status': 'failed'
            }), 500
    
    @app.route('/api/engines')
    def api_engines():
        """List engines - no auth required in dev mode"""
        try:
            from services.music_search_service import MusicSearchService
            search_service = MusicSearchService()
            engine_status = search_service.get_engine_status()
            return jsonify(engine_status)
        except Exception as e:
            logger.error(f"Engine list error: {e}")
            return jsonify({
                'error': str(e),
                'status': 'failed'
            }), 500

if __name__ == '__main__':
    app = create_app()
    # Run with SocketIO in development mode
    socketio.run(app, host='0.0.0.0', port=8889, debug=True)