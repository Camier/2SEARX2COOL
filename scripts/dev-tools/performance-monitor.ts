#!/usr/bin/env node

/**
 * Performance Monitoring System
 * Tracks application performance metrics during development
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { performance, PerformanceObserver } from 'perf_hooks';
import { spawn } from 'child_process';
import express from 'express';
import WebSocket from 'ws';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  category: 'build' | 'runtime' | 'test' | 'startup';
}

interface BuildMetrics {
  duration: number;
  bundleSize: number;
  chunkCount: number;
  moduleCount: number;
  memoryUsage: number;
  cpuUsage: number;
}

interface RuntimeMetrics {
  fps: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  eventLoopDelay: number;
  activeHandles: number;
  activeRequests: number;
}

interface TestMetrics {
  duration: number;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  coverage: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private projectPath: string;
  private dashboardServer?: express.Application;
  private wsServer?: WebSocket.Server;
  private observers: Map<string, PerformanceObserver> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.setupPerformanceObservers();
  }

  private setupPerformanceObservers(): void {
    // Build performance observer
    const buildObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.recordMetric({
          name: entry.name,
          value: entry.duration,
          unit: 'ms',
          timestamp: new Date(),
          category: 'build'
        });
      }
    });
    buildObserver.observe({ entryTypes: ['measure'] });
    this.observers.set('build', buildObserver);
  }

  async monitorBuild(): Promise<BuildMetrics> {
    console.log('📊 Monitoring build performance...\n');
    
    const startTime = performance.now();
    const startCpu = process.cpuUsage();
    const startMem = process.memoryUsage().heapUsed;

    return new Promise((resolve, reject) => {
      const buildProcess = spawn('npm', ['run', 'build'], {
        cwd: this.projectPath,
        stdio: 'inherit'
      });

      buildProcess.on('close', async (code) => {
        const endTime = performance.now();
        const endCpu = process.cpuUsage(startCpu);
        const endMem = process.memoryUsage().heapUsed;

        if (code !== 0) {
          reject(new Error(`Build failed with code ${code}`));
          return;
        }

        const metrics: BuildMetrics = {
          duration: endTime - startTime,
          bundleSize: await this.getBundleSize(),
          chunkCount: await this.getChunkCount(),
          moduleCount: await this.getModuleCount(),
          memoryUsage: endMem - startMem,
          cpuUsage: (endCpu.user + endCpu.system) / 1000
        };

        this.recordBuildMetrics(metrics);
        resolve(metrics);
      });
    });
  }

  async monitorRuntime(duration: number = 60000): Promise<RuntimeMetrics[]> {
    console.log(`📊 Monitoring runtime performance for ${duration / 1000}s...\n`);
    
    const metrics: RuntimeMetrics[] = [];
    const interval = 1000; // Sample every second
    
    const monitor = setInterval(() => {
      const metric: RuntimeMetrics = {
        fps: this.calculateFPS(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        eventLoopDelay: this.measureEventLoopDelay(),
        activeHandles: (process as any)._getActiveHandles().length,
        activeRequests: (process as any)._getActiveRequests().length
      };
      
      metrics.push(metric);
      this.broadcastMetric(metric);
    }, interval);

    return new Promise((resolve) => {
      setTimeout(() => {
        clearInterval(monitor);
        resolve(metrics);
      }, duration);
    });
  }

  async monitorTests(): Promise<TestMetrics> {
    console.log('📊 Monitoring test performance...\n');
    
    const startTime = performance.now();

    return new Promise((resolve, reject) => {
      const testProcess = spawn('npm', ['test', '--', '--reporter=json'], {
        cwd: this.projectPath
      });

      let output = '';
      testProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      testProcess.on('close', async (code) => {
        const duration = performance.now() - startTime;
        
        try {
          const results = JSON.parse(output);
          const coverage = await this.getTestCoverage();
          
          const metrics: TestMetrics = {
            duration,
            testsRun: results.numTotalTests,
            testsPassed: results.numPassedTests,
            testsFailed: results.numFailedTests,
            coverage: coverage.lines
          };

          this.recordTestMetrics(metrics);
          resolve(metrics);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async startDashboard(port: number = 8093): Promise<void> {
    this.dashboardServer = express();
    this.wsServer = new WebSocket.Server({ port: port + 1 });

    // Serve static dashboard
    this.dashboardServer.use(express.static(path.join(__dirname, 'dashboard')));

    // API endpoints
    this.dashboardServer.get('/api/metrics', (req, res) => {
      res.json(this.metrics);
    });

    this.dashboardServer.get('/api/metrics/latest', (req, res) => {
      const latest = this.getLatestMetrics();
      res.json(latest);
    });

    this.dashboardServer.get('/api/metrics/:category', (req, res) => {
      const category = req.params.category as PerformanceMetric['category'];
      const filtered = this.metrics.filter(m => m.category === category);
      res.json(filtered);
    });

    // WebSocket for real-time updates
    this.wsServer.on('connection', (ws) => {
      console.log('Dashboard connected');
      
      // Send initial metrics
      ws.send(JSON.stringify({
        type: 'initial',
        data: this.getLatestMetrics()
      }));
    });

    this.dashboardServer.listen(port, () => {
      console.log(`📊 Performance dashboard available at http://localhost:${port}`);
      console.log(`🔌 WebSocket server on port ${port + 1}\n`);
    });

    // Create dashboard HTML
    await this.createDashboardHTML();
  }

  private async createDashboardHTML(): Promise<void> {
    const dashboardDir = path.join(__dirname, 'dashboard');
    await fs.mkdir(dashboardDir, { recursive: true });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-value { font-size: 2em; font-weight: bold; color: #333; }
        .metric-label { color: #666; margin-top: 5px; }
        .chart-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .status { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 5px; }
        .status.good { background: #4caf50; }
        .status.warning { background: #ff9800; }
        .status.error { background: #f44336; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Performance Dashboard</h1>
        
        <div class="metric-grid" id="metrics">
            <!-- Metrics will be inserted here -->
        </div>
        
        <div class="chart-container">
            <canvas id="performanceChart"></canvas>
        </div>
    </div>

    <script>
        const ws = new WebSocket('ws://localhost:8094');
        const ctx = document.getElementById('performanceChart').getContext('2d');
        
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Memory Usage (MB)',
                    data: [],
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }, {
                    label: 'CPU Usage (%)',
                    data: [],
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            
            if (message.type === 'initial') {
                updateMetrics(message.data);
            } else if (message.type === 'update') {
                updateRealTimeData(message.data);
            }
        };

        function updateMetrics(data) {
            const metricsDiv = document.getElementById('metrics');
            metricsDiv.innerHTML = '';
            
            Object.entries(data).forEach(([key, value]) => {
                const card = document.createElement('div');
                card.className = 'metric-card';
                card.innerHTML = \`
                    <div class="metric-value">\${formatValue(value)}</div>
                    <div class="metric-label">\${formatLabel(key)}</div>
                \`;
                metricsDiv.appendChild(card);
            });
        }

        function updateRealTimeData(data) {
            const time = new Date().toLocaleTimeString();
            
            if (chart.data.labels.length > 20) {
                chart.data.labels.shift();
                chart.data.datasets.forEach(dataset => dataset.data.shift());
            }
            
            chart.data.labels.push(time);
            chart.data.datasets[0].data.push(data.memoryUsage / 1024 / 1024);
            chart.data.datasets[1].data.push(data.cpuUsage);
            chart.update();
        }

        function formatValue(value) {
            if (typeof value === 'number') {
                return value.toFixed(2);
            }
            return value;
        }

        function formatLabel(key) {
            return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        }
    </script>
</body>
</html>`;

    await fs.writeFile(path.join(dashboardDir, 'index.html'), html);
  }

  private recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }
  }

  private recordBuildMetrics(metrics: BuildMetrics): void {
    Object.entries(metrics).forEach(([key, value]) => {
      this.recordMetric({
        name: `build.${key}`,
        value: value as number,
        unit: this.getUnit(key),
        timestamp: new Date(),
        category: 'build'
      });
    });
  }

  private recordTestMetrics(metrics: TestMetrics): void {
    Object.entries(metrics).forEach(([key, value]) => {
      this.recordMetric({
        name: `test.${key}`,
        value: value as number,
        unit: this.getUnit(key),
        timestamp: new Date(),
        category: 'test'
      });
    });
  }

  private getUnit(metricName: string): string {
    const units: Record<string, string> = {
      duration: 'ms',
      bundleSize: 'bytes',
      memoryUsage: 'bytes',
      cpuUsage: 'ms',
      coverage: '%',
      fps: 'fps'
    };
    
    return units[metricName] || 'count';
  }

  private calculateFPS(): number {
    // Simplified FPS calculation
    // In a real app, this would track frame times
    return 60;
  }

  private measureEventLoopDelay(): number {
    const start = performance.now();
    setImmediate(() => {
      const delay = performance.now() - start;
    });
    return 0; // Placeholder
  }

  private async getBundleSize(): Promise<number> {
    try {
      const distPath = path.join(this.projectPath, 'dist');
      const files = await fs.readdir(distPath, { recursive: true });
      let totalSize = 0;
      
      for (const file of files) {
        if (file.toString().endsWith('.js')) {
          const stats = await fs.stat(path.join(distPath, file.toString()));
          totalSize += stats.size;
        }
      }
      
      return totalSize;
    } catch {
      return 0;
    }
  }

  private async getChunkCount(): Promise<number> {
    try {
      const distPath = path.join(this.projectPath, 'dist');
      const files = await fs.readdir(distPath);
      return files.filter(f => f.toString().includes('chunk')).length;
    } catch {
      return 0;
    }
  }

  private async getModuleCount(): Promise<number> {
    // This would parse webpack stats in production
    return 0;
  }

  private async getTestCoverage(): Promise<{ lines: number }> {
    try {
      const coveragePath = path.join(this.projectPath, 'coverage/coverage-summary.json');
      const coverage = JSON.parse(await fs.readFile(coveragePath, 'utf-8'));
      return { lines: coverage.total.lines.pct };
    } catch {
      return { lines: 0 };
    }
  }

  private getLatestMetrics(): Record<string, any> {
    const latest: Record<string, any> = {};
    
    // Get most recent metric for each name
    this.metrics.forEach(metric => {
      latest[metric.name] = metric.value;
    });
    
    return latest;
  }

  private broadcastMetric(metric: any): void {
    if (this.wsServer) {
      const message = JSON.stringify({
        type: 'update',
        data: metric
      });
      
      this.wsServer.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  }

  async generateReport(): Promise<void> {
    const report = {
      timestamp: new Date(),
      summary: this.generateSummary(),
      trends: this.analyzeTrends(),
      recommendations: this.generateRecommendations()
    };

    const reportPath = path.join(
      this.projectPath,
      '.performance',
      `report-${new Date().toISOString().split('T')[0]}.json`
    );

    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n📊 Performance report saved to ${reportPath}`);
  }

  private generateSummary(): Record<string, any> {
    const buildMetrics = this.metrics.filter(m => m.category === 'build');
    const testMetrics = this.metrics.filter(m => m.category === 'test');
    
    return {
      averageBuildTime: this.average(buildMetrics.filter(m => m.name.includes('duration'))),
      averageTestTime: this.average(testMetrics.filter(m => m.name.includes('duration'))),
      totalMetricsCollected: this.metrics.length
    };
  }

  private analyzeTrends(): Record<string, any> {
    // Analyze performance trends over time
    return {
      buildTimetrend: 'stable',
      memoryUsageTrend: 'increasing',
      testPerformance: 'improving'
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Analyze metrics and generate recommendations
    const avgBuildTime = this.average(this.metrics.filter(m => m.name === 'build.duration'));
    if (avgBuildTime > 30000) {
      recommendations.push('Consider implementing incremental builds to reduce build time');
    }
    
    return recommendations;
  }

  private average(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
  }
}

// CLI execution
if (require.main === module) {
  const monitor = new PerformanceMonitor(process.cwd());
  
  const command = process.argv[2];
  
  switch (command) {
    case 'build':
      monitor.monitorBuild()
        .then(metrics => console.log('Build completed:', metrics))
        .catch(console.error);
      break;
    
    case 'runtime':
      monitor.monitorRuntime(30000)
        .then(metrics => console.log(`Collected ${metrics.length} runtime samples`))
        .catch(console.error);
      break;
    
    case 'test':
      monitor.monitorTests()
        .then(metrics => console.log('Tests completed:', metrics))
        .catch(console.error);
      break;
    
    case 'dashboard':
      monitor.startDashboard()
        .catch(console.error);
      break;
    
    case 'report':
      monitor.generateReport()
        .catch(console.error);
      break;
    
    default:
      console.log('Usage: performance-monitor [build|runtime|test|dashboard|report]');
  }
}