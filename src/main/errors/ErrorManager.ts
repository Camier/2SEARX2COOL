import { app, dialog, BrowserWindow, crashReporter, session } from 'electron';
import log from 'electron-log';
import * as path from 'path';
import * as fs from 'fs/promises';
import { EventEmitter } from 'events';
import { recoveryManager } from './RecoveryManager';
import { errorReporter } from './ErrorReporter';

export interface ErrorInfo {
  id: string;
  timestamp: number;
  error: Error;
  context?: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: 'main' | 'renderer' | 'plugin' | 'server' | 'unknown';
  handled: boolean;
  userId?: string;
  sessionId: string;
  systemInfo?: {
    platform: string;
    version: string;
    memory: NodeJS.MemoryUsage;
    uptime: number;
  };
}

export interface ErrorReport {
  errors: ErrorInfo[];
  summary: {
    total: number;
    bySeverity: Record<string, number>;
    bySource: Record<string, number>;
    timeRange: {
      start: number;
      end: number;
    };
  };
}

export class ErrorManager extends EventEmitter {
  private errors: Map<string, ErrorInfo> = new Map();
  private sessionId: string;
  private maxErrors = 1000;
  private errorLogPath: string;
  private isInitialized = false;

  constructor() {
    super();
    this.sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    this.errorLogPath = path.join(app.getPath('userData'), 'logs', 'errors');
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Create error log directory
    await fs.mkdir(this.errorLogPath, { recursive: true });

    // Initialize recovery manager
    await recoveryManager.initialize();

    // Initialize error reporter
    await errorReporter.initialize();

    // Setup crash reporter
    crashReporter.start({
      submitURL: '', // Set to your crash report server if available
      uploadToServer: false,
      ignoreSystemCrashHandler: true,
      compress: true,
      extra: {
        sessionId: this.sessionId,
        version: app.getVersion()
      }
    });

    // Setup global error handlers
    this.setupGlobalHandlers();

    // Load previous session errors if any
    await this.loadPreviousErrors();

    this.isInitialized = true;
    log.info('ErrorManager initialized');
  }

