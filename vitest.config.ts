import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    include: ['integration-test/browser/**/*.browser.spec.ts'],
    globalSetup: ['./integration-test/browser/global-setup.ts'],
    fileParallelism: false,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium', name: 'chromium' }],
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage-browser',
    },
  },
});
