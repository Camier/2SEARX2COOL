import React, { useState, useEffect } from 'react';

interface ServerStatusProps {
  serverUrl?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  className?: string;
}

interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  lastPing?: number;
  error?: string;
}

export const ServerStatus: React.FC<ServerStatusProps> = ({
  serverUrl = 'http://localhost:8888',
  onConnect,
  onDisconnect,
  className = ''
}) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false
  });

  const checkConnection = async (): Promise<boolean> => {
    try {
      const startTime = Date.now();
      const response = await fetch(`${serverUrl}/healthz`, {
        method: 'GET',
        timeout: 5000
      } as RequestInit);
      
      if (response.ok) {
        const ping = Date.now() - startTime;
        setConnectionState(prev => ({
          ...prev,
          isConnected: true,
          lastPing: ping,
          error: undefined
        }));
        return true;
      }
      throw new Error(`Server responded with ${response.status}`);
    } catch (error) {
      setConnectionState(prev => ({
        ...prev,
        isConnected: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      }));
      return false;
    }
  };

  const handleConnect = async () => {
    setConnectionState(prev => ({ ...prev, isConnecting: true }));
    
    try {
      const success = await checkConnection();
      if (success && onConnect) {
        onConnect();
      }
    } finally {
      setConnectionState(prev => ({ ...prev, isConnecting: false }));
    }
  };

  const handleDisconnect = () => {
    setConnectionState({
      isConnected: false,
      isConnecting: false
    });
    if (onDisconnect) {
      onDisconnect();
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (connectionState.isConnected) {
      interval = setInterval(checkConnection, 30000); // Check every 30 seconds
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [connectionState.isConnected, serverUrl]);

  const getStatusColor = () => {
    if (connectionState.isConnecting) return 'status-connecting';
    if (connectionState.isConnected) return 'status-connected';
    return 'status-disconnected';
  };

  const getStatusText = () => {
    if (connectionState.isConnecting) return 'Connecting...';
    if (connectionState.isConnected) {
      const ping = connectionState.lastPing ? `${connectionState.lastPing}ms` : '';
      return `Connected ${ping}`;
    }
    return connectionState.error || 'Disconnected';
  };

  return (
    <div className={`server-status ${className}`}>
      <div className="server-status__header">
        <div className={`server-status__indicator ${getStatusColor()}`}>
          <span className="server-status__dot"></span>
          <span className="server-status__text">{getStatusText()}</span>
        </div>
        
        <div className="server-status__url">
          {serverUrl}
        </div>
      </div>

      <div className="server-status__controls">
        {!connectionState.isConnected ? (
          <button
            className="btn btn-primary"
            onClick={handleConnect}
            disabled={connectionState.isConnecting}
          >
            {connectionState.isConnecting ? 'Connecting...' : 'Connect'}
          </button>
        ) : (
          <button
            className="btn btn-secondary"
            onClick={handleDisconnect}
          >
            Disconnect
          </button>
        )}
      </div>

      {connectionState.error && (
        <div className="server-status__error">
          <span className="error-icon">⚠</span>
          <span className="error-text">{connectionState.error}</span>
        </div>
      )}
    </div>
  );
};

export default ServerStatus;