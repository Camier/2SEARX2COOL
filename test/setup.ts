import { vi } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.ELECTRON_IS_DEV = '0';

// Create a temporary directory for test databases
const testDir = path.join(os.tmpdir(), '2searx2cool-test', Date.now().toString());

beforeAll(async () => {
  // Create test directory
  await fs.mkdir(testDir, { recursive: true });
  
  // Mock app.getPath to use test directory
  vi.mock('electron', async () => {
    const actual = await vi.importActual('electron') as any;
    return {
      ...actual,
      app: {
        ...actual.app,
        getPath: (name: string) => {
          if (name === 'userData') {
            return testDir;
          }
          return actual.app.getPath(name);
        },
        getName: () => '2searx2cool-test',
        getVersion: () => '0.0.0-test',
        quit: vi.fn(),
        exit: vi.fn(),
        on: vi.fn(),
        whenReady: () => Promise.resolve()
      }
    };
  });
});

afterAll(async () => {
  // Clean up test directory
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch (error) {
    console.warn('Failed to clean up test directory:', error);
  }
});

// Global test utilities
global.testHelpers = {
  getTestDir: () => testDir,
  
  createTestFile: async (filename: string, content: string) => {
    const filepath = path.join(testDir, filename);
    await fs.writeFile(filepath, content);
    return filepath;
  },
  
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
};

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };
beforeEach(() => {
  console.log = vi.fn();
  console.debug = vi.fn();
  console.warn = vi.fn();
  // Keep error for debugging
  console.error = originalConsole.error;
});

afterEach(() => {
  Object.assign(console, originalConsole);
});