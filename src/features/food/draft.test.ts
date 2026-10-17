import { describe, expect, it } from 'vitest';
import type { PhotoAnalysis } from '@/domain/nutrition/analysis';
import type { OffProduct } from '@/domain/nutrition/off';
import type { UsdaFood } from '@/domain/nutrition/usda';
import {
  applyLookups,
  availableBases,
  canSave,
  chooseFood,
  confirmAmount,
  draftFromAnalysis,
  draftFromProduct,
  failLookups,
  removeItem,
  retryLookups,
  setGrams,
  summarize,
  toMealItems,
  valuesFor,
  waitingKeys,
} from './draft';

const rice: UsdaFood = { fdcId: 1, description: 'Rice, white, cooked', dataType: 'SR Legacy', per100: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, sugars: 0.1, satFat: 0.1 } };
const chicken: UsdaFood = { fdcId: 2, description: 'Chicken breast, grilled', dataType: 'Survey (FNDDS)', per100: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 } };

const analysis: PhotoAnalysis = {
  isFood: true,
  quality: 'good',
  dish: 'Arroz con pollo',
  items: [
    { name: 'Arroz blanco', query: 'rice white cooked', grams: 180, confidence: 'medium' },
    { name: 'Pechuga de pollo', query: 'chicken breast grilled', grams: 120, confidence: 'high', preparation: 'a la plancha' },
    { name: 'Salsa', query: 'sauce unknown', grams: 30, confidence: 'low' },
  ],
  caveats: ['No se ve si lleva aceite.'],
};

describe('scan draft', () => {
  it('waits for database values, then keeps unknown foods unresolved instead of inventing them', () => {
    const d0 = draftFromAnalysis(analysis);
    expect(waitingKeys(d0)).toHaveLength(3);
    const [a, b, c] = d0.items.map((i) => i.key);
    const d1 = applyLookups(d0, [
      { id: a!, match: rice, alternatives: [] },
      { id: b!, match: chicken, alternatives: [rice] },
      { id: c!, match: null, alternatives: [] },
    ]);
    expect(d1.items.map((i) => i.status)).toEqual(['ok', 'ok', 'none']);
    const s = summarize(d1);
    // Only the foods with values are added up, and the user is told one is missing.
    expect(s.ready).toBe(2);
    expect(s.pending).toBe(1);
    expect(s.total.kcal).toBeCloseTo(130 * 1.8 + 165 * 1.2, 5);
    expect(s.estimated).toBe(true);
    // Chicken has no fibre data, so fibre is not totalled as if it were complete.
    expect(s.total.fiber).toBeUndefined();
    expect(s.missing).toContain('fiber');
    expect(canSave(d1)).toBe(false);
    expect(canSave(removeItem(d1, c!))).toBe(true);
  });

  it('marks failed lookups for a retry', () => {
    const d = failLookups(draftFromAnalysis(analysis));
    expect(d.items.every((i) => i.status === 'error')).toBe(true);
    expect(retryLookups(d).items.every((i) => i.status === 'loading')).toBe(true);
  });

  it('edits amounts and foods; an edited amount is no longer an estimate', () => {
    let d = draftFromAnalysis(analysis);
    const [a] = d.items.map((i) => i.key);
    d = applyLookups(d, [{ id: a!, match: rice, alternatives: [] }]);
    d = removeItem(removeItem(d, d.items[1]!.key), d.items[2]!.key);
    d = setGrams(d, a!, 250);
    expect(d.items[0]).toMatchObject({ grams: 250, amount: 'user', confidence: undefined });
    expect(summarize(d).estimated).toBe(false);
    expect(setGrams(d, a!, 99999).items[0]!.grams).toBe(5000);
    d = chooseFood(d, a!, chicken);
    expect(d.items[0]!.source).toMatchObject({ kind: 'usda', id: 2 });
    expect(valuesFor(d, 'per100')).toEqual(chicken.per100);
    expect(valuesFor(d, 'portion')!.kcal).toBeCloseTo(412.5, 5);
  });

  it('describes a packaged product per serving, per 100 g and for the amount eaten', () => {
    const product: OffProduct = {
      code: '8410000123456',
      name: 'Yogur natural',
      brand: 'Marca',
      servingGrams: 125,
      servingLabel: '1 yogur (125 g)',
      liquid: false,
      per100: { kcal: 60, protein: 4, carbs: 5, fat: 2.5, sugars: 5 },
    };
    const d = draftFromProduct(product);
    expect(availableBases(d)).toEqual(['portion', 'per100', 'serving']);
    expect(d.items[0]).toMatchObject({ grams: 125, amount: 'label' });
    expect(valuesFor(d, 'serving')!.kcal).toBe(75);
    expect(valuesFor(d, 'per100')!.kcal).toBe(60);
    expect(canSave(d)).toBe(true);
    const items = toMealItems(d);
    expect(items[0]).toMatchObject({ grams: 125, estimated: false, source: { kind: 'off', id: '8410000123456' } });
    expect(items[0]!.nutrients.kcal).toBe(75);
  });

  it('asks for the amount when a product has no serving size', () => {
    const d = draftFromProduct({ code: '96385074', name: 'Zumo', liquid: true, per100: { kcal: 45, protein: 0.5, carbs: 10, fat: 0 } });
    expect(d.items[0]).toMatchObject({ grams: 100, unit: 'ml', amount: 'default' });
    expect(availableBases(d)).toEqual(['portion', 'per100']);
    expect(canSave(d)).toBe(false);
    const confirmed = confirmAmount(d, d.items[0]!.key);
    expect(canSave(confirmed)).toBe(true);
    expect(toMealItems(confirmed)[0]).toMatchObject({ unit: 'ml', grams: 100 });
  });

  it('saves photo estimates flagged as estimates', () => {
    let d = draftFromAnalysis({ ...analysis, items: analysis.items.slice(0, 1) });
    d = applyLookups(d, [{ id: d.items[0]!.key, match: rice, alternatives: [] }]);
    expect(toMealItems(d)[0]).toMatchObject({ name: 'Arroz blanco', grams: 180, estimated: true });
  });
});
