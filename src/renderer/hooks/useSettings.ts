import { useState, useEffect, useCallback } from 'react';
import { UserPreferences } from '../../shared/types';

interface UseSettingsReturn {
  preferences: UserPreferences | null;
  isLoading: boolean;
  error: string | null;
  updatePreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => Promise<void>;
  resetPreferences: () => Promise<void>;
  refreshPreferences: () => Promise<void>;
}

const defaultPreferences: UserPreferences = {
  theme: 'system',
  autoStart: false,
  startMinimized: false,
  globalShortcuts: true,
  plugins: {},
  cache: {
    enabled: true,
    maxSize: 500, // MB
    ttl: 3600, // 1 hour
    strategy: 'lru',
    offlineMode: false
  },
  privacy: {
    telemetry: false,
    crashReports: true,
    doNotTrack: true,
    clearOnExit: false
  },
  audio: {
    enableAnalysis: true,
    midiEnabled: true
  },
  shortcuts: {
    search: 'CmdOrCtrl+F',
    playPause: 'Space',
    next: 'ArrowRight',
    previous: 'ArrowLeft',
    volumeUp: 'ArrowUp',
    volumeDown: 'ArrowDown'
  }
};

export function useSettings(): UseSettingsReturn {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshPreferences = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const prefs = await window.api.preferences.get();
      
      // Merge with defaults to ensure all properties exist
      const mergedPrefs: UserPreferences = {
        ...defaultPreferences,
        ...prefs,
        cache: {
          ...defaultPreferences.cache,
          ...prefs?.cache
        },
        privacy: {
          ...defaultPreferences.privacy,
          ...prefs?.privacy
        },
        audio: {
          ...defaultPreferences.audio,
          ...prefs?.audio
        },
        shortcuts: {
          ...defaultPreferences.shortcuts,
          ...prefs?.shortcuts
        }
      };
      
      setPreferences(mergedPrefs);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load preferences';
      setError(errorMessage);
      console.error('Error loading preferences:', err);
      
      // Fallback to defaults if loading fails
      setPreferences(defaultPreferences);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updatePreference = useCallback(async <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    try {
      setError(null);
      
      // Optimistically update local state
      setPreferences(prevPrefs => {
        if (!prevPrefs) return null;
        return {
          ...prevPrefs,
          [key]: value
        };
      });

      // Persist to backend
      await window.api.preferences.set(key, value);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update preference';
      setError(errorMessage);
      console.error('Error updating preference:', err);
      
      // Revert optimistic update by refreshing
      await refreshPreferences();
    }
  }, [refreshPreferences]);

  const resetPreferences = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await window.api.preferences.reset();
      setPreferences(defaultPreferences);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset preferences';
      setError(errorMessage);
      console.error('Error resetting preferences:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load preferences on mount
    refreshPreferences();
  }, [refreshPreferences]);

  return {
    preferences,
    isLoading,
    error,
    updatePreference,
    resetPreferences,
    refreshPreferences
  };
}