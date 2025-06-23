import { FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';

async function globalTeardown(config: FullConfig) {
  // Clean up test data
  const testDataDir = path.join(__dirname, 'test-data');
  try {
    await fs.rm(testDataDir, { recursive: true, force: true });
  } catch (error) {
    console.warn('Failed to clean up test data:', error);
  }

  console.log('Global teardown completed');
}

export default globalTeardown;