import type { Page } from '@playwright/test';

/** A real EAN-13 (valid check digit) used across the scanner tests. */
export const CODE = '4006381333931';

const food = (fdcId: number, description: string, per100: Record<string, number>) => ({ fdcId, description, dataType: 'SR Legacy', per100 });
const RICE = food(168878, 'Rice, white, long-grain, regular, enriched, cooked', { kcal: 130, protein: 2.7, carbs: 28.2, fat: 0.3 });
const CHICKEN = food(171477, 'Chicken, broilers or fryers, breast, meat only, cooked, roasted', { kcal: 165, protein: 31, carbs: 0, fat: 3.6 });

/** Fixed answers for the RUMBO food functions; returns what the app sent. */
export async function mockFoodFunctions(page: Page) {
  const calls: { analyze: unknown[]; barcode: string[] } = { analyze: [], barcode: [] };
  await page.route('**/.netlify/functions/food-analyze', async (route) => {
    calls.analyze.push(route.request().postDataJSON());
    await route.fulfill({
      json: {
        ok: true,
        analysis: {
          is_food: true,
          image_quality: 'good',
          dish_name: 'Arroz con pollo',
          items: [
            { name_es: 'Arroz blanco', usda_query: 'rice white cooked', grams: 180, grams_confidence: 'medium', preparation: 'cocido' },
            { name_es: 'Pechuga de pollo', usda_query: 'chicken breast roasted', grams: 120, grams_confidence: 'high', preparation: 'asado' },
            { name_es: 'Salsa de la casa', usda_query: 'house sauce', grams: 20, grams_confidence: 'low', preparation: '' },
          ],
          barcode: '',
          caveats: ['No se ve si el arroz lleva aceite.'],
        },
      },
    });
  });
  await page.route('**/.netlify/functions/food-nutrients', async (route) => {
    const { items } = route.request().postDataJSON() as { items: { id: string; query: string }[] };
    const table: Record<string, typeof RICE> = { 'rice white cooked': RICE, 'chicken breast roasted': CHICKEN };
    await route.fulfill({ json: { ok: true, results: items.map((i) => ({ id: i.id, query: i.query, match: table[i.query] ?? null, alternatives: [] })) } });
  });
  await page.route('**/.netlify/functions/food-barcode*', async (route) => {
    calls.barcode.push(new URL(route.request().url()).searchParams.get('code') ?? '');
    await route.fulfill({
      json: { ok: true, product: { code: CODE, name: 'Yogur natural', brand: 'Granja', servingGrams: 125, servingLabel: '1 yogur (125 g)', liquid: false, per100: { kcal: 60, protein: 4, carbs: 5, fat: 2.5 } } },
    });
  });
  return calls;
}
