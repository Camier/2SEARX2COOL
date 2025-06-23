import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';

async function globalSetup(config: FullConfig) {
  // Ensure test data directory exists
  const testDataDir = path.join(__dirname, 'test-data');
  await fs.mkdir(testDataDir, { recursive: true });

  // Clear any previous test data
  const files = await fs.readdir(testDataDir);
  for (const file of files) {
    await fs.unlink(path.join(testDataDir, file)).catch(() => {});
  }

  // Set up test environment variables
  process.env.NODE_ENV = 'test';
  process.env.SEARXNG_TEST_MODE = 'true';

  console.log('Global setup completed');
}

export default globalSetup;