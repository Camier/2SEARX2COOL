import { app, BrowserWindow, dialog } from 'electron';
import log from 'electron-log';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ErrorInfo } from './ErrorManager';
import { ConfigStore } from '../config/ConfigStore';
import { DatabaseManager } from '../database/DatabaseManager';
import { asyncExecute } from '../utils/AsyncErrorHandler';

export interface RecoveryStrategy {
  name: string;
  description: string;
  canRecover: (error: ErrorInfo) => boolean;
  recover: (error: ErrorInfo) => Promise<boolean>;
  priority: number; // Higher priority strategies are tried first
}

export interface RecoveryState {
  lastRecoveryAttempt: number;
  recoveryCount: number;
  failedRecoveries: string[];
  successfulRecoveries: string[];
}

export class RecoveryManager {
  private strategies: Map<string, RecoveryStrategy> = new Map();
  private recoveryState: RecoveryState = {
    lastRecoveryAttempt: 0,
    recoveryCount: 0,
    failedRecoveries: [],
    successfulRecoveries: []
  };
  private maxRecoveryAttempts = 5;
  private recoveryWindow = 5 * 60 * 1000; // 5 minutes
  private stateFile: string;

  constructor() {
    this.stateFile = path.join(app.getPath('userData'), 'recovery-state.json');
    this.setupDefaultStrategies();
  }

  async initialize(): Promise<void> {
    await this.loadRecoveryState();
    log.info('RecoveryManager initialized');
  }

  private setupDefaultStrategies(): void {
    // Window recovery strategy
    this.registerStrategy({
      name: 'window-recovery',
      description: 'Recreate main window after crash',
      priority: 100,
      canRecover: (error) => {
        return error.source === 'renderer' && 
               error.context?.details?.reason === 'crashed';
      },
      recover: async (error) => {
        try {
          const windows = BrowserWindow.getAllWindows();
          const crashedWindow = windows.find(w => w.webContents.id === error.context?.webContentsId);
          
          if (crashedWindow) {
            if (crashedWindow.isDestroyed()) {
              // Create new window
              const { createWindow } = await import('../window');
              createWindow();
              log.info('Successfully recreated window after crash');
              return true;
            } else {
              // Reload existing window
              crashedWindow.reload();
              log.info('Successfully reloaded crashed window');
              return true;
            }
          }
          
          return false;
        } catch (e) {
          log.error('Window recovery failed:', e);
          return false;
        }
      }
    });

    // Database recovery strategy
    this.registerStrategy({
      name: 'database-recovery',
      description: 'Recover from database errors',
      priority: 90,
      canRecover: (error) => {
        const message = error.error.message.toLowerCase();
        return message.includes('database') || 
               message.includes('sqlite') ||
               message.includes('disk i/o error');
      },
      recover: async (error) => {
        try {
          // Try to close and reinitialize database
          const { DatabaseManager } = await import('../database/DatabaseManager');
          const db = new DatabaseManager();
          
          // Attempt repair
          await this.repairDatabase();
          
          // Reinitialize
          await db.initialize();
          
          log.info('Successfully recovered database');
          return true;
        } catch (e) {
          log.error('Database recovery failed:', e);
          return false;
        }
      }
    });

    // Server recovery strategy
    this.registerStrategy({
      name: 'server-recovery',
      description: 'Restart server after crash',
      priority: 80,
      canRecover: (error) => {
        return error.source === 'server' ||
               error.error.message.includes('EADDRINUSE') ||
               error.error.message.includes('server');
      },
      recover: async (error) => {
        try {
          const { ServerManager } = await import('../server/ServerManager');
          const { ConfigStore } = await import('../config/ConfigStore');
          
          const configStore = new ConfigStore();
          const serverManager = new ServerManager(configStore);
          
          // Force stop if running
          await serverManager.stop();
          
          // Wait a bit
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Start again
          await serverManager.start();
          
          log.info('Successfully recovered server');
          return true;
        } catch (e) {
          log.error('Server recovery failed:', e);
          return false;
        }
      }
    });

    // Plugin recovery strategy
    this.registerStrategy({
      name: 'plugin-recovery',
      description: 'Disable problematic plugins',
      priority: 70,
      canRecover: (error) => {
        return error.source === 'plugin' ||
               (error.context?.pluginId && error.severity === 'high');
      },
      recover: async (error) => {
        try {
          const pluginId = error.context?.pluginId;
          if (!pluginId) return false;

          const { PluginManager } = await import('../plugins/PluginManager');
          const { ConfigStore } = await import('../config/ConfigStore');
          
          // Create temporary plugin manager
          const configStore = new ConfigStore();
          const pluginManager = new PluginManager({
            configStore,
            cacheManager: null as any,
            hardwareManager: null as any,
            databaseManager: null as any,
            serverManager: null as any
          });

          // Disable the problematic plugin
          await pluginManager.disablePlugin(pluginId);
          
          log.info(`Successfully disabled problematic plugin: ${pluginId}`);
          return true;
        } catch (e) {
          log.error('Plugin recovery failed:', e);
          return false;
        }
      }
    });

    // Memory recovery strategy
    this.registerStrategy({
      name: 'memory-recovery',
      description: 'Free memory when running low',
      priority: 60,
      canRecover: (error) => {
        const memUsage = error.systemInfo?.memory;
        if (!memUsage) return false;
        
        const heapUsed = memUsage.heapUsed / memUsage.heapTotal;
        return heapUsed > 0.9 || error.error.message.includes('out of memory');
      },
      recover: async () => {
        try {
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }

          // Clear caches
          const { CacheManager } = await import('../cache/CacheManager');
          const { DatabaseManager } = await import('../database/DatabaseManager');
          
          const db = new DatabaseManager();
          const cache = new CacheManager(db);
          await cache.clear();

          // Clear Electron caches
          const ses = session.defaultSession;
          await ses.clearCache();
          await ses.clearStorageData({
            storages: ['cachestorage', 'shadercache']
          });

          log.info('Successfully freed memory');
          return true;
        } catch (e) {
          log.error('Memory recovery failed:', e);
          return false;
        }
      }
    });

