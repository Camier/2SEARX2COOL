import log from 'electron-log';
import { DatabaseManager } from '../database/DatabaseManager';
import { EventEmitter } from 'events';

export interface AnalyticsEvent {
  id: string;
  event: string;
  properties?: Record<string, any>;
  timestamp: number;
  sessionId: string;
  userId?: string;
}

export interface AnalyticsMetrics {
  searches: {
    total: number;
    byEngine: Record<string, number>;
    avgResultsPerSearch: number;
    avgSearchDuration: number;
  };
  plugins: {
    installed: number;
    active: number;
    byUsage: Record<string, number>;
  };
  performance: {
    avgStartupTime: number;
    avgMemoryUsage: number;
    crashRate: number;
  };
  usage: {
    dailyActiveUsers: number;
    sessionDuration: number;
    featuresUsed: Record<string, number>;
  };
}

export class Analytics extends EventEmitter {
  private sessionId: string;
  private isEnabled = false;
  private batchQueue: AnalyticsEvent[] = [];
  private batchTimer?: NodeJS.Timeout;
  private metrics: Partial<AnalyticsMetrics> = {};

  constructor(private databaseManager: DatabaseManager) {
    super();
    this.sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  async initialize(): Promise<void> {
    // Check if analytics is enabled
    const { ConfigStore } = await import('../config/ConfigStore');
    const configStore = new ConfigStore();
    const config = await configStore.get('analytics');
    this.isEnabled = config?.enabled || false;

    if (this.isEnabled) {
      log.info('Analytics initialized');
      this.startBatchTimer();
    } else {
      log.info('Analytics disabled');
    }
  }

  async track(event: string, properties?: Record<string, any>): Promise<void> {
    if (!this.isEnabled) return;

    const analyticsEvent: AnalyticsEvent = {
      id: this.generateEventId(),
      event,
      properties,
      timestamp: Date.now(),
      sessionId: this.sessionId
    };

    this.batchQueue.push(analyticsEvent);
    this.emit('event', analyticsEvent);

    // Flush if batch is large
    if (this.batchQueue.length >= 50) {
      await this.flush();
    }
  }

  async trackSearch(query: string, engines: string[], resultsCount: number, duration: number): Promise<void> {
    await this.track('search_performed', {
      query_length: query.length,
      engines,
      results_count: resultsCount,
      duration,
      has_results: resultsCount > 0
    });

    // Update metrics
    if (!this.metrics.searches) {
      this.metrics.searches = {
        total: 0,
        byEngine: {},
        avgResultsPerSearch: 0,
        avgSearchDuration: 0
      };
    }

    this.metrics.searches.total++;
    engines.forEach(engine => {
      this.metrics.searches!.byEngine[engine] = (this.metrics.searches!.byEngine[engine] || 0) + 1;
    });
  }

  async trackPlugin(action: 'installed' | 'enabled' | 'disabled' | 'uninstalled', pluginId: string): Promise<void> {
    await this.track(`plugin_${action}`, { plugin_id: pluginId });
  }

  async trackPerformance(metric: 'startup' | 'memory' | 'crash', value: number): Promise<void> {
    await this.track('performance_metric', { metric, value });
  }

  async trackFeatureUsage(feature: string, metadata?: any): Promise<void> {
    await this.track('feature_used', { feature, ...metadata });
  }

  async getMetrics(timeRange?: { start: number; end: number }): Promise<AnalyticsMetrics> {
    // Get analytics from database
    const events = await this.databaseManager.getAnalytics();
    
    // Calculate metrics
    const metrics: AnalyticsMetrics = {
      searches: {
        total: 0,
        byEngine: {},
        avgResultsPerSearch: 0,
        avgSearchDuration: 0
      },
      plugins: {
        installed: 0,
        active: 0,
        byUsage: {}
      },
      performance: {
        avgStartupTime: 0,
        avgMemoryUsage: 0,
        crashRate: 0
      },
      usage: {
        dailyActiveUsers: 0,
        sessionDuration: 0,
        featuresUsed: {}
      }
    };

    // Process events
    let totalResults = 0;
    let totalDuration = 0;
    const uniqueSessions = new Set<string>();
    const sessionTimes: Record<string, { start: number; end: number }> = {};

    for (const event of events) {
      if (timeRange && (event.timestamp < timeRange.start || event.timestamp > timeRange.end)) {
        continue;
      }

      uniqueSessions.add(event.sessionId);

      // Track session times
      if (!sessionTimes[event.sessionId]) {
        sessionTimes[event.sessionId] = { start: event.timestamp, end: event.timestamp };
      } else {
        sessionTimes[event.sessionId].end = event.timestamp;
      }

      switch (event.event) {
        case 'search_performed':
          metrics.searches.total++;
          if (event.properties?.engines) {
            event.properties.engines.forEach((engine: string) => {
              metrics.searches.byEngine[engine] = (metrics.searches.byEngine[engine] || 0) + 1;
            });
          }
          if (event.properties?.results_count) {
            totalResults += event.properties.results_count;
          }
          if (event.properties?.duration) {
            totalDuration += event.properties.duration;
          }
          break;

        case 'plugin_installed':
          metrics.plugins.installed++;
          break;

        case 'plugin_enabled':
          metrics.plugins.active++;
          break;

        case 'feature_used':
          if (event.properties?.feature) {
            metrics.usage.featuresUsed[event.properties.feature] = 
              (metrics.usage.featuresUsed[event.properties.feature] || 0) + 1;
          }
          break;

        case 'performance_metric':
          if (event.properties?.metric === 'startup' && event.properties?.value) {
            metrics.performance.avgStartupTime = 
              (metrics.performance.avgStartupTime + event.properties.value) / 2;
          }
          break;
      }
    }

    // Calculate averages
    if (metrics.searches.total > 0) {
      metrics.searches.avgResultsPerSearch = totalResults / metrics.searches.total;
      metrics.searches.avgSearchDuration = totalDuration / metrics.searches.total;
    }

    // Calculate session duration
    const sessionDurations = Object.values(sessionTimes).map(times => times.end - times.start);
    if (sessionDurations.length > 0) {
      metrics.usage.sessionDuration = sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length;
    }

    metrics.usage.dailyActiveUsers = uniqueSessions.size;

    return metrics;
  }

  private startBatchTimer(): void {
    this.batchTimer = setInterval(() => {
      this.flush().catch(error => {
        log.error('Failed to flush analytics batch:', error);
      });
    }, 30000); // Flush every 30 seconds
  }

  private async flush(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const events = [...this.batchQueue];
    this.batchQueue = [];

    try {
      // Save to database
      for (const event of events) {
        await this.databaseManager.trackEvent(event);
      }
      log.debug(`Flushed ${events.length} analytics events`);
    } catch (error) {
      log.error('Failed to save analytics events:', error);
      // Re-queue failed events
      this.batchQueue.unshift(...events);
    }
  }

  private generateEventId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this.isEnabled = enabled;
    
    if (enabled && !this.batchTimer) {
      this.startBatchTimer();
    } else if (!enabled && this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = undefined;
      await this.flush(); // Flush remaining events
    }
  }

  async cleanup(): Promise<void> {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
    await this.flush();
    this.removeAllListeners();
    log.info('Analytics cleaned up');
  }
}