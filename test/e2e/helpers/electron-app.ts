import { _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';

export class ElectronApp {
  private app: ElectronApplication | null = null;
  private window: Page | null = null;

  async launch(options: { 
    args?: string[];
    env?: Record<string, string>;
  } = {}) {
    // Build the Electron app path
    const electronPath = require('electron');
    const appPath = path.join(__dirname, '../../..');

    // Launch Electron app
    this.app = await electron.launch({
      args: [appPath, ...(options.args || [])],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ...options.env
      }
    });

    // Get the first window
    this.window = await this.app.firstWindow();
    
    // Wait for app to be ready
    await this.window.waitForLoadState('networkidle');

    return this;
  }

  async close() {
    if (this.app) {
      await this.app.close();
      this.app = null;
      this.window = null;
    }
  }

  getWindow(): Page {
    if (!this.window) {
      throw new Error('App not launched');
    }
    return this.window;
  }

  getApp(): ElectronApplication {
    if (!this.app) {
      throw new Error('App not launched');
    }
    return this.app;
  }

  async evaluate(fn: Function, ...args: any[]) {
    if (!this.app) {
      throw new Error('App not launched');
    }
    return this.app.evaluate(fn, ...args);
  }

  async waitForEvent(event: string, timeout = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeout);

      this.evaluate((eventName: string) => {
        return new Promise((res) => {
          // @ts-ignore - accessing Electron APIs
          require('electron').ipcRenderer.once(eventName, (event, data) => {
            res(data);
          });
        });
      }, event).then((data) => {
        clearTimeout(timer);
        resolve(data);
      }).catch(reject);
    });
  }

  async invokeIPC(channel: string, ...args: any[]): Promise<any> {
    return this.evaluate((ch: string, ...a: any[]) => {
      // @ts-ignore - accessing Electron APIs
      return require('electron').ipcRenderer.invoke(ch, ...a);
    }, channel, ...args);
  }
}