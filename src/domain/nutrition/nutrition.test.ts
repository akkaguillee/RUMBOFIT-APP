import { describe, expect, it } from 'vitest';
import { AnalysisFormatError, parsePhotoAnalysis } from './analysis';
import { isValidGtin, normalizeBarcode } from './barcode';
import { goalFamily, mealGuidance, type GuidanceInput } from './guidance';
import { itemFromPer100, mealForTime, withGrams } from './meals';
import { isPlausiblePer100, kcalToKj, per100Of, scaleNutrients, sumNutrients } from './nutrients';
import { parseOffProduct, perServing } from './off';
import { bestUsdaMatch, parseUsdaFood, parseUsdaSearch } from './usda';

// Shapes follow the public APIs: a FoodData Central search hit and an Open Food Facts v2 product.
const banana = {
  fdcId: 173944,
  description: 'Bananas, raw',
  dataType: 'SR Legacy',
  foodNutrients: [
    { nutrientId: 1003, nutrientName: 'Protein', nutrientNumber: '203', unitName: 'G', value: 1.09 },
    { nutrientId: 1004, nutrientName: 'Total lipid (fat)', nutrientNumber: '204', unitName: 'G', value: 0.33 },
    { nutrientId: 1005, nutrientName: 'Carbohydrate, by difference', nutrientNumber: '205', unitName: 'G', value: 22.84 },
    { nutrientId: 1008, nutrientName: 'Energy', nutrientNumber: '208', unitName: 'KCAL', value: 89 },
    { nutrientId: 1062, nutrientName: 'Energy', nutrientNumber: '268', unitName: 'kJ', value: 371 },
    { nutrientId: 1079, nutrientName: 'Fiber, total dietary', nutrientNumber: '291', unitName: 'G', value: 2.6 },
    { nutrientId: 2000, nutrientName: 'Sugars, total including NLEA', nutrientNumber: '269', unitName: 'G', value: 12.23 },
    { nutrientId: 1258, nutrientName: 'Fatty acids, total saturated', nutrientNumber: '606', unitName: 'G', value: 0.112 },
  ],
};

const nutella = {
  code: '3017620422003',
  status: 1,
  product: {
    product_name: 'Nutella',
    brands: 'Ferrero,Nutella',
    quantity: '400 g',
    serving_size: '15 g',
    serving_quantity: 15,
    nutriments: {
      'energy-kcal_100g': 539,
      'energy-kj_100g': 2252,
      fat_100g: 30.9,
      'saturated-fat_100g': 10.6,
      carbohydrates_100g: 57.5,
      sugars_100g: 56.3,
      proteins_100g: 6.3,
    },
  },
};

describe('nutrient math', () => {
  it('scales values per 100 g and keeps only the optional values the source gives', () => {
    const n = scaleNutrients({ kcal: 89, protein: 1.09, carbs: 22.84, fat: 0.33, fiber: 2.6 }, 120);
    expect(n.kcal).toBeCloseTo(106.8);
    expect(n.fiber).toBeCloseTo(3.12);
    expect('sugars' in n).toBe(false);
    expect(kcalToKj(100)).toBe(418);
  });

  it('never presents a partial sum of an optional nutrient as the total', () => {
    const { total, missing } = sumNutrients([
      { kcal: 100, protein: 5, carbs: 10, fat: 4, fiber: 2 },
      { kcal: 50, protein: 1, carbs: 12, fat: 0 },
    ]);
    expect(total).toEqual({ kcal: 150, protein: 6, carbs: 22, fat: 4 });
    expect(missing).toEqual(['satFat', 'fiber', 'sugars']);
    expect(per100Of(total, 300)).toMatchObject({ kcal: expect.closeTo(50, 6), carbs: expect.closeTo(7.33, 2) });
    expect(per100Of(total, 0)).toBeNull();
  });

  it('rejects impossible values per 100 g', () => {
    expect(isPlausiblePer100({ kcal: 89, protein: 1, carbs: 23, fat: 0.3 })).toBe(true);
    expect(isPlausiblePer100({ kcal: 884, protein: 0, carbs: 0, fat: 100 })).toBe(true);
    expect(isPlausiblePer100({ kcal: 1200, protein: 0, carbs: 0, fat: 100 })).toBe(false);
    expect(isPlausiblePer100({ kcal: 300, protein: 60, carbs: 50, fat: 10 })).toBe(false);
    expect(isPlausiblePer100({ kcal: 300, protein: 10, carbs: 20, fat: 5, satFat: 9 })).toBe(false);
    expect(isPlausiblePer100({ kcal: Number.NaN, protein: 1, carbs: 1, fat: 1 })).toBe(false);
  });

  it('edits amounts from the values per 100 g', () => {
    const item = itemFromPer100({ name: 'Plátano', per100: { kcal: 89, protein: 1.09, carbs: 22.84, fat: 0.33 }, grams: 118, source: { kind: 'manual' }, estimated: true });
    expect(item.nutrients).toEqual({ kcal: 105, protein: 1.3, carbs: 27, fat: 0.4 });
    const edited = withGrams(item, 150);
    expect(edited).toMatchObject({ grams: 150, estimated: false, nutrients: { kcal: 134 } });
    expect(mealForTime('08:30')).toBe('breakfast');
    expect(mealForTime('14:15')).toBe('lunch');
    expect(mealForTime('21:40')).toBe('dinner');
    expect(mealForTime('18:00')).toBe('snack');
  });
});

