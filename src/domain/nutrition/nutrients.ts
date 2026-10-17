import type { MealItem, Nutrients } from '../types';

export const KJ_PER_KCAL = 4.184;

export const OPTIONAL_NUTRIENTS = ['satFat', 'fiber', 'sugars'] as const;
export type OptionalNutrient = (typeof OPTIONAL_NUTRIENTS)[number];

export const kcalToKj = (kcal: number): number => Math.round(kcal * KJ_PER_KCAL);

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Values for `grams` of a food described per 100 g. */
export function scaleNutrients(per100: Nutrients, grams: number): Nutrients {
  const f = grams / 100;
  const out: Nutrients = {
    kcal: per100.kcal * f,
    protein: per100.protein * f,
    carbs: per100.carbs * f,
    fat: per100.fat * f,
  };
  for (const k of OPTIONAL_NUTRIENTS) if (per100[k] !== undefined) out[k] = per100[k]! * f;
  return out;
}

/**
 * Adds up several amounts. An optional nutrient is only totalled when every
 * part reports it; otherwise it is left out and listed in `missing`, so a
 * partial sum is never shown as the whole.
 */
export function sumNutrients(parts: readonly Nutrients[]): { total: Nutrients; missing: OptionalNutrient[] } {
  const total: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const p of parts) {
    total.kcal += p.kcal;
    total.protein += p.protein;
    total.carbs += p.carbs;
    total.fat += p.fat;
  }
  const missing: OptionalNutrient[] = [];
  for (const k of OPTIONAL_NUTRIENTS) {
    if (parts.length && parts.every((p) => p[k] !== undefined)) total[k] = parts.reduce((a, p) => a + p[k]!, 0);
    else missing.push(k);
  }
  return { total, missing };
}

/** Values per 100 g of a whole plate, from its total and its total weight. */
export function per100Of(total: Nutrients, grams: number): Nutrients | null {
  if (!(grams > 0)) return null;
  return scaleNutrients(total, (100 / grams) * 100);
}

export function mealTotals(items: readonly MealItem[]) {
  return sumNutrients(items.map((i) => i.nutrients));
}

/** Rounded for storage and display: whole kcal, one decimal for grams. */
export function roundNutrients(n: Nutrients): Nutrients {
  const out: Nutrients = { kcal: Math.round(n.kcal), protein: round1(n.protein), carbs: round1(n.carbs), fat: round1(n.fat) };
  for (const k of OPTIONAL_NUTRIENTS) if (n[k] !== undefined) out[k] = round1(n[k]!);
  return out;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Whether values per 100 g are physically possible. Pure fat is ~900 kcal per
 * 100 g, macronutrients cannot add up to more than 100 g, saturated fat is part
 * of fat and sugars part of carbohydrates. Small rounding margins allowed.
 */
export function isPlausiblePer100(n: Nutrients): boolean {
  const core = [n.kcal, n.protein, n.carbs, n.fat];
  if (!core.every((v) => finite(v) && v >= 0)) return false;
  if (n.kcal > 950 || n.protein > 100 || n.carbs > 100 || n.fat > 100) return false;
  if (n.protein + n.carbs + n.fat > 105) return false;
  for (const k of OPTIONAL_NUTRIENTS) {
    const v = n[k];
    if (v !== undefined && (!finite(v) || v < 0 || v > 100)) return false;
  }
  if (n.satFat !== undefined && n.satFat > n.fat + 1) return false;
  if (n.sugars !== undefined && n.sugars > n.carbs + 1) return false;
  return true;
}

/** Energy that the macronutrients alone would give (Atwater 4/4/9), to flag inconsistent sources. */
export const atwaterKcal = (n: Nutrients): number => 4 * n.protein + 4 * n.carbs + 9 * n.fat;
