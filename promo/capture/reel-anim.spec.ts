import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { dismissCelebration } from '../../e2e/helpers';
import { setupDemo } from './reel-setup';

/**
 * Real animations of the app, frame by frame: the page clock is paused and
 * advanced 1/30 s between screenshots, so the app's own motion (chart line,
 * water level, steps track, set check) is recorded exactly as it plays.
 */
const OUT = path.resolve(__dirname, '../public/reel/seq');
test.use({ viewport: { width: 390, height: 797 }, deviceScaleFactor: 2 });

const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

async function sequence(page: Page, name: string, frames: number, act: () => Promise<void>) {
  if (ONLY && !ONLY.includes(name)) return;
  const dir = `${OUT}/${name}`;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const t = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(t + 50);
  await act();
  for (let i = 0; i < frames; i++) {
    await page.screenshot({ path: `${dir}/${String(i).padStart(3, '0')}.jpg`, type: 'jpeg', quality: 90 });
    await page.clock.runFor(i % 3 === 2 ? 34 : 33);
  }
  await page.clock.resume();
}

async function go(page: Page, path: string, scroll = 0) {
  await page.goto(path);
  await dismissCelebration(page);
  await page.waitForTimeout(1500);
  await page.evaluate((y) => window.scrollTo(0, y), scroll);
  await page.waitForTimeout(800);
}

test('reel animations', async ({ page }) => {
  test.setTimeout(600_000);
  await setupDemo(page);

  // Chart: the line draws itself when the range changes (the app's own animation).
  await go(page, '/progresos', 330);
  await page.getByRole('radio', { name: '6M' }).or(page.getByRole('button', { name: '6M', exact: true })).first().click();
  await page.waitForTimeout(1600);
  await page.evaluate(() => window.scrollTo(0, 330));
  await sequence(page, 'grafica', 54, async () => {
    await page.getByRole('radio', { name: '90D' }).or(page.getByRole('button', { name: '90D', exact: true })).first().click();
  });

  // Water: «500 ml» fills the day's goal.
  await go(page, '/habitos');
  await sequence(page, 'agua', 96, async () => {
    await page.getByRole('group', { name: 'Añadir agua' }).getByRole('button').nth(3).click();
  });
  await dismissCelebration(page);

  // Steps: «+2.500» completes the track.
  await go(page, '/habitos?tab=pasos');
  await sequence(page, 'pasos', 66, async () => {
    await page.getByRole('button', { name: /Sumar 2\.500 pasos/ }).click();
  });
  await dismissCelebration(page);

  // A set completed in a live session.
  await page.evaluate(async () => {
    const tr = await import('/src/db/repos/training.ts');
    const { db } = await import('/src/db/db.ts');
    const t = (await db.templates.toArray()).find((x) => x.name === 'Torso')!;
    await tr.startFromTemplate(t);
  });
  await go(page, '/entreno/sesion');
  await expect(page.getByRole('button', { name: 'Completar serie 1' }).first()).toBeVisible();
  await sequence(page, 'serie', 30, async () => {
    await page.getByRole('button', { name: 'Completar serie 1' }).first().click();
  });
});