describe('barcodes', () => {
  it('checks EAN-13, UPC-A and EAN-8 check digits', () => {
    expect(isValidGtin('3017620422003')).toBe(true);
    expect(isValidGtin('036000291452')).toBe(true);
    expect(isValidGtin('96385074')).toBe(true);
    expect(isValidGtin('3017620422004')).toBe(false);
    expect(isValidGtin('12345')).toBe(false);
    expect(normalizeBarcode(' 3017 6204 2200 3 ')).toBe('3017620422003');
  });
});

describe('USDA FoodData Central', () => {
  it('reads a search hit by nutrient id, per 100 g', () => {
    expect(parseUsdaFood(banana)).toEqual({
      fdcId: 173944,
      description: 'Bananas, raw',
      dataType: 'SR Legacy',
      per100: { kcal: 89, protein: 1.09, fat: 0.33, carbs: 22.84, fiber: 2.6, sugars: 12.23, satFat: 0.112 },
    });
  });

  it('reads food details, Atwater energy and kJ-only foods', () => {
    const detail = {
      fdcId: 748967,
      description: 'Eggs, Grade A, Large, egg whole',
      dataType: 'Foundation',
      foodNutrients: [
        { nutrient: { id: 1003, number: '203', name: 'Protein', unitName: 'g' }, amount: 12.4 },
        { nutrient: { id: 1004, number: '204', name: 'Total lipid (fat)', unitName: 'g' }, amount: 9.96 },
        { nutrient: { id: 1050, number: '205.2', name: 'Carbohydrates', unitName: 'g' }, amount: 0.96 },
        { nutrient: { id: 2047, number: '957', name: 'Energy (Atwater General Factors)', unitName: 'kcal' }, amount: 143 },
      ],
    };
    expect(parseUsdaFood(detail)?.per100).toEqual({ kcal: 143, protein: 12.4, fat: 9.96, carbs: 0.96 });
    const kjOnly = { ...banana, foodNutrients: banana.foodNutrients.filter((n) => n.nutrientId !== 1008) };
    expect(parseUsdaFood(kjOnly)?.per100.kcal).toBeCloseTo(88.7, 1);
  });

  it('drops foods without energy or macros, or with impossible values', () => {
    expect(parseUsdaFood({ ...banana, foodNutrients: banana.foodNutrients.filter((n) => n.nutrientId !== 1005) })).toBeNull();
    expect(parseUsdaFood({ ...banana, foodNutrients: [...banana.foodNutrients.filter((n) => n.nutrientId !== 1003), { nutrientId: 1003, unitName: 'G', value: 140 }] })).toBeNull();
    expect(parseUsdaFood({ description: 'x' })).toBeNull();
  });

  it('prefers generic foods over branded ones, keeping relevance order', () => {
    const branded = { ...banana, fdcId: 1, description: 'BANANA CHIPS', dataType: 'Branded' };
    const fndds = { ...banana, fdcId: 2, description: 'Banana, raw', dataType: 'Survey (FNDDS)' };
    const foods = parseUsdaSearch({ foods: [branded, fndds, banana] });
    expect(foods).toHaveLength(3);
    expect(bestUsdaMatch(foods)?.fdcId).toBe(2);
    expect(bestUsdaMatch(parseUsdaSearch({ foods: [branded] }))?.fdcId).toBe(1);
    expect(bestUsdaMatch([])).toBeNull();
  });
});

describe('Open Food Facts', () => {
  it('reads label values per 100 g and the serving size', () => {
    const p = parseOffProduct(nutella, '3017620422003')!;
    expect(p).toMatchObject({ name: 'Nutella', brand: 'Ferrero', quantity: '400 g', servingLabel: '15 g', servingGrams: 15, liquid: false });
    expect(p.per100).toEqual({ kcal: 539, protein: 6.3, carbs: 57.5, fat: 30.9, satFat: 10.6, sugars: 56.3 });
    expect(perServing(p)?.kcal).toBeCloseTo(80.85);
  });

  it('handles drinks, decimal commas, kJ-only labels and missing products', () => {
    const drink = parseOffProduct(
      { status: 1, product: { product_name_es: 'Zumo de naranja', quantity: '1 l', nutriments: { energy_100g: '188', proteins_100g: '0,7', carbohydrates_100g: '10,4', fat_100g: 0.1, sugars_100g: '8,9' } } },
      '8410000000000',
    )!;
    expect(drink).toMatchObject({ name: 'Zumo de naranja', liquid: true });
    expect(drink.per100.kcal).toBeCloseTo(44.9, 1);
    expect(drink.per100.protein).toBe(0.7);
    expect(parseOffProduct({ status: 0, status_verbose: 'product not found' }, '1')).toBeNull();
    expect(parseOffProduct({ status: 1, product: { product_name: 'Sin datos', nutriments: {} } }, '1')).toBeNull();
  });
});

