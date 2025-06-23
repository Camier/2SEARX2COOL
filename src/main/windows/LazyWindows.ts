import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';
import { createLazyModule, lazyLoader } from '../utils/LazyLoader';
import log from 'electron-log';

export interface WindowModule {
  create: (options?: Partial<BrowserWindowConstructorOptions>) => BrowserWindow;
  show: () => void;
  hide: () => void;
  isVisible: () => boolean;
  getInstance: () => BrowserWindow | null;
  cleanup: () => Promise<void>;
}

// Settings Window - Lazy loaded
export const settingsWindowModule = createLazyModule<WindowModule>(
  'settingsWindow',
  async () => {
    const { app } = await import('electron');
    const { join } = await import('path');
    
    let window: BrowserWindow | null = null;

    return {
      create(options?: Partial<BrowserWindowConstructorOptions>) {
        if (window && !window.isDestroyed()) {
          return window;
        }

        window = new BrowserWindow({
          width: 800,
          height: 600,
          title: 'Settings',
          show: false,
          frame: true,
          resizable: true,
          minimizable: true,
          maximizable: false,
          webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false
          },
          ...options
        });

        window.loadFile(join(__dirname, '../renderer/settings.html'));

        window.once('ready-to-show', () => {
          window?.show();
        });

        window.on('closed', () => {
          window = null;
        });

        return window;
      },

      show() {
        if (!window || window.isDestroyed()) {
          this.create();
        }
        window?.show();
        window?.focus();
      },

      hide() {
        window?.hide();
      },

      isVisible() {
        return window?.isVisible() || false;
      },

      getInstance() {
        return window;
      },

      async cleanup() {
        if (window && !window.isDestroyed()) {
          window.close();
        }
        window = null;
      }
    };
  }
);

// About Window - Lazy loaded
export const aboutWindowModule = createLazyModule<WindowModule>(
  'aboutWindow',
  async () => {
    const { app, shell } = await import('electron');
    const { join } = await import('path');
    
    let window: BrowserWindow | null = null;

    return {
      create(options?: Partial<BrowserWindowConstructorOptions>) {
        if (window && !window.isDestroyed()) {
          return window;
        }

        window = new BrowserWindow({
          width: 400,
          height: 500,
          title: 'About 2SEARX2COOL',
          show: false,
          frame: true,
          resizable: false,
          minimizable: false,
          maximizable: false,
          webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false
          },
          ...options
        });

        window.loadFile(join(__dirname, '../renderer/about.html'));

        // Handle external links
        window.webContents.setWindowOpenHandler(({ url }) => {
          shell.openExternal(url);
          return { action: 'deny' };
        });

        window.once('ready-to-show', () => {
          window?.show();
        });

        window.on('closed', () => {
          window = null;
        });

        return window;
      },

      show() {
        if (!window || window.isDestroyed()) {
          this.create();
        }
        window?.show();
        window?.focus();
      },

      hide() {
        window?.hide();
      },

      isVisible() {
        return window?.isVisible() || false;
      },

      getInstance() {
        return window;
      },

      async cleanup() {
        if (window && !window.isDestroyed()) {
          window.close();
        }
        window = null;
      }
    };
  }
);

// Plugin Manager Window - Lazy loaded
export const pluginManagerWindowModule = createLazyModule<WindowModule>(
  'pluginManagerWindow',
  async () => {
    const { app } = await import('electron');
    const { join } = await import('path');
    
    let window: BrowserWindow | null = null;

    return {
      create(options?: Partial<BrowserWindowConstructorOptions>) {
        if (window && !window.isDestroyed()) {
          return window;
        }

        window = new BrowserWindow({
          width: 900,
          height: 700,
          title: 'Plugin Manager',
          show: false,
          frame: true,
          resizable: true,
          webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false
          },
          ...options
        });

        window.loadFile(join(__dirname, '../renderer/plugins.html'));

        window.once('ready-to-show', () => {
          window?.show();
        });

        window.on('closed', () => {
          window = null;
        });

        return window;
      },

      show() {
        if (!window || window.isDestroyed()) {
          this.create();
        }
        window?.show();
        window?.focus();
      },

      hide() {
        window?.hide();
      },

      isVisible() {
        return window?.isVisible() || false;
      },

      getInstance() {
        return window;
      },

      async cleanup() {
        if (window && !window.isDestroyed()) {
          window.close();
        }
        window = null;
      }
    };
  }
);

// Register all window modules
export function registerWindowModules(): void {
  lazyLoader.register(settingsWindowModule);
  lazyLoader.register(aboutWindowModule);
  lazyLoader.register(pluginManagerWindowModule);
  
  log.info('Window modules registered for lazy loading');
}

// Helper to open lazy windows
export async function openWindow(windowName: 'settings' | 'about' | 'pluginManager'): Promise<void> {
  const moduleMap = {
    settings: 'settingsWindow',
    about: 'aboutWindow',
    pluginManager: 'pluginManagerWindow'
  };

  const moduleName = moduleMap[windowName];
  if (!moduleName) {
    throw new Error(`Unknown window: ${windowName}`);
  }

  const windowModule = await lazyLoader.get<WindowModule>(moduleName);
  windowModule.show();
}