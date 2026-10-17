import path from 'node:path';
import { test } from '@playwright/test';
import { setupDemo } from './reel-setup';

/** The weight chart without its drawn layers (line, trend, area, points), to draw them on video exactly over it. */
test.use({ viewport: { width: 390, height: 797 }, deviceScaleFactor: 3 });

test('chart base', async ({ page }) => {
  test.setTimeout(300_000);
  await setupDemo(page);
  await page.goto('/progresos');
  await page.waitForTimeout(1800);
  await page.evaluate(() => window.scrollTo(0, 330));
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.resolve(__dirname, '../public/reel/progreso-grafica.png') });
  await page.addStyleTag({ content: '.wchart__svg path, .wchart__dot { visibility: hidden !important; }' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.resolve(__dirname, '../public/reel/progreso-grafica-base.png') });
});
