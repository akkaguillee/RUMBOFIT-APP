// Captures the real RUMBO screens used by the «Cada pequeño paso cuenta» ad.
//
//   npm run build && npx vite preview --port 4173    (from the repository root)
//   node promo/capture/capture-pasos.mjs [--out promo/public/pasos]
//
// A clean phone-sized browser (390 × 844 pt at 3×) completes the real
// onboarding as the fictional user «Alex», loads the demo data from seed.mjs
// into the app's IndexedDB and saves each screen. Every network request made
// during the run is logged to network.json (the privacy check of the ad).

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, devices, expect } from '@playwright/test';
import { buildDemo, writeDemo } from './seed.mjs';

// Dates are computed in the same zone as the capture browser.
process.env.TZ = 'Europe/Madrid';
/** A Monday morning, so the plan shows a session and Rumbi is awake (the app's mascot gets sleepy after 22:00). */
const NOW = new Date(process.env.RUMBO_NOW ?? '2026-10-19T10:30:00+02:00').getTime();

const BASE = process.env.RUMBO_URL ?? 'http://localhost:4173';
const outArg = process.argv.indexOf('--out');
const OUT = path.resolve(outArg > 0 ? process.argv[outArg + 1] : 'promo/public/pasos');
mkdirSync(OUT, { recursive: true });

const requests = [];
const boxes = {};

function dateKey(offset) {
  const d = new Date(NOW);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function settle(page, ms = 1400) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(ms);
}

async function dismissCelebration(page) {
  for (let i = 0; i < 6; i++) {
    const btn = page.getByRole('button', { name: /Seguir avanzando|Continuar|Genial|Cerrar celebración/ }).first();
    try {
      await btn.waitFor({ state: 'visible', timeout: 1800 });
      await btn.click();
      await page.waitForTimeout(700);
    } catch {
      return;
    }
  }
}

/** Screens the video uses (the walk-through visits a few more to reach them). */
const USED = new Set(["acentos", "acentos-cian", "calendario", "calorias", "historial", "historial-480", "hoy-antes", "hoy-despues", "imc", "inicio", "inicio-1040", "inicio-520", "inicio-cian", "inicio-cian-claro", "inicio-fucsia", "inicio-naranja", "inicio-violeta", "inicio-volt", "marcas", "plantillas", "progreso-todo", "sesion", "sesion-serie", "stats"]);

async function shot(page, name, opts = {}) {
  if (!USED.has(name)) return;
  // Park the pointer over the page background so no hover state is captured.
  await page.mouse.move(195, 838);
  await settle(page, opts.wait ?? 1400);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), animations: 'allow', ...opts.screenshot });
  console.log('·', name);
}

/** The whole page without its fixed bars (layout unchanged), so the video can scroll it under the real header and tab bar. */
async function fullPage(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const style = await page.addStyleTag({ content: '.topbar, .tabbar { visibility: hidden !important; }' });
  await page.mouse.move(195, 838);
  await settle(page, 900);
  await page.screenshot({ path: path.join(OUT, `${name}-full.png`), fullPage: true, animations: 'allow' });
  await style.evaluate((el) => el.remove());
  console.log('·', `${name}-full`);
}

async function box(page, key, locator) {
  const b = await locator.boundingBox();
  if (b) boxes[key] = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
}

async function advance(page, name = 'Continuar') {
  const screen = page.locator('.onb__step');
  const before = await screen.getAttribute('data-screen');
  await page.getByRole('button', { name, exact: true }).click();
  await expect(screen).not.toHaveAttribute('data-screen', before ?? '');
  await expect(screen).toHaveCount(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices['iPhone 13'],
  // The whole phone screen (390 × 844 pt), not the area left by Safari's bars.
  viewport: { width: 390, height: 844 },
  screen: { width: 390, height: 844 },
  locale: 'es-ES',
  timezoneId: 'Europe/Madrid',
  colorScheme: 'dark',
});
await context.clock.setFixedTime(NOW);
const page = await context.newPage();
page.on('request', (r) => {
  const url = new URL(r.url());
  requests.push({ method: r.method(), origin: url.origin, path: url.pathname, type: r.resourceType(), body: r.postData()?.length ?? 0 });
});

