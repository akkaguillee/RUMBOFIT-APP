import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { dismissCelebration, noHorizontalOverflow, onboard } from './helpers';

// Single-file build produced by `npm run build:html`.
const filePath = fileURLToPath(new URL('../dist-html/rumbo.html', import.meta.url));
const fileUrl = `file://${filePath}`;

test.describe('RUMBO · archivo HTML autónomo', () => {
  test.skip(!existsSync(filePath), 'Ejecuta `npm run build:html` antes de estas pruebas.');

  test('works from disk with hash routes and keeps data after reload', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      if (!/^(file|data|blob):/.test(r.url())) external.push(r.url());
    });
    await onboard(page, 'Guille', fileUrl);
    await page.getByRole('link', { name: /Progres/ }).first().click();
    await expect(page).toHaveURL(/#\/progresos$/);
    await expect(page.getByRole('heading', { name: 'Tu evolución' })).toBeVisible();
    await page.goto(`${fileUrl}#/calendario`);
    await expect(page.getByRole('heading', { name: 'Tu historial' })).toBeVisible();
    await page.reload();
    await dismissCelebration(page);
    await expect(page.getByRole('heading', { name: 'Tu historial' })).toBeVisible();
    await page.goto(`${fileUrl}#/`);
    await expect(page.getByRole('heading', { name: /Guille/ })).toBeVisible();
    await expect(page.getByText('Modo temporal')).toHaveCount(0);
    await noHorizontalOverflow(page);
    expect(external, 'the standalone file must not load anything from the network').toEqual([]);
  });

  test('skip link focuses the content without breaking hash routing', async ({ page }) => {
    await onboard(page, 'Guille', fileUrl);
    await page.goto(`${fileUrl}#/hitos`);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/hitos$/);
    await expect(page.locator('#main')).toBeFocused();
  });

  test('falls back to a clearly labelled temporary mode when storage is blocked', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', { configurable: true, get: () => undefined });
    });
    await onboard(page, 'Guille', fileUrl);
    await expect(page.getByRole('alert').filter({ hasText: 'Modo temporal' })).toBeVisible();
    await page.getByRole('link', { name: /Hábitos/ }).first().click();
    await page.getByRole('button', { name: '250 ml' }).click();
    await expect(page.locator('.vessel__value')).toHaveText('250 ml');
    // Nothing is kept after reloading in temporary mode.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Empezar' })).toBeVisible();
  });
});
