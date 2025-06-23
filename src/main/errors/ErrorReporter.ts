import { app, net, dialog } from 'electron';
import log from 'electron-log';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as crypto from 'crypto';
import { ErrorInfo, ErrorReport } from './ErrorManager';
import { ConfigStore } from '../config/ConfigStore';
import { asyncExecute } from '../utils/AsyncErrorHandler';

export interface ErrorReportConfig {
  enabled: boolean;
  endpoint?: string;
  apiKey?: string;
  includeSystemInfo: boolean;
  includeStackTrace: boolean;
  includeScreenshot: boolean;
  autoReport: boolean;
  reportLevel: 'all' | 'high' | 'critical';
  sentryDsn?: string;
}

export interface PreparedReport {
  id: string;
  timestamp: number;
  appVersion: string;
  platform: string;
  errors: Array<{
    id: string;
    message: string;
    stack?: string;
    severity: string;
    source: string;
    context?: any;
    timestamp: number;
  }>;
  systemInfo?: {
    os: string;
    arch: string;
    memory: {
      total: number;
      free: number;
      used: number;
    };
    cpu: {
      model: string;
      cores: number;
      speed: number;
    };
    uptime: number;
  };
  userInfo?: {
    userId?: string;
    sessionId: string;
  };
  screenshot?: string;
}

export class ErrorReporter {
  private config: ErrorReportConfig;
  private reportQueue: PreparedReport[] = [];
  private isReporting = false;
  private reportHistory: Map<string, number> = new Map();
  private sentry: any = null;

  constructor(private configStore: ConfigStore) {
    this.config = {
      enabled: false,
      includeSystemInfo: true,
      includeStackTrace: true,
      includeScreenshot: false,
      autoReport: false,
      reportLevel: 'high'
    };
  }

  async initialize(): Promise<void> {
    const savedConfig = await this.configStore.get<ErrorReportConfig>('errorReporting');
    if (savedConfig) {
      this.config = { ...this.config, ...savedConfig };
    }

    // Initialize Sentry if configured
    if (this.config.sentryDsn) {
      try {
        const Sentry = await import('@sentry/electron/main');
        Sentry.init({
          dsn: this.config.sentryDsn,
          environment: process.env.NODE_ENV || 'production',
          beforeSend: (event) => {
            // Filter sensitive data
            return this.filterSensitiveData(event);
          }
        });
        this.sentry = Sentry;
        log.info('Sentry error reporting initialized');
      } catch (e) {
        log.error('Failed to initialize Sentry:', e);
      }
    }

    // Load report history
    await this.loadReportHistory();

    log.info('ErrorReporter initialized');
  }

  async updateConfig(config: Partial<ErrorReportConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    await this.configStore.set('errorReporting', this.config);
  }

  async reportError(error: ErrorInfo): Promise<void> {
    if (!this.config.enabled) return;

    // Check if error severity meets reporting threshold
    if (!this.shouldReportError(error)) return;

    // Check if we've already reported this error recently
    const errorHash = this.getErrorHash(error);
    const lastReported = this.reportHistory.get(errorHash);
    if (lastReported && Date.now() - lastReported < 3600000) { // 1 hour
      log.debug('Skipping duplicate error report');
      return;
    }

    // Prepare single error report
    const report = await this.prepareReport([error]);
    
    if (this.config.autoReport) {
      await this.sendReport(report);
    } else {
      this.reportQueue.push(report);
      await this.promptUserToReport();
    }
  }

  async reportBatch(errors: ErrorInfo[]): Promise<void> {
    if (!this.config.enabled || errors.length === 0) return;

    // Filter errors by severity
    const reportableErrors = errors.filter(e => this.shouldReportError(e));
    if (reportableErrors.length === 0) return;

    const report = await this.prepareReport(reportableErrors);
    
    if (this.config.autoReport) {
      await this.sendReport(report);
    } else {
      this.reportQueue.push(report);
      await this.promptUserToReport();
    }
  }

