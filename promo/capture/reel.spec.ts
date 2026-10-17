import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import { dismissCelebration } from '../../e2e/helpers';
import { setupDemo } from './reel-setup';

/**
 * Real captures of the current app for the reel, with a clearly fictitious demo
 * profile («Alex») and demo records written through the app's own repositories.
 * 390 × 797 pt (an iPhone 13 below the status bar) at 3×.
 */
const OUT = path.resolve(__dirname, '../public/reel');
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

test.use({ viewport: { width: 390, height: 797 }, deviceScaleFactor: 3 });

type Box = { x: number; y: number; w: number; h: number };
const boxes: Record<string, Record<string, Box>> = {};

async function box(name: string, key: string, loc: Locator) {
  const b = await loc.first().boundingBox({ timeout: 3000 }).catch(() => null);
  if (!b) {
    console.log(`no box: ${name}.${key}`);
    return;
  }
  const scrollY = await loc.page().evaluate(() => window.scrollY);
  (boxes[name] ??= {})[key] = { x: Math.round(b.x * 10) / 10, y: Math.round((b.y + scrollY) * 10) / 10, w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 };
}

async function shot(page: Page, name: string, full = false) {
  if (ONLY && !ONLY.some((o) => name.startsWith(o))) return;
  await page.waitForTimeout(1500);
  // Full pages are scrolled inside the video under the real bars (taken from the viewport shots).
  const hide = full ? await page.addStyleTag({ content: '.topbar, .tabbar { visibility: hidden !important; }' }) : null;
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full, animations: 'disabled' });
  if (hide) await hide.evaluate((el) => (el as Element).remove());
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  (boxes[name] ??= {}).page = { x: 0, y: 0, w: 390, h: full ? h : 797 };
}

