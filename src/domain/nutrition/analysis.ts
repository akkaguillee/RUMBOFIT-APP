import type { Nutrients } from '../types';
import { isValidGtin, normalizeBarcode } from './barcode';
import { energyAddsUp, isPlausiblePer100, roundNutrients } from './nutrients';

/**
 * Contract between the photo analysis function and the app. The vision model
 * identifies foods, estimates amounts and gives typical values per 100 g from
 * food composition tables. Those values are shown as estimates and checked
 * (possible, and energy consistent with the macronutrients); a nutrition
 * database verifies or replaces them when it is available.
 */

export type GramsConfidence = 'low' | 'medium' | 'high';
export type ImageQuality = 'good' | 'blurry' | 'dark' | 'partial' | 'not_food';

export interface DetectedItem {
  /** Name shown to the user (Spanish). */
  name: string;
  /** English terms to look the food up in USDA FoodData Central. */
  query: string;
  /** Estimated edible amount. */
  grams: number;
  confidence: GramsConfidence;
  preparation?: string;
  /** Typical values per 100 g estimated by the model, when they passed the checks. */
  per100?: Nutrients;
  /** Approximate centre of the food in the photo (fractions of width and height). */
  at?: { x: number; y: number };
}

export interface PhotoAnalysis {
  isFood: boolean;
  quality: ImageQuality;
  dish: string;
  items: DetectedItem[];
  /** Digits of a legible product barcode, already checked. */
  barcode?: string;
  caveats: string[];
}

export const MAX_ITEMS = 10;
export const MAX_HINT_LENGTH = 200;

/** Typical composition per 100 g, as in food composition tables. */
const PER_100G_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'sat_fat_g', 'fiber_g', 'sugars_g', 'alcohol_g'],
  properties: {
    kcal: { type: 'number' },
    protein_g: { type: 'number' },
    carbs_g: { type: 'number' },
    fat_g: { type: 'number' },
    sat_fat_g: { type: 'number' },
    fiber_g: { type: 'number' },
    sugars_g: { type: 'number' },
    alcohol_g: { type: 'number' },
  },
} as const;

/** JSON schema the model's answer must follow (structured outputs). */
export const PHOTO_ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_food', 'image_quality', 'dish_name', 'items', 'barcode', 'caveats'],
  properties: {
    is_food: { type: 'boolean' },
    image_quality: { type: 'string', enum: ['good', 'blurry', 'dark', 'partial', 'not_food'] },
    dish_name: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name_es', 'usda_query', 'grams', 'grams_confidence', 'preparation', 'per_100g', 'center_x', 'center_y'],
        properties: {
          name_es: { type: 'string' },
          usda_query: { type: 'string' },
          grams: { type: 'number' },
          grams_confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          preparation: { type: 'string' },
          per_100g: PER_100G_SCHEMA,
          center_x: { type: 'number' },
          center_y: { type: 'number' },
        },
      },
    },
    barcode: { type: 'string' },
    caveats: { type: 'array', items: { type: 'string' } },
  },
} as const;

const QUALITIES: readonly ImageQuality[] = ['good', 'blurry', 'dark', 'partial', 'not_food'];
const CONFIDENCES: readonly GramsConfidence[] = ['low', 'medium', 'high'];

