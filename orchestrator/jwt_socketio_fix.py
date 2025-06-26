"""
JWT Exception Handler for Socket.IO
Allows Socket.IO connections without JWT authentication
"""

from flask import request
from flask_jwt_extended.exceptions import NoAuthorizationError

class JWTManager_SocketIO_Compatible:
    """Wrapper for JWTManager that excludes Socket.IO paths"""
    
    def __init__(self, jwt_manager):
        self.jwt_manager = jwt_manager
        self._original_decode_complete_token = None
    
    def init_app(self, app):
        """Initialize with app and modify JWT behavior"""
        # Store original JWT error handler
        self._original_unauthorized_callback = self.jwt_manager._unauthorized_callback
        
        # Override the unauthorized callback
        @self.jwt_manager.unauthorized_loader
        def custom_unauthorized_callback(reason):
            # Check if this is a Socket.IO request
            if request.path.startswith('/socket.io/'):
                # For Socket.IO, return a response that allows the connection
                # Socket.IO will handle its own authentication at the event level
                return '', 200
            
            # For other endpoints, use original handler
            return self._original_unauthorized_callback(reason)
        
        # Also handle invalid token callbacks
        @self.jwt_manager.invalid_token_loader
        def custom_invalid_token_callback(reason):
            if request.path.startswith('/socket.io/'):
                return '', 200
            return {'msg': reason}, 422
