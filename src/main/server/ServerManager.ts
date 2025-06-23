import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import log from 'electron-log';
import { app } from 'electron';
import axios from 'axios';
import { ConfigStore } from '../config/ConfigStore';
import { ServerConfig, ServerStatus } from '../../shared/types';
import { asyncExecute, asyncWrap } from '../utils/AsyncErrorHandler';

export class ServerManager {
  private serverProcess: ChildProcess | null = null;
  private serverUrl: string = '';
  private mode: 'bundled' | 'external' | 'hybrid' = 'bundled';
  private isRunning = false;
  private config: ServerConfig | null = null;

  constructor(private configStore: ConfigStore) {}

  async initialize(): Promise<void> {
    const result = await asyncExecute({
      name: 'ServerManager.initialize',
      operation: async () => {
        this.config = await this.configStore.get<ServerConfig>('server') || {
          mode: 'bundled',
          port: 8888,
          host: 'localhost',
          enableMetrics: false,
          customEngines: []
        };

        this.mode = this.config.mode || 'bundled';
        
        if (this.mode === 'external' && this.config.externalUrl) {
          this.serverUrl = this.config.externalUrl;
          this.isRunning = await this.checkServerHealth(this.serverUrl);
        }

        log.info(`ServerManager initialized in ${this.mode} mode`);
      },
      retries: 2,
      severity: 'high',
      context: { component: 'ServerManager' }
    });

    if (!result.success) {
      throw result.error;
    }
  }

  async start(): Promise<void> {
    if (this.mode === 'external') {
      log.info('Using external server, skipping local server start');
      return;
    }

    const result = await asyncExecute({
      name: 'ServerManager.start',
      operation: async () => {
        if (this.isRunning) {
          log.warn('Server is already running');
          return;
        }

        const searxngPath = await this.findSearXNGInstallation();
        if (!searxngPath) {
          throw new Error('SearXNG installation not found');
        }

        // Start the server process
        await this.startServerProcess(searxngPath);
        
        // Wait for server to be ready
        await this.waitForServerReady();
        
        this.isRunning = true;
        log.info(`SearXNG server started successfully at ${this.serverUrl}`);
      },
      timeout: 60000, // 1 minute to start server
      retries: 2,
      retryDelay: 2000,
      fallback: async () => {
        // Fallback to external server if available
        if (this.config?.externalUrl) {
          log.info('Falling back to external server');
          this.mode = 'external';
          this.serverUrl = this.config.externalUrl;
          this.isRunning = await this.checkServerHealth(this.serverUrl);
          if (!this.isRunning) {
            throw new Error('External server is not available');
          }
        } else {
          throw new Error('No fallback server available');
        }
      },
      severity: 'high',
      context: { component: 'ServerManager', action: 'start' }
    });

    if (!result.success) {
      throw result.error;
    }
  }

  async stop(): Promise<void> {
    if (this.mode === 'external') {
      log.info('Using external server, nothing to stop');
      return;
    }

    const result = await asyncExecute({
      name: 'ServerManager.stop',
      operation: async () => {
        if (!this.isRunning || !this.serverProcess) {
          log.warn('Server is not running');
          return;
        }

        // Kill the server process
        await this.killServerProcess();
        
        this.isRunning = false;
        this.serverUrl = '';
        
        log.info('SearXNG server stopped successfully');
      },
      timeout: 10000,
      retries: 2,
      severity: 'medium',
      context: { component: 'ServerManager', action: 'stop' }
    });

    if (!result.success) {
      throw result.error;
    }
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  getStatus(): ServerStatus {
    return {
      running: this.isRunning,
      url: this.serverUrl,
      mode: this.mode,
      pid: this.serverProcess?.pid,
      version: this.config?.version
    };
  }

  private async findSearXNGInstallation(): Promise<string | null> {
    const possiblePaths = [
      path.join(app.getPath('userData'), 'searxng'),
      path.join(process.resourcesPath, 'searxng'),
      path.join(__dirname, '../../searxng'),
      '/usr/local/searxng',
      '/opt/searxng'
    ];

    for (const searxngPath of possiblePaths) {
      try {
        await fs.access(searxngPath);
        const mainPy = path.join(searxngPath, 'searx', 'webapp.py');
        await fs.access(mainPy);
        return searxngPath;
      } catch {
        // Path doesn't exist, try next
      }
    }

    return null;
  }

  private async startServerProcess(searxngPath: string): Promise<void> {
    const port = this.config?.port || 8888;
    const host = this.config?.host || 'localhost';
    
    const env = {
      ...process.env,
      SEARXNG_SETTINGS_PATH: path.join(searxngPath, 'settings.yml'),
      SEARXNG_PORT: String(port),
      SEARXNG_BIND_ADDRESS: host
    };

    // Prepare command based on platform
    const isWindows = process.platform === 'win32';
    const pythonCmd = isWindows ? 'python' : 'python3';
    const args = [
      '-m',
      'searx.webapp',
      '--port', String(port),
      '--host', host
    ];

    log.info(`Starting SearXNG with command: ${pythonCmd} ${args.join(' ')}`);

    this.serverProcess = spawn(pythonCmd, args, {
      cwd: searxngPath,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.serverUrl = `http://${host}:${port}`;

    // Handle process output
    if (this.serverProcess.stdout) {
      this.serverProcess.stdout.on('data', (data) => {
        log.debug(`SearXNG stdout: ${data}`);
      });
    }

    if (this.serverProcess.stderr) {
      this.serverProcess.stderr.on('data', (data) => {
        log.error(`SearXNG stderr: ${data}`);
      });
    }

    this.serverProcess.on('error', (error) => {
      log.error('SearXNG process error:', error);
      this.isRunning = false;
    });

    this.serverProcess.on('exit', (code, signal) => {
      log.info(`SearXNG process exited with code ${code} and signal ${signal}`);
      this.isRunning = false;
      this.serverProcess = null;
    });
  }

  private async waitForServerReady(): Promise<void> {
    const maxAttempts = 30;
    const delay = 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const healthy = await this.checkServerHealth(this.serverUrl);
      if (healthy) {
        return;
      }

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Server failed to start within timeout');
  }

  private checkServerHealth = asyncWrap(
    async (url: string): Promise<boolean> => {
      try {
        const response = await axios.get(`${url}/healthz`, {
          timeout: 5000,
          validateStatus: () => true
        });
        return response.status === 200;
      } catch {
        return false;
      }
    },
    {
      name: 'ServerManager.checkServerHealth',
      retries: 1,
      timeout: 5000,
      severity: 'low'
    }
  );

  private async killServerProcess(): Promise<void> {
    if (!this.serverProcess) {
      return;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.serverProcess) {
          this.serverProcess.kill('SIGKILL');
        }
        resolve();
      }, 5000);

      this.serverProcess!.once('exit', () => {
        clearTimeout(timeout);
        this.serverProcess = null;
        resolve();
      });

      // Try graceful shutdown first
      this.serverProcess!.kill('SIGTERM');
    });
  }

  async updateConfig(config: Partial<ServerConfig>): Promise<void> {
    const result = await asyncExecute({
      name: 'ServerManager.updateConfig',
      operation: async () => {
        this.config = { ...this.config, ...config } as ServerConfig;
        await this.configStore.set('server', this.config);
        
        // If server is running and config changed significantly, restart
        if (this.isRunning && (config.port || config.host)) {
          await this.restart();
        }
      },
      severity: 'medium',
      context: { component: 'ServerManager', action: 'updateConfig', config }
    });

    if (!result.success) {
      throw result.error;
    }
  }
}