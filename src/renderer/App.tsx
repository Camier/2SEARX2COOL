/**
 * App.tsx - Main React Application Component
 * 
 * Primary renderer interface for 2SEARX2COOL desktop application
 * Features:
 * - Integrated search interface
 * - Server status management
 * - Plugin system integration
 * - Hardware controls support
 * - Real-time updates
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SearchInterface } from './components/SearchInterface';
import { ServerStatus } from './components/ServerStatus';
import { PluginManager } from './components/PluginManager';
import { HardwareControls } from './components/HardwareControls';
import { SettingsPanel } from './components/SettingsPanel';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotificationSystem } from './components/NotificationSystem';
import { useServerStatus } from './hooks/useServerStatus';
import { useHardware } from './hooks/useHardware';
import { useSettings } from './hooks/useSettings';
import { AppProvider } from './context/AppContext';

interface AppState {
  initialized: boolean;
  currentView: 'search' | 'settings' | 'plugins' | 'hardware';
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    initialized: false,
    currentView: 'search',
    sidebarCollapsed: false,
    theme: 'system'
  });

  const { serverStatus, connectToServer, disconnectFromServer } = useServerStatus();
  const { hardwareStatus, sendHardwareCommand } = useHardware();
  const { settings, updateSetting } = useSettings();
  const appRef = useRef<HTMLDivElement>(null);

  // Initialize application
  useEffect(() => {
    initializeApp();
  }, []);

  // Handle hardware events
  useEffect(() => {
    if (hardwareStatus.midiEnabled) {
      const handleHardwareAction = (action: any) => {
        handleHardwareCommand(action);
      };

      window.api?.hardware?.onAction?.(handleHardwareAction);
      
      return () => {
        window.api?.hardware?.offAction?.(handleHardwareAction);
      };
    }
  }, [hardwareStatus.midiEnabled]);

  // Apply theme changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  const initializeApp = async () => {
    try {
      console.log('🚀 [APP] Initializing 2SEARX2COOL...');

      // Load initial settings
      const initialSettings = await window.api.config.getAll();
      setState(prev => ({
        ...prev,
        theme: initialSettings.app?.theme || 'system'
      }));

      // Connect to server
      await connectToServer();

      setState(prev => ({ ...prev, initialized: true }));
      console.log('✅ [APP] Application initialized successfully');

    } catch (error) {
      console.error('❌ [APP] Initialization failed:', error);
      // Show error notification but allow partial functionality
      setState(prev => ({ ...prev, initialized: true }));
    }
  };

  const handleViewChange = useCallback((view: AppState['currentView']) => {
    setState(prev => ({ ...prev, currentView: view }));
  }, []);

  const handleSidebarToggle = useCallback(() => {
    setState(prev => ({ ...prev, sidebarCollapsed: !prev.sidebarCollapsed }));
  }, []);

  const handleThemeChange = useCallback((theme: AppState['theme']) => {
    setState(prev => ({ ...prev, theme }));
    updateSetting('app.theme', theme);
  }, [updateSetting]);

  const handleHardwareCommand = useCallback((action: any) => {
    switch (action.action) {
      case 'search':
        handleViewChange('search');
        break;
      case 'next-result':
        // Implement navigation
        window.api.search?.nextResult?.();
        break;
      case 'previous-result':
        window.api.search?.previousResult?.();
        break;
      case 'toggle-play':
        window.api.player?.toggle?.();
        break;
      case 'volume':
        window.api.player?.setVolume?.(action.value);
        break;
      default:
        console.log('🎛️ [APP] Unhandled hardware action:', action);
    }
  }, [handleViewChange]);

  const renderMainContent = () => {
    switch (state.currentView) {
      case 'search':
        return (
          <SearchInterface
            serverStatus={serverStatus}
            onServerConnect={connectToServer}
            onServerDisconnect={disconnectFromServer}
          />
        );
      case 'settings':
        return (
          <SettingsPanel
            settings={settings}
            onSettingChange={updateSetting}
            onThemeChange={handleThemeChange}
            currentTheme={state.theme}
          />
        );
      case 'plugins':
        return <PluginManager />;
      case 'hardware':
        return (
          <HardwareControls
            status={hardwareStatus}
            onCommand={sendHardwareCommand}
          />
        );
      default:
        return <SearchInterface serverStatus={serverStatus} />;
    }
  };

  if (!state.initialized) {
    return (
      <div className="app-loading">
        <LoadingSpinner size="large" />
        <h2>Starting 2SEARX2COOL...</h2>
        <p>Initializing components...</p>
      </div>
    );
  }

  return (
    <AppProvider>
      <ErrorBoundary>
        <div 
          ref={appRef}
          className={`app ${state.sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
          data-theme={state.theme}
        >
          {/* Header */}
          <header className="app-header">
            <div className="header-left">
              <button
                className="sidebar-toggle"
                onClick={handleSidebarToggle}
                aria-label="Toggle sidebar"
              >
                <span className="hamburger-icon">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              </button>
              
              <h1 className="app-title">2SEARX2COOL</h1>
              
              <ServerStatus 
                status={serverStatus} 
                onConnect={connectToServer}
                onDisconnect={disconnectFromServer}
              />
            </div>

            <div className="header-right">
              <div className="header-controls">
                <button
                  className={`control-btn ${state.currentView === 'search' ? 'active' : ''}`}
                  onClick={() => handleViewChange('search')}
                  title="Search"
                >
                  🔍
                </button>
                
                <button
                  className={`control-btn ${state.currentView === 'plugins' ? 'active' : ''}`}
                  onClick={() => handleViewChange('plugins')}
                  title="Plugins"
                >
                  🧩
                </button>
                
                {hardwareStatus.midiEnabled && (
                  <button
                    className={`control-btn ${state.currentView === 'hardware' ? 'active' : ''}`}
                    onClick={() => handleViewChange('hardware')}
                    title="Hardware Controls"
                  >
                    🎛️
                  </button>
                )}
                
                <button
                  className={`control-btn ${state.currentView === 'settings' ? 'active' : ''}`}
                  onClick={() => handleViewChange('settings')}
                  title="Settings"
                >
                  ⚙️
                </button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="app-main">
            {renderMainContent()}
          </main>

          {/* Notification System */}
          <NotificationSystem />

          {/* Development Info */}
          {process.env.NODE_ENV === 'development' && (
            <div className="dev-info">
              <small>
                Server: {serverStatus.running ? '🟢' : '🔴'} | 
                MIDI: {hardwareStatus.midiEnabled ? '🎹' : '❌'} |
                View: {state.currentView}
              </small>
            </div>
          )}
        </div>
      </ErrorBoundary>
    </AppProvider>
  );
};

export default App;