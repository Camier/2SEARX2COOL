/**
 * ConfigStore.ts - Comprehensive Configuration Management
 * 
 * Handles all application configuration with:
 * - Type-safe configuration schema
 * - Validation and migration
 * - Environment variable support
 * - Real-time updates
 * - Configuration export/import
 */

import { app } from 'electron';
import Store from 'electron-store';
import { z } from 'zod';
import path from 'path';
import { EventEmitter } from 'events';

// Configuration Schema
const ConfigSchema = z.object({
  version: z.string().default('0.2.0'),
  
  // Application settings
  app: z.object({
    autoLaunch: z.boolean().default(false),
    minimizeToTray: z.boolean().default(true),
    closeToTray: z.boolean().default(true),
    startMinimized: z.boolean().default(false),
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    language: z.string().default('en'),
    checkForUpdates: z.boolean().default(true),
    enableAnalytics: z.boolean().default(false)
  }).default({}),

  // Search engine configuration
  search: z.object({
    defaultEngine: z.string().default('searxng'),
    engines: z.array(z.object({
      name: z.string(),
      url: z.string().url(),
      enabled: z.boolean().default(true),
      priority: z.number().min(0).max(100).default(50)
    })).default([]),
    resultsPerPage: z.number().min(1).max(100).default(20),
    timeout: z.number().min(1000).max(30000).default(10000),
    useProxy: z.boolean().default(false),
    proxyUrl: z.string().optional()
  }).default({}),

  // Window settings
  window: z.object({
    width: z.number().min(800).default(1200),
    height: z.number().min(600).default(800),
    x: z.number().optional(),
    y: z.number().optional(),
    maximized: z.boolean().default(false),
    alwaysOnTop: z.boolean().default(false),
    opacity: z.number().min(0.1).max(1.0).default(1.0)
  }).default({}),

  // Plugin system
  plugins: z.object({
    enabled: z.boolean().default(true),
    autoUpdate: z.boolean().default(false),
    allowUnsigned: z.boolean().default(false),
    installed: z.array(z.object({
      id: z.string(),
      version: z.string(),
      enabled: z.boolean().default(true),
      config: z.record(z.any()).default({})
    })).default([])
  }).default({}),

  // Security settings
  security: z.object({
    enableCSP: z.boolean().default(true),
    allowInsecureContent: z.boolean().default(false),
    enableRemoteDebugging: z.boolean().default(false),
    trustedDomains: z.array(z.string()).default([])
  }).default({}),

  // Hardware configuration
  hardware: z.object({
    midi: z.object({
      enabled: z.boolean().default(false),
      inputDevice: z.string().optional(),
      outputDevice: z.string().optional(),
      mappings: z.array(z.object({
        control: z.number(),
        action: z.string(),
        parameter: z.string().optional()
      })).default([])
    }).default({})
  }).default({}),

  // Performance settings
  performance: z.object({
    enableGPU: z.boolean().default(true),
    enableBackgroundProcessing: z.boolean().default(true),
    maxCacheSize: z.number().min(10).max(1000).default(100), // MB
    preloadResults: z.boolean().default(true),
    lazyLoading: z.boolean().default(true)
  }).default({}),

  // Developer settings
  developer: z.object({
    enableDevTools: z.boolean().default(false),
    showPerformanceMetrics: z.boolean().default(false),
    enableLogging: z.boolean().default(false),
    logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info')
  }).default({})
});

export type Config = z.infer<typeof ConfigSchema>;
export type ConfigPath = keyof Config;

export class ConfigStore extends EventEmitter {
  private store: Store<Config>;
  private schema = ConfigSchema;
  private watchers = new Map<string, ((value: any) => void)[]>();

  constructor() {
    super();

    // Initialize electron-store with schema validation
    this.store = new Store<Config>({
      name: '2searx2cool-config',
      cwd: app.getPath('userData'),
      fileExtension: 'json',
      clearInvalidConfig: true,
      schema: this.convertZodToElectronSchema(ConfigSchema),
      migrations: this.getMigrations()
    });

    // Set defaults if config is empty
    if (Object.keys(this.store.store).length === 0) {
      this.resetToDefaults();
    }

    // Validate existing config
    this.validateAndMigrate();

    console.log(`📄 [CONFIG-STORE] Initialized at: ${this.store.path}`);
  }

  /**
   * Get configuration value by path
   */
  get<T extends keyof Config>(key: T): Config[T];
  get<T extends keyof Config, K extends keyof Config[T]>(key: T, subKey: K): Config[T][K];
  get(key: string): any {
    try {
      const value = this.store.get(key as any);
      return value;
    } catch (error) {
      console.error(`❌ [CONFIG-STORE] Failed to get config '${key}':`, error);
      return this.getDefault(key);
    }
  }

  /**
   * Set configuration value by path
   */
  set<T extends keyof Config>(key: T, value: Config[T]): void;
  set<T extends keyof Config, K extends keyof Config[T]>(key: T, subKey: K, value: Config[T][K]): void;
  set(key: string, ...args: any[]): void {
    try {
      if (args.length === 1) {
        // Direct set: set('app', { ... })
        const [value] = args;
        this.store.set(key as any, value);
      } else if (args.length === 2) {
        // Nested set: set('app', 'theme', 'dark')
        const [subKey, value] = args;
        this.store.set(`${key}.${subKey}` as any, value);
      }

      // Emit change event
      this.emit('config-changed', { key, value: this.get(key) });
      
      // Trigger watchers
      this.triggerWatchers(key);

      console.log(`✅ [CONFIG-STORE] Updated '${key}'`);
    } catch (error) {
      console.error(`❌ [CONFIG-STORE] Failed to set config '${key}':`, error);
    }
  }

