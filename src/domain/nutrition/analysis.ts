import { isValidGtin, normalizeBarcode } from './barcode';

/**
 * Contract between the photo analysis function and the app. The vision model
 * only identifies foods and estimates amounts; nutrient values always come
 * from a nutrition database, never from the model.
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
        required: ['name_es', 'usda_query', 'grams', 'grams_confidence', 'preparation'],
        properties: {
          name_es: { type: 'string' },
          usda_query: { type: 'string' },
          grams: { type: 'number' },
          grams_confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          preparation: { type: 'string' },
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
    items.push({
      name,
      query,
      grams,
      confidence: CONFIDENCES.includes(confRaw as GramsConfidence) ? (confRaw as GramsConfidence) : 'low',
      ...(preparation ? { preparation } : {}),
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
