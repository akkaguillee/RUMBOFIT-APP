import { expect, test, type Page } from '@playwright/test';
import { dismissCelebration, onboard } from './helpers';

const fabOf = (page: Page) => page.getByRole('button', { name: /Abrir a Rumbi/ });
const storedSide = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('rumbo.rumbi') ?? '{}').side as string | undefined);

test.describe('Rumbi flotante', () => {
  test('can be dragged to the other edge, remembers its spot and opens its panel', async ({ page }) => {
    await onboard(page);
    const fab = fabOf(page);
    await expect(fab).toBeVisible();
    const vw = page.viewportSize()!.width;
    const box = (await fab.boundingBox())!;
    expect(box.x).toBeGreaterThan(vw / 2);

    // Drag it to the left half: it docks on the left edge and the spot is stored.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(vw * 0.25, box.y - 60, { steps: 14 });
    await page.mouse.up();
    await expect.poll(() => storedSide(page)).toBe('left');
    await expect.poll(async () => (await fab.boundingBox())!.x).toBeLessThan(vw / 2);

    await page.reload();
    await dismissCelebration(page);
    await expect(fab).toBeVisible();
    expect((await fab.boundingBox())!.x).toBeLessThan(vw / 2);

    // A tap opens the panel: today's tip, tips by area, shortcuts and help.
    await fab.click();
    const panel = page.getByRole('dialog', { name: 'Rumbi' });
    await expect(panel.getByRole('heading', { name: 'Tu consejo de hoy' })).toBeVisible();
    await expect(fab).toBeHidden();
    await panel.getByRole('radio', { name: 'Descanso' }).click();
    await expect(panel.getByRole('radio', { name: 'Descanso' })).toHaveAttribute('aria-checked', 'true');
    await panel.getByRole('button', { name: 'Añadir 250 ml de agua' }).click();
    await expect(page.getByText('+250 ml de agua')).toBeVisible();
    await panel.getByRole('link', { name: /Cómo se calculan tus calorías/ }).click();
    await expect(page).toHaveURL(/tab=calorias/);
    await expect(panel).toBeHidden();
    await expect(fab).toBeVisible();
  });

  test('steps aside for dialogs and can be turned off in Perfil', async ({ page }) => {
    await onboard(page);
    const fab = fabOf(page);
    await expect(fab).toBeVisible();

    await page.getByRole('button', { name: 'Cambiar el color de la interfaz' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Color de la interfaz' })).toBeVisible();
    await expect(fab).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(fab).toBeVisible();

    await page.goto('/perfil#appearance');
    await dismissCelebration(page);
    const toggle = page.getByRole('switch', { name: 'Rumbi flotante' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(fab).toHaveCount(0);
    await page.reload();
    await dismissCelebration(page);
    await expect(page.getByRole('switch', { name: 'Rumbi flotante' })).toHaveAttribute('aria-checked', 'false');
    await expect(fab).toHaveCount(0);
    await page.getByRole('switch', { name: 'Rumbi flotante' }).click();
    await expect(fab).toBeVisible();
  });
});
