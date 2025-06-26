"""
JSON-RPC Protocol Implementation for Engine Bridge
"""
import json
import sys
import traceback
from typing import Any, Dict, Optional, Union
import uuid


class JsonRpcRequest:
    """Represents a JSON-RPC request"""
    def __init__(self, method: str, params: Optional[Dict[str, Any]] = None, id: Optional[Union[str, int]] = None):
        self.jsonrpc = "2.0"
        self.method = method
        self.params = params or {}
        self.id = id or str(uuid.uuid4())
    
    def to_dict(self) -> Dict[str, Any]:
        d = {
            "jsonrpc": self.jsonrpc,
            "method": self.method,
            "id": self.id
        }
        if self.params:
            d["params"] = self.params
        return d
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'JsonRpcRequest':
        return cls(
            method=data.get("method", ""),
            params=data.get("params", {}),
            id=data.get("id")
        )


class JsonRpcResponse:
    """Represents a JSON-RPC response"""
    def __init__(self, result: Optional[Any] = None, error: Optional[Dict[str, Any]] = None, id: Optional[Union[str, int]] = None):
        self.jsonrpc = "2.0"
        self.result = result
        self.error = error
        self.id = id
    
    def to_dict(self) -> Dict[str, Any]:
        d = {
            "jsonrpc": self.jsonrpc,
            "id": self.id
        }
        if self.error is not None:
            d["error"] = self.error
        else:
            d["result"] = self.result
        return d
    
    @classmethod
    def success(cls, result: Any, id: Optional[Union[str, int]] = None) -> 'JsonRpcResponse':
        return cls(result=result, id=id)
    
    @classmethod
    def error(cls, code: int, message: str, data: Optional[Any] = None, id: Optional[Union[str, int]] = None) -> 'JsonRpcResponse':
        error = {
            "code": code,
            "message": message
        }
        if data is not None:
            error["data"] = data
        return cls(error=error, id=id)


class JsonRpcProtocol:
    """Handles JSON-RPC communication over stdin/stdout"""
    
    # Standard JSON-RPC error codes
    PARSE_ERROR = -32700
    INVALID_REQUEST = -32600
    METHOD_NOT_FOUND = -32601
    INVALID_PARAMS = -32602
    INTERNAL_ERROR = -32603
    
    def __init__(self):
        self.handlers = {}
    
    def register_handler(self, method: str, handler):
        """Register a method handler"""
        self.handlers[method] = handler
    
    def read_request(self) -> Optional[JsonRpcRequest]:
        """Read a JSON-RPC request from stdin"""
        try:
            line = sys.stdin.readline()
            if not line:
                return None
            
            data = json.loads(line.strip())
            return JsonRpcRequest.from_dict(data)
        except json.JSONDecodeError as e:
            # Send parse error response
            response = JsonRpcResponse.error(
                self.PARSE_ERROR,
                "Parse error",
                str(e)
            )
            self.send_response(response)
            return None
        except Exception as e:
            # Send internal error response
            response = JsonRpcResponse.error(
                self.INTERNAL_ERROR,
                "Internal error",
                str(e)
            )
            self.send_response(response)
            return None
    
    def send_response(self, response: JsonRpcResponse):
        """Send a JSON-RPC response to stdout"""
        try:
            response_json = json.dumps(response.to_dict())
            sys.stdout.write(response_json + "\\n")
            sys.stdout.flush()
        except Exception as e:
            # If we can't send a response, log to stderr
            sys.stderr.write(f"Failed to send response: {e}\\n")
            sys.stderr.flush()
    
    def handle_request(self, request: JsonRpcRequest) -> JsonRpcResponse:
        """Handle a JSON-RPC request"""
        method = request.method
        
        if method not in self.handlers:
            return JsonRpcResponse.error(
                self.METHOD_NOT_FOUND,
                f"Method '{method}' not found",
                id=request.id
            )
        
        try:
            handler = self.handlers[method]
            result = handler(**request.params)
            return JsonRpcResponse.success(result, id=request.id)
        except TypeError as e:
            # Invalid parameters
            return JsonRpcResponse.error(
                self.INVALID_PARAMS,
                "Invalid parameters",
                str(e),
                id=request.id
            )
        except Exception as e:
            # Internal error
            return JsonRpcResponse.error(
                self.INTERNAL_ERROR,
                "Internal error",
                {
                    "error": str(e),
                    "traceback": traceback.format_exc()
                },
                id=request.id
            )
    
    def run(self):
        """Main protocol loop"""
        while True:
            request = self.read_request()
            if request is None:
                break
            
            response = self.handle_request(request)
            self.send_response(response)
