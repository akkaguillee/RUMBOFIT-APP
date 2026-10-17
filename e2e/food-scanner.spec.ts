import { expect, test } from '@playwright/test';
import { CODE, mockFoodFunctions as mockFunctions } from './food-mocks';
import { dismissCelebration, onboard } from './helpers';

/*
 * The scanner against Chromium's fake camera. The RUMBO server functions are
 * replaced with fixed answers (no AI, USDA or Open Food Facts calls are made):
 * these tests check the app's flow, validation and error handling.
 */

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAYAAAAICAIAAABVpBlvAAAAIUlEQVR4nGM8UWHDgAqYGDAAo5xcFJoQy6qoR4Q1ki0EANahBAkJ0SbKAAAAAElFTkSuQmCC', 'base64');

// Chromium's fake camera (a test pattern), with permission granted.
test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }, permissions: ['camera'] });

test.describe('Escáner de alimentos · cámara', () => {
  test('photo → foods with values at once → verified in the database → fix what is missing → save to the log', async ({ page }) => {
    const calls = await mockFunctions(page);
    await onboard(page);
    await page.getByRole('button', { name: 'Escanear', exact: true }).click();
    await expect(page).toHaveURL(/\/habitos\/escaner/);

    // First use explains what happens with photos before the camera starts.
    await expect(page.getByRole('heading', { name: 'Antes de escanear' })).toBeVisible();
    await expect(page.locator('.cap__video')).toHaveCount(0);
    await page.getByRole('button', { name: 'Entendido, empezar' }).click();
    await expect(page.locator('.cap__video[data-live]')).toBeVisible();
    await page.getByRole('button', { name: 'Hacer foto' }).click();

    await expect(page.getByRole('heading', { name: 'Arroz con pollo' })).toBeVisible();
    // Only the resized JPEG is sent, nothing else.
    const sent = calls.analyze[0] as Record<string, string>;
    expect(Object.keys(sent).sort()).toEqual(['image', 'mediaType']);
    expect(sent.mediaType).toBe('image/jpeg');
    expect(Buffer.from(sent.image!, 'base64').subarray(0, 2).toString('hex')).toBe('ffd8');

    // Values show at once (typical values from the analysis), then the database confirms them.
    await expect(page.locator('.vchip--verified')).toHaveCount(2);
    await expect(page.locator('.tile--kcal')).toContainText('≈ 432');
    // Each food is labelled on the photo, and a label opens it.
    await expect(page.locator('.tag')).toHaveCount(2);
    await page.locator('.tag', { hasText: 'Pechuga de pollo' }).click();
    const chickenSheet = page.getByRole('dialog', { name: 'Pechuga de pollo' });
    await expect(chickenSheet).toBeVisible();
    await expect(chickenSheet).toContainText('USDA FoodData Central');
    await page.getByRole('button', { name: 'Listo' }).click();
    await expect(chickenSheet).toHaveCount(0);
    // A food without any data is not invented and blocks saving.
    await expect(page.getByText('No hemos encontrado datos fiables para este alimento.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar en mi registro' })).toBeDisabled();
    await page.getByRole('button', { name: 'Quitar', exact: true }).click();
    await expect(page.getByText('Salsa de la casa')).toHaveCount(0);

    // Adjust an amount.
    await page.locator('.item__main', { hasText: 'Arroz blanco' }).click();
    await page.getByRole('button', { name: '200 g' }).click();
    await page.getByRole('button', { name: 'Listo' }).click();
    await expect(page.locator('.tile--kcal')).toContainText('458');
    await page.getByRole('radio', { name: 'Por 100 g' }).click();
    await expect(page.getByText('Valores por 100 g del plato completo.')).toBeVisible();
    await page.getByRole('radio', { name: 'Tu porción' }).click();
    await expect(page.getByRole('region', { name: 'Valores nutricionales' })).toBeVisible();
    await expect(page.getByText(/Para tu objetivo/)).toBeVisible();

    await page.getByRole('radio', { name: 'Cena' }).click();
    await page.getByRole('button', { name: 'Guardar en mi registro' }).click();
    await expect(page.getByRole('heading', { name: 'Guardado en Cena' })).toBeVisible();
    await page.getByRole('button', { name: 'Ver mi registro' }).click();
    await dismissCelebration(page);
    await expect(page).toHaveURL(/tab=comidas/);
    const row = page.locator('.meal-row', { hasText: 'Arroz con pollo' });
    await expect(row).toContainText('458 kcal');
    await expect(page.locator('.meal-group', { hasText: 'Cena' })).toBeVisible();

    // Deleting can be undone, and the log survives a reload.
    await page.getByRole('button', { name: 'Eliminar Arroz con pollo' }).click();
    await expect(row).toHaveCount(0);
    await page.getByRole('button', { name: 'Deshacer' }).click();
    await expect(row).toBeVisible();
    await page.reload();
    await dismissCelebration(page);
    await expect(page.locator('.meal-row', { hasText: 'Arroz con pollo' })).toBeVisible();

    // Consent is remembered.
    await page.getByRole('link', { name: 'Escanear comida' }).click();
    await expect(page.locator('.cap__video[data-live]')).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar escáner' }).click();
    await expect(page).toHaveURL(/\/habitos/);
  });

  test('without the database key the values are still shown, marked as estimates', async ({ page }) => {
    const calls = await mockFunctions(page, { database: false });
    await onboard(page);
    await page.goto('/habitos/escaner');
    await page.getByRole('button', { name: 'Entendido, empezar' }).click();
    await expect(page.locator('.cap__video[data-live]')).toBeVisible();
    await page.getByRole('button', { name: 'Hacer foto' }).click();
    await expect(page.getByRole('heading', { name: 'Arroz con pollo' })).toBeVisible();
    await expect(page.locator('.vchip--estimate')).toHaveCount(2);
    await expect(page.locator('.tile--kcal')).toContainText('≈ 422');
    await expect(page.getByText(/valores típicos por 100 g estimados por la IA/)).toBeVisible();
    // Nothing tells the user the values are «missing»: only the sauce, without data, needs a decision.
    await expect(page.getByText('Faltan sus valores nutricionales.')).toHaveCount(0);
    await expect(page.getByText('No hemos encontrado datos fiables para este alimento.')).toHaveCount(1);
    expect(calls.nutrients).toBe(0);
    await page.getByRole('button', { name: 'Quitar', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar en mi registro' }).click();
    await expect(page.getByRole('heading', { name: /^Guardado en/ })).toBeVisible();
  });

  test('the flash button explains the system camera when the browser cannot light it', async ({ page }) => {
    await mockFunctions(page);
    await onboard(page);
    await page.goto('/habitos/escaner');
    await page.getByRole('button', { name: 'Entendido, empezar' }).click();
    await expect(page.locator('.cap__video[data-live]')).toBeVisible();
    // Chromium's fake camera has no light, like Safari on iPhone.
    await page.getByRole('button', { name: 'Encender el flash' }).click();
    const sheet = page.getByRole('dialog', { name: 'Flash' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Hacer la foto con la cámara del sistema' })).toBeVisible();
    await sheet.getByRole('button', { name: 'Entendido' }).click();
    await expect(sheet).toHaveCount(0);
  });

  test('a code typed by hand is checked and looked up', async ({ page }) => {
    const calls = await mockFunctions(page);
    await onboard(page);
    await page.goto('/habitos/escaner?modo=codigo');
    await page.getByRole('button', { name: 'Entendido, empezar' }).click();
    await page.getByRole('button', { name: 'Escribir el código' }).click();
    const field = page.getByRole('textbox', { name: 'Código de barras' });
    await field.fill('4006381333932');
    await page.getByRole('button', { name: 'Buscar producto' }).click();
    await expect(page.getByText('Los números no cuadran con el dígito de control. Revísalos.')).toBeVisible();
    expect(calls.barcode).toEqual([]);
    await field.fill(CODE);
    await page.getByRole('button', { name: 'Buscar producto' }).click();
    await expect(page.getByRole('heading', { name: 'Yogur natural' })).toBeVisible();
    expect(calls.barcode).toEqual([CODE]);
  });
});

test.describe('Escáner de alimentos · sin cámara ni servidor', () => {
  test('camera denied: explains it, offers the gallery, and a missing server key leads to other options', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')) },
      });
    });
    await page.route('**/.netlify/functions/food-analyze', (route) =>
      route.fulfill({ status: 503, json: { ok: false, error: { code: 'not_configured', message: 'El análisis por foto no está configurado en el servidor.' } } }),
    );
    await onboard(page);
    await page.goto('/habitos/escaner');
    await page.getByRole('button', { name: 'Entendido, empezar' }).click();
    await expect(page.getByRole('heading', { name: 'Sin permiso para usar la cámara' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hacer una foto' })).toBeVisible();

    await page.locator('.cap input[type="file"]:not([capture])').setInputFiles({ name: 'plato.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByRole('heading', { name: 'Análisis por foto sin configurar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Escanear el código de barras' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Probar con otra foto' })).toHaveCount(0);

    // Values typed from a label still work, and impossible ones are refused.
    await page.getByRole('button', { name: 'Buscar por nombre o añadir a mano' }).click();
    await page.getByRole('button', { name: 'Introducir valores' }).click();
    const sheet = page.getByRole('dialog', { name: 'Introducir valores' });
    await sheet.getByRole('textbox', { name: 'Alimento' }).fill('Tostada con aceite');
    await sheet.getByRole('textbox', { name: 'Cantidad que has tomado' }).fill('60');
    await sheet.getByRole('textbox', { name: 'Calorías' }).fill('2000');
    await sheet.getByRole('textbox', { name: 'Proteína' }).fill('8');
    await sheet.getByRole('textbox', { name: 'Hidratos de carbono' }).fill('45');
    await sheet.getByRole('textbox', { name: 'Grasa', exact: true }).fill('9');
    await sheet.getByRole('button', { name: 'Usar estos valores' }).click();
    await expect(sheet.getByText(/Los valores no cuadran/)).toBeVisible();
    await sheet.getByRole('textbox', { name: 'Calorías' }).fill('300');
    await sheet.getByRole('button', { name: 'Usar estos valores' }).click();
    await expect(page.getByRole('heading', { name: 'Tostada con aceite' })).toBeVisible();
    await expect(page.locator('.tile--kcal')).toContainText('180');
    await page.getByRole('button', { name: 'Guardar en mi registro' }).click();
    await expect(page.getByRole('heading', { name: /^Guardado en/ })).toBeVisible();
  });
});