/** A viewport shot after a real scroll (the top bar shows its scrolled state). */
async function scrolled(page: Page, name: string, y: number) {
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await page.waitForTimeout(700);
  const real = await page.evaluate(() => window.scrollY);
  await shot(page, name);
  (boxes[name] ??= {}).scroll = { x: 0, y: real, w: 390, h: 797 };
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function go(page: Page, path: string) {
  await page.goto(path);
  await dismissCelebration(page);
  await page.evaluate(() => window.scrollTo(0, 0));
}


test('reel captures', async ({ page }) => {
  test.setTimeout(600_000);
  fs.mkdirSync(OUT, { recursive: true });
  await setupDemo(page, {
    welcome: async (p) => {
      await shot(p, 'bienvenida');
      await box('bienvenida', 'cta', p.getByRole('button', { name: 'Empezar', exact: true }));
    },
  });

  // ── Dark, violet ─────────────────────────────────────────────────────────
  await go(page, '/');
  await shot(page, 'inicio');
  await box('inicio', 'theme', page.getByRole('button', { name: /Cambiar a modo/ }));
  await box('inicio', 'accent', page.getByRole('button', { name: 'Cambiar el color de la interfaz' }));
  await box('inicio', 'streak', page.locator('.streak-card'));
  await shot(page, 'inicio-full', true);
  await box('inicio-full', 'streak', page.locator('.streak-card'));
  await scrolled(page, 'inicio-racha', 860);

  await go(page, '/progresos');
  await shot(page, 'progreso');
  await box('progreso', 'chart', page.locator('.wchart').first());
  await shot(page, 'progreso-full', true);
  await scrolled(page, 'progreso-grafica', 330);
  // A real tap on a point of the chart: the app shows that record.
  await page.evaluate(() => window.scrollTo(0, 330));
  await page.waitForTimeout(600);
  {
    const c = await page.locator('.wchart').first().boundingBox();
    if (c) await page.mouse.click(c.x + c.width * 0.62, c.y + c.height * 0.4);
  }
  await page.waitForTimeout(900);
  await shot(page, 'progreso-tip');
  (boxes['progreso-tip'] ??= {}).scroll = { x: 0, y: await page.evaluate(() => window.scrollY), w: 390, h: 797 };
  await box('progreso-tip', 'tip', page.locator('.wchart__tip'));
  await go(page, '/progresos?tab=registros');
  await shot(page, 'registros');
  await shot(page, 'registros-full', true);
  await go(page, '/progresos?tab=imc');
  await shot(page, 'imc');
  await shot(page, 'imc-full', true);
  await go(page, '/progresos?tab=calorias');
  await shot(page, 'calorias');
  await shot(page, 'calorias-full', true);

  await go(page, '/entreno');
  await shot(page, 'entreno');
  await shot(page, 'entreno-full', true);
  await scrolled(page, 'entreno-plan', 1250);
  await go(page, '/entreno?tab=plantillas');
  await shot(page, 'rutinas');
  await shot(page, 'rutinas-full', true);
  await go(page, '/entreno?tab=historial');
  await shot(page, 'historial');
  await shot(page, 'historial-full', true);
  await go(page, '/entreno?tab=stats');
  await shot(page, 'stats-full', true);
  await box('stats-full', 'marcas', page.locator('[aria-labelledby="st-prs"]'));
  await scrolled(page, 'stats-marcas', 2100);

  await go(page, '/habitos');
  await shot(page, 'agua');
  await box('agua', 'presets', page.getByRole('group', { name: 'Añadir agua' }));
  await box('agua', 'p500', page.getByRole('group', { name: 'Añadir agua' }).getByRole('button').nth(3));
  await shot(page, 'agua-full', true);
  // A real tap on «500 ml»: the day reaches its goal.
  await page.getByRole('group', { name: 'Añadir agua' }).getByRole('button').nth(3).click();
  await page.waitForTimeout(1800);
  if (await page.getByRole('button', { name: 'Seguir avanzando' }).isVisible()) {
    await shot(page, 'hito-celebracion');
    await dismissCelebration(page);
    await page.waitForTimeout(600);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, 'agua-meta');
  await go(page, '/habitos?tab=pasos');
  await shot(page, 'pasos');
  await box('pasos', 'quick', page.getByRole('group', { name: /Sumar pasos/ }));
  await shot(page, 'pasos-full', true);
  await page.getByRole('button', { name: /Sumar 2\.500 pasos/ }).click();
  await page.waitForTimeout(2200);
  if (await page.getByRole('button', { name: 'Seguir avanzando' }).isVisible()) {
    await shot(page, 'hito-celebracion-2');
    await dismissCelebration(page);
    await page.waitForTimeout(600);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, 'pasos-meta');

  await go(page, '/calendario');
  await shot(page, 'calendario');
  await shot(page, 'calendario-full', true);

  await go(page, '/hitos');
  await shot(page, 'hitos');
  await shot(page, 'hitos-full', true);

  await go(page, '/perfil');
  await shot(page, 'perfil-full', true);
  await box('perfil-full', 'privacidad', page.locator('#data'));

  // Accent picker, opened from the top bar.
  await go(page, '/');
  await page.getByRole('button', { name: 'Cambiar el color de la interfaz' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForTimeout(900);
  await shot(page, 'acento-selector');
  await box('acento-selector', 'grid', page.getByRole('radiogroup', { name: 'Color de la interfaz' }));
  for (const name of ['Violeta', 'Rojo', 'Naranja', 'Lima', 'Cian', 'Fucsia']) await box('acento-selector', name, page.getByRole('radio', { name: new RegExp(`^${name}`) }));

  // Accents on the same screen (dark).
  for (const accent of ['cian', 'fucsia', 'naranja', 'volt', 'rojo']) {
    await page.evaluate((a) => localStorage.setItem('rumbo.accent', a), accent);
    await go(page, '/');
    await shot(page, `inicio-${accent}`);
  }
  await page.evaluate(() => localStorage.setItem('rumbo.accent', 'violeta'));

  // Light theme through the real toggle, then the same screens.
  await go(page, '/');
  await page.getByRole('button', { name: 'Cambiar a modo claro' }).click();
  await page.waitForTimeout(1200);
  await shot(page, 'inicio-claro');
  await box('inicio-claro', 'theme', page.getByRole('button', { name: /Cambiar a modo/ }));
  await go(page, '/progresos');
  await shot(page, 'progreso-claro');
  for (const accent of ['cian', 'fucsia']) {
    await page.evaluate((a) => localStorage.setItem('rumbo.accent', a), accent);
    await go(page, '/');
    await shot(page, `inicio-claro-${accent}`);
  }
  await page.evaluate(() => {
    localStorage.setItem('rumbo.accent', 'violeta');
    localStorage.setItem('rumbo.theme', 'dark');
  });

  // Active session: one set completed with a real tap.
  await page.evaluate(async () => {
    const tr = await import('/src/db/repos/training.ts');
    const { db } = await import('/src/db/db.ts');
    const t = (await db.templates.toArray()).find((x) => x.name === 'Torso')!;
    await tr.startFromTemplate(t);
  });
  await go(page, '/entreno/sesion');
  await shot(page, 'sesion');
  await box('sesion', 'set1', page.getByRole('button', { name: 'Completar serie 1' }));
  await page.getByRole('button', { name: 'Completar serie 1' }).first().click();
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, 'sesion-hecha');
  await box('sesion-hecha', 'set1', page.getByRole('button', { name: 'Desmarcar serie 1' }));
  await page.getByRole('button', { name: 'Completar serie 2' }).first().click();
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, 'sesion-hecha2');

  const prev = fs.existsSync(`${OUT}/boxes.json`) && ONLY ? JSON.parse(fs.readFileSync(`${OUT}/boxes.json`, 'utf8')) : {};
  fs.writeFileSync(`${OUT}/boxes.json`, JSON.stringify({ ...prev, ...boxes }, null, 1));
});
