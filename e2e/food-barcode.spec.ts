import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { encodeEan } from '../src/domain/nutrition/ean';
import { CODE, mockFoodFunctions } from './food-mocks';
import { onboard } from './helpers';

/** A camera video (YUV4MPEG2) of a printed EAN-13 label, for the live barcode reader. */
function barcodeVideo(): string {
  const W = 640;
  const H = 480;
  const dir = join(tmpdir(), 'rumbo-e2e');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `ean-${CODE}.y4m`);
  const modules = encodeEan(CODE);
  const unit = 3;
  const left = Math.round((W - modules.length * unit) / 2);
  const y = Buffer.alloc(W * H, 228);
  for (let row = 150; row < 330; row++)
    modules.forEach((dark, m) => {
      if (dark) y.fill(24, row * W + left + m * unit, row * W + left + (m + 1) * unit);
    });
  const chroma = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
  const frame = Buffer.concat([Buffer.from('FRAME\n'), y, chroma]);
  writeFileSync(file, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`), ...Array.from({ length: 10 }, () => frame)]));
  return file;
}

// Chromium's fake camera plays the label video; the code is read in the page.
test.use({
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${barcodeVideo()}`] },
  permissions: ['camera'],
});

test.describe('Escáner de alimentos · código de barras en directo', () => {
  test('reads an EAN-13 from the camera on the device and shows the product per serving', async ({ page }) => {
    const calls = await mockFoodFunctions(page);
    await onboard(page);
    await page.goto('/habitos/escaner?modo=codigo');
    await page.getByRole('button', { name: 'Entendido, empezar' }).click();
    await expect(page.getByRole('heading', { name: 'Yogur natural' })).toBeVisible({ timeout: 15_000 });
    expect(calls.barcode).toEqual([CODE]);
    // Nothing was sent for analysis: the code was read in the browser.
    expect(calls.analyze).toEqual([]);
    await expect(page.getByText('Datos del envase · Open Food Facts')).toBeVisible();
    await expect(page.locator('.tile--kcal')).toContainText('75');
    await page.getByRole('radio', { name: 'Por 100 g' }).click();
    await expect(page.locator('.tile--kcal')).toContainText('60');
    await page.getByRole('button', { name: 'Guardar en mi registro' }).click();
    await expect(page.getByRole('heading', { name: /^Guardado en/ })).toBeVisible();
  });
});
