import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { 
  ServerStatus, 
  UserPreferences, 
  MidiDevice, 
  AudioDevice, 
  SearchResult,
  Plugin 
} from '../../shared/types';

// State interface
interface AppState {
  // Server state
  serverStatus: ServerStatus | null;
  serverLoading: boolean;
  serverError: string | null;

  // Hardware state
  midiDevices: MidiDevice[];
  audioDevices: AudioDevice[];
  connectedMidiDevice: string | null;
  hardwareLoading: boolean;
  hardwareError: string | null;

  // Settings state
  preferences: UserPreferences | null;
  settingsLoading: boolean;
  settingsError: string | null;

  // Search state
  currentQuery: string;
  searchResults: SearchResult[];
  searchLoading: boolean;
  searchError: string | null;

  // Plugin state
  plugins: Plugin[];
  pluginsLoading: boolean;
  pluginsError: string | null;

  // UI state
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  currentView: string;
  notifications: Notification[];
}

// Action types
type AppAction =
  // Server actions
  | { type: 'SET_SERVER_STATUS'; payload: ServerStatus }
  | { type: 'SET_SERVER_LOADING'; payload: boolean }
  | { type: 'SET_SERVER_ERROR'; payload: string | null }
  
  // Hardware actions
  | { type: 'SET_MIDI_DEVICES'; payload: MidiDevice[] }
  | { type: 'SET_AUDIO_DEVICES'; payload: AudioDevice[] }
  | { type: 'SET_CONNECTED_MIDI_DEVICE'; payload: string | null }
  | { type: 'SET_HARDWARE_LOADING'; payload: boolean }
  | { type: 'SET_HARDWARE_ERROR'; payload: string | null }
  
  // Settings actions
  | { type: 'SET_PREFERENCES'; payload: UserPreferences }
  | { type: 'UPDATE_PREFERENCE'; payload: { key: keyof UserPreferences; value: any } }
  | { type: 'SET_SETTINGS_LOADING'; payload: boolean }
  | { type: 'SET_SETTINGS_ERROR'; payload: string | null }
  
  // Search actions
  | { type: 'SET_CURRENT_QUERY'; payload: string }
  | { type: 'SET_SEARCH_RESULTS'; payload: SearchResult[] }
  | { type: 'SET_SEARCH_LOADING'; payload: boolean }
  | { type: 'SET_SEARCH_ERROR'; payload: string | null }
  
  // Plugin actions
  | { type: 'SET_PLUGINS'; payload: Plugin[] }
  | { type: 'SET_PLUGINS_LOADING'; payload: boolean }
  | { type: 'SET_PLUGINS_ERROR'; payload: string | null }
  | { type: 'UPDATE_PLUGIN'; payload: Plugin }
  
  // UI actions
  | { type: 'SET_THEME'; payload: 'light' | 'dark' | 'system' }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_CURRENT_VIEW'; payload: string }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string };

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  duration?: number;
}

