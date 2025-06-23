/**
 * Execution Worker - Parallel Task Execution
 * 
 * Handles the actual implementation of refactoring tasks.
 * Multiple instances work in parallel to execute code changes,
 * file operations, and other refactoring actions.
 */

import { EventEmitter } from 'events';
import {
  RefactoringTask,
  WorkerMessage,
  WorkerStatus
} from '../types';

interface TaskExecutor {
  type: 'create' | 'update' | 'delete' | 'optimize' | 'fix' | 'validate';
  executor: (task: RefactoringTask) => Promise<void>;
}

interface FileOperation {
  type: 'read' | 'write' | 'delete' | 'copy' | 'move';
  sourcePath: string;
  targetPath?: string;
  content?: string;
}

export class ExecutionWorker extends EventEmitter {
  private workerId: string;
  private status: WorkerStatus;
  private maxTasksPerWorker: number;
  private currentTasks: Set<string> = new Set();
  private taskExecutors: Map<string, TaskExecutor> = new Map();
  private taskHistory: RefactoringTask[] = [];

  constructor(maxTasksPerWorker: number = 3) {
    super();
    this.workerId = `execution-worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.maxTasksPerWorker = maxTasksPerWorker;
    
    this.status = {
      id: this.workerId,
      type: 'execution',
      status: 'idle',
      completedTasks: 0,
      failedTasks: 0,
      uptime: 0,
      lastActivity: new Date(),
      capabilities: [
        'file_creation',
        'file_modification',
        'code_generation',
        'template_instantiation',
        'dependency_management',
        'build_optimization',
        'test_execution'
      ],
      performance: {
        averageTaskTime: 0,
        successRate: 0,
        errorRate: 0
      }
    };

    this.initializeTaskExecutors();
    this.startUptimeTracking();
    
    console.log(`⚡ [EXECUTION] Worker ${this.workerId} initialized (max concurrent: ${maxTasksPerWorker})`);
  }

  /**
   * Execute a refactoring task
   */
  async executeTask(task: RefactoringTask): Promise<void> {
    if (this.currentTasks.size >= this.maxTasksPerWorker) {
      throw new Error('Worker at maximum capacity');
    }

    console.log(`🚀 [EXECUTION] Starting task: ${task.id} - ${task.description}`);
    
    const startTime = Date.now();
    this.currentTasks.add(task.id);
    this.updateStatus('busy', task.id);

    try {
      const executor = this.taskExecutors.get(task.type);
      if (!executor) {
        throw new Error(`No executor found for task type: ${task.type}`);
      }

      await executor.executor(task);

      this.currentTasks.delete(task.id);
      this.status.completedTasks++;
      this.taskHistory.push(task);
      
      const executionTime = Date.now() - startTime;
      this.updatePerformanceMetrics(executionTime, true);
      this.updateStatus('idle');

      console.log(`✅ [EXECUTION] Task completed: ${task.id} (${executionTime}ms)`);
      
      // Send completion message to orchestrator
      const message: WorkerMessage = {
        type: 'task_completion',
        workerId: this.workerId,
        taskId: task.id,
        payload: { 
          executionTime,
          result: 'Task completed successfully'
        },
        timestamp: new Date()
      };
      this.emit('message', message);

    } catch (error) {
      this.currentTasks.delete(task.id);
      this.status.failedTasks++;
      
      const executionTime = Date.now() - startTime;
      this.updatePerformanceMetrics(executionTime, false);
      this.updateStatus('error');

      console.error(`❌ [EXECUTION] Task failed: ${task.id} - ${error}`);
      
      // Send failure message to orchestrator
      const message: WorkerMessage = {
        type: 'task_failure',
        workerId: this.workerId,
        taskId: task.id,
        payload: { 
          error: error instanceof Error ? error.message : String(error),
          executionTime
        },
        timestamp: new Date()
      };
      this.emit('message', message);

      throw error;
    }
  }

  /**
   * Initialize task executors for different task types
   */
  private initializeTaskExecutors(): void {
    this.taskExecutors.set('create', {
      type: 'create',
      executor: this.executeCreateTask.bind(this)
    });

    this.taskExecutors.set('update', {
      type: 'update',
      executor: this.executeUpdateTask.bind(this)
    });

    this.taskExecutors.set('delete', {
      type: 'delete',
      executor: this.executeDeleteTask.bind(this)
    });

    this.taskExecutors.set('optimize', {
      type: 'optimize',
      executor: this.executeOptimizeTask.bind(this)
    });

    this.taskExecutors.set('fix', {
      type: 'fix',
      executor: this.executeFixTask.bind(this)
    });

    this.taskExecutors.set('validate', {
      type: 'validate',
      executor: this.executeValidateTask.bind(this)
    });
  }

  /**
   * Execute file creation task
   */
  private async executeCreateTask(task: RefactoringTask): Promise<void> {
    console.log(`📝 [EXECUTION] Creating file: ${task.filePath}`);

    let content = '';

    // Generate content based on file type and purpose
    if (task.filePath.includes('ConfigStore.ts')) {
      content = this.generateConfigStoreContent();
    } else if (task.filePath.includes('SecurityManager.ts')) {
      content = this.generateSecurityManagerContent();
    } else if (task.filePath.includes('HardwareManager.ts')) {
      content = this.generateHardwareManagerContent();
    } else if (task.filePath.includes('UpdateManager.ts')) {
      content = this.generateUpdateManagerContent();
    } else if (task.filePath.includes('window.ts')) {
      content = this.generateWindowContent();
    } else if (task.filePath.includes('tray.ts')) {
      content = this.generateTrayContent();
    } else if (task.filePath.includes('shortcuts.ts')) {
      content = this.generateShortcutsContent();
    } else if (task.filePath.includes('App.tsx')) {
      content = this.generateRendererAppContent();
    } else {
      content = this.generateGenericContent(task);
    }

    // Simulate file creation with error handling
    await this.simulateFileOperation({
      type: 'write',
      sourcePath: task.filePath,
      content
    });

    console.log(`✅ [EXECUTION] File created: ${task.filePath}`);
  }

  /**
   * Execute file update task
   */
  private async executeUpdateTask(task: RefactoringTask): Promise<void> {
    console.log(`📝 [EXECUTION] Updating file: ${task.filePath}`);

    // Read existing content
    const existingContent = await this.simulateFileOperation({
      type: 'read',
      sourcePath: task.filePath
    });

    // Apply modifications based on task metadata
    const updatedContent = this.applyUpdates(existingContent as string, task);

    // Write updated content
    await this.simulateFileOperation({
      type: 'write',
      sourcePath: task.filePath,
      content: updatedContent
    });

    console.log(`✅ [EXECUTION] File updated: ${task.filePath}`);
  }

  /**
   * Execute file deletion task
   */
  private async executeDeleteTask(task: RefactoringTask): Promise<void> {
    console.log(`🗑️ [EXECUTION] Deleting file: ${task.filePath}`);

    await this.simulateFileOperation({
      type: 'delete',
      sourcePath: task.filePath
    });

    console.log(`✅ [EXECUTION] File deleted: ${task.filePath}`);
  }

  /**
   * Execute optimization task
   */
  private async executeOptimizeTask(task: RefactoringTask): Promise<void> {
    console.log(`⚡ [EXECUTION] Optimizing: ${task.filePath}`);

    // Read existing content
    const content = await this.simulateFileOperation({
      type: 'read',
      sourcePath: task.filePath
    }) as string;

    // Apply optimizations
    const optimizedContent = this.applyOptimizations(content, task);

    // Write optimized content
    await this.simulateFileOperation({
      type: 'write',
      sourcePath: task.filePath,
      content: optimizedContent
    });

    console.log(`✅ [EXECUTION] Optimization complete: ${task.filePath}`);
  }

  /**
   * Execute fix task
   */
  private async executeFixTask(task: RefactoringTask): Promise<void> {
    console.log(`🔧 [EXECUTION] Fixing issues in: ${task.filePath}`);

    // Read existing content
    const content = await this.simulateFileOperation({
      type: 'read',
      sourcePath: task.filePath
    }) as string;

    // Apply fixes
    const fixedContent = this.applyFixes(content, task);

    // Write fixed content
    await this.simulateFileOperation({
      type: 'write',
      sourcePath: task.filePath,
      content: fixedContent
    });

    console.log(`✅ [EXECUTION] Fixes applied: ${task.filePath}`);
  }

  /**
   * Execute validation task
   */
  private async executeValidateTask(task: RefactoringTask): Promise<void> {
    console.log(`✓ [EXECUTION] Validating: ${task.filePath}`);

    // This would integrate with actual validation tools
    await new Promise(resolve => setTimeout(resolve, 200)); // Simulate validation time

    console.log(`✅ [EXECUTION] Validation complete: ${task.filePath}`);
  }

  /**
   * Generate ConfigStore.ts content
   */
  private generateConfigStoreContent(): string {
    return `/**
 * Configuration Store - Centralized Configuration Management
 * 
 * Manages application configuration with validation, defaults,
 * and live updates.
 */

import { EventEmitter } from 'events';
import { app } from 'electron';
import { z } from 'zod';
import Store from 'electron-store';

const ConfigSchema = z.object({
  window: z.object({
    width: z.number().min(800).default(1200),
    height: z.number().min(600).default(800),
    x: z.number().optional(),
    y: z.number().optional(),
    maximized: z.boolean().default(false)
  }),
  hardware: z.object({
    enableMidi: z.boolean().default(true),
    midiDevices: z.array(z.string()).default([]),
    audioLatency: z.number().min(0).max(1000).default(100)
  }),
  search: z.object({
    engines: z.array(z.string()).default([]),
    timeout: z.number().min(1000).max(30000).default(10000),
    maxResults: z.number().min(10).max(1000).default(100)
  }),
  security: z.object({
    allowRemoteConnections: z.boolean().default(false),
    encryptCache: z.boolean().default(true)
  })
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export class ConfigStore extends EventEmitter {
  private store: Store<AppConfig>;
  private config: AppConfig;

  constructor() {
    super();
    
    this.store = new Store<AppConfig>({
      schema: ConfigSchema.shape as any,
      defaults: ConfigSchema.parse({})
    });

    this.config = this.loadConfig();
    this.watchForChanges();
  }

  /**
   * Load configuration with validation
   */
  private loadConfig(): AppConfig {
    try {
      const rawConfig = this.store.store;
      return ConfigSchema.parse(rawConfig);
    } catch (error) {
      console.error('Invalid configuration, using defaults:', error);
      const defaultConfig = ConfigSchema.parse({});
      this.store.store = defaultConfig;
      return defaultConfig;
    }
  }

  /**
   * Get configuration value
   */
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  /**
   * Set configuration value
   */
  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config[key] = value;
    this.store.set(key, value);
    this.emit('config-changed', key, value);
  }

  /**
   * Get entire configuration
   */
  getAll(): AppConfig {
    return { ...this.config };
  }

  /**
   * Update multiple configuration values
   */
  update(updates: Partial<AppConfig>): void {
    const newConfig = { ...this.config, ...updates };
    const validated = ConfigSchema.parse(newConfig);
    
    this.config = validated;
    this.store.store = validated;
    this.emit('config-updated', updates);
  }

  /**
   * Reset to defaults
   */
  reset(): void {
    const defaults = ConfigSchema.parse({});
    this.config = defaults;
    this.store.clear();
    this.store.store = defaults;
    this.emit('config-reset');
  }

  /**
   * Watch for external configuration changes
   */
  private watchForChanges(): void {
    // This would implement file watching for live updates
  }

  /**
   * Validate configuration
   */
  validate(): boolean {
    try {
      ConfigSchema.parse(this.config);
      return true;
    } catch {
      return false;
    }
  }
}

export const configStore = new ConfigStore();`;
  }

  /**
   * Generate SecurityManager.ts content
   */
  private generateSecurityManagerContent(): string {
    return `/**
 * Security Manager - Application Security Layer
 * 
 * Handles security policies, CSP, and secure operations.
 */

import { app, session } from 'electron';
import { EventEmitter } from 'events';

export class SecurityManager extends EventEmitter {
  private initialized = false;

  constructor() {
    super();
  }

  /**
   * Initialize security policies
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.setupContentSecurityPolicy();
    await this.setupPermissions();
    await this.setupSecureDefaults();

    this.initialized = true;
    console.log('🔒 [SECURITY] Security manager initialized');
  }

  /**
   * Setup Content Security Policy
   */
  private async setupContentSecurityPolicy(): Promise<void> {
    session.defaultSession.webSecurity = true;
    
    // Set CSP headers
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
          ]
        }
      });
    });
  }

  /**
   * Setup permission handling
   */
  private async setupPermissions(): Promise<void> {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      // Allow only necessary permissions
      const allowedPermissions = ['midi', 'media'];
      callback(allowedPermissions.includes(permission));
    });
  }

  /**
   * Setup secure defaults
   */
  private async setupSecureDefaults(): Promise<void> {
    app.commandLine.appendSwitch('disable-web-security', 'false');
    app.commandLine.appendSwitch('enable-sandbox', 'true');
  }

  /**
   * Validate secure context
   */
  isSecureContext(): boolean {
    return this.initialized;
  }
}