  private setupGlobalHandlers(): void {
    // Handle uncaught exceptions in main process
    process.on('uncaughtException', (error: Error) => {
      this.handleError({
        error,
        severity: 'critical',
        source: 'main',
        handled: false,
        context: { type: 'uncaughtException' }
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.handleError({
        error,
        severity: 'high',
        source: 'main',
        handled: false,
        context: { type: 'unhandledRejection', promise }
      });
    });

    // Handle app errors
    app.on('render-process-gone', (event, webContents, details) => {
      this.handleError({
        error: new Error(`Renderer process gone: ${details.reason}`),
        severity: 'critical',
        source: 'renderer',
        handled: false,
        context: { details, webContentsId: webContents.id }
      });
    });

    app.on('child-process-gone', (event, details) => {
      this.handleError({
        error: new Error(`Child process gone: ${details.type}`),
        severity: 'high',
        source: 'main',
        handled: false,
        context: details
      });
    });
  }

  // Recovery strategies are now handled by RecoveryManager

  async handleError(options: {
    error: Error;
    severity: ErrorInfo['severity'];
    source: ErrorInfo['source'];
    handled: boolean;
    context?: any;
  }): Promise<void> {
    const errorInfo: ErrorInfo = {
      id: this.generateErrorId(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      systemInfo: {
        platform: process.platform,
        version: app.getVersion(),
        memory: process.memoryUsage(),
        uptime: process.uptime()
      },
      ...options
    };

    // Store error
    this.errors.set(errorInfo.id, errorInfo);
    
    // Trim old errors if needed
    if (this.errors.size > this.maxErrors) {
      const oldestErrors = Array.from(this.errors.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)
        .slice(0, this.errors.size - this.maxErrors);
      
      for (const [id] of oldestErrors) {
        this.errors.delete(id);
      }
    }

    // Log error
    log.error(`[${errorInfo.source}] ${errorInfo.error.message}`, {
      errorId: errorInfo.id,
      severity: errorInfo.severity,
      context: errorInfo.context,
      stack: errorInfo.error.stack
    });

    // Persist error
    await this.persistError(errorInfo);

    // Emit error event
    this.emit('error', errorInfo);

    // Report error if enabled
    await errorReporter.reportError(errorInfo).catch(e => 
      log.error('Failed to report error:', e)
    );

    // Handle critical errors
    if (errorInfo.severity === 'critical') {
      await this.handleCriticalError(errorInfo);
    }

    // Attempt recovery
    await this.attemptRecovery(errorInfo);
  }

  private async handleCriticalError(errorInfo: ErrorInfo): Promise<void> {
    // Show error dialog
    const response = await dialog.showMessageBox({
      type: 'error',
      title: 'Critical Error',
      message: 'A critical error has occurred',
      detail: errorInfo.error.message,
      buttons: ['Restart', 'Quit', 'Continue'],
      defaultId: 0,
      cancelId: 2
    });

    switch (response.response) {
      case 0: // Restart
        app.relaunch();
        app.quit();
        break;
      case 1: // Quit
        app.quit();
        break;
      case 2: // Continue
        // User chose to continue despite critical error
        break;
    }
  }

  private async attemptRecovery(errorInfo: ErrorInfo): Promise<boolean> {
    const result = await recoveryManager.attemptRecovery(errorInfo);
    
    if (result.success) {
      this.emit('recovery', { errorInfo, strategy: result.strategy });
      return true;
    }

    // If automatic recovery failed and error is critical, prompt user
    if (errorInfo.severity === 'critical') {
      const userChoice = await recoveryManager.promptUserForRecovery(errorInfo);
      
      switch (userChoice) {
        case 'retry':
          // Retry the operation that caused the error
          this.emit('retry', errorInfo);
          break;
        case 'reset':
          // Reset application settings
          const { ConfigStore } = await import('../config/ConfigStore');
          const configStore = new ConfigStore();
          await configStore.clear();
          await configStore.setDefaults();
          app.relaunch();
          app.quit();
          break;
        case 'quit':
          app.quit();
          break;
        case 'ignore':
        default:
          // Continue running
          break;
      }
    }

    return false;
  }

  private async persistError(errorInfo: ErrorInfo): Promise<void> {
    try {
      const filename = `error_${errorInfo.id}.json`;
      const filepath = path.join(this.errorLogPath, filename);
      
      await fs.writeFile(filepath, JSON.stringify(errorInfo, null, 2), 'utf-8');
      
      // Also append to daily log
      const dailyLog = path.join(
        this.errorLogPath,
        `errors_${new Date().toISOString().split('T')[0]}.log`
      );
      
      const logEntry = `[${new Date(errorInfo.timestamp).toISOString()}] ` +
        `${errorInfo.severity.toUpperCase()} - ${errorInfo.source} - ` +
        `${errorInfo.error.message}\n${errorInfo.error.stack}\n\n`;
      
      await fs.appendFile(dailyLog, logEntry, 'utf-8');
    } catch (e) {
      // Don't throw if we can't persist - just log
      log.error('Failed to persist error:', e);
    }
  }

  private async loadPreviousErrors(): Promise<void> {
    try {
      const files = await fs.readdir(this.errorLogPath);
      const errorFiles = files.filter(f => f.startsWith('error_') && f.endsWith('.json'));
      
      // Load only recent errors (last 24 hours)
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      
      for (const file of errorFiles) {
        try {
          const content = await fs.readFile(path.join(this.errorLogPath, file), 'utf-8');
          const errorInfo: ErrorInfo = JSON.parse(content);
          
          if (errorInfo.timestamp > cutoff) {
            this.errors.set(errorInfo.id, errorInfo);
          }
        } catch (e) {
          // Skip invalid files
        }
      }
    } catch (e) {
      // Directory might not exist on first run
      log.debug('No previous errors to load');
    }
  }

  async getErrors(filter?: {
    severity?: ErrorInfo['severity'];
    source?: ErrorInfo['source'];
    since?: number;
    limit?: number;
  }): Promise<ErrorInfo[]> {
    let errors = Array.from(this.errors.values());

    if (filter) {
      if (filter.severity) {
        errors = errors.filter(e => e.severity === filter.severity);
      }
      if (filter.source) {
        errors = errors.filter(e => e.source === filter.source);
      }
      if (filter.since) {
        errors = errors.filter(e => e.timestamp >= filter.since);
      }
    }

    // Sort by timestamp descending
    errors.sort((a, b) => b.timestamp - a.timestamp);

    if (filter?.limit) {
      errors = errors.slice(0, filter.limit);
    }

    return errors;
  }

  async generateReport(timeRange?: { start: number; end: number }): Promise<ErrorReport> {
    const errors = await this.getErrors();
    
    const filteredErrors = timeRange
      ? errors.filter(e => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end)
      : errors;

    const bySeverity: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    for (const error of filteredErrors) {
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
      bySource[error.source] = (bySource[error.source] || 0) + 1;
    }

    return {
      errors: filteredErrors,
      summary: {
        total: filteredErrors.length,
        bySeverity,
        bySource,
        timeRange: {
          start: filteredErrors.length > 0 ? filteredErrors[filteredErrors.length - 1].timestamp : 0,
          end: filteredErrors.length > 0 ? filteredErrors[0].timestamp : 0
        }
      }
    };
  }

  async clearErrors(before?: number): Promise<void> {
    if (before) {
      for (const [id, error] of this.errors) {
        if (error.timestamp < before) {
          this.errors.delete(id);
        }
      }
    } else {
      this.errors.clear();
    }

    // Clean up old error files
    try {
      const files = await fs.readdir(this.errorLogPath);
      const cutoff = before || 0;
      
      for (const file of files) {
        if (file.startsWith('error_') && file.endsWith('.json')) {
          const filepath = path.join(this.errorLogPath, file);
          const content = await fs.readFile(filepath, 'utf-8');
          const errorInfo: ErrorInfo = JSON.parse(content);
          
          if (errorInfo.timestamp < cutoff || !before) {
            await fs.unlink(filepath);
          }
        }
      }
    } catch (e) {
      log.error('Failed to clean up error files:', e);
    }
  }

  private generateErrorId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  async cleanup(): Promise<void> {
    // Remove old error logs (older than 7 days)
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    await this.clearErrors(cutoff);
    
    // Clean up recovery manager
    await recoveryManager.cleanup();
    
    // Clean up error reporter
    await errorReporter.cleanup();
    
    this.removeAllListeners();
    log.info('ErrorManager cleaned up');
  }
}

// Singleton instance
export const errorManager = new ErrorManager();