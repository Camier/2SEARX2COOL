/**
 * IPC handlers for unified configuration management
 */

import { ipcMain, dialog, shell } from 'electron';
import { unifiedConfigManager } from '../config/UnifiedConfigManager';
import log from 'electron-log';
import * as path from 'path';
import * as fs from 'fs/promises';

export function setupConfigIPC(): void {
  // Get unified configuration
  ipcMain.handle('config:get-unified', async () => {
    try {
      return await unifiedConfigManager.getUnified();
    } catch (error) {
      log.error('Failed to get unified config:', error);
      throw error;
    }
  });
  
  // Get specific configuration value
  ipcMain.handle('config:get', async (event, path: string, defaultValue?: any) => {
    try {
      return unifiedConfigManager.get(path, defaultValue);
    } catch (error) {
      log.error(`Failed to get config value at ${path}:`, error);
      throw error;
    }
  });
  
  // Set configuration value
  ipcMain.handle('config:set', async (event, path: string, value: any) => {
    try {
      await unifiedConfigManager.set(path, value);
      return true;
    } catch (error) {
      log.error(`Failed to set config value at ${path}:`, error);
      throw error;
    }
  });
  
  // Get all configuration
  ipcMain.handle('config:get-all', async () => {
    try {
      return unifiedConfigManager.getAll();
    } catch (error) {
      log.error('Failed to get all config:', error);
      throw error;
    }
  });
  
  // Validate configuration
  ipcMain.handle('config:validate', async () => {
    try {
      return unifiedConfigManager.validate();
    } catch (error) {
      log.error('Failed to validate config:', error);
      throw error;
    }
  });
  
  // Get operating mode
  ipcMain.handle('config:get-mode', () => {
    return unifiedConfigManager.getMode();
  });
  
  // Set operating mode
  ipcMain.handle('config:set-mode', async (event, mode: 'service' | 'desktop' | 'hybrid') => {
    try {
      await unifiedConfigManager.setMode(mode);
      return true;
    } catch (error) {
      log.error(`Failed to set mode to ${mode}:`, error);
      throw error;
    }
  });
  
  // Reload specific configuration
  ipcMain.handle('config:reload', async (event, configName: string) => {
    try {
      await unifiedConfigManager.reloadConfig(configName);
      return true;
    } catch (error) {
      log.error(`Failed to reload config ${configName}:`, error);
      throw error;
    }
  });
  
  // Export configuration for Python
  ipcMain.handle('config:export-python', () => {
    try {
      return unifiedConfigManager.exportForPython();
    } catch (error) {
      log.error('Failed to export Python config:', error);
      throw error;
    }
  });
  
  // Export configuration for Electron
  ipcMain.handle('config:export-electron', () => {
    try {
      return unifiedConfigManager.exportForElectron();
    } catch (error) {
      log.error('Failed to export Electron config:', error);
      throw error;
    }
  });
  
  // Open configuration file in editor
  ipcMain.handle('config:open-file', async (event, configName: string) => {
    try {
      const configFiles: Record<string, string> = {
        'musicEngines': 'music_engines.yml',
        'orchestrator': 'orchestrator.yml',
        'searxngSettings': 'searxng-settings.yml',
        'appSettings': 'unified/app-settings.json',
        'userPreferences': 'unified/user-preferences.json',
        'unified': 'unified/unified-config.json'
      };
      
      const fileName = configFiles[configName];
      if (!fileName) {
        throw new Error(`Unknown config name: ${configName}`);
      }
      
      const appPath = require('electron').app.getAppPath();
      const filePath = path.join(appPath, 'config', fileName);
      
      await shell.openPath(filePath);
      return true;
    } catch (error) {
      log.error(`Failed to open config file ${configName}:`, error);
      throw error;
    }
  });
  
  // Show configuration directory
  ipcMain.handle('config:show-directory', async () => {
    try {
      const appPath = require('electron').app.getAppPath();
      const configDir = path.join(appPath, 'config');
      
      shell.showItemInFolder(configDir);
      return true;
    } catch (error) {
      log.error('Failed to show config directory:', error);
      throw error;
    }
  });
  
  // Import configuration
  ipcMain.handle('config:import', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Import Configuration',
        filters: [
          { name: 'Configuration Files', extensions: ['json', 'yml', 'yaml'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });
      
      if (result.canceled || !result.filePaths.length) {
        return null;
      }
      
      const filePath = result.filePaths[0];
      const content = await fs.readFile(filePath, 'utf8');
      
      // Determine config type based on file name
      const fileName = path.basename(filePath);
      let imported = false;
      
      if (fileName.includes('music_engines')) {
        // Import as music engines config
        log.info('Importing music engines configuration...');
        // Would need to implement YAML import in UnifiedConfigManager
        throw new Error('YAML import not yet implemented');
      } else if (fileName.includes('app-settings')) {
        // Import as app settings
        const settings = JSON.parse(content);
        await unifiedConfigManager.set('appSettings', settings);
        imported = true;
      } else if (fileName.includes('user-preferences')) {
        // Import as user preferences
        const preferences = JSON.parse(content);
        await unifiedConfigManager.set('userPreferences', preferences);
        imported = true;
      } else {
        throw new Error('Unknown configuration file type');
      }
      
      if (imported) {
        log.info(`Successfully imported configuration from ${fileName}`);
        return true;
      }
      
      return false;
    } catch (error) {
      log.error('Failed to import configuration:', error);
      throw error;
    }
  });
  
  // Export configuration
  ipcMain.handle('config:export', async (event, configType: string) => {
    try {
      const result = await dialog.showSaveDialog({
        title: 'Export Configuration',
        defaultPath: `2searx2cool-${configType}-config.json`,
        filters: [
          { name: 'JSON Files', extensions: ['json'] }
        ]
      });
      
      if (result.canceled || !result.filePath) {
        return null;
      }
      
      let configData: any;
      
      switch (configType) {
        case 'unified':
          configData = await unifiedConfigManager.getUnified();
          break;
        case 'python':
          configData = unifiedConfigManager.exportForPython();
          break;
        case 'electron':
          configData = unifiedConfigManager.exportForElectron();
          break;
        case 'all':
          configData = unifiedConfigManager.getAll();
          break;
        default:
          configData = unifiedConfigManager.get(configType);
      }
      
      await fs.writeFile(result.filePath, JSON.stringify(configData, null, 2));
      
      log.info(`Successfully exported ${configType} configuration to ${result.filePath}`);
      return result.filePath;
    } catch (error) {
      log.error('Failed to export configuration:', error);
      throw error;
    }
  });
  
  // Reset configuration
  ipcMain.handle('config:reset', async (event, configName?: string) => {
    try {
      const result = await dialog.showMessageBox({
        type: 'warning',
        title: 'Reset Configuration',
        message: configName 
          ? `Are you sure you want to reset ${configName} to defaults?`
          : 'Are you sure you want to reset all configurations to defaults?',
        detail: 'This action cannot be undone.',
        buttons: ['Cancel', 'Reset'],
        defaultId: 0,
        cancelId: 0
      });
      
      if (result.response === 1) {
        // User clicked Reset
        if (configName) {
          await unifiedConfigManager.reloadConfig(configName);
        } else {
          // Reset all - would need to implement in UnifiedConfigManager
          throw new Error('Full reset not yet implemented');
        }
        
        log.info(`Configuration ${configName || 'all'} reset to defaults`);
        return true;
      }
      
      return false;
    } catch (error) {
      log.error('Failed to reset configuration:', error);
      throw error;
    }
  });
  
  // Listen for configuration events
  unifiedConfigManager.on('config:changed', (path: string, value: any) => {
    // Broadcast to all renderer processes
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('config:changed', path, value);
    });
  });
  
  unifiedConfigManager.on('config:reloaded', (configName: string) => {
    // Broadcast reload event
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('config:reloaded', configName);
    });
  });
  
  unifiedConfigManager.on('mode:changed', (mode: string) => {
    // Broadcast mode change
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('config:mode-changed', mode);
    });
  });
}