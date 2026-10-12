import { expect, type Page } from '@playwright/test';

export function dateKey(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Advances one onboarding screen and waits until the next one is on screen, so
 * the next action never lands while the previous screen is still leaving.
 */
async function advance(page: Page, name: 'Empezar' | 'Continuar' | 'Ahora no' = 'Continuar') {
  const screen = page.locator('.onb__step');
  const before = await screen.getAttribute('data-screen');
  await page.getByRole('button', { name, exact: true }).click();
  await expect(screen).not.toHaveAttribute('data-screen', before ?? '');
  await expect(screen).toHaveCount(1);
}

/**
 * Completes onboarding with a fat-loss goal (90 → 85,4 kg, goal 78 kg) and a
 * moderate activity level (on your feet most of the day, training three days a
 * week: Monday, Wednesday and Friday). The optional screens (habits and
 * motivation) are skipped with «Ahora no», so the profile has no answers for them.
 */
export async function onboard(page: Page, name = 'Guille', url = '/') {
  await page.addInitScript(() => localStorage.setItem('rumbo.intro', 'off'));
  await page.goto(url);
  await advance(page, 'Empezar');
  // 1 · Sobre ti
  await page.getByRole('textbox', { name: 'Nombre o alias' }).fill(name);
  await page.getByRole('textbox', { name: 'Edad' }).fill('28');
  await page.getByRole('textbox', { name: 'Altura' }).fill('180');
  await page.getByRole('textbox', { name: 'Peso actual' }).fill('85,4');
  await page.getByRole('radio', { name: 'Hombre' }).click();
  await page.getByRole('button', { name: /Empezaste antes/ }).click();
  await page.getByRole('textbox', { name: 'Peso inicial' }).fill('90');
  await page.getByRole('textbox', { name: 'Fecha de inicio' }).fill(dateKey(-30));
  await advance(page);
  // 2 · Tu objetivo
  await page.getByRole('radio', { name: /Perder grasa/ }).click();
  await page.getByRole('textbox', { name: 'Peso objetivo' }).fill('78');
  await advance(page);
  // 3 · Tu actividad → moderate
  await page.getByRole('radiogroup', { name: '¿Cómo pasas la mayor parte del día?' }).getByRole('radio', { name: /De pie/ }).click();
  await page.getByRole('radiogroup', { name: '¿Cuántos días entrenas a la semana?' }).getByRole('radio', { name: '3 días', exact: true }).click();
  await expect(page.getByText('Moderado', { exact: true })).toBeVisible();
  await advance(page);
  // 4–5 · Optional screens
  await advance(page, 'Ahora no'); // habits → motivation
  await advance(page, 'Ahora no'); // motivation → summary
  // Resumen
  await expect(page.getByRole('heading', { name: `Encantados, ${name}` })).toBeVisible();
  await page.getByRole('checkbox', { name: /Entiendo que estos datos se guardan solo en este dispositivo/ }).check();
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