// The full logo intro would cover the first screen; the app lets users switch it off.
await page.addInitScript(() => localStorage.setItem('rumbo.intro', 'off'));
// The floating Rumbi is a real setting (Perfil → Rumbi flotante); the ad animates Rumbi outside the phone instead.
await page.addInitScript(() => {
  if (!localStorage.getItem('rumbo.rumbi')) localStorage.setItem('rumbo.rumbi', JSON.stringify({ enabled: false, side: 'right', y: 0.78 }));
});
await page.goto(BASE);

// ── Welcome (onboarding) ──
await shot(page, 'bienvenida', { wait: 2200 });

await advance(page, 'Empezar');
await page.getByRole('textbox', { name: 'Nombre o alias' }).fill('Alex');
await page.getByRole('textbox', { name: 'Edad' }).fill('29');
await page.getByRole('textbox', { name: 'Altura' }).fill('178');
await page.getByRole('textbox', { name: 'Peso actual' }).fill('78,6');
await page.getByRole('radio', { name: 'Hombre' }).click();
await page.getByRole('button', { name: /Empezaste antes/ }).click();
await page.getByRole('textbox', { name: 'Peso inicial' }).fill('81');
await page.getByRole('textbox', { name: 'Fecha de inicio' }).fill(dateKey(-56));
await advance(page);
await page.getByRole('radio', { name: /Perder grasa/ }).click();
await page.getByRole('textbox', { name: 'Peso objetivo' }).fill('77');
await advance(page);
await page.getByRole('radiogroup', { name: '¿Cómo pasas la mayor parte del día?' }).getByRole('radio', { name: /De pie/ }).click();
await page.getByRole('radiogroup', { name: '¿Cuántos días entrenas a la semana?' }).getByRole('radio', { name: '3 días', exact: true }).click();
await advance(page);
await advance(page, 'Ahora no');
await advance(page, 'Ahora no');
await page.getByRole('checkbox', { name: /Entiendo que estos datos se guardan solo en este dispositivo/ }).check();
await page.getByRole('button', { name: 'Crear mi RUMBO' }).click();
await dismissCelebration(page);

// ── Demo data ──
await page.evaluate(writeDemo, buildDemo(NOW));
await page.reload();
await dismissCelebration(page);
await page.waitForTimeout(1500);
await dismissCelebration(page);

// ── Inicio ──
await page.goto(`${BASE}/`);
await dismissCelebration(page);
await shot(page, 'inicio');
await box(page, 'themeToggle', page.locator('.theme-toggle').first());
await box(page, 'accentButton', page.locator('.accent-btn').first());
for (const y of [520, 1040, 1560]) {
  await page.evaluate((top) => window.scrollTo(0, top), y);
  await shot(page, `inicio-${y}`, { wait: 900 });
}

await fullPage(page, 'inicio');

// ── Water: before and after the real «+ 250» button on Inicio ──
await page.evaluate(() => window.scrollTo(0, 0));
const add = page.getByRole('button', { name: /250/ }).first();
await add.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollTo(0, 260));
await shot(page, 'hoy-antes');
await box(page, 'add250', add);
await add.click();
await page.waitForTimeout(400);
await shot(page, 'hoy-despues', { wait: 1600 });
await dismissCelebration(page);

// ── Progresos ──
for (const [tab, name] of [['', 'progreso'], ['?tab=registros', 'registros'], ['?tab=imc', 'imc'], ['?tab=calorias', 'calorias']]) {
  await page.goto(`${BASE}/progresos${tab}`);
  await dismissCelebration(page);
  await shot(page, name, { wait: 1800 });
  await page.evaluate(() => window.scrollTo(0, 480));
  await shot(page, `${name}-480`, { wait: 1000 });
}

// ── Weight chart over the whole period ──
await page.goto(`${BASE}/progresos`);
await page.getByRole('radio', { name: 'Todo' }).or(page.getByRole('tab', { name: 'Todo' })).or(page.getByRole('button', { name: 'Todo', exact: true })).first().click();
await page.evaluate(() => window.scrollTo(0, 330));
await shot(page, 'progreso-todo', { wait: 1800 });

// ── Entreno ──
for (const [tab, name] of [['', 'entreno'], ['?tab=historial', 'historial'], ['?tab=plantillas', 'plantillas'], ['?tab=stats', 'stats']]) {
  await page.goto(`${BASE}/entreno${tab}`);
  await dismissCelebration(page);
  await shot(page, name, { wait: 1600 });
  if (name === 'historial') await fullPage(page, name);
  await page.evaluate(() => window.scrollTo(0, 480));
  await shot(page, `${name}-480`, { wait: 1000 });
}