    // Configuration recovery strategy
    this.registerStrategy({
      name: 'config-recovery',
      description: 'Reset corrupted configuration',
      priority: 50,
      canRecover: (error) => {
        return error.error.message.includes('config') ||
               error.error.message.includes('settings') ||
               error.error.message.includes('JSON');
      },
      recover: async () => {
        try {
          const configStore = new ConfigStore();
          
          // Backup current config
          const backupPath = path.join(
            app.getPath('userData'),
            `config-backup-${Date.now()}.json`
          );
          
          try {
            const currentConfig = await configStore.getAll();
            await fs.writeFile(backupPath, JSON.stringify(currentConfig, null, 2));
          } catch {
            // Config might be corrupted, continue anyway
          }

          // Reset to defaults
          await configStore.clear();
          await configStore.setDefaults();

          log.info('Successfully reset configuration');
          return true;
        } catch (e) {
          log.error('Config recovery failed:', e);
          return false;
        }
      }
    });
  }

  registerStrategy(strategy: RecoveryStrategy): void {
    this.strategies.set(strategy.name, strategy);
    log.debug(`Registered recovery strategy: ${strategy.name}`);
  }

  async attemptRecovery(error: ErrorInfo): Promise<{ success: boolean; strategy?: string }> {
    // Check if we're in a recovery loop
    if (this.isInRecoveryLoop()) {
      log.warn('Recovery loop detected, skipping recovery attempts');
      return { success: false };
    }

    // Get applicable strategies
    const applicableStrategies = Array.from(this.strategies.values())
      .filter(s => s.canRecover(error))
      .sort((a, b) => b.priority - a.priority);

    if (applicableStrategies.length === 0) {
      log.debug('No applicable recovery strategies found');
      return { success: false };
    }

    // Update recovery state
    this.recoveryState.lastRecoveryAttempt = Date.now();
    this.recoveryState.recoveryCount++;

    // Try each strategy
    for (const strategy of applicableStrategies) {
      if (this.recoveryState.failedRecoveries.includes(strategy.name)) {
        log.debug(`Skipping previously failed strategy: ${strategy.name}`);
        continue;
      }

      log.info(`Attempting recovery with strategy: ${strategy.name}`);

      const result = await asyncExecute({
        name: `recovery-${strategy.name}`,
        operation: () => strategy.recover(error),
        timeout: 30000,
        retries: 1,
        severity: 'medium'
      });

      if (result.success && result.data) {
        this.recoveryState.successfulRecoveries.push(strategy.name);
        await this.saveRecoveryState();
        
        log.info(`Recovery successful with strategy: ${strategy.name}`);
        return { success: true, strategy: strategy.name };
      } else {
        this.recoveryState.failedRecoveries.push(strategy.name);
      }
    }

    await this.saveRecoveryState();
    return { success: false };
  }

  private isInRecoveryLoop(): boolean {
    const now = Date.now();
    const recentRecoveries = this.recoveryState.recoveryCount;
    const timeSinceLastRecovery = now - this.recoveryState.lastRecoveryAttempt;

    // If too many recoveries in the time window, we're in a loop
    if (timeSinceLastRecovery < this.recoveryWindow && recentRecoveries >= this.maxRecoveryAttempts) {
      return true;
    }

    // Reset counter if outside window
    if (timeSinceLastRecovery > this.recoveryWindow) {
      this.recoveryState.recoveryCount = 0;
      this.recoveryState.failedRecoveries = [];
    }

    return false;
  }

  async promptUserForRecovery(error: ErrorInfo): Promise<'retry' | 'reset' | 'ignore' | 'quit'> {
    const response = await dialog.showMessageBox({
      type: 'error',
      title: 'Recovery Options',
      message: 'An error occurred and automatic recovery failed',
      detail: `${error.error.message}\n\nWhat would you like to do?`,
      buttons: ['Retry Operation', 'Reset Settings', 'Ignore & Continue', 'Quit Application'],
      defaultId: 0,
      cancelId: 2
    });

    switch (response.response) {
      case 0: return 'retry';
      case 1: return 'reset';
      case 2: return 'ignore';
      case 3: return 'quit';
      default: return 'ignore';
    }
  }

  private async repairDatabase(): Promise<void> {
    const dbPath = path.join(app.getPath('userData'), 'searxng.db');
    
    try {
      // Check if database exists
      await fs.access(dbPath);
      
      // Run integrity check
      const Database = require('better-sqlite3');
      const db = new Database(dbPath);
      
      const result = db.prepare('PRAGMA integrity_check').get();
      if (result.integrity_check !== 'ok') {
        log.warn('Database integrity check failed, attempting repair');
        
        // Backup corrupted database
        const backupPath = `${dbPath}.corrupted.${Date.now()}`;
        await fs.copyFile(dbPath, backupPath);
        
        // Try to recover what we can
        db.exec('PRAGMA writable_schema = ON');
        db.exec('REINDEX');
        db.exec('PRAGMA writable_schema = OFF');
      }
      
      db.close();
    } catch (e) {
      log.error('Database repair failed:', e);
      
      // As last resort, delete and recreate
      try {
        await fs.unlink(dbPath);
        log.info('Deleted corrupted database, will recreate');
      } catch {
        // Ignore if doesn't exist
      }
    }
  }

  private async loadRecoveryState(): Promise<void> {
    try {
      const data = await fs.readFile(this.stateFile, 'utf-8');
      this.recoveryState = JSON.parse(data);
    } catch {
      // File doesn't exist or is corrupted, use defaults
    }
  }

  private async saveRecoveryState(): Promise<void> {
    try {
      await fs.writeFile(
        this.stateFile,
        JSON.stringify(this.recoveryState, null, 2),
        'utf-8'
      );
    } catch (e) {
      log.error('Failed to save recovery state:', e);
    }
  }

  getRecoveryStats(): {
    totalAttempts: number;
    successfulStrategies: string[];
    failedStrategies: string[];
    lastAttempt: number;
    isInRecoveryLoop: boolean;
  } {
    return {
      totalAttempts: this.recoveryState.recoveryCount,
      successfulStrategies: this.recoveryState.successfulRecoveries,
      failedStrategies: this.recoveryState.failedRecoveries,
      lastAttempt: this.recoveryState.lastRecoveryAttempt,
      isInRecoveryLoop: this.isInRecoveryLoop()
    };
  }

  async cleanup(): Promise<void> {
    await this.saveRecoveryState();
    this.strategies.clear();
    log.info('RecoveryManager cleaned up');
  }
}

// Singleton instance
export const recoveryManager = new RecoveryManager();