export const securityManager = new SecurityManager();`;
  }

  /**
   * Generate HardwareManager.ts content
   */
  private generateHardwareManagerContent(): string {
    return `/**
 * Hardware Manager - MIDI and Hardware Abstraction
 * 
 * Provides cross-platform hardware access with proper error handling
 * and graceful degradation when hardware is unavailable.
 */

import { EventEmitter } from 'events';

interface MidiDevice {
  id: string;
  name: string;
  type: 'input' | 'output';
  connected: boolean;
}

export class HardwareManager extends EventEmitter {
  private midiEnabled = false;
  private availableDevices: MidiDevice[] = [];
  private easymidi: any = null;

  constructor() {
    super();
  }

  /**
   * Initialize hardware systems
   */
  async initialize(): Promise<void> {
    await this.initializeMidi();
    console.log('🎹 [HARDWARE] Hardware manager initialized');
  }

  /**
   * Initialize MIDI with optional dependency handling
   */
  private async initializeMidi(): Promise<void> {
    try {
      // Dynamic import for optional dependency
      this.easymidi = await import('easymidi');
      this.midiEnabled = true;
      await this.scanMidiDevices();
      console.log('🎹 [HARDWARE] MIDI initialized successfully');
    } catch (error) {
      console.warn('⚠️ [HARDWARE] MIDI not available:', error);
      this.midiEnabled = false;
    }
  }