  private shouldReportError(error: ErrorInfo): boolean {
    switch (this.config.reportLevel) {
      case 'all':
        return true;
      case 'high':
        return error.severity === 'high' || error.severity === 'critical';
      case 'critical':
        return error.severity === 'critical';
      default:
        return false;
    }
  }

  private async prepareReport(errors: ErrorInfo[]): Promise<PreparedReport> {
    const report: PreparedReport = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      appVersion: app.getVersion(),
      platform: process.platform,
      errors: errors.map(e => ({
        id: e.id,
        message: e.error.message,
        stack: this.config.includeStackTrace ? e.error.stack : undefined,
        severity: e.severity,
        source: e.source,
        context: e.context,
        timestamp: e.timestamp
      })),
      userInfo: {
        sessionId: errors[0]?.sessionId || 'unknown'
      }
    };

    // Add system info if enabled
    if (this.config.includeSystemInfo) {
      report.systemInfo = await this.collectSystemInfo();
    }

    // Add screenshot if enabled and available
    if (this.config.includeScreenshot) {
      report.screenshot = await this.captureScreenshot();
    }

    return report;
  }

  private async collectSystemInfo() {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    return {
      os: `${os.type()} ${os.release()}`,
      arch: os.arch(),
      memory: {
        total: totalMemory,
        free: freeMemory,
        used: totalMemory - freeMemory
      },
      cpu: {
        model: cpus[0]?.model || 'unknown',
        cores: cpus.length,
        speed: cpus[0]?.speed || 0
      },
      uptime: os.uptime()
    };
  }

  private async captureScreenshot(): Promise<string | undefined> {
    try {
      const { BrowserWindow } = await import('electron');
      const windows = BrowserWindow.getAllWindows();
      
      if (windows.length === 0) return undefined;

      const window = windows[0];
      const image = await window.capturePage();
      
      // Convert to base64 JPEG with compression
      const buffer = image.toJPEG(80);
      return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    } catch (e) {
      log.error('Failed to capture screenshot:', e);
      return undefined;
    }
  }

  private async sendReport(report: PreparedReport): Promise<void> {
    const result = await asyncExecute({
      name: 'ErrorReporter.sendReport',
      operation: async () => {
        if (this.sentry) {
          // Send via Sentry
          for (const error of report.errors) {
            this.sentry.captureException(new Error(error.message), {
              level: this.mapSeverityToSentry(error.severity),
              tags: {
                source: error.source,
                errorId: error.id
              },
              extra: {
                context: error.context,
                systemInfo: report.systemInfo
              }
            });
          }
        } else if (this.config.endpoint) {
          // Send via custom endpoint
          const response = await net.fetch(this.config.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(this.config.apiKey && {
                'Authorization': `Bearer ${this.config.apiKey}`
              })
            },
            body: JSON.stringify(report)
          });

          if (!response.ok) {
            throw new Error(`Failed to send report: ${response.status}`);
          }
        } else {
          // Save locally
          await this.saveReportLocally(report);
        }

        // Update report history
        for (const error of report.errors) {
          const hash = this.getErrorHash({
            error: new Error(error.message),
            severity: error.severity as any,
            source: error.source as any
          } as ErrorInfo);
          this.reportHistory.set(hash, Date.now());
        }

        await this.saveReportHistory();
      },
      retries: 3,
      timeout: 30000,
      severity: 'low'
    });

    if (!result.success) {
      log.error('Failed to send error report:', result.error);
      // Save failed report locally
      await this.saveReportLocally(report);
    }
  }

  private async saveReportLocally(report: PreparedReport): Promise<void> {
    const reportsDir = path.join(app.getPath('userData'), 'error-reports');
    await fs.mkdir(reportsDir, { recursive: true });

    const filename = `error-report-${report.id}.json`;
    const filepath = path.join(reportsDir, filename);

    await fs.writeFile(filepath, JSON.stringify(report, null, 2), 'utf-8');
    log.info(`Error report saved locally: ${filename}`);
  }

  private async promptUserToReport(): Promise<void> {
    if (this.isReporting || this.reportQueue.length === 0) return;

    this.isReporting = true;

    const response = await dialog.showMessageBox({
      type: 'question',
      title: 'Send Error Report?',
      message: 'The application encountered errors. Would you like to send an error report to help improve the app?',
      detail: `${this.reportQueue.length} error report(s) are pending. No personal information will be sent.`,
      buttons: ['Send Report', 'Not Now', 'Disable Reporting'],
      defaultId: 0,
      cancelId: 1
    });

    switch (response.response) {
      case 0: // Send
        for (const report of this.reportQueue) {
          await this.sendReport(report);
        }
        this.reportQueue = [];
        break;
      case 1: // Not now
        // Keep in queue
        break;
      case 2: // Disable
        await this.updateConfig({ enabled: false });
        this.reportQueue = [];
        break;
    }

    this.isReporting = false;
  }

  private getErrorHash(error: Partial<ErrorInfo>): string {
    const key = `${error.error?.message || ''}-${error.source || ''}-${error.severity || ''}`;
    return crypto.createHash('md5').update(key).digest('hex');
  }

  private filterSensitiveData(event: any): any {
    // Remove sensitive data from error reports
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /api[_-]?key/i,
      /secret/i,
      /credential/i
    ];

    const filterObject = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;

      const filtered = Array.isArray(obj) ? [] : {};

      for (const key in obj) {
        if (sensitivePatterns.some(pattern => pattern.test(key))) {
          filtered[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          filtered[key] = filterObject(obj[key]);
        } else if (typeof obj[key] === 'string') {
          // Check for sensitive patterns in values
          filtered[key] = sensitivePatterns.some(p => p.test(obj[key]))
            ? '[REDACTED]'
            : obj[key];
        } else {
          filtered[key] = obj[key];
        }
      }

      return filtered;
    };

    return filterObject(event);
  }

  private mapSeverityToSentry(severity: string): any {
    const mapping = {
      low: 'info',
      medium: 'warning',
      high: 'error',
      critical: 'fatal'
    };
    return mapping[severity] || 'error';
  }

  private async loadReportHistory(): Promise<void> {
    try {
      const historyFile = path.join(app.getPath('userData'), 'report-history.json');
      const data = await fs.readFile(historyFile, 'utf-8');
      const history = JSON.parse(data);
      
      // Convert to Map and filter old entries
      const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
      for (const [hash, timestamp] of Object.entries(history)) {
        if (typeof timestamp === 'number' && timestamp > cutoff) {
          this.reportHistory.set(hash, timestamp);
        }
      }
    } catch {
      // File doesn't exist or is invalid
    }
  }

  private async saveReportHistory(): Promise<void> {
    try {
      const historyFile = path.join(app.getPath('userData'), 'report-history.json');
      const history = Object.fromEntries(this.reportHistory);
      await fs.writeFile(historyFile, JSON.stringify(history), 'utf-8');
    } catch (e) {
      log.error('Failed to save report history:', e);
    }
  }

  async exportReports(outputPath: string): Promise<void> {
    const reportsDir = path.join(app.getPath('userData'), 'error-reports');
    
    try {
      const files = await fs.readdir(reportsDir);
      const reports: PreparedReport[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(reportsDir, file), 'utf-8');
          reports.push(JSON.parse(content));
        }
      }

      // Create export file
      const exportData = {
        exported: new Date().toISOString(),
        appVersion: app.getVersion(),
        reportCount: reports.length,
        reports
      };

      await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');
      log.info(`Exported ${reports.length} error reports to ${outputPath}`);
    } catch (e) {
      log.error('Failed to export reports:', e);
      throw e;
    }
  }

  getPendingReports(): PreparedReport[] {
    return [...this.reportQueue];
  }

  async cleanup(): Promise<void> {
    // Send any pending reports
    if (this.reportQueue.length > 0 && this.config.autoReport) {
      for (const report of this.reportQueue) {
        await this.sendReport(report).catch(e => 
          log.error('Failed to send pending report during cleanup:', e)
        );
      }
    }

    await this.saveReportHistory();
    log.info('ErrorReporter cleaned up');
  }
}

// Singleton instance
export const errorReporter = new ErrorReporter(new ConfigStore());