// ── Hábitos ──
await page.goto(`${BASE}/habitos`);
await dismissCelebration(page);
await shot(page, 'agua');
await page.evaluate(() => window.scrollTo(0, 420));
await shot(page, 'agua-420', { wait: 900 });
await page.goto(`${BASE}/habitos?tab=pasos`);
await shot(page, 'pasos');
await page.evaluate(() => window.scrollTo(0, 420));
await shot(page, 'pasos-420', { wait: 900 });

// ── Hitos, calendario ──
await page.goto(`${BASE}/hitos`);
await dismissCelebration(page);
await shot(page, 'hitos');
await page.goto(`${BASE}/calendario`);
await shot(page, 'calendario');

// ── Perfil · Apariencia ──
await page.goto(`${BASE}/perfil`);
await dismissCelebration(page);
const appearance = page.getByRole('radiogroup', { name: 'Color de la interfaz' }).first();
await appearance.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -160));
await shot(page, 'perfil-apariencia');

// ── Accent sheet ──
await page.goto(`${BASE}/`);
await dismissCelebration(page);
await shot(page, 'inicio-violeta');
await page.locator('.accent-btn').first().click();
await shot(page, 'acentos', { wait: 1200 });
const swatches = page.locator('.accent-opt');
for (let i = 0; i < (await swatches.count()); i++) await box(page, `swatch${i}`, swatches.nth(i));

// ── Accent change: the sheet after picking cyan, then the app in cyan ──
await page.getByRole('radio', { name: /Cian glaciar/i }).click();
await shot(page, 'acentos-cian', { wait: 1400 });
// The choice is stored like any other setting; reopen Inicio without the sheet.
await page.reload();
await dismissCelebration(page);
await shot(page, 'inicio-cian');

// ── Light theme (toggle in the top bar), cyan and back to violet ──
await page.locator('.theme-toggle').first().click();
await page.waitForTimeout(1500);
await page.reload();
await dismissCelebration(page);
await shot(page, 'inicio-cian-claro', { wait: 1600 });
await page.evaluate(() => localStorage.setItem('rumbo.accent', 'violeta'));
await page.reload();
await dismissCelebration(page);
await shot(page, 'inicio-claro');
await page.goto(`${BASE}/progresos`);
await shot(page, 'progreso-claro', { wait: 1800 });
await page.evaluate(() => {
  localStorage.setItem('rumbo.theme', 'dark');
});

// ── Other accents on Inicio (dark) ──
for (const accent of ['naranja', 'fucsia', 'volt', 'rojo']) {
  await page.evaluate((a) => localStorage.setItem('rumbo.accent', a), accent);
  await page.goto(`${BASE}/`);
  await dismissCelebration(page);
  await shot(page, `inicio-${accent}`);
}
await page.evaluate(() => localStorage.setItem('rumbo.accent', 'violeta'));

// ── Personal records ──
await page.goto(`${BASE}/entreno?tab=stats`);
await dismissCelebration(page);
const prs = page.getByText('Marcas personales').first();
await prs.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -140));
await shot(page, 'marcas');

// ── A live session: before and after completing the first set ──
await page.goto(`${BASE}/entreno`);
await dismissCelebration(page);
await page.getByRole('button', { name: /Empezar/ }).first().click();
await page.waitForTimeout(1500);
await page.goto(`${BASE}/entreno/sesion`);
await page.getByRole('button', { name: 'Completar serie 1' }).first().waitFor({ timeout: 15_000 });
await page.evaluate(() => window.scrollTo(0, 0));
await shot(page, 'sesion', { wait: 1800 });
await box(page, 'set1', page.getByRole('button', { name: 'Completar serie 1' }).first());
await page.getByRole('button', { name: 'Completar serie 1' }).first().click();
await shot(page, 'sesion-serie', { wait: 900 });

writeFileSync(path.join(OUT, 'boxes.json'), JSON.stringify(boxes, null, 2));
// The network audit of the privacy claim lives with the deliverables, not with the video assets.
const NET = path.resolve('promo/out/pasos/red-captura.json');
mkdirSync(path.dirname(NET), { recursive: true });
writeFileSync(NET, JSON.stringify(requests, null, 2));
await browser.close();
console.log(`${requests.length} requests logged; origins:`, [...new Set(requests.map((r) => r.origin))]);
