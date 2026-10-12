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
});
