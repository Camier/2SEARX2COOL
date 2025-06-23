import log from 'electron-log';
import { app } from 'electron';

interface StartupMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export class StartupPerformance {
  private static instance: StartupPerformance;
  private metrics: Map<string, StartupMetric> = new Map();
  private appStartTime: number;
  
  private constructor() {
    this.appStartTime = Date.now();
  }

  static getInstance(): StartupPerformance {
    if (!StartupPerformance.instance) {
      StartupPerformance.instance = new StartupPerformance();
    }
    return StartupPerformance.instance;
  }

  /**
   * Mark the start of a startup phase
   */
  markStart(name: string, metadata?: Record<string, any>): void {
    this.metrics.set(name, {
      name,
      startTime: Date.now(),
      metadata
    });
  }

  /**
   * Mark the end of a startup phase
   */
  markEnd(name: string): void {
    const metric = this.metrics.get(name);
    if (!metric) {
      log.warn(`No start time found for metric: ${name}`);
      return;
    }

    metric.endTime = Date.now();
    metric.duration = metric.endTime - metric.startTime;
    
    log.debug(`${name} completed in ${metric.duration}ms`);
  }

  /**
   * Mark a single point in time
   */
  mark(name: string, metadata?: Record<string, any>): void {
    const now = Date.now();
    this.metrics.set(name, {
      name,
      startTime: now,
      endTime: now,
      duration: 0,
      metadata
    });
  }

  /**
   * Get total startup time
   */
  getTotalStartupTime(): number {
    return Date.now() - this.appStartTime;
  }

  /**
   * Get all metrics
   */
  getMetrics(): StartupMetric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get a summary report
   */
  getSummary(): {
    totalTime: number;
    phases: Array<{
      name: string;
      duration: number;
      percentage: number;
    }>;
    criticalPath: string[];
  } {
    const totalTime = this.getTotalStartupTime();
    const completedMetrics = this.getMetrics().filter(m => m.duration !== undefined);
    
    // Sort by duration
    const phases = completedMetrics
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .map(m => ({
        name: m.name,
        duration: m.duration || 0,
        percentage: ((m.duration || 0) / totalTime) * 100
      }));

    // Identify critical path (longest running sequential operations)
    const criticalPath = this.identifyCriticalPath();

    return {
      totalTime,
      phases,
      criticalPath
    };
  }

  /**
   * Log performance report
   */
  logReport(): void {
    const summary = this.getSummary();
    
    log.info('=== Startup Performance Report ===');
    log.info(`Total startup time: ${summary.totalTime}ms`);
    log.info('\nPhases:');
    
    summary.phases.forEach(phase => {
      log.info(`  ${phase.name}: ${phase.duration}ms (${phase.percentage.toFixed(1)}%)`);
    });
    
    if (summary.criticalPath.length > 0) {
      log.info('\nCritical path:');
      summary.criticalPath.forEach(phase => {
        log.info(`  - ${phase}`);
      });
    }
    
    log.info('================================');
  }

  /**
   * Save performance report to file
   */
  async saveReport(outputPath?: string): Promise<void> {
    const path = await import('path');
    const fs = await import('fs').then(m => m.promises);
    
    const reportPath = outputPath || path.join(
      app.getPath('userData'),
      'logs',
      `startup-performance-${Date.now()}.json`
    );
    
    const report = {
      timestamp: new Date().toISOString(),
      appVersion: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron,
      summary: this.getSummary(),
      metrics: this.getMetrics()
    };
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    log.info(`Performance report saved to: ${reportPath}`);
  }

  /**
   * Identify critical path of startup operations
   */
  private identifyCriticalPath(): string[] {
    const metrics = Array.from(this.metrics.values());
    if (metrics.length === 0) return [];

    // Sort by start time
    metrics.sort((a, b) => a.startTime - b.startTime);

    const criticalPath: string[] = [];
    let currentEndTime = 0;

    for (const metric of metrics) {
      if (metric.startTime >= currentEndTime && metric.endTime) {
        criticalPath.push(metric.name);
        currentEndTime = metric.endTime;
      }
    }

    return criticalPath;
  }

  /**
   * Compare with previous startup
   */
  async compareWithPrevious(): Promise<{
    improvement: number;
    previousTime: number;
    currentTime: number;
  } | null> {
    try {
      const fs = await import('fs').then(m => m.promises);
      const path = await import('path');
      
      const logsDir = path.join(app.getPath('userData'), 'logs');
      const files = await fs.readdir(logsDir);
      
      // Find most recent performance report
      const performanceReports = files
        .filter(f => f.startsWith('startup-performance-'))
        .sort()
        .reverse();
      
      if (performanceReports.length === 0) return null;
      
      const previousReport = JSON.parse(
        await fs.readFile(path.join(logsDir, performanceReports[0]), 'utf-8')
      );
      
      const currentTime = this.getTotalStartupTime();
      const previousTime = previousReport.summary.totalTime;
      const improvement = previousTime - currentTime;
      
      return {
        improvement,
        previousTime,
        currentTime
      };
    } catch (error) {
      log.error('Failed to compare with previous startup:', error);
      return null;
    }
  }
}

// Export singleton instance
export const startupPerformance = StartupPerformance.getInstance();