const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** A query for the database: letters, digits and simple punctuation only. */
export function cleanQuery(v: unknown): string {
  return clean(v, 80)
    .replace(/[^\p{L}\p{N} ,()'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class AnalysisFormatError extends Error {}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);

/**
 * Model-estimated values per 100 g (snake_case from the schema, or the
 * camelCase Nutrients the app already uses). Returned only when they are
 * physically possible and the energy agrees with the macronutrients.
 */
export function parseEstimatedPer100(input: unknown): Nutrients | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const r = input as Record<string, unknown>;
  const n: Nutrients = {
    kcal: num(r.kcal),
    protein: num(r.protein_g ?? r.protein),
    carbs: num(r.carbs_g ?? r.carbs),
    fat: num(r.fat_g ?? r.fat),
  };
  const optional: [keyof Nutrients, unknown][] = [
    ['satFat', r.sat_fat_g ?? r.satFat],
    ['fiber', r.fiber_g ?? r.fiber],
    ['sugars', r.sugars_g ?? r.sugars],
  ];
  for (const [k, v] of optional) if (Number.isFinite(num(v)) && num(v) >= 0) n[k] = num(v);
  const alcohol = Math.max(0, num(r.alcohol_g) || 0);
  if (!isPlausiblePer100(n) || !energyAddsUp(n, alcohol)) return undefined;
  return roundNutrients(n);
}

const fraction = (v: unknown): number | null => {
  const n = num(v);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? Math.round(n * 1000) / 1000 : null;
};

/**
 * Validates the model's raw JSON (snake_case, from the schema above) or an
 * already-parsed analysis sent to the app (camelCase), and returns a safe,
 * bounded PhotoAnalysis. Throws AnalysisFormatError if it is unusable.
 */
export function parsePhotoAnalysis(input: unknown): PhotoAnalysis {
  if (!input || typeof input !== 'object') throw new AnalysisFormatError('Respuesta vacía.');
  const r = input as Record<string, unknown>;
  const isFood = (r.is_food ?? r.isFood) === true;
  const qualityRaw = r.image_quality ?? r.quality;
  const quality: ImageQuality = QUALITIES.includes(qualityRaw as ImageQuality) ? (qualityRaw as ImageQuality) : 'good';
  const rawItems = Array.isArray(r.items) ? r.items : [];
  const items: DetectedItem[] = [];
  for (const raw of rawItems.slice(0, MAX_ITEMS)) {
    if (!raw || typeof raw !== 'object') continue;
    const it = raw as Record<string, unknown>;
    const name = clean(it.name_es ?? it.name, 60);
    const query = cleanQuery(it.usda_query ?? it.query);
    const grams = typeof it.grams === 'number' && Number.isFinite(it.grams) ? Math.min(2000, Math.max(1, Math.round(it.grams))) : NaN;
    const confRaw = it.grams_confidence ?? it.confidence;
    if (!name || !query || !Number.isFinite(grams)) continue;
    const preparation = clean(it.preparation, 40);
    const per100 = parseEstimatedPer100(it.per_100g ?? it.per100);
    const pos = (it.at ?? {}) as Record<string, unknown>;
    const x = fraction(it.center_x ?? pos.x);
    const y = fraction(it.center_y ?? pos.y);
    items.push({
      name,
      query,
      grams,
      confidence: CONFIDENCES.includes(confRaw as GramsConfidence) ? (confRaw as GramsConfidence) : 'low',
      ...(preparation ? { preparation } : {}),
      ...(per100 ? { per100 } : {}),
      ...(x !== null && y !== null ? { at: { x, y } } : {}),
    });
  }
  const code = normalizeBarcode(clean(r.barcode, 20));
  const caveats = (Array.isArray(r.caveats) ? r.caveats : [])
    .map((c) => clean(c, 140))
    .filter(Boolean)
    .slice(0, 4);
  const dish = clean(r.dish_name ?? r.dish, 80) || items.map((i) => i.name).join(', ').slice(0, 80);
  if (isFood && !items.length && !code) throw new AnalysisFormatError('No se identificó ningún alimento.');
  return {
    isFood: isFood && items.length > 0,
    quality: isFood ? quality : 'not_food',
    dish,
    items: isFood ? items : [],
    ...(code && isValidGtin(code) ? { barcode: code } : {}),
    caveats,
  };
}

// ── A food typed by the user ───────────────────────────────────────────

/** Schema for looking up one food by name: a database query and typical values. */
export const FOOD_REFERENCE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_food', 'name_es', 'usda_query', 'per_100g'],
  properties: {
    is_food: { type: 'boolean' },
    name_es: { type: 'string' },
    usda_query: { type: 'string' },
    per_100g: PER_100G_SCHEMA,
  },
} as const;

export interface FoodReference {
  name: string;
  query: string;
  per100?: Nutrients;
}

export function parseFoodReference(input: unknown): FoodReference | null {
  if (!input || typeof input !== 'object') return null;
  const r = input as Record<string, unknown>;
  if (r.is_food === false) return null;
  const name = clean(r.name_es ?? r.name, 60);
  const query = cleanQuery(r.usda_query ?? r.query);
  if (!name) return null;
  const per100 = parseEstimatedPer100(r.per_100g ?? r.per100);
  return { name, query, ...(per100 ? { per100 } : {}) };
}
