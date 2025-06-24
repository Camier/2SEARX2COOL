/**
 * ConfigStore - Centralized configuration management with validation
 */

import Store from 'electron-store';
import { z } from 'zod';
import { EventEmitter } from 'events';
import { app } from 'electron';
import path from 'path';
import fs from 'fs/promises';

// Configuration schema using Zod
const UserPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  language: z.string().default('en'),
  serverUrl: z.string().url().optional(),
  serverPort: z.number().min(1024).max(65535).default(8888),
  globalShortcuts: z.boolean().default(true),
  autoStart: z.boolean().default(false),
  minimizeToTray: z.boolean().default(true),
  audio: z.object({
    enabled: z.boolean().default(true),
    volume: z.number().min(0).max(100).default(50),
    midiEnabled: z.boolean().default(false),
    defaultDevice: z.string().optional()
  }).default({})
});

const WindowStateSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().min(400).default(1200),
  height: z.number().min(300).default(800),
  isMaximized: z.boolean().default(false),
  isFullScreen: z.boolean().default(false)
});

const SearchSettingsSchema = z.object({
  defaultEngine: z.string().default('all'),
  safeSearch: z.enum(['off', 'moderate', 'strict']).default('moderate'),
  resultsPerPage: z.number().min(10).max(100).default(20),
  openInNewTab: z.boolean().default(true),
  history: z.object({
    enabled: z.boolean().default(true),
    maxItems: z.number().min(0).max(10000).default(1000),
    clearOnExit: z.boolean().default(false)
  }).default({})
});

const ConfigSchema = z.object({
  preferences: UserPreferencesSchema.default({}),
  windowState: WindowStateSchema.default({}),
  searchSettings: SearchSettingsSchema.default({}),
  version: z.string().default('1.0.0')
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type WindowState = z.infer<typeof WindowStateSchema>;
export type SearchSettings = z.infer<typeof SearchSettingsSchema>;
export type ConfigData = z.infer<typeof ConfigSchema>;

export class ConfigStore extends EventEmitter {
  private store: Store<ConfigData>;
  private configPath: string;
  private backupPath: string;
  private migrationHandlers: Map<string, (data: any) => any> = new Map();

  constructor() {
    super();
    
    // Initialize store without schema validation (we'll use Zod for validation)
    this.store = new Store<ConfigData>({
      name: '2searx2cool-config',
      migrations: {
        '1.0.0': (store: any) => {
          // Initial version, no migration needed
        }
      },
      beforeEachMigration: (store: any, context: any) => {
        console.log(`Migrating config from ${context.fromVersion} to ${context.toVersion}`);
      }
    });

    this.configPath = (this.store as any).path;
    this.backupPath = path.join(
      path.dirname(this.configPath),
      'config-backup.json'
    );

    // Watch for changes
    (this.store as any).onDidChange('preferences', (newValue: any, oldValue: any) => {
      this.emit('preferences:change', newValue, oldValue);
    });

    (this.store as any).onDidChange('searchSettings', (newValue: any, oldValue: any) => {
      this.emit('searchSettings:change', newValue, oldValue);
    });

    // Validate existing config on startup
    this.validateConfig();
  }

  /**
   * Get configuration value
   */
  async get<K extends keyof ConfigData>(key: K): Promise<ConfigData[K]> {
    try {
      const value = (this.store as any).get(key);
      return value;
    } catch (error) {
      console.error(`Error getting config key ${key}:`, error);
      // Return default value on error
      const defaults = ConfigSchema.parse({});
      return defaults[key];
    }
  }

  /**
   * Set configuration value
   */
  async set<K extends keyof ConfigData>(
    key: K,
    value: ConfigData[K]
  ): Promise<void> {
    try {
      // Validate the specific schema
      const schema = this.getSchemaForKey(key);
      const validated = schema.parse(value);
      
      // Create backup before changing
      await this.createBackup();
      
      (this.store as any).set(key, validated);
      this.emit('config:change', key, validated);
    } catch (error) {
      console.error(`Error setting config key ${key}:`, error);
      throw new Error(`Invalid configuration value for ${key}`);
    }
  }

  /**
   * Get all configuration
   */
  async getAll(): Promise<ConfigData> {
    return (this.store as any).store;
  }

  /**
   * Reset configuration to defaults
   */
  async reset(key?: keyof ConfigData): Promise<void> {
    await this.createBackup();
    
    if (key) {
      const defaults = ConfigSchema.parse({});
      (this.store as any).set(key, defaults[key]);
    } else {
      (this.store as any).clear();
      const defaults = ConfigSchema.parse({});
      (this.store as any).set(defaults);
    }
    
    this.emit('config:reset', key);
  }

  /**
   * Import configuration from file
   */
  async importConfig(filePath: string): Promise<void> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      
      // Validate the imported config
      const validated = ConfigSchema.parse(parsed);
      
      await this.createBackup();
      (this.store as any).set(validated);
      
      this.emit('config:imported', filePath);
    } catch (error) {
      console.error('Error importing config:', error);
      throw new Error('Failed to import configuration');
    }
  }

  /**
   * Export configuration to file
   */
  async exportConfig(filePath: string): Promise<void> {
    try {
      const config = (this.store as any).store;
      await fs.writeFile(filePath, JSON.stringify(config, null, 2));
      this.emit('config:exported', filePath);
    } catch (error) {
      console.error('Error exporting config:', error);
      throw new Error('Failed to export configuration');
    }
  }

  /**
   * Create backup of current configuration
   */
  private async createBackup(): Promise<void> {
    try {
      const config = (this.store as any).store;
      await fs.writeFile(this.backupPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Error creating config backup:', error);
    }
  }

  /**
   * Restore configuration from backup
   */
  async restoreFromBackup(): Promise<void> {
    try {
      const data = await fs.readFile(this.backupPath, 'utf-8');
      const parsed = JSON.parse(data);
      const validated = ConfigSchema.parse(parsed);
      
      (this.store as any).set(validated);
      this.emit('config:restored');
    } catch (error) {
      console.error('Error restoring config:', error);
      throw new Error('Failed to restore configuration from backup');
    }
  }

  /**
   * Validate current configuration
   */
  private validateConfig(): void {
    try {
      const config = (this.store as any).store;
      ConfigSchema.parse(config);
    } catch (error) {
      console.error('Invalid configuration detected:', error);
      // Reset to defaults if validation fails
      this.reset();
    }
  }

  /**
   * Get schema for specific key
   */
  private getSchemaForKey(key: keyof ConfigData): z.ZodSchema {
    switch (key) {
      case 'preferences':
        return UserPreferencesSchema;
      case 'windowState':
        return WindowStateSchema;
      case 'searchSettings':
        return SearchSettingsSchema;
      case 'version':
        return z.string();
      default:
        return ConfigSchema;
    }
  }


  /**
   * Register a migration handler
   */
  registerMigration(fromVersion: string, handler: (data: any) => any): void {
    this.migrationHandlers.set(fromVersion, handler);
  }

  /**
   * Get configuration file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Watch for external configuration changes
   */
  async watchExternalChanges(): Promise<void> {
    // Implement file watcher if needed
  }
}

// Export singleton instance
export const configStore = new ConfigStore();