import { expect, test } from '@playwright/test';
import { dateKey, dismissCelebration, onboard } from './helpers';

/** A tiny picture made for the test (no person in it). */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAYAAAAICAIAAABVpBlvAAAAIUlEQVR4nGM8UWHDgAqYGDAAo5xcFJoQy6qoR4Q1ki0EANahBAkJ0SbKAAAAAElFTkSuQmCC', 'base64');

test.describe('Mapa muscular', () => {
  test('follows the real session: planned work, completed sets and the muscle detail', async ({ page, isMobile }) => {
    await onboard(page);
    await page.goto('/entreno');
    const today = page.locator('.today');
    await expect(today.getByText('Sin plan')).toBeVisible();
    // Nothing trained yet: the figure stays dark and says why.
    await expect(today.locator('.bm__m:not([data-fill="none"])')).toHaveCount(0);
    await expect(today.getByText(/Empieza una sesión o elige una plantilla/)).toBeVisible();

    await today.getByRole('button', { name: 'Entrenamiento libre' }).click();
    await expect(page).toHaveURL(/\/entreno\/sesion/);
    await page.getByRole('button', { name: 'Añadir ejercicio' }).first().click();
    await page.getByRole('button', { name: /^Press banca Pecho/ }).click();
    await page.getByRole('button', { name: /^Añadir \(1\)/ }).click();
    await expect(page.locator('.ex-card__name', { hasText: 'Press banca' })).toBeVisible();

    // Planned, not done: outlines only, and looking at the map completes nothing.
    await page.goto('/entreno');
    const chest = today.locator('[data-muscle="chest"]').first();
    await expect(today.getByText('En curso')).toBeVisible();
    await expect(chest).toHaveAttribute('data-pending', 'primary');
    await expect(chest).toHaveAttribute('data-fill', 'none');
    await expect(today.locator('[data-muscle="triceps"]').first()).toHaveAttribute('data-pending', 'secondary');
    await expect(today.locator('[data-muscle="quads"]').first()).toHaveAttribute('data-fill', 'none');
    await expect(today.locator('[data-muscle="quads"]').first()).not.toHaveAttribute('data-pending', /.+/);
    await expect(today.getByText('Pendiente').first()).toBeVisible();

    // A completed set fills the prime mover and its helpers, live in the session sheet too.
    await today.getByRole('button', { name: 'Continuar sesión' }).click();
    await page.getByRole('textbox', { name: 'Peso en kg, serie 1' }).fill('40');
    await page.getByRole('textbox', { name: 'Repeticiones, serie 1' }).fill('10');
    await page.getByRole('button', { name: 'Completar serie 1' }).click();
    await page.getByRole('button', { name: /Ver músculos/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Músculos de la sesión' });
    await expect(sheet.locator('[data-muscle="chest"]').first()).toHaveAttribute('data-fill', 'primary');
    await page.keyboard.press('Escape');

    await page.goto('/entreno');
    await expect(chest).toHaveAttribute('data-fill', 'primary');
    await expect(today.locator('[data-muscle="front-delts"]').first()).toHaveAttribute('data-fill', 'secondary');

    // Selecting a muscle names it and lists the exercises that reached it.
    await today.getByRole('button', { name: 'Pectorales', exact: true }).click();
    await expect(today.getByRole('heading', { name: 'Pectorales' })).toBeVisible();
    await expect(today.locator('.mmap__info')).toContainText('Press banca');
    await expect(chest).toHaveAttribute('aria-pressed', 'true');
    await today.getByRole('button', { name: 'Cerrar detalle del músculo' }).click();

    if (isMobile) {
      // One figure at a time on a phone, with a switch.
      await expect(today.locator('.mmap__fig--back')).toBeHidden();
      await today.getByRole('radio', { name: 'Espalda' }).click();
      await expect(today.locator('.mmap__fig--back')).toBeVisible();
      await expect(today.locator('.mmap__fig--front')).toBeHidden();
    } else {
      await expect(today.locator('.mmap__fig--front')).toBeVisible();
      await expect(today.locator('.mmap__fig--back')).toBeVisible();
    }

    // The session is still in progress: the map never saved or finished anything.
    await page.goto('/entreno?tab=historial');
    await expect(page.getByText('Aún no hay entrenamientos')).toBeVisible();
  });

  test('Estadísticas compares this week with the last one', async ({ page }) => {
    await onboard(page);
    await page.goto('/entreno');
    await page.getByRole('button', { name: 'Registrar sesión pasada' }).click();
    const sheet = page.getByRole('dialog', { name: 'Registrar sesión pasada' });
    await sheet.getByRole('textbox', { name: 'Fecha' }).fill(dateKey(-7));
    await sheet.getByRole('button', { name: 'Añadir ejercicio' }).click();
    await page.getByRole('button', { name: /^Sentadilla Cuádriceps/ }).click();
    await page.getByRole('button', { name: /^Añadir \(1\)/ }).click();
    await sheet.getByRole('textbox', { name: 'Repeticiones, serie 1' }).fill('8');
    await sheet.getByRole('button', { name: 'Guardar sesión' }).click();
    await expect(page.getByText('Sesión registrada')).toBeVisible();
    await dismissCelebration(page);

    await page.goto('/entreno?tab=stats');
    const card = page.locator('#musculos');
    await expect(card.getByText('0 sesiones completadas')).toBeVisible();
    await expect(card.locator('[data-muscle="quads"]').first()).toHaveAttribute('data-fill', 'none');
    await card.getByRole('radio', { name: 'Semana pasada' }).click();
    await expect(card.getByText('1 sesión completada')).toBeVisible();
    await expect(card.locator('[data-muscle="quads"]').first()).toHaveAttribute('data-fill', 'l1');
    await expect(card.locator('[data-muscle="glutes"]').first()).toHaveAttribute('data-fill', 'l1');
    await expect(card.locator('[data-muscle="chest"]').first()).toHaveAttribute('data-fill', 'none');
  });

  test('Perfil chooses the figure and a photo that stays on the device', async ({ page }) => {
    await onboard(page); // «Hombre» in onboarding
    await page.goto('/entreno');
    await expect(page.locator('.today svg.bm').first()).toHaveAttribute('data-figure', 'male');

    await page.goto('/perfil#appearance');
    await dismissCelebration(page);
    await page.getByRole('radio', { name: 'Femenina' }).click();
    await expect(page.getByRole('radio', { name: 'Femenina' })).toHaveAttribute('aria-checked', 'true');
    await page.goto('/entreno');
    await expect(page.locator('.today svg.bm').first()).toHaveAttribute('data-figure', 'female');

    await page.goto('/perfil');
    await dismissCelebration(page);
    const topAvatar = page.locator('.topbar .avatar-btn img.avatar-img');
    await expect(topAvatar).toHaveCount(0);
    await page.locator('#personal input[type="file"]').setInputFiles({ name: 'yo.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByText('Foto de perfil actualizada')).toBeVisible();
    await expect(topAvatar).toHaveCount(1);
    await expect(topAvatar).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
    await page.reload();
    await dismissCelebration(page);
    await expect(topAvatar).toHaveCount(1);
    await page.getByRole('button', { name: 'Quitar', exact: true }).click();
    await expect(topAvatar).toHaveCount(0);
    await page.getByRole('button', { name: 'Deshacer' }).click();
    await expect(topAvatar).toHaveCount(1);
  });

  test('Inicio keeps its note and no longer has the ribbon', async ({ page }) => {
    await onboard(page);
    await expect(page.locator('.greet')).toBeVisible();
    await expect(page.getByText('tu ritmo, tu rumbo')).toBeVisible();
    await expect(page.locator('.ribbon')).toHaveCount(0);
    await expect(page.getByText('CADA PASO CUENTA')).toHaveCount(0);
  });
});