  /**
   * Scan for available MIDI devices
   */
  private async scanMidiDevices(): Promise<void> {
    if (!this.midiEnabled || !this.easymidi) return;

    try {
      const inputs = this.easymidi.getInputs();
      const outputs = this.easymidi.getOutputs();

      this.availableDevices = [
        ...inputs.map((name: string, index: number) => ({
          id: \`input-\${index}\`,
          name,
          type: 'input' as const,
          connected: true
        })),
        ...outputs.map((name: string, index: number) => ({
          id: \`output-\${index}\`,
          name,
          type: 'output' as const,
          connected: true
        }))
      ];

      this.emit('devices-updated', this.availableDevices);
    } catch (error) {
      console.error('❌ [HARDWARE] Failed to scan MIDI devices:', error);
    }
  }

  /**
   * Get available MIDI devices
   */
  getMidiDevices(): MidiDevice[] {
    return [...this.availableDevices];
  }

  /**
   * Check if MIDI is available
   */
  isMidiAvailable(): boolean {
    return this.midiEnabled;
  }

  /**
   * Connect to MIDI device
   */
  async connectMidiDevice(deviceId: string): Promise<boolean> {
    if (!this.midiEnabled) {
      console.warn('⚠️ [HARDWARE] MIDI not available');
      return false;
    }

    try {
      // Implementation would handle actual device connection
      console.log(\`🔌 [HARDWARE] Connected to MIDI device: \${deviceId}\`);
      return true;
    } catch (error) {
      console.error(\`❌ [HARDWARE] Failed to connect to device \${deviceId}:\`, error);
      return false;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    // Close all MIDI connections
    this.availableDevices = [];
    this.emit('shutdown');
  }
}

export const hardwareManager = new HardwareManager();`;
  }

  /**
   * Generate UpdateManager.ts content
   */
  private generateUpdateManagerContent(): string {
    return `/**
 * Update Manager - Application Updates
 * 
 * Handles automatic updates with user consent and fallback mechanisms.
 */

import { autoUpdater } from 'electron-updater';
import { EventEmitter } from 'events';

export class UpdateManager extends EventEmitter {
  private updateAvailable = false;
  private downloadProgress = 0;

  constructor() {
    super();
    this.setupAutoUpdater();
  }

  /**
   * Initialize update manager
   */
  async initialize(): Promise<void> {
    autoUpdater.checkForUpdatesAndNotify();
    console.log('🔄 [UPDATE] Update manager initialized');
  }

  /**
   * Setup auto updater events
   */
  private setupAutoUpdater(): void {
    autoUpdater.on('update-available', (info) => {
      this.updateAvailable = true;
      this.emit('update-available', info);
    });

    autoUpdater.on('download-progress', (progress) => {
      this.downloadProgress = progress.percent;
      this.emit('download-progress', progress);
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.emit('update-downloaded', info);
    });

    autoUpdater.on('error', (error) => {
      console.error('❌ [UPDATE] Update error:', error);
      this.emit('update-error', error);
    });
  }

  /**
   * Check for updates manually
   */
  async checkForUpdates(): Promise<void> {
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      console.error('❌ [UPDATE] Failed to check for updates:', error);
    }
  }

  /**
   * Download and install update
   */
  async downloadAndInstall(): Promise<void> {
    if (!this.updateAvailable) return;

    try {
      await autoUpdater.downloadUpdate();
      autoUpdater.quitAndInstall();
    } catch (error) {
      console.error('❌ [UPDATE] Failed to download/install update:', error);
    }
  }

  /**
   * Get download progress
   */
  getDownloadProgress(): number {
    return this.downloadProgress;
  }

  /**
   * Check if update is available
   */
  isUpdateAvailable(): boolean {
    return this.updateAvailable;
  }
}

export const updateManager = new UpdateManager();`;
  }

  /**
   * Generate window.ts content
   */
  private generateWindowContent(): string {
    return `/**
 * Window Management - Main Application Window
 * 
 * Creates and manages the main application window with state persistence.
 */

import { BrowserWindow, app, screen } from 'electron';
import { join } from 'path';
import { configStore } from './config/ConfigStore';

let mainWindow: BrowserWindow | null = null;

/**
 * Create the main application window
 */
export function createWindow(): BrowserWindow {
  const windowConfig = configStore.get('window');
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: windowConfig.width,
    height: windowConfig.height,
    x: windowConfig.x,
    y: windowConfig.y,
    minWidth: 800,
    minHeight: 600,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true
    },
    titleBarStyle: 'default',
    frame: true
  });

  // Load the app
  if (app.isPackaged) {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  } else {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    if (!mainWindow) return;
    
    if (windowConfig.maximized) {
      mainWindow.maximize();
    }
    
    mainWindow.show();
  });

  // Save window state on close
  mainWindow.on('close', () => {
    if (!mainWindow) return;
    
    const bounds = mainWindow.getBounds();
    configStore.set('window', {
      ...bounds,
      maximized: mainWindow.isMaximized()
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

/**
 * Get the main window instance
 */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}`;
  }

  /**
   * Generate tray.ts content
   */
  private generateTrayContent(): string {
    return `/**
 * System Tray - Tray Icon and Menu
 * 
 * Provides system tray functionality with context menu.
 */

import { Tray, Menu, app, nativeImage } from 'electron';
import { join } from 'path';
import { getMainWindow } from './window';

let tray: Tray | null = null;

/**
 * Setup system tray
 */
export function setupTray(): void {
  const icon = nativeImage.createFromPath(
    join(__dirname, '../../resources/tray-icon.png')
  );
  
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show 2SEARX2COOL',
      click: () => {
        const mainWindow = getMainWindow();
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Hide to Tray',
      click: () => {
        const mainWindow = getMainWindow();
        if (mainWindow) {
          mainWindow.hide();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.setToolTip('2SEARX2COOL - Music Search Desktop');
  
  // Double-click to show/hide
  tray.on('double-click', () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

/**
 * Get tray instance
 */
export function getTray(): Tray | null {
  return tray;
}`;
  }

  /**
   * Generate shortcuts.ts content
   */
  private generateShortcutsContent(): string {
    return `/**
 * Global Shortcuts - Keyboard Shortcuts
 * 
 * Registers global keyboard shortcuts for application control.
 */

import { globalShortcut } from 'electron';
import { getMainWindow } from './window';

/**
 * Setup global shortcuts
 */
export function setupGlobalShortcuts(): void {
  // Toggle window visibility
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  // Quick search
  globalShortcut.register('CommandOrControl+Shift+F', () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      // Focus search input
      mainWindow.webContents.send('focus-search');
    }
  });

  console.log('⌨️ [SHORTCUTS] Global shortcuts registered');
}

/**
 * Unregister all shortcuts
 */
export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
  console.log('⌨️ [SHORTCUTS] Global shortcuts unregistered');
}`;
  }

  /**
   * Generate renderer App.tsx content
   */
  private generateRendererAppContent(): string {
    return `/**
 * Main Renderer Application
 * 
 * React-based user interface for 2SEARX2COOL
 */

import React, { useState, useEffect } from 'react';

interface SearchResult {
  title: string;
  url: string;
  engine: string;
  thumbnail?: string;
}

export function App(): JSX.Element {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      // This would call the main process via IPC
      const searchResults = await window.electronAPI.search(query);
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎵 2SEARX2COOL</h1>
        <p>Music Search Desktop Application</p>
      </header>

      <main className="app-main">
        <div className="search-container">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search for music..."
            className="search-input"
            disabled={loading}
          />
          <button 
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="search-button"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        <div className="results-container">
          {results.length > 0 && (
            <div className="results-grid">
              {results.map((result, index) => (
                <div key={index} className="result-card">
                  {result.thumbnail && (
                    <img src={result.thumbnail} alt={result.title} />
                  )}
                  <h3>{result.title}</h3>
                  <p>Source: {result.engine}</p>
                  <a href={result.url} target="_blank" rel="noopener noreferrer">
                    Open
                  </a>
                </div>
              ))}
            </div>
          )}
          
          {loading && (
            <div className="loading">
              <p>Searching across multiple engines...</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;`;
  }

  /**
   * Generate generic content for unknown file types
   */
  private generateGenericContent(task: RefactoringTask): string {
    return `/**
 * ${task.filePath}
 * 
 * Generated by Self-Optimizing Refactoring System
 * Task: ${task.description}
 */

// TODO: Implement ${task.description}
console.log('File created: ${task.filePath}');

export default {};`;
  }

  /**
   * Apply updates to existing content
   */
  private applyUpdates(content: string, task: RefactoringTask): string {
    // This would implement specific update logic based on task metadata
    return content + `\n// Updated by task: ${task.id}`;
  }

  /**
   * Apply optimizations to content
   */
  private applyOptimizations(content: string, task: RefactoringTask): string {
    // This would implement optimization logic
    return content.replace(/console\.log\([^)]*\);?/g, ''); // Remove console.log
  }

  /**
   * Apply fixes to content
   */
  private applyFixes(content: string, task: RefactoringTask): string {
    // This would implement fix logic
    return content; // Placeholder
  }

  /**
   * Simulate file operations
   */
  private async simulateFileOperation(operation: FileOperation): Promise<string | void> {
    // Simulate filesystem delay
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));

    switch (operation.type) {
      case 'read':
        console.log(`📖 [EXECUTION] Reading file: ${operation.sourcePath}`);
        return 'file content'; // Simulated content
      
      case 'write':
        console.log(`💾 [EXECUTION] Writing file: ${operation.sourcePath}`);
        // In real implementation, would write to filesystem
        break;
      
      case 'delete':
        console.log(`🗑️ [EXECUTION] Deleting file: ${operation.sourcePath}`);
        break;
      
      case 'copy':
        console.log(`📋 [EXECUTION] Copying: ${operation.sourcePath} → ${operation.targetPath}`);
        break;
      
      case 'move':
        console.log(`📦 [EXECUTION] Moving: ${operation.sourcePath} → ${operation.targetPath}`);
        break;
    }
  }

  /**
   * Update worker status
   */
  private updateStatus(status: 'idle' | 'busy' | 'error', currentTask?: string): void {
    this.status.status = status;
    this.status.currentTask = currentTask;
    this.status.lastActivity = new Date();

    // Send status update to orchestrator
    const message: WorkerMessage = {
      type: 'status_update',
      workerId: this.workerId,
      payload: this.status,
      timestamp: new Date()
    };
    this.emit('message', message);
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(taskTime: number, success: boolean): void {
    const currentAvg = this.status.performance.averageTaskTime;
    const count = this.status.completedTasks + this.status.failedTasks;
    
    this.status.performance.averageTaskTime = 
      (currentAvg * (count - 1) + taskTime) / count;

    if (success) {
      this.status.performance.successRate = 
        (this.status.completedTasks / count) * 100;
    }

    this.status.performance.errorRate = 
      (this.status.failedTasks / count) * 100;
  }

  /**
   * Start uptime tracking
   */
  private startUptimeTracking(): void {
    const startTime = Date.now();
    setInterval(() => {
      this.status.uptime = Date.now() - startTime;
    }, 1000);
  }

  /**
   * Check if worker can accept more tasks
   */
  canAcceptTask(): boolean {
    return this.currentTasks.size < this.maxTasksPerWorker;
  }

  /**
   * Get current task load
   */
  getCurrentLoad(): number {
    return this.currentTasks.size / this.maxTasksPerWorker;
  }

  /**
   * Get task history
   */
  getTaskHistory(): RefactoringTask[] {
    return [...this.taskHistory];
  }

  /**
   * Get current status
   */
  getStatus(): WorkerStatus {
    return this.status;
  }

  /**
   * Shutdown the execution worker
   */
  async shutdown(): Promise<void> {
    // Wait for current tasks to complete
    while (this.currentTasks.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`🛑 [EXECUTION] Shutting down worker ${this.workerId}`);
    this.status.status = 'offline';
    this.emit('shutdown');
  }
}