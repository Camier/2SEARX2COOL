#!/usr/bin/env python3
"""
Fix Socket.IO authentication issue
Configures Flask app to exclude Socket.IO endpoints from JWT
"""

import os
import re

def create_jwt_exclude_decorator():
    """Create a decorator file to exclude certain paths from JWT"""
    
    decorator_content = '''"""
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
'''
    
    with open('orchestrator/jwt_socketio_fix.py', 'w') as f:
        f.write(decorator_content)
    print("✅ Created JWT Socket.IO compatibility module")

def patch_app_py():
    """Patch app.py to use the Socket.IO compatible JWT"""
    
    app_path = 'orchestrator/app.py'
    with open(app_path, 'r') as f:
        content = f.read()
    
    # Check if already patched
    if 'jwt_socketio_fix' in content:
        print("⏭️  app.py already patched")
        return
    
    # Add import after other imports
    import_line = "from flask_jwt_extended import JWTManager"
    new_import = """from flask_jwt_extended import JWTManager
from jwt_socketio_fix import JWTManager_SocketIO_Compatible"""
    
    content = content.replace(import_line, new_import)
    
    # Wrap JWT manager initialization
    jwt_init = "jwt = JWTManager()"
    new_jwt_init = """jwt_original = JWTManager()
jwt = JWTManager_SocketIO_Compatible(jwt_original)"""
    
    content = content.replace(jwt_init, new_jwt_init)
    
    # Also need to initialize the original manager
    jwt_init_app = "jwt.init_app(app)"
    new_jwt_init_app = """jwt_original.init_app(app)
    jwt.init_app(app)"""
    
    content = content.replace(jwt_init_app, new_jwt_init_app)
    
    with open(app_path, 'w') as f:
        f.write(content)
    
    print("✅ Patched app.py for Socket.IO compatibility")

def main():
    print("🔧 Fixing Socket.IO authentication issue...")
    
    # Create the JWT Socket.IO fix module
    create_jwt_exclude_decorator()
    
    # Patch app.py
    patch_app_py()
    
    print("\n✅ Socket.IO authentication fix complete!")
    print("ℹ️  Socket.IO endpoints will now bypass JWT authentication")
    print("ℹ️  Restart the orchestrator to apply changes")

if __name__ == "__main__":
    main()