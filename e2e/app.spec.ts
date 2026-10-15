import { expect, test } from '@playwright/test';
import { dismissCelebration, noHorizontalOverflow, onboard } from './helpers';

test.describe('RUMBO', () => {
  test('onboarding creates a profile that persists after reload', async ({ page }) => {
    await onboard(page);
    await expect(page.getByText('85,4').first()).toBeVisible();
    await page.reload();
    await dismissCelebration(page);
    await expect(page.getByRole('heading', { name: /Guille/ })).toBeVisible();
    await page.goto('/progresos');
    await expect(page.getByText('Peso perdido')).toBeVisible();
    await expect(page.getByText('4,6').first()).toBeVisible();
  });

  test('weight chart tooltip shows the exact stored record', async ({ page, isMobile }) => {
    await onboard(page);
    await page.goto('/progresos');
    await page.getByRole('button', { name: 'Registrar' }).click();
    await page.getByRole('textbox', { name: 'Peso', exact: true }).fill('84,7');
    await page.getByRole('textbox', { name: 'Nota (opcional)' }).fill('Después de entrenar');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await dismissCelebration(page);
    const plot = page.locator('.wchart__plot');
    await plot.scrollIntoViewIfNeeded();
    // Keyboard access: focus selects the latest record.
    await plot.focus();
    await page.keyboard.press('End');
    const tip = page.getByTestId('chart-detail');
    await expect(tip).toContainText('84,7');
    await expect(tip).toContainText('Después de entrenar');
    await expect(tip).toContainText('−0,7 kg'); // vs. previous record (85,4)
    await expect(tip).toContainText('−5,3 kg'); // vs. initial weight (90)
    await page.keyboard.press('Home');
    await expect(tip).toContainText('90');
    await expect(tip).toContainText('Primer registro');
    if (!isMobile) {
      // Hover: the crosshair snaps to the record nearest to the cursor.
      await page.keyboard.press('Escape');
      const box = (await plot.boundingBox())!;
      await page.mouse.move(box.x + 60, box.y + box.height / 2);
      await expect(tip).toContainText('90');
      // Two records share today's x: the one closest to the pointer wins.
      const last = (await page.locator('.wchart__dot.is-last').boundingBox())!;
      await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2 + 2);
      await expect(tip).toContainText('84,7');
    }
  });

  test('theme toggle switches and persists', async ({ page }) => {
    await onboard(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'Cambiar a modo claro' }).first().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('button', { name: 'Cambiar a modo oscuro' }).first()).toBeVisible();
  });

  test('accent colour can be changed from the top bar and persists', async ({ page }) => {
    await onboard(page);
    // Lime is the brand default; another choice is kept across reloads.
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'volt');
    await page.getByRole('button', { name: 'Cambiar el color de la interfaz' }).first().click();
    await page.getByRole('radio', { name: /rojo/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'rojo');
    await expect(page.getByRole('radio', { name: /rojo/i })).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await page.reload();
    await dismissCelebration(page);
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'rojo');
  });

  test('switching tabs always reveals the panel content', async ({ page }) => {
    await onboard(page);
    const checks: [string, string, string][] = [
      ['/habitos', 'Pasos', '#habits-panel .glass'],
      ['/progresos', 'Calorías', '#progress-panel .glass'],
      ['/entreno', 'Estadísticas', '#training-panel .glass'],
    ];
    for (const [path, tab, card] of checks) {
      await page.goto(path);
      await page.getByRole('tab', { name: tab }).click();
      const first = page.locator(card).first();
      await expect(first).toBeVisible();
      // Regression: cards mounted on a tab switch used to stay at opacity 0.
      await expect.poll(() => first.evaluate((el) => Number(getComputedStyle(el).opacity)), { timeout: 4000 }).toBe(1);
    }
  });

  test('steps quick add moves the track and reaches the goal', async ({ page }) => {
    await onboard(page);
    await page.goto('/habitos?tab=pasos');
    await expect(page.getByText('Te faltan')).toContainText('8.000');
    await page.getByRole('button', { name: 'Sumar 5.000 pasos hoy' }).click();
    await dismissCelebration(page);
    await expect(page.getByText('Te faltan')).toContainText('3.000');
    await expect(page.getByRole('img', { name: /Pasos respecto al objetivo: 63 %/ })).toBeVisible();
    await page.getByRole('button', { name: 'Sumar 5.000 pasos hoy' }).click();
    await dismissCelebration(page);
    await expect(page.locator('.steps-status').getByText('Objetivo cumplido')).toBeVisible();
    await expect(page.getByText('+2.000 pasos extra')).toBeVisible();
  });

  test('water updates the daily summary and the calendar', async ({ page }) => {
    await onboard(page);
    await page.goto('/habitos');
    await page.getByRole('button', { name: '500 ml' }).click();
    await page.getByRole('button', { name: '250 ml' }).click();
    await expect(page.locator('.vessel__value')).toHaveText('750 ml');
    await dismissCelebration(page);
    await page.goto('/calendario');
    const today = page.locator('.cal-day[data-today="true"]');
    await expect(today.locator('.cal-dot--water')).toHaveCount(1);
    await expect(today).toHaveAttribute('aria-label', /750 ml de agua/);
  });

  test('a full workout is saved to history and unlocks its milestone', async ({ page }) => {
    await onboard(page);
    await page.goto('/entreno');
    await page.getByRole('button', { name: /Entrenamiento libre|Empezar sesión/ }).first().click();
    await expect(page).toHaveURL(/\/entreno\/sesion/);
    await page.getByRole('button', { name: 'Añadir ejercicio' }).first().click();
    await page.getByRole('button', { name: /^Press banca Pecho/ }).click();
    await page.getByRole('button', { name: /^Añadir \(1\)/ }).click();
    await page.getByRole('textbox', { name: 'Peso en kg, serie 1' }).fill('40');
    await page.getByRole('textbox', { name: 'Repeticiones, serie 1' }).fill('12');
    await page.getByRole('button', { name: 'Completar serie 1' }).click();
    await expect(page.getByRole('timer')).toBeVisible(); // rest timer starts
    await page.getByRole('button', { name: 'Finalizar' }).click();
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByText('Entrenamiento completado')).toBeVisible();
    await dismissCelebration(page);
    await page.getByRole('button', { name: 'Listo' }).click();
    await expect(page.getByText('Entrenamiento libre').first()).toBeVisible();
    await page.goto('/hitos');
    const card = page.locator('.ms-card', { hasText: 'Primera Sesión' });
    await expect(card).toContainText('Desbloqueado');
  });

  test('creator page keeps the official text and real social links', async ({ page }) => {
    await onboard(page);
    await page.goto('/quien-soy');
    await expect(page.getByRole('heading', { name: 'Hola, soy Guille' })).toBeVisible();
    await expect(page.getByText('RUMBO nace de algo muy sencillo: las ganas de cambiar, crecer y convertirnos en nuestra mejor versión.')).toBeVisible();
    await expect(page.getByText('Este es mi RUMBO.')).toBeVisible();
    await expect(page.getByText('Ahora es el momento de encontrar el tuyo.')).toBeVisible();
    const links = {
      Instagram: 'https://www.instagram.com/akkaguillee',
      TikTok: 'https://www.tiktok.com/@akkaguillee',
      YouTube: 'https://www.youtube.com/@akkaguillee',
    };
    for (const [name, href] of Object.entries(links)) {
      const a = page.getByRole('link', { name: new RegExp(`^${name} de Guille`) });
      await expect(a).toHaveAttribute('href', href);
      await expect(a).toHaveAttribute('target', '_blank');
      await expect(a).toHaveAttribute('rel', /noopener/);
    }
  });

  test('main screens render without horizontal overflow or errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await onboard(page);
    for (const path of ['/', '/progresos', '/progresos?tab=registros', '/progresos?tab=imc', '/progresos?tab=calorias', '/calendario', '/habitos', '/habitos?tab=pasos', '/entreno', '/entreno?tab=historial', '/entreno?tab=ejercicios', '/entreno?tab=plantillas', '/entreno?tab=stats', '/hitos', '/perfil', '/quien-soy']) {
      await page.goto(path);
      await page.waitForTimeout(400);
      await noHorizontalOverflow(page);
    }
    expect(errors.filter((e) => !e.includes('guille.jpg'))).toEqual([]);
  });
});