describe('photo analysis contract', () => {
  it('bounds and cleans what the model returns', () => {
    const a = parsePhotoAnalysis({
      is_food: true,
      image_quality: 'good',
      dish_name: 'Tortilla con ensalada',
      items: [
        { name_es: 'Tortilla de patatas', usda_query: 'omelet with potatoes', grams: 180.4, grams_confidence: 'medium', preparation: 'frita' },
        { name_es: 'Lechuga', usda_query: 'lettuce <script>', grams: 9999, grams_confidence: 'weird', preparation: '' },
        { name_es: '', usda_query: 'nothing', grams: 10, grams_confidence: 'low', preparation: '' },
      ],
      barcode: '3017620422004',
      caveats: ['Puede llevar aceite que no se ve.'],
    });
    expect(a.items).toEqual([
      { name: 'Tortilla de patatas', query: 'omelet with potatoes', grams: 180, confidence: 'medium', preparation: 'frita' },
      { name: 'Lechuga', query: 'lettuce script', grams: 2000, confidence: 'low' },
    ]);
    // An invalid check digit is dropped instead of being looked up.
    expect(a.barcode).toBeUndefined();
    expect(a.caveats).toHaveLength(1);
  });

  it('reports photos without food and rejects empty answers', () => {
    expect(parsePhotoAnalysis({ is_food: false, image_quality: 'not_food', dish_name: '', items: [], barcode: '', caveats: [] })).toMatchObject({
      isFood: false,
      quality: 'not_food',
      items: [],
    });
    expect(() => parsePhotoAnalysis({ is_food: true, items: [], barcode: '' })).toThrow(AnalysisFormatError);
    expect(() => parsePhotoAnalysis(null)).toThrow(AnalysisFormatError);
  });
});

describe('meal guidance', () => {
  const base: GuidanceInput = {
    total: { kcal: 900, protein: 18, carbs: 100, fat: 40, fiber: 2 },
    meal: 'lunch',
    goal: 'lose',
    targetKcal: 2000,
    kg: 85,
    loggedKcal: 0,
    estimated: true,
    healthFlags: [],
  };

  it('maps every goal to one of four families', () => {
    expect(['lose', 'recomp', 'gain', 'strength', 'maintain', 'fitness', 'habits', 'consistency'].map((g) => goalFamily(g as never))).toEqual([
      'lose',
      'lose',
      'gain',
      'muscle',
      'maintain',
      'maintain',
      'maintain',
      'maintain',
    ]);
  });

  it('judges the portion against the daily target without labelling the food', () => {
    // Lunch is the main meal in Spain: 45 % of the day still fits, 50 % is generous.
    expect(mealGuidance(base).headline).toBe('Encaja bien en tu objetivo: el 45 % de tus ~2.000 kcal diarias.');
    const g = mealGuidance({ ...base, total: { ...base.total, kcal: 1000 } });
    expect(g.headline).toBe('Es una ración generosa para tu objetivo: aporta el 50 % de las ~2.000 kcal de tu día.');
    expect(g.tips[0]).toMatch(/ajusta la cantidad/);
    expect(g.tips).toHaveLength(2);
    expect(g.note).toMatch(/estimadas a partir de la foto/);
    expect(JSON.stringify(g)).not.toMatch(/malo|mala|prohibid|culpa/i);
  });

  it('suggests protein for muscle gain and energy for weight gain', () => {
    expect(mealGuidance({ ...base, goal: 'strength', total: { kcal: 600, protein: 12, carbs: 90, fat: 18 } }).tips).toContain(
      'Sumar una fuente de proteína (huevo, legumbre, pescado, carne, yogur…) te ayuda a construir músculo.',
    );
    const gain = mealGuidance({ ...base, goal: 'gain', targetKcal: 2800, total: { kcal: 400, protein: 30, carbs: 40, fat: 12 } });
    expect(gain.headline).toMatch(/ración algo mayor/);
  });

  it('counts what is already logged today', () => {
    const g = mealGuidance({ ...base, total: { kcal: 600, protein: 40, carbs: 60, fat: 20 }, loggedKcal: 700 });
    expect(g.tips).toContain('Con lo que llevas registrado hoy te quedarían unas 700 kcal.');
  });

  it('never compares with targets for a history of eating disorders, and explains missing or restricted targets', () => {
    const ed = mealGuidance({ ...base, healthFlags: ['eating_disorder'] });
    expect(ed.tips).toEqual([]);
    expect(ed.headline).not.toMatch(/%|kcal/);
    const restricted = mealGuidance({ ...base, targetKcal: null, noTarget: 'restricted' });
    expect(restricted.headline).toMatch(/^Aporta 900 kcal/);
    expect(restricted.note).toMatch(/no mostramos comparaciones/);
    expect(mealGuidance({ ...base, targetKcal: null, noTarget: 'missing', estimated: false }).note).toMatch(/Completa tu peso/);
  });
});
