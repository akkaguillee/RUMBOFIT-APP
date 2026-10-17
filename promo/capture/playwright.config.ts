import { defineConfig, devices } from '@playwright/test';

/**
 * Captures of the real app for the reel (run from the repository root):
 *   npx playwright test -c promo/capture/playwright.config.ts
 * Stills go to promo/public/reel as 3× PNG and animations to public/reel/seq;
 * promo/capture/convert.py turns the stills into the 2× JPEGs the video uses.
 */
export default defineConfig({
  testDir: '.',
  timeout: 600_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5199' },
  webServer: { command: 'npx vite --port 5199 --strictPort', url: 'http://localhost:5199', reuseExistingServer: true, cwd: '../..' },
  projects: [{ name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium' } }],
});
