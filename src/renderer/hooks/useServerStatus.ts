import { useState, useEffect, useCallback } from 'react';
import { ServerStatus } from '../../shared/types';

interface UseServerStatusReturn {
  status: ServerStatus | null;
  isLoading: boolean;
  error: string | null;
  startServer: () => Promise<void>;
  stopServer: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

export function useServerStatus(): UseServerStatusReturn {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      setError(null);
      const serverStatus = await window.api.server.getStatus();
      setStatus(serverStatus);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get server status';
      setError(errorMessage);
      console.error('Error fetching server status:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startServer = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await window.api.server.start();
      await refreshStatus();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start server';
      setError(errorMessage);
      console.error('Error starting server:', err);
    } finally {
      setIsLoading(false);
    }
  }, [refreshStatus]);

  const stopServer = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await window.api.server.stop();
      await refreshStatus();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop server';
      setError(errorMessage);
      console.error('Error stopping server:', err);
    } finally {
      setIsLoading(false);
    }
  }, [refreshStatus]);

  useEffect(() => {
    // Initial status fetch
    refreshStatus();

    // Set up status change listener
    const handleStatusChange = (newStatus: ServerStatus) => {
      setStatus(newStatus);
      setError(null);
    };

    window.api.server.onStatusChange(handleStatusChange);

    // Cleanup function
    return () => {
      // Remove the listener when component unmounts
      window.api.ipc.removeAllListeners('server:status');
    };
  }, [refreshStatus]);

  return {
    status,
    isLoading,
    error,
    startServer,
    stopServer,
    refreshStatus
  };
}