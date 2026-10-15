import { expect, test } from '@playwright/test';
import { dismissCelebration, onboard } from './helpers';

test.describe('Personalisation', () => {
  test('streak counts today once, survives reloads and never double counts', async ({ page }) => {
    // Onboarding saves today's weight, so today already counts.
    await onboard(page);
    const card = page.locator('.streak-card');
    await expect(card).toContainText('Primer día encendido');
    await expect(card.locator('.t-num').first()).toHaveText('1');

    // More records on the same day never add a second day.
    await page.goto('/habitos');
    await page.getByRole('button', { name: '250 ml' }).click();
    await page.getByRole('button', { name: '500 ml' }).click();
    await dismissCelebration(page);
    await page.goto('/');
    await expect(card).toContainText('Primer día encendido');
    await expect(card.locator('.t-num').first()).toHaveText('1');

    await page.reload();
    await dismissCelebration(page);
    await expect(card).toContainText('Primer día encendido');
    await expect(card.locator('.t-num').first()).toHaveText('1');
  });

  test('dashboard shows today’s tip and automatic body estimates from the profile', async ({ page }) => {
    await onboard(page);
    const tip = page.getByRole('region', { name: 'Tu consejo de hoy' });
    await expect(tip).toBeVisible();
    const title = await tip.locator('h3').first().textContent();

    // 85,4 kg at 180 cm → 26,4 kg/m²
    const bmi = page.locator('.body-mini', { hasText: 'IMC' });
    await expect(bmi).toContainText('26,4');
    await expect(bmi).toContainText('Sobrepeso');
    await expect(page.locator('.body-mini', { hasText: 'Calorías' })).toContainText('kcal');

    // The main tip is stable for the whole day
    await page.reload();
    await dismissCelebration(page);
    await expect(page.getByRole('region', { name: 'Tu consejo de hoy' }).locator('h3').first()).toHaveText(title ?? '');
  });

  test('the removed nutrition section is not linked and its old URL is safe', async ({ page }) => {
    await onboard(page);
    await expect(page.locator('a[href*="nutricion"]')).toHaveCount(0);
    await page.goto('/nutricion');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /Guille/ })).toBeVisible();
  });

  test('the top bar shows the current section in capitals after scrolling', async ({ page }) => {
    await onboard(page);
    await page.goto('/progresos');
    await page.evaluate(() => window.scrollTo(0, 600));
    const title = page.locator('.topbar__title');
    await expect(title).toBeVisible();
    await expect(title).toHaveCSS('text-transform', 'uppercase');
    await expect(title).toContainText(/Progreso/);
  });

  test('«Ajustar el cálculo» validates, updates the calories and keeps them after reload', async ({ page }) => {
    await onboard(page);
    await page.goto('/progresos?tab=calorias');
    const trigger = page.getByRole('button', { name: /Ajustar el cálculo/ });
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#kcal-title')).toBeFocused();

    // Empty and non-numeric values are rejected with an accessible message.
    const weight = page.getByRole('textbox', { name: 'Peso' });
    const height = page.getByRole('textbox', { name: 'Altura' });
    await height.fill('');
    await weight.fill('abc');
    const save = page.getByRole('button', { name: 'Guardar y actualizar' });
    await save.click();
    await expect(weight).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('alert').filter({ hasText: 'El peso debe ser un número' })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'Indica la altura' })).toBeVisible();
    await expect(weight).toBeFocused();

    // Valid data: saved to the profile, the main card updates at once.
    await weight.fill('85,4');
    await height.fill('180');
    await page.getByRole('combobox', { name: /Nivel de actividad/ }).selectOption('active');
    await save.click();
    await expect(page.getByText(/Guardado\. Tus calorías diarias ahora son/)).toBeVisible();
    await dismissCelebration(page);
    const card = page.locator('.kcal-card');
    const kcal = await card.locator('.kcal-hero__num').textContent();
    await expect(save).toBeDisabled();

    // Escape closes the panel and returns focus to its button.
    await page.getByRole('button', { name: 'Cerrar' }).focus();
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();

    await page.reload();
    await dismissCelebration(page);
    await expect(card.locator('.kcal-hero__num')).toHaveText(kcal ?? '');
    await page.getByRole('button', { name: /Ajustar el cálculo/ }).click();
    await expect(page.getByRole('combobox', { name: /Nivel de actividad/ })).toHaveValue('active');
  });
});
