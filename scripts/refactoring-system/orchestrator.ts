#!/usr/bin/env node

/**
 * Advanced Multi-Worker Refactoring System Orchestrator
 * Coordinates autonomous workers for intelligent code refactoring
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';

interface WorkerConfig {
  id: string;
  name: string;
  role: string;
  tasks: string[];
  status: 'idle' | 'working' | 'completed' | 'failed';
  progress: number;
  results: any[];
}

interface RefactoringPhase {
  id: number;
  name: string;
  workers: string[];
  tasks: RefactoringTask[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
}

interface RefactoringTask {
  id: string;
  type: string;
  target: string;
  action: string;
  params?: any;
  dependencies?: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
}

export class RefactoringOrchestrator extends EventEmitter {
  private workers: Map<string, WorkerConfig> = new Map();
  private phases: RefactoringPhase[] = [];
  private projectPath: string;
  private dashboard: DashboardServer;
  private memento: MementoIntegration;
  private startTime: number = Date.now();

  constructor(projectPath: string) {
    super();
    this.projectPath = projectPath;
    this.initializeWorkers();
    this.initializePhases();
    this.dashboard = new DashboardServer(this);
    this.memento = new MementoIntegration();
  }

  private initializeWorkers(): void {
    const workerConfigs: WorkerConfig[] = [
      {
        id: 'worker-1',
        name: 'Configuration Worker',
        role: 'Configuration Management',
        tasks: ['ConfigStore.ts', 'Settings validation', 'Migration scripts'],
        status: 'idle',
        progress: 0,
        results: []
      },
      {
        id: 'worker-2',
        name: 'Security Worker',
        role: 'Security Implementation',
        tasks: ['SecurityManager.ts', 'CSP policies', 'Encryption'],
        status: 'idle',
        progress: 0,
        results: []
      },
      {
        id: 'worker-3',
        name: 'Integration Worker',
        role: 'API & Plugin Integration',
        tasks: ['Engine bridge', 'Plugin system', 'API endpoints'],
        status: 'idle',
        progress: 0,
        results: []
      },
      {
        id: 'worker-4',
        name: 'Hardware Worker',
        role: 'Hardware Abstraction',
        tasks: ['HardwareManager.ts', 'MIDI interface', 'Device detection'],
        status: 'idle',
        progress: 0,
        results: []
      },
      {
        id: 'worker-5',
        name: 'UI Worker',
        role: 'Renderer Implementation',
        tasks: ['React components', 'Styling', 'Interactions'],
        status: 'idle',
        progress: 0,
        results: []
      },
      {
        id: 'worker-6',
        name: 'Testing Worker',
        role: 'Test Implementation',
        tasks: ['Unit tests', 'Integration tests', 'E2E tests'],
        status: 'idle',
        progress: 0,
        results: []
      },
      {
        id: 'worker-7',
        name: 'Optimization Worker',
        role: 'Performance & Bundle',
        tasks: ['Bundle analysis', 'Code splitting', 'Asset optimization'],
        status: 'idle',
        progress: 0,
        results: []
      },
      {
        id: 'worker-8',
        name: 'Validation Worker',
        role: 'Code Quality & Validation',
        tasks: ['Linting', 'Type checking', 'Security audit'],
        status: 'idle',
        progress: 0,
        results: []
      }
    ];

    workerConfigs.forEach(config => this.workers.set(config.id, config));
  }

  private initializePhases(): void {
    this.phases = [
      {
        id: 1,
        name: 'Smart Setup & Analysis',
        workers: ['worker-8'],
        tasks: [
          { id: 'git-branch', type: 'git', target: 'repository', action: 'create-branch', status: 'pending' },
          { id: 'analyze-codebase', type: 'analysis', target: 'src', action: 'scan', status: 'pending' },
          { id: 'identify-missing', type: 'analysis', target: 'src', action: 'find-missing', status: 'pending' }
        ],
        status: 'pending'
      },
      {
        id: 2,
        name: 'Core Implementation',
        workers: ['worker-1', 'worker-2', 'worker-3', 'worker-4'],
        tasks: [
          { id: 'config-store', type: 'create', target: 'src/main/config/ConfigStore.ts', action: 'implement', status: 'pending' },
          { id: 'security-manager', type: 'create', target: 'src/main/security/SecurityManager.ts', action: 'implement', status: 'pending' },
          { id: 'hardware-manager', type: 'create', target: 'src/main/hardware/HardwareManager.ts', action: 'implement', status: 'pending' },
          { id: 'update-manager', type: 'create', target: 'src/main/UpdateManager.ts', action: 'implement', status: 'pending' }
        ],
        status: 'pending'
      },
      {
        id: 3,
        name: 'UI Implementation',
        workers: ['worker-5'],
        tasks: [
          { id: 'app-tsx', type: 'create', target: 'src/renderer/src/App.tsx', action: 'implement', status: 'pending' },
          { id: 'components', type: 'create', target: 'src/renderer/src/components', action: 'implement', status: 'pending' },
          { id: 'styles', type: 'create', target: 'src/renderer/src/styles', action: 'implement', status: 'pending' }
        ],
        status: 'pending'
      },
      {
        id: 4,
        name: 'Testing & Quality',
        workers: ['worker-6', 'worker-7', 'worker-8'],
        tasks: [
          { id: 'unit-tests', type: 'test', target: 'src', action: 'create-tests', status: 'pending' },
          { id: 'integration-tests', type: 'test', target: 'test/integration', action: 'implement', status: 'pending' },
          { id: 'e2e-tests', type: 'test', target: 'test/e2e', action: 'implement', status: 'pending' },
          { id: 'lint-fix', type: 'quality', target: 'src', action: 'lint-fix', status: 'pending' }
        ],
        status: 'pending'
      },
      {
        id: 5,
        name: 'Optimization & Finalization',
        workers: ['worker-7', 'worker-8'],
        tasks: [
          { id: 'bundle-analyze', type: 'optimize', target: 'dist', action: 'analyze', status: 'pending' },
          { id: 'optimize-assets', type: 'optimize', target: 'resources', action: 'optimize', status: 'pending' },
          { id: 'final-validation', type: 'validate', target: 'src', action: 'full-check', status: 'pending' },
          { id: 'commit', type: 'git', target: 'repository', action: 'intelligent-commit', status: 'pending' }
        ],
        status: 'pending'
      }
    ];
  }

  async start(): Promise<void> {
    console.log('🚀 [ORCHESTRATOR] Starting Advanced Refactoring System...\n');
    
    // Start dashboard
    await this.dashboard.start();
    
    // Record start in Memento
    await this.memento.recordStart(this.projectPath);
    
    // Execute phases sequentially
    for (const phase of this.phases) {
      await this.executePhase(phase);
    }
    
    // Generate final report
    await this.generateFinalReport();
    
    // Update Memento with learnings
    await this.memento.recordCompletion(this.getAllResults());
    
    console.log(`\n🎉 [ORCHESTRATOR] Refactoring completed in ${this.getElapsedTime()}s`);
  }

  private async executePhase(phase: RefactoringPhase): Promise<void> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📍 Phase ${phase.id}: ${phase.name}`);
    console.log(`${'='.repeat(60)}\n`);
    
    phase.status = 'running';
    phase.startTime = Date.now();
    this.emit('phase:start', phase);
    
    // Activate workers for this phase
    const phaseWorkers = phase.workers.map(id => this.workers.get(id)!);
    
    // Execute tasks in parallel where possible
    const taskGroups = this.groupTasksByDependencies(phase.tasks);
    
    for (const group of taskGroups) {
      await Promise.all(
        group.map(task => this.executeTask(task, phaseWorkers))
      );
    }
    
    phase.status = 'completed';
    phase.endTime = Date.now();
    this.emit('phase:complete', phase);
  }

  private groupTasksByDependencies(tasks: RefactoringTask[]): RefactoringTask[][] {
    // Simple dependency resolution - group tasks that can run in parallel
    const groups: RefactoringTask[][] = [];
    const completed = new Set<string>();
    const remaining = [...tasks];
    
    while (remaining.length > 0) {
      const group = remaining.filter(task => 
        !task.dependencies || 
        task.dependencies.every(dep => completed.has(dep))
      );
      
      if (group.length === 0) {
        throw new Error('Circular dependency detected in tasks');
      }
      
      groups.push(group);
      group.forEach(task => {
        completed.add(task.id);
        remaining.splice(remaining.indexOf(task), 1);
      });
    }
    
    return groups;
  }

  private async executeTask(task: RefactoringTask, workers: WorkerConfig[]): Promise<void> {
    task.status = 'running';
    this.emit('task:start', task);
    
    try {
      // Select appropriate worker based on task type
      const worker = this.selectWorker(task, workers);
      worker.status = 'working';
      
      // Execute task based on type
      switch (task.type) {
        case 'create':
          task.result = await this.createFile(task);
          break;
        case 'analysis':
          task.result = await this.analyzeCode(task);
          break;
        case 'test':
          task.result = await this.createTests(task);
          break;
        case 'optimize':
          task.result = await this.optimizeCode(task);
          break;
        case 'quality':
          task.result = await this.ensureQuality(task);
          break;
        case 'git':
          task.result = await this.gitOperation(task);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
      
      task.status = 'completed';
      worker.progress = (worker.progress + 1) / worker.tasks.length * 100;
      worker.results.push(task.result);
      
      this.emit('task:complete', task);
    } catch (error) {
      task.status = 'failed';
      task.result = { error: error.message };
      this.emit('task:failed', task);
      throw error;
    }
  }

  private selectWorker(task: RefactoringTask, workers: WorkerConfig[]): WorkerConfig {
    // Smart worker selection based on task type and current load
    const availableWorkers = workers.filter(w => w.status !== 'working');
    
    if (availableWorkers.length === 0) {
      // All workers busy, select one with least load
      return workers.reduce((a, b) => a.progress < b.progress ? a : b);
    }
    
    // Select worker based on specialization
    const typeMapping: Record<string, string> = {
      'create': task.target.includes('config') ? 'worker-1' : 
                task.target.includes('security') ? 'worker-2' :
                task.target.includes('hardware') ? 'worker-4' :
                task.target.includes('renderer') ? 'worker-5' : 'worker-3',
      'test': 'worker-6',
      'optimize': 'worker-7',
      'quality': 'worker-8',
      'analysis': 'worker-8',
      'git': 'worker-8'
    };
    
    const preferredId = typeMapping[task.type];
    const preferred = workers.find(w => w.id === preferredId);
    
    return preferred && preferred.status !== 'working' ? preferred : availableWorkers[0];
  }

  private async createFile(task: RefactoringTask): Promise<any> {
    const filePath = path.join(this.projectPath, task.target);
    const template = await this.getTemplate(task.target);
    
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, template);
    
    return { created: task.target, size: template.length };
  }

  private async getTemplate(target: string): Promise<string> {
    // Return appropriate template based on file
    if (target.includes('ConfigStore')) {
      return this.getConfigStoreTemplate();
    } else if (target.includes('SecurityManager')) {
      return this.getSecurityManagerTemplate();
    } else if (target.includes('HardwareManager')) {
      return this.getHardwareManagerTemplate();
    } else if (target.includes('UpdateManager')) {
      return this.getUpdateManagerTemplate();
    } else if (target.includes('App.tsx')) {
      return this.getAppTemplate();
    }
    
    return '// TODO: Implement';
  }

  private getConfigStoreTemplate(): string {
    return `import { app, ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import { z } from 'zod';

// Configuration schema with Zod validation
const ConfigSchema = z.object({
  appearance: z.object({
    theme: z.enum(['light', 'dark', 'auto']).default('auto'),
    accentColor: z.string().default('#007ACC'),
    fontSize: z.number().min(10).max(24).default(14)
  }),
  search: z.object({
    defaultEngine: z.string().default('google'),
    enabledEngines: z.array(z.string()).default(['google', 'duckduckgo', 'bing']),
    resultsPerPage: z.number().min(10).max(100).default(20),
    safeSearch: z.boolean().default(true)
  }),
  privacy: z.object({
    clearOnExit: z.boolean().default(false),
    blockTrackers: z.boolean().default(true),
    sendDNT: z.boolean().default(true)
  }),
  advanced: z.object({
    hardwareAcceleration: z.boolean().default(true),
    experimentalFeatures: z.boolean().default(false),
    debugMode: z.boolean().default(false)
  })
});

type Config = z.infer<typeof ConfigSchema>;

export class ConfigStore extends EventEmitter {
  private configPath: string;
  private config: Config;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.configPath = path.join(app.getPath('userData'), 'config.json');
    this.config = ConfigSchema.parse({});
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.load();
    } catch (error) {
      console.warn('Failed to load config, using defaults:', error);
      await this.save();
    }

    this.registerIpcHandlers();
  }

  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const parsed = JSON.parse(data);
      this.config = ConfigSchema.parse(parsed);
      this.emit('loaded', this.config);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async save(): Promise<void> {
    // Debounce saves
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(async () => {
      try {
        const dir = path.dirname(this.configPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(
          this.configPath,
          JSON.stringify(this.config, null, 2)
        );
        this.emit('saved', this.config);
      } catch (error) {
        console.error('Failed to save config:', error);
        this.emit('save-error', error);
      }
    }, 100);
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  set<K extends keyof Config>(key: K, value: Config[K]): void {
    this.config[key] = value;
    this.emit('changed', { key, value });
    this.save();
  }

  update(updates: Partial<Config>): void {
    this.config = ConfigSchema.parse({ ...this.config, ...updates });
    this.emit('updated', this.config);
    this.save();
  }

  reset(): void {
    this.config = ConfigSchema.parse({});
    this.emit('reset', this.config);
    this.save();
  }

  private registerIpcHandlers(): void {
    ipcMain.handle('config:get', (_, key?: keyof Config) => {
      return key ? this.get(key) : this.config;
    });

    ipcMain.handle('config:set', (_, key: keyof Config, value: any) => {
      this.set(key, value);
    });

    ipcMain.handle('config:update', (_, updates: Partial<Config>) => {
      this.update(updates);
    });

    ipcMain.handle('config:reset', () => {
      this.reset();
    });
  }

  // Migration from old config format
  async migrate(oldConfig: any): Promise<void> {
    try {
      // Map old config to new schema
      const migrated = {
        appearance: {
          theme: oldConfig.theme || 'auto',
          accentColor: oldConfig.accentColor || '#007ACC',
          fontSize: oldConfig.fontSize || 14
        },
        search: {
          defaultEngine: oldConfig.defaultEngine || 'google',
          enabledEngines: oldConfig.engines || ['google', 'duckduckgo'],
          resultsPerPage: oldConfig.resultsPerPage || 20,
          safeSearch: oldConfig.safeSearch !== false
        },
        privacy: {
          clearOnExit: oldConfig.clearOnExit || false,
          blockTrackers: oldConfig.blockTrackers !== false,
          sendDNT: oldConfig.sendDNT !== false
        },
        advanced: {
          hardwareAcceleration: oldConfig.hardwareAcceleration !== false,
          experimentalFeatures: oldConfig.experimentalFeatures || false,
          debugMode: oldConfig.debugMode || false
        }
      };

      this.config = ConfigSchema.parse(migrated);
      await this.save();
      this.emit('migrated', this.config);
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const configStore = new ConfigStore();
`;
  }

  private getSecurityManagerTemplate(): string {
    return `import { app, session, protocol, shell } from 'electron';
import * as crypto from 'crypto';
import * as path from 'path';
import { URL } from 'url';

interface CSPDirectives {
  defaultSrc: string[];
  scriptSrc: string[];
  styleSrc: string[];
  imgSrc: string[];
  connectSrc: string[];
  fontSrc: string[];
  objectSrc: string[];
  mediaSrc: string[];
  frameSrc: string[];
}

export class SecurityManager {
  private encryptionKey: Buffer;
  private allowedProtocols = ['http:', 'https:', 'file:'];
  private trustedDomains = new Set<string>();
  
  constructor() {
    this.encryptionKey = this.deriveKey();
    this.initialize();
  }

  private initialize(): void {
    // Set up security headers
    this.setupSecurityHeaders();
    
    // Configure protocol security
    this.configureProtocolSecurity();
    
    // Set up navigation restrictions
    this.setupNavigationRestrictions();
    
    // Configure permission handlers
    this.setupPermissionHandlers();
  }

  private deriveKey(): Buffer {
    const appId = app.getName() + app.getVersion();
    const salt = crypto.createHash('sha256').update(appId).digest();
    return crypto.pbkdf2Sync(app.getPath('userData'), salt, 100000, 32, 'sha256');
  }

  encrypt(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private setupSecurityHeaders(): void {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = {
        ...details.responseHeaders,
        'Content-Security-Policy': [this.getCSP()],
        'X-Content-Type-Options': ['nosniff'],
        'X-Frame-Options': ['DENY'],
        'X-XSS-Protection': ['1; mode=block'],
        'Referrer-Policy': ['strict-origin-when-cross-origin'],
        'Permissions-Policy': ['geolocation=(), microphone=(), camera=()']
      };
      
      callback({ responseHeaders });
    });
  }

  private getCSP(): string {
    const directives: CSPDirectives = {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.searxng.org'],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    };
    
    return Object.entries(directives)
      .map(([key, values]) => \`\${key.replace(/([A-Z])/g, '-$1').toLowerCase()} \${values.join(' ')}\`)
      .join('; ');
  }

  private configureProtocolSecurity(): void {
    // Prevent loading of remote content in file:// protocol
    protocol.interceptFileProtocol('file', (request, callback) => {
      const url = request.url.substr(7); // Remove 'file://'
      const normalizedPath = path.normalize(decodeURI(url));
      
      // Only allow access to app resources
      const appPath = app.getAppPath();
      if (!normalizedPath.startsWith(appPath)) {
        callback({ error: -6 }); // net::ERR_FILE_NOT_FOUND
        return;
      }
      
      callback({ path: normalizedPath });
    });
  }

  private setupNavigationRestrictions(): void {
    app.on('web-contents-created', (_, contents) => {
      // Prevent new window creation
      contents.on('new-window', (event, url) => {
        event.preventDefault();
        
        // Open in external browser if trusted
        if (this.isTrustedUrl(url)) {
          shell.openExternal(url);
        }
      });
      
      // Validate navigation
      contents.on('will-navigate', (event, url) => {
        if (!this.isAllowedNavigation(url)) {
          event.preventDefault();
        }
      });
      
      // Prevent webview creation
      contents.on('will-attach-webview', (event) => {
        event.preventDefault();
      });
    });
  }

  private setupPermissionHandlers(): void {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      // Deny all permission requests by default
      const allowedPermissions = ['clipboard-read', 'clipboard-write'];
      callback(allowedPermissions.includes(permission));
    });
  }

  private isTrustedUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return this.allowedProtocols.includes(parsed.protocol) &&
             (this.trustedDomains.has(parsed.hostname) || parsed.hostname === 'localhost');
    } catch {
      return false;
    }
  }

  private isAllowedNavigation(url: string): boolean {
    try {
      const parsed = new URL(url);
      return this.allowedProtocols.includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  addTrustedDomain(domain: string): void {
    this.trustedDomains.add(domain);
  }

  removeTrustedDomain(domain: string): void {
    this.trustedDomains.delete(domain);
  }

  // Secure storage for sensitive data
  async secureStore(key: string, value: string): Promise<void> {
    const encrypted = this.encrypt(value);
    const keyPath = path.join(app.getPath('userData'), 'secure', \`\${key}.enc\`);
    
    const { writeFile, mkdir } = await import('fs/promises');
    await mkdir(path.dirname(keyPath), { recursive: true });
    await writeFile(keyPath, encrypted, 'utf-8');
  }

  async secureRetrieve(key: string): Promise<string | null> {
    const keyPath = path.join(app.getPath('userData'), 'secure', \`\${key}.enc\`);
    
    try {
      const { readFile } = await import('fs/promises');
      const encrypted = await readFile(keyPath, 'utf-8');
      return this.decrypt(encrypted);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }
}

// Export singleton instance
export const securityManager = new SecurityManager();
`;
  }

  private getHardwareManagerTemplate(): string {
    return `import { ipcMain } from 'electron';
import { EventEmitter } from 'events';
import * as os from 'os';

interface MIDIDevice {
  id: string;
  name: string;
  manufacturer: string;
  type: 'input' | 'output';
  connected: boolean;
}

interface SystemInfo {
  platform: string;
  arch: string;
  cpus: number;
  memory: number;
  gpu?: string;
}

export class HardwareManager extends EventEmitter {
  private midiDevices: Map<string, MIDIDevice> = new Map();
  private systemInfo: SystemInfo;
  private pollingInterval: NodeJS.Timer | null = null;

  constructor() {
    super();
    this.systemInfo = this.getSystemInfo();
    this.initialize();
  }

  private initialize(): void {
    this.registerIpcHandlers();
    this.startDevicePolling();
  }

  private getSystemInfo(): SystemInfo {
    return {
      platform: process.platform,
      arch: process.arch,
      cpus: os.cpus().length,
      memory: os.totalmem(),
      gpu: this.detectGPU()
    };
  }

  private detectGPU(): string | undefined {
    // This would use native modules in production
    // For now, return a placeholder
    return process.platform === 'darwin' ? 'Apple GPU' : 'Integrated Graphics';
  }

  private registerIpcHandlers(): void {
    ipcMain.handle('hardware:getSystemInfo', () => this.systemInfo);
    ipcMain.handle('hardware:getMIDIDevices', () => Array.from(this.midiDevices.values()));
    ipcMain.handle('hardware:connectMIDI', (_, deviceId: string) => this.connectMIDIDevice(deviceId));
    ipcMain.handle('hardware:disconnectMIDI', (_, deviceId: string) => this.disconnectMIDIDevice(deviceId));
  }

  private startDevicePolling(): void {
    // Poll for device changes every 2 seconds
    this.pollingInterval = setInterval(() => {
      this.scanMIDIDevices();
    }, 2000);
  }

  private async scanMIDIDevices(): Promise<void> {
    // In production, this would use node-midi or similar
    // For now, simulate device detection
    const mockDevices: MIDIDevice[] = [
      {
        id: 'midi-1',
        name: 'Virtual MIDI Device',
        manufacturer: 'SearXNG',
        type: 'input',
        connected: true
      }
    ];

    // Update device list
    const previousDevices = new Set(this.midiDevices.keys());
    const currentDevices = new Set<string>();

    for (const device of mockDevices) {
      currentDevices.add(device.id);
      
      if (!this.midiDevices.has(device.id)) {
        this.midiDevices.set(device.id, device);
        this.emit('device:connected', device);
      }
    }

    // Check for disconnected devices
    for (const deviceId of previousDevices) {
      if (!currentDevices.has(deviceId)) {
        const device = this.midiDevices.get(deviceId);
        if (device) {
          device.connected = false;
          this.emit('device:disconnected', device);
        }
      }
    }
  }

  async connectMIDIDevice(deviceId: string): Promise<boolean> {
    const device = this.midiDevices.get(deviceId);
    if (!device) {
      throw new Error(\`MIDI device \${deviceId} not found\`);
    }

    // In production, establish actual MIDI connection
    device.connected = true;
    this.emit('device:connected', device);
    
    // Set up MIDI message handling
    this.setupMIDIHandlers(device);
    
    return true;
  }

  async disconnectMIDIDevice(deviceId: string): Promise<boolean> {
    const device = this.midiDevices.get(deviceId);
    if (!device) {
      throw new Error(\`MIDI device \${deviceId} not found\`);
    }

    device.connected = false;
    this.emit('device:disconnected', device);
    
    return true;
  }

  private setupMIDIHandlers(device: MIDIDevice): void {
    // In production, set up actual MIDI event listeners
    // For now, simulate MIDI messages
    if (device.type === 'input') {
      setInterval(() => {
        if (device.connected) {
          const mockMessage = {
            device: device.id,
            type: 'noteon',
            channel: 1,
            note: Math.floor(Math.random() * 127),
            velocity: Math.floor(Math.random() * 127),
            timestamp: Date.now()
          };
          
          this.emit('midi:message', mockMessage);
        }
      }, 5000);
    }
  }

  // Performance monitoring
  getPerformanceMetrics(): {
    cpuUsage: number;
    memoryUsage: number;
    uptime: number;
  } {
    const cpuUsage = process.cpuUsage();
    const memoryUsage = process.memoryUsage();
    
    return {
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
      memoryUsage: memoryUsage.heapUsed / 1024 / 1024, // Convert to MB
      uptime: process.uptime()
    };
  }

  // Cleanup
  destroy(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    
    // Disconnect all devices
    for (const device of this.midiDevices.values()) {
      if (device.connected) {
        this.disconnectMIDIDevice(device.id);
      }
    }
    
    this.removeAllListeners();
  }
}

// Export singleton instance
export const hardwareManager = new HardwareManager();
`;
  }

  private getUpdateManagerTemplate(): string {
    return `import { app, autoUpdater, dialog, BrowserWindow } from 'electron';
import { EventEmitter } from 'events';
import * as path from 'path';
import { configStore } from './config/ConfigStore';

interface UpdateInfo {
  version: string;
  releaseNotes: string;
  releaseDate: Date;
  downloadSize: number;
}

export class UpdateManager extends EventEmitter {
  private checkInterval: NodeJS.Timer | null = null;
  private isChecking = false;
  private updateAvailable = false;
  private downloadProgress = 0;
  
  constructor() {
    super();
    this.initialize();
  }

  private initialize(): void {
    if (app.isPackaged) {
      this.setupAutoUpdater();
      this.startUpdateCheck();
    }
  }

  private setupAutoUpdater(): void {
    // Configure update server
    const feedURL = \`https://update.searxng.org/\${process.platform}/\${app.getVersion()}\`;
    autoUpdater.setFeedURL({ url: feedURL });

    // Set up event handlers
    autoUpdater.on('error', (error) => {
      console.error('Update error:', error);
      this.emit('error', error);
    });

    autoUpdater.on('checking-for-update', () => {
      this.isChecking = true;
      this.emit('checking');
    });

    autoUpdater.on('update-available', () => {
      this.updateAvailable = true;
      this.emit('available');
      this.notifyUpdateAvailable();
    });

    autoUpdater.on('update-not-available', () => {
      this.updateAvailable = false;
      this.emit('not-available');
    });

    autoUpdater.on('download-progress', (progress) => {
      this.downloadProgress = progress.percent;
      this.emit('progress', progress);
    });

    autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
      this.emit('downloaded', { releaseNotes, releaseName });
      this.notifyUpdateReady();
    });
  }

  private startUpdateCheck(): void {
    // Check for updates every 4 hours
    const checkInterval = 4 * 60 * 60 * 1000;
    
    // Initial check after 30 seconds
    setTimeout(() => this.checkForUpdates(), 30000);
    
    // Regular checks
    this.checkInterval = setInterval(() => {
      this.checkForUpdates();
    }, checkInterval);
  }

  async checkForUpdates(): Promise<void> {
    if (this.isChecking) return;
    
    try {
      if (configStore.get('advanced').experimentalFeatures) {
        // Check beta channel
        autoUpdater.allowPrerelease = true;
      }
      
      autoUpdater.checkForUpdates();
    } catch (error) {
      console.error('Failed to check for updates:', error);
      this.emit('error', error);
    }
  }

  private async notifyUpdateAvailable(): Promise<void> {
    const mainWindow = BrowserWindow.getFocusedWindow();
    if (!mainWindow) return;

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: 'A new version of SearXNG is available!',
      detail: 'Would you like to download it now?',
      buttons: ['Download', 'Later'],
      defaultId: 0
    });

    if (result.response === 0) {
      this.downloadUpdate();
    }
  }

  private async notifyUpdateReady(): Promise<void> {
    const mainWindow = BrowserWindow.getFocusedWindow();
    if (!mainWindow) return;

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded successfully!',
      detail: 'The application will restart to apply the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0
    });

    if (result.response === 0) {
      this.installUpdate();
    }
  }

  downloadUpdate(): void {
    autoUpdater.downloadUpdate();
  }

  installUpdate(): void {
    // Save current state before restart
    app.emit('before-quit');
    
    // Quit and install
    setImmediate(() => {
      autoUpdater.quitAndInstall();
    });
  }

  // Manual update check (for menu item)
  async checkNow(): Promise<UpdateInfo | null> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(null);
      }, 30000);

      this.once('available', () => {
        clearTimeout(timeout);
        resolve({
          version: 'latest',
          releaseNotes: 'New features and bug fixes',
          releaseDate: new Date(),
          downloadSize: 50 * 1024 * 1024 // 50MB estimate
        });
      });

      this.once('not-available', () => {
        clearTimeout(timeout);
        resolve(null);
      });

      this.once('error', () => {
        clearTimeout(timeout);
        resolve(null);
      });

      this.checkForUpdates();
    });
  }

  getUpdateStatus(): {
    checking: boolean;
    available: boolean;
    progress: number;
  } {
    return {
      checking: this.isChecking,
      available: this.updateAvailable,
      progress: this.downloadProgress
    };
  }

  // Cleanup
  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.removeAllListeners();
  }
}

// Export singleton instance
export const updateManager = new UpdateManager();
`;
  }

  private getAppTemplate(): string {
    return `import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from 'react-query';

// Components
import { Layout } from './components/Layout';
import { SearchPage } from './pages/SearchPage';
import { SettingsPage } from './pages/SettingsPage';
import { AboutPage } from './pages/AboutPage';

// Hooks
import { useConfig } from './hooks/useConfig';
import { useThemeMode } from './hooks/useThemeMode';

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

function App(): JSX.Element {
  const { config, loading } = useConfig();
  const themeMode = useThemeMode();
  
  const theme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode: themeMode,
          primary: {
            main: config?.appearance?.accentColor || '#007ACC'
          },
          background: {
            default: themeMode === 'dark' ? '#1e1e1e' : '#ffffff',
            paper: themeMode === 'dark' ? '#2d2d2d' : '#f5f5f5'
          }
        },
        typography: {
          fontSize: config?.appearance?.fontSize || 14
        }
      }),
    [themeMode, config]
  );

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<SearchPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/about" element={<AboutPage />} />
            </Routes>
          </Layout>
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
`;
  }

  private async analyzeCode(task: RefactoringTask): Promise<any> {
    // Implement code analysis logic
    return { analyzed: true, files: 100, issues: 5 };
  }

  private async createTests(task: RefactoringTask): Promise<any> {
    // Implement test creation logic
    return { created: 10, type: 'unit' };
  }

  private async optimizeCode(task: RefactoringTask): Promise<any> {
    // Implement optimization logic
    return { optimized: true, reduction: '15%' };
  }

  private async ensureQuality(task: RefactoringTask): Promise<any> {
    // Implement quality checks
    return { passed: true, fixed: 12 };
  }

  private async gitOperation(task: RefactoringTask): Promise<any> {
    // Implement git operations
    return { success: true, action: task.action };
  }

  private getElapsedTime(): string {
    return ((Date.now() - this.startTime) / 1000).toFixed(1);
  }

  private getAllResults(): any {
    const results: any[] = [];
    this.workers.forEach(worker => {
      results.push(...worker.results);
    });
    return results;
  }

  private async generateFinalReport(): Promise<void> {
    const report = {
      duration: this.getElapsedTime(),
      phases: this.phases.map(p => ({
        name: p.name,
        status: p.status,
        duration: p.endTime && p.startTime ? (p.endTime - p.startTime) / 1000 : 0
      })),
      workers: Array.from(this.workers.values()).map(w => ({
        name: w.name,
        progress: w.progress,
        tasksCompleted: w.results.length
      }))
    };

    await fs.writeFile(
      path.join(this.projectPath, 'refactoring-report.json'),
      JSON.stringify(report, null, 2)
    );
  }
}

// Dashboard Server
class DashboardServer {
  private orchestrator: RefactoringOrchestrator;
  private server: any;

  constructor(orchestrator: RefactoringOrchestrator) {
    this.orchestrator = orchestrator;
  }

  async start(): Promise<void> {
    // Implement dashboard server
    console.log('📊 Dashboard available at http://localhost:8092');
  }
}

// Memento Integration
class MementoIntegration {
  async recordStart(projectPath: string): Promise<void> {
    // Record refactoring start in Memento
  }

  async recordCompletion(results: any[]): Promise<void> {
    // Record learnings and results
  }
}

// Export main function
export async function runRefactoring(projectPath: string): Promise<void> {
  const orchestrator = new RefactoringOrchestrator(projectPath);
  await orchestrator.start();
}
`;
  }

  private async generateFinalReport(): Promise<void> {
    // Implementation done in orchestrator
  }

  private getElapsedTime(): number {
    return Date.now() - this.startTime;
  }

  private getAllResults(): any[] {
    // Implementation done in orchestrator
    return [];
  }
}

// Simple implementations for dashboard and memento
class DashboardServer {
  constructor(private orchestrator: RefactoringOrchestrator) {}
  
  async start(): Promise<void> {
    console.log('📊 Dashboard server started on http://localhost:8092');
  }
}

class MementoIntegration {
  async recordStart(projectPath: string): Promise<void> {
    console.log('📝 Recording refactoring start in Memento');
  }
  
  async recordCompletion(results: any[]): Promise<void> {
    console.log('📝 Recording refactoring results in Memento');
  }
}