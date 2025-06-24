import React, { useState, useEffect, useCallback } from 'react';

interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  status: 'loaded' | 'error' | 'disabled' | 'loading';
  dependencies?: string[];
  settings?: Record<string, any>;
  error?: string;
}

interface PluginManagerProps {
  plugins?: Plugin[];
  onPluginToggle?: (pluginId: string, enabled: boolean) => Promise<void>;
  onPluginInstall?: (pluginId: string) => Promise<void>;
  onPluginUninstall?: (pluginId: string) => Promise<void>;
  onPluginConfigure?: (pluginId: string, settings: Record<string, any>) => Promise<void>;
  onRefresh?: () => Promise<void>;
  className?: string;
}

interface PluginFilters {
  search: string;
  status: 'all' | 'enabled' | 'disabled' | 'error';
  category: string;
}

const PluginCard: React.FC<{
  plugin: Plugin;
  onToggle: (enabled: boolean) => void;
  onConfigure: () => void;
  onUninstall: () => void;
  isLoading: boolean;
}> = ({ plugin, onToggle, onConfigure, onUninstall, isLoading }) => {
  const getStatusBadge = () => {
    const statusClasses = {
      loaded: 'badge-success',
      error: 'badge-error',
      disabled: 'badge-secondary',
      loading: 'badge-warning'
    };

    return (
      <span className={`badge ${statusClasses[plugin.status]}`}>
        {plugin.status}
      </span>
    );
  };

  return (
    <div className={`plugin-card ${plugin.enabled ? 'plugin-enabled' : 'plugin-disabled'}`}>
      <div className="plugin-card__header">
        <div className="plugin-card__info">
          <h3 className="plugin-card__name">{plugin.name}</h3>
          <span className="plugin-card__version">v{plugin.version}</span>
          {getStatusBadge()}
        </div>
        
        <div className="plugin-card__toggle">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={plugin.enabled}
              onChange={(e) => onToggle(e.target.checked)}
              disabled={isLoading || plugin.status === 'error'}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div className="plugin-card__content">
        <p className="plugin-card__description">{plugin.description}</p>
        <div className="plugin-card__meta">
          <span className="plugin-card__author">by {plugin.author}</span>
        </div>

        {plugin.dependencies && plugin.dependencies.length > 0 && (
          <div className="plugin-card__dependencies">
            <strong>Dependencies:</strong>
            <div className="dependency-list">
              {plugin.dependencies.map(dep => (
                <span key={dep} className="dependency-tag">{dep}</span>
              ))}
            </div>
          </div>
        )}

        {plugin.error && (
          <div className="plugin-card__error">
            <span className="error-icon">⚠</span>
            <span className="error-message">{plugin.error}</span>
          </div>
        )}
      </div>

      <div className="plugin-card__actions">
        <button
          className="btn btn-secondary btn-sm"
          onClick={onConfigure}
          disabled={isLoading || !plugin.enabled}
        >
          Configure
        </button>
        <button
          className="btn btn-danger btn-sm"
          onClick={onUninstall}
          disabled={isLoading}
        >
          Uninstall
        </button>
      </div>
    </div>
  );
};

export const PluginManager: React.FC<PluginManagerProps> = ({
  plugins = [],
  onPluginToggle,
  onPluginInstall,
  onPluginUninstall,
  onPluginConfigure,
  onRefresh,
  className = ''
}) => {
  const [filters, setFilters] = useState<PluginFilters>({
    search: '',
    status: 'all',
    category: 'all'
  });
  const [loadingPlugins, setLoadingPlugins] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredPlugins = plugins.filter(plugin => {
    const matchesSearch = plugin.name.toLowerCase().includes(filters.search.toLowerCase()) ||
                         plugin.description.toLowerCase().includes(filters.search.toLowerCase()) ||
                         plugin.author.toLowerCase().includes(filters.search.toLowerCase());

    const matchesStatus = filters.status === 'all' ||
                         (filters.status === 'enabled' && plugin.enabled) ||
                         (filters.status === 'disabled' && !plugin.enabled) ||
                         (filters.status === 'error' && plugin.status === 'error');

    return matchesSearch && matchesStatus;
  });

  const handlePluginToggle = async (pluginId: string, enabled: boolean) => {
    if (!onPluginToggle) return;

    setLoadingPlugins(prev => new Set(prev).add(pluginId));
    
    try {
      await onPluginToggle(pluginId, enabled);
    } catch (error) {
      console.error('Failed to toggle plugin:', error);
      // Optionally show error notification
    } finally {
      setLoadingPlugins(prev => {
        const newSet = new Set(prev);
        newSet.delete(pluginId);
        return newSet;
      });
    }
  };

  const handlePluginUninstall = async (pluginId: string) => {
    if (!onPluginUninstall) return;

    const confirmed = window.confirm('Are you sure you want to uninstall this plugin?');
    if (!confirmed) return;

    setLoadingPlugins(prev => new Set(prev).add(pluginId));
    
    try {
      await onPluginUninstall(pluginId);
    } catch (error) {
      console.error('Failed to uninstall plugin:', error);
    } finally {
      setLoadingPlugins(prev => {
        const newSet = new Set(prev);
        newSet.delete(pluginId);
        return newSet;
      });
    }
  };

  const handlePluginConfigure = async (pluginId: string) => {
    if (!onPluginConfigure) return;

    // This would typically open a configuration modal
    // For now, just log the action
    console.log('Configure plugin:', pluginId);
  };

  const handleRefresh = async () => {
    if (!onRefresh) return;

    setIsRefreshing(true);
    
    try {
      await onRefresh();
    } catch (error) {
      console.error('Failed to refresh plugins:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getPluginStats = () => {
    const total = plugins.length;
    const enabled = plugins.filter(p => p.enabled).length;
    const errors = plugins.filter(p => p.status === 'error').length;

    return { total, enabled, errors };
  };

  const stats = getPluginStats();

  return (
    <div className={`plugin-manager ${className}`}>
      <div className="plugin-manager__header">
        <div className="plugin-manager__title">
          <h2>Plugin Manager</h2>
          <div className="plugin-stats">
            <span className="stat">Total: {stats.total}</span>
            <span className="stat">Enabled: {stats.enabled}</span>
            {stats.errors > 0 && (
              <span className="stat error">Errors: {stats.errors}</span>
            )}
          </div>
        </div>

        <div className="plugin-manager__actions">
          <button
            className="btn btn-primary"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="plugin-manager__filters">
        <div className="filter-group">
          <input
            type="text"
            placeholder="Search plugins..."
            className="filter-input"
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          />
        </div>

        <div className="filter-group">
          <select
            className="filter-select"
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ 
              ...prev, 
              status: e.target.value as PluginFilters['status']
            }))}
          >
            <option value="all">All Status</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>

      <div className="plugin-manager__content">
        {filteredPlugins.length === 0 ? (
          <div className="plugin-manager__empty">
            <div className="empty-state">
              <span className="empty-icon">🔌</span>
              <h3>No plugins found</h3>
              <p>
                {filters.search || filters.status !== 'all'
                  ? 'No plugins match your current filters.'
                  : 'No plugins are currently installed.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="plugin-grid">
            {filteredPlugins.map(plugin => (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                onToggle={(enabled) => handlePluginToggle(plugin.id, enabled)}
                onConfigure={() => handlePluginConfigure(plugin.id)}
                onUninstall={() => handlePluginUninstall(plugin.id)}
                isLoading={loadingPlugins.has(plugin.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PluginManager;