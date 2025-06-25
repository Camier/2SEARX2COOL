/**
 * Unified Configuration Manager for 2SEARX2COOL
 * Handles both Python service configuration and Electron app settings
 * Supports dual-mode operation (web service + desktop app)
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { app } from 'electron';
import { z } from 'zod';
import { configStore } from './ConfigStore';

// Configuration schemas
const MusicEngineConfigSchema = z.object({
  enabled: z.boolean(),
  api_token: z.string().optional(),
  api_key: z.string().optional(),
  rate_limit: z.number(),
  rate_period: z.number(),
  cache_ttl: z.number(),
  timeout: z.number(),
  base_url: z.string().optional(),
  user_agent: z.string().optional()
});

const MusicEnginesConfigSchema = z.object({
  engines: z.record(z.string(), MusicEngineConfigSchema),
  features: z.object({
    deduplication: z.boolean(),
    quality_scoring: z.boolean(),
    parallel_search: z.boolean(),
    max_parallel: z.number(),
    result_limit: z.number()
  }),
  cache: z.object({
    backend: z.string(),
    host: z.string(),
    port: z.number(),
    db: z.number(),
    key_prefix: z.string(),
    compression: z.boolean()
  }),
  fallback_chains: z.record(z.string(), z.array(z.string())),
  search_enhancement: z.object({
    natural_language: z.boolean(),
    synonym_expansion: z.boolean(),
    genre_normalization: z.boolean(),
    year_extraction: z.boolean()
  })
});

const OrchestratorConfigSchema = z.object({
  DATABASE: z.object({
    SQLALCHEMY_DATABASE_URI: z.string(),
    SQLALCHEMY_TRACK_MODIFICATIONS: z.boolean()
  }),
  JWT: z.object({
    JWT_SECRET_KEY: z.string(),
    JWT_ACCESS_TOKEN_EXPIRES: z.union([z.string(), z.number()])
  }),
  REDIS: z.object({
    REDIS_URL: z.string()
  }),
  SEARXNG: z.object({
    CORE_URL: z.string(),
    SETTINGS_PATH: z.string()
  }),
  WEBSOCKET: z.object({
    SOCKETIO_REDIS_URL: z.string()
  }),
  SERVER: z.object({
    HOST: z.string(),
    PORT: z.number(),
    DEBUG: z.boolean()
  }),
  CORS: z.object({
    ORIGINS: z.array(z.string())
  })
});

export type MusicEnginesConfig = z.infer<typeof MusicEnginesConfigSchema>;
export type OrchestratorConfig = z.infer<typeof OrchestratorConfigSchema>;

export interface UnifiedConfig {
  mode: 'service' | 'desktop' | 'hybrid';
  timestamp: string;
  service: {
    searxng: {
      port: number;
      host: string;
      settings: any;
    };
    orchestrator: {
      port: number;
      host: string;
      database?: any;
      redis?: any;
      jwt?: any;
    };
    engines: {
      music: MusicEnginesConfig;
    };
  };
  app: {
    settings: any;
    preferences: any;
  };
  shared: {
    redis: {
      host: string;
      port: number;
      databases: {
        cache: number;
        websocket: number;
        sessions: number;
      };
    };
    database: {
      url: string;
    };
    api: {
      baseUrl: string;
      orchestratorUrl: string;
    };
  };
}

export class UnifiedConfigManager extends EventEmitter {
  private configDir: string;
  private unifiedDir: string;
  private configFiles: Record<string, string>;
  private mode: 'service' | 'desktop' | 'hybrid';
  private cache: Record<string, any> = {};
  private fileWatchers: Map<string, fs.FSWatcher> = new Map();

  constructor() {
    super();

    // Get app path based on environment
    const appPath = app?.getAppPath() || process.cwd();
    
    // Configuration paths
    this.configDir = path.join(appPath, 'config');
    this.unifiedDir = path.join(this.configDir, 'unified');

    // Configuration files
    this.configFiles = {
      // Python/Service configurations
      musicEngines: path.join(this.configDir, 'music_engines.yml'),
      orchestrator: path.join(this.configDir, 'orchestrator.yml'),
      searxngSettings: path.join(this.configDir, 'searxng-settings.yml'),
      
      // Electron app configurations
      appSettings: path.join(this.unifiedDir, 'app-settings.json'),
      userPreferences: path.join(this.unifiedDir, 'user-preferences.json'),
      
      // Unified configuration
      unified: path.join(this.unifiedDir, 'unified-config.json')
    };

    // Operating mode
    this.mode = (process.env.APP_MODE as any) || 'hybrid';

    // Initialize
    this.initialize();
  }

  /**
   * Initialize configuration manager
   */
  private async initialize(): Promise<void> {
    try {
      // Ensure directories exist
      await this.ensureDirectories();
      
      // Load all configurations
      await this.loadAllConfigurations();
      
      // Setup file watchers
      this.setupFileWatchers();
      
      // Sync with Electron ConfigStore
      await this.syncWithConfigStore();
    } catch (error) {
      console.error('Failed to initialize UnifiedConfigManager:', error);
      this.emit('error', error);
    }
  }

  /**
   * Ensure required directories exist
   */
  private async ensureDirectories(): Promise<void> {
    const dirs = [this.configDir, this.unifiedDir];
    
    for (const dir of dirs) {
      try {
        await fs.promises.mkdir(dir, { recursive: true });
      } catch (error) {
        // Directory may already exist
      }
    }
  }

  /**
   * Load all configurations
   */
  private async loadAllConfigurations(): Promise<void> {
    try {
      // Load Python/Service configurations
      this.cache.musicEngines = await this.loadYamlConfig('musicEngines');
      this.cache.orchestrator = await this.loadYamlConfig('orchestrator');
      this.cache.searxngSettings = await this.loadYamlConfig('searxngSettings');
      
      // Load or create Electron configurations
      this.cache.appSettings = await this.loadJsonConfig('appSettings', {
        theme: 'system',
        language: 'en',
        serverPort: 8888,
        orchestratorPort: 8889,
        autoStart: false,
        minimizeToTray: true,
        globalShortcuts: true
      });
      
      this.cache.userPreferences = await this.loadJsonConfig('userPreferences', {
        defaultEngine: 'all',
        safeSearch: 'moderate',
        resultsPerPage: 20,
        openInNewTab: true,
        searchHistory: {
          enabled: true,
          maxItems: 1000,
          clearOnExit: false
        }
      });
      
      // Create unified configuration
      await this.createUnifiedConfig();
      
      this.emit('config:loaded', this.cache);
    } catch (error) {
      console.error('Error loading configurations:', error);
      this.emit('config:error', error);
    }
  }

  /**
   * Load YAML configuration file
   */
  private async loadYamlConfig(configName: string): Promise<any> {
    const filePath = this.configFiles[configName];
    
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      return yaml.load(content);
    } catch (error) {
      console.error(`Error loading ${configName}:`, error);
      return {};
    }
  }

  /**
   * Load JSON configuration file
   */
  private async loadJsonConfig(configName: string, defaults: any = {}): Promise<any> {
    const filePath = this.configFiles[configName];
    
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        // File doesn't exist, create with defaults
        await this.saveJsonConfig(configName, defaults);
        return defaults;
      }
      console.error(`Error loading ${configName}:`, error);
      return defaults;
    }
  }

  /**
   * Save JSON configuration file
   */
  private async saveJsonConfig(configName: string, data: any): Promise<void> {
    const filePath = this.configFiles[configName];
    
    try {
      await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
      this.emit('config:saved', configName, data);
    } catch (error) {
      console.error(`Error saving ${configName}:`, error);
      this.emit('config:error', error);
    }
  }

  /**
   * Create unified configuration
   */
  private async createUnifiedConfig(): Promise<UnifiedConfig> {
    const unified: UnifiedConfig = {
      mode: this.mode,
      timestamp: new Date().toISOString(),
      
      // Service configuration
      service: {
        searxng: {
          port: this.cache.appSettings?.serverPort || 8888,
          host: '0.0.0.0',
          settings: this.cache.searxngSettings
        },
        orchestrator: {
          port: this.cache.appSettings?.orchestratorPort || 8889,
          host: '0.0.0.0',
          database: this.cache.orchestrator?.DATABASE,
          redis: this.cache.orchestrator?.REDIS,
          jwt: this.cache.orchestrator?.JWT
        },
        engines: {
          music: this.cache.musicEngines
        }
      },
      
      // Desktop application configuration
      app: {
        settings: this.cache.appSettings,
        preferences: this.cache.userPreferences
      },
      
      // Shared configuration
      shared: {
        redis: {
          host: 'localhost',
          port: 6379,
          databases: {
            cache: 0,
            websocket: 1,
            sessions: 2
          }
        },
        database: {
          url: process.env.DATABASE_URL || 'postgresql:///searxng_cool_music'
        },
        api: {
          baseUrl: `http://localhost:${this.cache.appSettings?.serverPort || 8888}`,
          orchestratorUrl: `http://localhost:${this.cache.appSettings?.orchestratorPort || 8889}`
        }
      }
    };
    
    // Save unified configuration
    await this.saveJsonConfig('unified', unified);
    this.cache.unified = unified;
    
    return unified;
  }

  /**
   * Sync with Electron ConfigStore
   */
  private async syncWithConfigStore(): Promise<void> {
    try {
      // Get current ConfigStore values
      const preferences = await configStore.get('preferences');
      const searchSettings = await configStore.get('searchSettings');
      
      // Update our cache with ConfigStore values
      if (preferences) {
        this.cache.appSettings = {
          ...this.cache.appSettings,
          theme: preferences.theme,
          language: preferences.language,
          serverPort: preferences.serverPort,
          globalShortcuts: preferences.globalShortcuts,
          autoStart: preferences.autoStart,
          minimizeToTray: preferences.minimizeToTray
        };
      }
      
      if (searchSettings) {
        this.cache.userPreferences = {
          ...this.cache.userPreferences,
          defaultEngine: searchSettings.defaultEngine,
          safeSearch: searchSettings.safeSearch,
          resultsPerPage: searchSettings.resultsPerPage,
          openInNewTab: searchSettings.openInNewTab,
          searchHistory: searchSettings.history
        };
      }
      
      // Listen for ConfigStore changes
      configStore.on('config:change', async (key: string, value: any) => {
        await this.handleConfigStoreChange(key, value);
      });
    } catch (error) {
      console.error('Error syncing with ConfigStore:', error);
    }
  }

  /**
   * Handle ConfigStore changes
   */
  private async handleConfigStoreChange(key: string, value: any): Promise<void> {
    if (key === 'preferences') {
      this.cache.appSettings = {
        ...this.cache.appSettings,
        ...value
      };
      await this.saveJsonConfig('appSettings', this.cache.appSettings);
    } else if (key === 'searchSettings') {
      this.cache.userPreferences = {
        ...this.cache.userPreferences,
        ...value
      };
      await this.saveJsonConfig('userPreferences', this.cache.userPreferences);
    }
    
    await this.createUnifiedConfig();
  }

  /**
   * Setup file watchers
   */
  private setupFileWatchers(): void {
    // Watch Python config files
    ['musicEngines', 'orchestrator', 'searxngSettings'].forEach(configName => {
      const filePath = this.configFiles[configName];
      
      try {
        const watcher = fs.watch(filePath, async (eventType) => {
          if (eventType === 'change') {
            console.log(`Configuration changed: ${configName}`);
            this.cache[configName] = await this.loadYamlConfig(configName);
            await this.createUnifiedConfig();
            this.emit('config:reloaded', configName);
          }
        });
        
        this.fileWatchers.set(configName, watcher);
      } catch (error) {
        console.error(`Error watching ${configName}:`, error);
      }
    });
  }

  /**
   * Get configuration value
   */
  get(path: string, defaultValue: any = null): any {
    const keys = path.split('.');
    let value: any = this.cache;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return defaultValue;
      }
    }
    
    return value;
  }

  /**
   * Set configuration value
   */
  async set(path: string, value: any): Promise<void> {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    let target: any = this.cache;
    
    // Navigate to target object
    for (const key of keys) {
      if (!(key in target) || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }
    
    // Set value
    target[lastKey] = value;
    
    // Determine which config file to update
    const rootKey = path.split('.')[0];
    if (rootKey === 'appSettings') {
      await this.saveJsonConfig('appSettings', this.cache.appSettings);
    } else if (rootKey === 'userPreferences') {
      await this.saveJsonConfig('userPreferences', this.cache.userPreferences);
    }
    
    // Regenerate unified config
    await this.createUnifiedConfig();
    
    this.emit('config:changed', path, value);
  }

  /**
   * Get all configuration
   */
  getAll(): any {
    return this.cache;
  }

  /**
   * Get unified configuration
   */
  async getUnified(): Promise<UnifiedConfig> {
    return this.cache.unified || await this.createUnifiedConfig();
  }

  /**
   * Export configuration for Python services
   */
  exportForPython(): any {
    return {
      musicEngines: this.cache.musicEngines,
      orchestrator: this.cache.orchestrator,
      searxngSettings: this.cache.searxngSettings
    };
  }

  /**
   * Export configuration for Electron app
   */
  exportForElectron(): any {
    return {
      appSettings: this.cache.appSettings,
      userPreferences: this.cache.userPreferences,
      service: {
        ports: {
          searxng: this.cache.appSettings?.serverPort,
          orchestrator: this.cache.appSettings?.orchestratorPort
        }
      }
    };
  }

  /**
   * Validate configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Validate ports
    const searxngPort = this.get('appSettings.serverPort');
    const orchestratorPort = this.get('appSettings.orchestratorPort');
    
    if (searxngPort === orchestratorPort) {
      errors.push('SearXNG and Orchestrator ports must be different');
    }
    
    if (searxngPort < 1024 || searxngPort > 65535) {
      errors.push('SearXNG port must be between 1024 and 65535');
    }
    
    if (orchestratorPort < 1024 || orchestratorPort > 65535) {
      errors.push('Orchestrator port must be between 1024 and 65535');
    }
    
    // Validate Redis configuration
    const redisHost = this.get('shared.redis.host');
    if (!redisHost) {
      errors.push('Redis host is not configured');
    }
    
    // Validate music engines
    try {
      if (this.cache.musicEngines) {
        MusicEnginesConfigSchema.parse(this.cache.musicEngines);
      }
    } catch (error) {
      errors.push(`Invalid music engines configuration: ${error}`);
    }
    
    // Validate orchestrator
    try {
      if (this.cache.orchestrator) {
        OrchestratorConfigSchema.parse(this.cache.orchestrator);
      }
    } catch (error) {
      errors.push(`Invalid orchestrator configuration: ${error}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get operating mode
   */
  getMode(): 'service' | 'desktop' | 'hybrid' {
    return this.mode;
  }

  /**
   * Set operating mode
   */
  async setMode(mode: 'service' | 'desktop' | 'hybrid'): Promise<void> {
    this.mode = mode;
    await this.createUnifiedConfig();
    this.emit('mode:changed', mode);
  }

  /**
   * Reload specific configuration
   */
  async reloadConfig(configName: string): Promise<void> {
    if (configName in this.configFiles) {
      if (configName.endsWith('Settings') || configName.endsWith('Preferences')) {
        this.cache[configName] = await this.loadJsonConfig(configName);
      } else {
        this.cache[configName] = await this.loadYamlConfig(configName);
      }
      
      await this.createUnifiedConfig();
      this.emit('config:reloaded', configName);
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    // Close file watchers
    this.fileWatchers.forEach(watcher => watcher.close());
    this.fileWatchers.clear();
    
    // Remove all listeners
    this.removeAllListeners();
  }
}

// Export singleton instance
export const unifiedConfigManager = new UnifiedConfigManager();