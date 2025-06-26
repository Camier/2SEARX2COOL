/**
 * Unified Configuration Manager
 * Handles both Python service configuration and Electron app settings
 * Supports dual-mode operation (web service + desktop app)
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { EventEmitter } = require('events');

class UnifiedConfigManager extends EventEmitter {
  constructor() {
    super();
    
    // Configuration paths
    this.configDir = path.join(__dirname, '..');
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
    this.mode = process.env.APP_MODE || 'hybrid'; // 'service', 'desktop', 'hybrid'
    
    // Configuration cache
    this.cache = {};
    
    // Initialize
    this.initialize();
  }
  
  /**
   * Initialize configuration manager
   */
  initialize() {
    // Ensure directories exist
    this.ensureDirectories();
    
    // Load all configurations
    this.loadAllConfigurations();
    
    // Watch for changes
    this.setupFileWatchers();
  }
  
  /**
   * Ensure required directories exist
   */
  ensureDirectories() {
    const dirs = [this.unifiedDir];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }
  
  /**
   * Load all configurations
   */
  loadAllConfigurations() {
    try {
      // Load Python/Service configurations
      this.cache.musicEngines = this.loadYamlConfig('musicEngines');
      this.cache.orchestrator = this.loadYamlConfig('orchestrator');
      this.cache.searxngSettings = this.loadYamlConfig('searxngSettings');
      
      // Load or create Electron configurations
      this.cache.appSettings = this.loadJsonConfig('appSettings', {
        theme: 'system',
        language: 'en',
        serverPort: 8888,
        orchestratorPort: 8889,
        autoStart: false,
        minimizeToTray: true,
        globalShortcuts: true
      });
      
      this.cache.userPreferences = this.loadJsonConfig('userPreferences', {
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
      this.createUnifiedConfig();
      
      this.emit('config:loaded', this.cache);
    } catch (error) {
      console.error('Error loading configurations:', error);
      this.emit('config:error', error);
    }
  }
  
  /**
   * Load YAML configuration file
   */
  loadYamlConfig(configName) {
    const filePath = this.configFiles[configName];
    
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        return yaml.load(content);
      } catch (error) {
        console.error(`Error loading ${configName}:`, error);
        return {};
      }
    }
    
    return {};
  }
  
  /**
   * Load JSON configuration file
   */
  loadJsonConfig(configName, defaults = {}) {
    const filePath = this.configFiles[configName];
    
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
      } catch (error) {
        console.error(`Error loading ${configName}:`, error);
        return defaults;
      }
    }
    
    // Create with defaults if doesn't exist
    this.saveJsonConfig(configName, defaults);
    return defaults;
  }
  
  /**
   * Save JSON configuration file
   */
  saveJsonConfig(configName, data) {
    const filePath = this.configFiles[configName];
    
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      this.emit('config:saved', configName, data);
    } catch (error) {
      console.error(`Error saving ${configName}:`, error);
      this.emit('config:error', error);
    }
  }
  
  /**
   * Create unified configuration
   */
  createUnifiedConfig() {
    const unified = {
      mode: this.mode,
      timestamp: new Date().toISOString(),
      
      // Service configuration
      service: {
        searxng: {
          port: this.cache.appSettings.serverPort || 8888,
          host: '0.0.0.0',
          settings: this.cache.searxngSettings
        },
        orchestrator: {
          port: this.cache.appSettings.orchestratorPort || 8889,
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
          baseUrl: `http://localhost:${this.cache.appSettings.serverPort || 8888}`,
          orchestratorUrl: `http://localhost:${this.cache.appSettings.orchestratorPort || 8889}`
        }
      }
    };
    
    // Save unified configuration
    this.saveJsonConfig('unified', unified);
    this.cache.unified = unified;
    
    return unified;
  }
  
  /**
   * Get configuration value
   */
  get(path, defaultValue = null) {
    const keys = path.split('.');
    let value = this.cache;
    
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
  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let target = this.cache;
    
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
      this.saveJsonConfig('appSettings', this.cache.appSettings);
    } else if (rootKey === 'userPreferences') {
      this.saveJsonConfig('userPreferences', this.cache.userPreferences);
    }
    
    // Regenerate unified config
    this.createUnifiedConfig();
    
    this.emit('config:changed', path, value);
  }
  
  /**
   * Get all configuration
   */
  getAll() {
    return this.cache;
  }
  
  /**
   * Get unified configuration
   */
  getUnified() {
    return this.cache.unified || this.createUnifiedConfig();
  }
  
  /**
   * Setup file watchers
   */
  setupFileWatchers() {
    // Watch Python config files
    ['musicEngines', 'orchestrator', 'searxngSettings'].forEach(configName => {
      const filePath = this.configFiles[configName];
      if (fs.existsSync(filePath)) {
        fs.watchFile(filePath, { interval: 2000 }, () => {
          console.log(`Configuration changed: ${configName}`);
          this.cache[configName] = this.loadYamlConfig(configName);
          this.createUnifiedConfig();
          this.emit('config:reloaded', configName);
        });
      }
    });
  }
  
  /**
   * Export configuration for Python services
   */
  exportForPython() {
    return {
      musicEngines: this.cache.musicEngines,
      orchestrator: this.cache.orchestrator,
      searxngSettings: this.cache.searxngSettings
    };
  }
  
  /**
   * Export configuration for Electron app
   */
  exportForElectron() {
    return {
      appSettings: this.cache.appSettings,
      userPreferences: this.cache.userPreferences,
      service: {
        ports: {
          searxng: this.cache.appSettings.serverPort,
          orchestrator: this.cache.appSettings.orchestratorPort
        }
      }
    };
  }
  
  /**
   * Validate configuration
   */
  validate() {
    const errors = [];
    
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
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Get operating mode
   */
  getMode() {
    return this.mode;
  }
  
  /**
   * Set operating mode
   */
  setMode(mode) {
    if (['service', 'desktop', 'hybrid'].includes(mode)) {
      this.mode = mode;
      this.createUnifiedConfig();
      this.emit('mode:changed', mode);
    }
  }
}

module.exports = UnifiedConfigManager;