// Initial state
const initialState: AppState = {
  // Server state
  serverStatus: null,
  serverLoading: true,
  serverError: null,

  // Hardware state
  midiDevices: [],
  audioDevices: [],
  connectedMidiDevice: null,
  hardwareLoading: true,
  hardwareError: null,

  // Settings state
  preferences: null,
  settingsLoading: true,
  settingsError: null,

  // Search state
  currentQuery: '',
  searchResults: [],
  searchLoading: false,
  searchError: null,

  // Plugin state
  plugins: [],
  pluginsLoading: true,
  pluginsError: null,

  // UI state
  theme: 'system',
  sidebarOpen: true,
  currentView: 'search',
  notifications: []
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // Server cases
    case 'SET_SERVER_STATUS':
      return { ...state, serverStatus: action.payload, serverError: null };
    case 'SET_SERVER_LOADING':
      return { ...state, serverLoading: action.payload };
    case 'SET_SERVER_ERROR':
      return { ...state, serverError: action.payload, serverLoading: false };

    // Hardware cases
    case 'SET_MIDI_DEVICES':
      return { ...state, midiDevices: action.payload };
    case 'SET_AUDIO_DEVICES':
      return { ...state, audioDevices: action.payload };
    case 'SET_CONNECTED_MIDI_DEVICE':
      return { ...state, connectedMidiDevice: action.payload };
    case 'SET_HARDWARE_LOADING':
      return { ...state, hardwareLoading: action.payload };
    case 'SET_HARDWARE_ERROR':
      return { ...state, hardwareError: action.payload, hardwareLoading: false };

    // Settings cases
    case 'SET_PREFERENCES':
      return { ...state, preferences: action.payload, theme: action.payload.theme };
    case 'UPDATE_PREFERENCE':
      if (!state.preferences) return state;
      const updatedPreferences = { ...state.preferences, [action.payload.key]: action.payload.value };
      return { 
        ...state, 
        preferences: updatedPreferences,
        theme: action.payload.key === 'theme' ? action.payload.value : state.theme
      };
    case 'SET_SETTINGS_LOADING':
      return { ...state, settingsLoading: action.payload };
    case 'SET_SETTINGS_ERROR':
      return { ...state, settingsError: action.payload, settingsLoading: false };

    // Search cases
    case 'SET_CURRENT_QUERY':
      return { ...state, currentQuery: action.payload };
    case 'SET_SEARCH_RESULTS':
      return { ...state, searchResults: action.payload };
    case 'SET_SEARCH_LOADING':
      return { ...state, searchLoading: action.payload };
    case 'SET_SEARCH_ERROR':
      return { ...state, searchError: action.payload, searchLoading: false };

    // Plugin cases
    case 'SET_PLUGINS':
      return { ...state, plugins: action.payload };
    case 'SET_PLUGINS_LOADING':
      return { ...state, pluginsLoading: action.payload };
    case 'SET_PLUGINS_ERROR':
      return { ...state, pluginsError: action.payload, pluginsLoading: false };
    case 'UPDATE_PLUGIN':
      return {
        ...state,
        plugins: state.plugins.map(plugin =>
          plugin.id === action.payload.id ? action.payload : plugin
        )
      };

    // UI cases
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'SET_CURRENT_VIEW':
      return { ...state, currentView: action.payload };
    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [...state.notifications, action.payload] };
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload)
      };

    default:
      return state;
  }
}

// Context interface
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  
  // Convenience methods
  showNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  updatePreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
}

// Create context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps): JSX.Element {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Convenience method to show notifications
  const showNotification = (notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const timestamp = Date.now();
    
    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: { ...notification, id, timestamp }
    });

    // Auto-remove notification after duration
    const duration = notification.duration || 5000;
    setTimeout(() => {
      dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
    }, duration);
  };

  // Convenience method to update preferences
  const updatePreference = <K extends keyof UserPreferences>(
    key: K, 
    value: UserPreferences[K]
  ) => {
    dispatch({ type: 'UPDATE_PREFERENCE', payload: { key, value } });
  };

  // Initialize app data
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load initial data in parallel
        const [serverStatus, preferences, plugins] = await Promise.all([
          window.api.server.getStatus().catch(err => {
            console.error('Failed to load server status:', err);
            dispatch({ type: 'SET_SERVER_ERROR', payload: err.message });
            return null;
          }),
          
          window.api.preferences.get().catch(err => {
            console.error('Failed to load preferences:', err);
            dispatch({ type: 'SET_SETTINGS_ERROR', payload: err.message });
            return null;
          }),
          
          window.api.plugins.list().catch(err => {
            console.error('Failed to load plugins:', err);
            dispatch({ type: 'SET_PLUGINS_ERROR', payload: err.message });
            return [];
          })
        ]);

        // Update state with loaded data
        if (serverStatus) {
          dispatch({ type: 'SET_SERVER_STATUS', payload: serverStatus });
        }
        dispatch({ type: 'SET_SERVER_LOADING', payload: false });

        if (preferences) {
          dispatch({ type: 'SET_PREFERENCES', payload: preferences });
        }
        dispatch({ type: 'SET_SETTINGS_LOADING', payload: false });

        dispatch({ type: 'SET_PLUGINS', payload: plugins });
        dispatch({ type: 'SET_PLUGINS_LOADING', payload: false });

      } catch (error) {
        console.error('Failed to initialize app:', error);
        showNotification({
          type: 'error',
          title: 'Initialization Error',
          message: 'Failed to initialize application. Please restart.'
        });
      }
    };

    initializeApp();

    // Set up server status listener
    const handleServerStatusChange = (status: ServerStatus) => {
      dispatch({ type: 'SET_SERVER_STATUS', payload: status });
    };

    window.api.server.onStatusChange(handleServerStatusChange);

    return () => {
      // Cleanup listeners
      window.api.ipc.removeAllListeners('server:status');
    };
  }, []);

  const contextValue: AppContextType = {
    state,
    dispatch,
    showNotification,
    updatePreference
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

// Hook to use the context
export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}