  /**
   * Get all configuration
   */
  getAll(): Config {
    return this.store.store as Config;
  }

  /**
   * Reset to default values
   */
  resetToDefaults(): void {
    const defaults = this.schema.parse({});
    this.store.clear();
    
    Object.entries(defaults).forEach(([key, value]) => {
      this.store.set(key as any, value);
    });

    this.emit('config-reset');
    console.log(`🔄 [CONFIG-STORE] Reset to defaults`);
  }

  /**
   * Validate current configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    try {
      this.schema.parse(this.store.store);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
      return { valid: false, errors: [String(error)] };
    }
  }

  /**
   * Export configuration to file
   */
  async exportConfig(filePath: string): Promise<void> {
    const fs = await import('fs/promises');
    const config = this.getAll();
    
    await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
    console.log(`📤 [CONFIG-STORE] Exported to: ${filePath}`);
  }

  /**
   * Import configuration from file
   */
  async importConfig(filePath: string, merge = true): Promise<void> {
    const fs = await import('fs/promises');
    
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const importedConfig = JSON.parse(data);
      
      // Validate imported config
      const validatedConfig = this.schema.parse(importedConfig);
      
      if (merge) {
        // Merge with existing config
        const currentConfig = this.getAll();
        const mergedConfig = { ...currentConfig, ...validatedConfig };
        this.store.store = mergedConfig;
      } else {
        // Replace entire config
        this.store.store = validatedConfig;
      }

      this.emit('config-imported', { filePath, merge });
      console.log(`📥 [CONFIG-STORE] Imported from: ${filePath}`);
      
    } catch (error) {
      console.error(`❌ [CONFIG-STORE] Import failed:`, error);
      throw error;
    }
  }

  /**
   * Watch for configuration changes
   */
  watch<T extends keyof Config>(key: T, callback: (value: Config[T]) => void): () => void {
    const keyStr = String(key);
    
    if (!this.watchers.has(keyStr)) {
      this.watchers.set(keyStr, []);
    }
    
    this.watchers.get(keyStr)!.push(callback);
    
    // Return unwatch function
    return () => {
      const callbacks = this.watchers.get(keyStr);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Get default value for a key
   */
  private getDefault(key: string): any {
    try {
      const defaults = this.schema.parse({});
      return key.split('.').reduce((obj, k) => obj?.[k], defaults);
    } catch {
      return undefined;
    }
  }

  /**
   * Trigger watchers for a configuration key
   */
  private triggerWatchers(key: string): void {
    const callbacks = this.watchers.get(key);
    if (callbacks) {
      const value = this.get(key);
      callbacks.forEach(callback => {
        try {
          callback(value);
        } catch (error) {
          console.error(`❌ [CONFIG-STORE] Watcher callback error:`, error);
        }
      });
    }
  }

  /**
   * Validate and migrate existing configuration
   */
  private validateAndMigrate(): void {
    const validation = this.validate();
    
    if (!validation.valid) {
      console.warn(`⚠️ [CONFIG-STORE] Invalid configuration detected:`, validation.errors);
      
      // Attempt to fix by resetting invalid sections
      try {
        const currentConfig = this.store.store;
        const fixedConfig = this.schema.parse(currentConfig);
        this.store.store = fixedConfig;
        console.log(`✅ [CONFIG-STORE] Configuration auto-fixed`);
      } catch (error) {
        console.error(`❌ [CONFIG-STORE] Auto-fix failed, resetting to defaults`);
        this.resetToDefaults();
      }
    }
  }

  /**
   * Convert Zod schema to electron-store compatible schema
   */
  private convertZodToElectronSchema(zodSchema: z.ZodSchema): any {
    // Simple conversion - electron-store uses JSON Schema
    // For full compatibility, we'd need a more sophisticated converter
    return {};
  }

  /**
   * Get configuration migrations for version upgrades
   */
  private getMigrations(): any {
    return {
      '>=0.2.0': (store: Store) => {
        // Migration for v0.2.0
        if (!store.has('version')) {
          store.set('version', '0.2.0');
        }
      }
    };
  }

  /**
   * Get configuration file path
   */
  getConfigPath(): string {
    return this.store.path;
  }

  /**
   * Check if configuration has been modified from defaults
   */
  isModified(): boolean {
    try {
      const current = this.getAll();
      const defaults = this.schema.parse({});
      return JSON.stringify(current) !== JSON.stringify(defaults);
    } catch {
      return true;
    }
  }

  /**
   * Get configuration size in bytes
   */
  getSize(): number {
    try {
      const config = JSON.stringify(this.getAll());
      return Buffer.byteLength(config, 'utf8');
    } catch {
      return 0;
    }
  }
}

// Create singleton instance
export const configStore = new ConfigStore();

// Export types and schema for external use
export { ConfigSchema };
export type { Config, ConfigPath };