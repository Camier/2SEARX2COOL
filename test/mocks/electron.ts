import { vi } from 'vitest';

// Mock Electron APIs for testing
export const app = {
  getName: () => '2searx2cool-test',
  getVersion: () => '0.0.0-test',
  getPath: (name: string) => `/tmp/2searx2cool-test/${name}`,
  getAppPath: () => '/tmp/2searx2cool-test/app',
  isPackaged: false,
  quit: vi.fn(),
  exit: vi.fn(),
  relaunch: vi.fn(),
  focus: vi.fn(),
  hide: vi.fn(),
  show: vi.fn(),
  setAppUserModelId: vi.fn(),
  requestSingleInstanceLock: () => true,
  on: vi.fn(),
  once: vi.fn(),
  whenReady: () => Promise.resolve(),
  dock: {
    setBadge: vi.fn(),
    getBadge: () => '',
    hide: vi.fn(),
    show: vi.fn()
  }
};

export const BrowserWindow = vi.fn().mockImplementation(() => ({
  id: Math.random(),
  webContents: {
    send: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    openDevTools: vi.fn(),
    closeDevTools: vi.fn(),
    isDevToolsOpened: () => false,
    setWindowOpenHandler: vi.fn()
  },
  loadURL: vi.fn(),
  loadFile: vi.fn(),
  close: vi.fn(),
  destroy: vi.fn(),
  minimize: vi.fn(),
  maximize: vi.fn(),
  unmaximize: vi.fn(),
  isMaximized: () => false,
  isMinimized: () => false,
  isDestroyed: () => false,
  setFullScreen: vi.fn(),
  isFullScreen: () => false,
  setBounds: vi.fn(),
  getBounds: () => ({ x: 0, y: 0, width: 800, height: 600 }),
  setSize: vi.fn(),
  getSize: () => [800, 600],
  setPosition: vi.fn(),
  getPosition: () => [0, 0],
  center: vi.fn(),
  setTitle: vi.fn(),
  getTitle: () => 'Test Window',
  flashFrame: vi.fn(),
  setSkipTaskbar: vi.fn(),
  setProgressBar: vi.fn(),
  setOverlayIcon: vi.fn(),
  setAlwaysOnTop: vi.fn(),
  isAlwaysOnTop: () => false,
  on: vi.fn(),
  once: vi.fn(),
  removeAllListeners: vi.fn(),
  focus: vi.fn(),
  blur: vi.fn(),
  isFocused: () => true,
  restore: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  isVisible: () => true
}));

// Add static methods
BrowserWindow.getAllWindows = () => [];
BrowserWindow.getFocusedWindow = () => null;
BrowserWindow.fromId = () => null;
BrowserWindow.fromWebContents = () => null;

export const ipcMain = {
  on: vi.fn(),
  once: vi.fn(),
  handle: vi.fn(),
  handleOnce: vi.fn(),
  removeHandler: vi.fn(),
  removeAllListeners: vi.fn(),
  emit: vi.fn(),
  eventNames: () => [],
  listenerCount: () => 0,
  invoke: vi.fn()
};

export const ipcRenderer = {
  send: vi.fn(),
  sendSync: vi.fn(),
  sendTo: vi.fn(),
  sendToHost: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
  invoke: vi.fn()
};

export const dialog = {
  showOpenDialog: vi.fn(),
  showOpenDialogSync: vi.fn(),
  showSaveDialog: vi.fn(),
  showSaveDialogSync: vi.fn(),
  showMessageBox: vi.fn(),
  showMessageBoxSync: vi.fn(),
  showErrorBox: vi.fn(),
  showCertificateTrustDialog: vi.fn()
};

export const Menu = {
  buildFromTemplate: vi.fn(),
  setApplicationMenu: vi.fn(),
  getApplicationMenu: vi.fn()
};

export const Tray = vi.fn().mockImplementation(() => ({
  setToolTip: vi.fn(),
  setTitle: vi.fn(),
  setImage: vi.fn(),
  setPressedImage: vi.fn(),
  setContextMenu: vi.fn(),
  getBounds: () => ({ x: 0, y: 0, width: 22, height: 22 }),
  isDestroyed: () => false,
  destroy: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  removeAllListeners: vi.fn()
}));

export const shell = {
  openExternal: vi.fn(),
  openPath: vi.fn(),
  showItemInFolder: vi.fn(),
  moveItemToTrash: vi.fn(),
  beep: vi.fn()
};

export const nativeImage = {
  createFromPath: vi.fn().mockReturnValue({
    resize: vi.fn().mockReturnThis(),
    crop: vi.fn().mockReturnThis(),
    getSize: () => ({ width: 16, height: 16 }),
    toPNG: () => Buffer.from(''),
    toJPEG: () => Buffer.from(''),
    toBitmap: () => Buffer.from(''),
    toDataURL: () => 'data:image/png;base64,'
  }),
  createFromBuffer: vi.fn(),
  createFromDataURL: vi.fn(),
  createEmpty: vi.fn()
};

export const session = {
  defaultSession: {
    setPermissionRequestHandler: vi.fn(),
    setPermissionCheckHandler: vi.fn(),
    clearCache: vi.fn(),
    clearStorageData: vi.fn(),
    getCacheSize: () => Promise.resolve(0),
    protocol: {
      registerFileProtocol: vi.fn(),
      registerHttpProtocol: vi.fn(),
      registerStringProtocol: vi.fn(),
      registerBufferProtocol: vi.fn(),
      unregisterProtocol: vi.fn(),
      isProtocolRegistered: () => false
    }
  }
};

export const protocol = {
  registerFileProtocol: vi.fn(),
  registerHttpProtocol: vi.fn(),
  registerStringProtocol: vi.fn(),
  registerBufferProtocol: vi.fn(),
  unregisterProtocol: vi.fn(),
  isProtocolRegistered: () => false
};

export const contextBridge = {
  exposeInMainWorld: vi.fn()
};

export const autoUpdater = {
  checkForUpdates: vi.fn(),
  checkForUpdatesAndNotify: vi.fn(),
  downloadUpdate: vi.fn(),
  quitAndInstall: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  removeAllListeners: vi.fn(),
  setFeedURL: vi.fn()
};

// Export all mocks
export default {
  app,
  BrowserWindow,
  ipcMain,
  ipcRenderer,
  dialog,
  Menu,
  Tray,
  shell,
  nativeImage,
  session,
  protocol,
  contextBridge,
  autoUpdater
};