import { expect, type Page } from '@playwright/test';

export function dateKey(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Completes onboarding with a weight-loss goal (90 → 85,4 kg, goal 78 kg). */
export async function onboard(page: Page, name = 'Guille', url = '/') {
  await page.addInitScript(() => localStorage.setItem('rumbo.intro', 'off'));
  await page.goto(url);
  await page.getByRole('button', { name: 'Empezar' }).click();
  await page.getByRole('textbox', { name: 'Nombre o alias' }).fill(name);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('radio', { name: /Perder peso/ }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('textbox', { name: 'Edad' }).fill('28');
  await page.getByRole('radio', { name: 'Hombre' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('textbox', { name: 'Altura' }).fill('180');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('textbox', { name: 'Peso actual' }).fill('85,4');
  await page.getByRole('textbox', { name: 'Peso inicial' }).fill('90');
  await page.getByRole('textbox', { name: 'Fecha de inicio' }).fill(dateKey(-30));
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('textbox', { name: 'Peso objetivo' }).fill('78');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('radio', { name: /Moderado/ }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Crear mi RUMBO' }).click();
  await dismissCelebration(page);
  await expect(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible();
}

export async function dismissCelebration(page: Page) {
  const btn = page.getByRole('button', { name: 'Seguir avanzando' });
  try {
    await btn.waitFor({ state: 'visible', timeout: 2500 });
    await btn.click();
    await btn.waitFor({ state: 'hidden' });
  } catch {
    /* nothing unlocked */
  }
}

export async function noHorizontalOverflow(page: Page) {
  const { sw, vw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth }));
  expect(sw, 'page should not scroll horizontally').toBeLessThanOrEqual(vw + 1);
}
