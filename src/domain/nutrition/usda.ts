import type { Nutrients } from '../types';
import { isPlausiblePer100, KJ_PER_KCAL } from './nutrients';

/**
 * USDA FoodData Central. Foundation, SR Legacy and Survey (FNDDS) foods are
 * reported per 100 g. Nutrients are matched by their FDC id (or the legacy
 * nutrient number), never by name, which changes between data types.
 */

export interface UsdaFood {
  fdcId: number;
  description: string;
  dataType: string;
  per100: Nutrients;
}

type Field = keyof Nutrients;

// [field, FDC nutrient ids in order of preference, legacy numbers]
const NUTRIENTS: [Field, number[], string[]][] = [
  ['protein', [1003], ['203']],
  ['fat', [1004], ['204']],
  ['carbs', [1005, 1050], ['205', '205.2']],
  ['fiber', [1079], ['291']],
  ['sugars', [2000, 1063], ['269', '269.3']],
  ['satFat', [1258], ['606']],
];

/** Generic foods first: they describe the food itself, not one brand's recipe. */
export const USDA_DATA_TYPES = ['Survey (FNDDS)', 'SR Legacy', 'Foundation'] as const;

interface Row {
  id?: number;
  number?: string;
  unit: string;
  value: number;
}

/** Search results and food details list nutrients in two different shapes. */
function rows(food: Record<string, unknown>): Row[] {
  const list = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
  const out: Row[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const nested = (r.nutrient && typeof r.nutrient === 'object' ? r.nutrient : null) as Record<string, unknown> | null;
    const id = typeof r.nutrientId === 'number' ? r.nutrientId : typeof nested?.id === 'number' ? nested.id : undefined;
    const number = typeof r.nutrientNumber === 'string' ? r.nutrientNumber : typeof nested?.number === 'string' ? nested.number : undefined;
    const unit = String(r.unitName ?? nested?.unitName ?? '').toLowerCase();
    const value = typeof r.value === 'number' ? r.value : typeof r.amount === 'number' ? r.amount : NaN;
    if (Number.isFinite(value)) out.push({ id, number, unit, value });
  }
  return out;
}

const find = (list: Row[], ids: number[], numbers: string[]) => {
  for (const id of ids) {
    const r = list.find((x) => x.id === id);
    if (r) return r;
  }
  for (const n of numbers) {
    const r = list.find((x) => x.number === n);
    if (r) return r;
  }
  return undefined;
};

function energyKcal(list: Row[]): number | undefined {
  const kcal = find(list, [1008, 2048, 2047], ['208', '958', '957']);
  if (kcal && kcal.unit === 'kcal') return kcal.value;
  const kj = find(list, [1062], ['268']);
  if (kj && kj.unit === 'kj') return kj.value / KJ_PER_KCAL;
  return undefined;
}

/** Values per 100 g of one FDC food, or null when energy or a macronutrient is missing or the numbers are impossible. */
export function parseUsdaFood(input: unknown): UsdaFood | null {
  if (!input || typeof input !== 'object') return null;
  const food = input as Record<string, unknown>;
  if (typeof food.fdcId !== 'number' || typeof food.description !== 'string') return null;
  const list = rows(food);
  const kcal = energyKcal(list);
  if (kcal === undefined) return null;
  const per100: Partial<Nutrients> = { kcal };
  for (const [field, ids, numbers] of NUTRIENTS) {
    const r = find(list, ids, numbers);
    if (r && r.unit === 'g') per100[field] = r.value;
  }
  if (per100.protein === undefined || per100.fat === undefined || per100.carbs === undefined) return null;
  const n = per100 as Nutrients;
  if (!isPlausiblePer100(n)) return null;
  return { fdcId: food.fdcId, description: food.description, dataType: typeof food.dataType === 'string' ? food.dataType : '', per100: n };
}

/** Valid foods of a search response, keeping USDA's relevance order. */
export function parseUsdaSearch(input: unknown): UsdaFood[] {
  const foods = input && typeof input === 'object' && Array.isArray((input as { foods?: unknown }).foods) ? (input as { foods: unknown[] }).foods : [];
  return foods.map(parseUsdaFood).filter((f): f is UsdaFood => f !== null);
}

/** The most relevant generic food; branded products only if nothing generic matched. */
export function bestUsdaMatch(foods: readonly UsdaFood[]): UsdaFood | null {
  const generic = foods.find((f) => (USDA_DATA_TYPES as readonly string[]).includes(f.dataType));
  return generic ?? foods[0] ?? null;
}
