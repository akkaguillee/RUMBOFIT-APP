import type { Nutrients } from '../types';
import { isPlausiblePer100, KJ_PER_KCAL, scaleNutrients } from './nutrients';

/**
 * Open Food Facts products: values from the label, per 100 g (or 100 ml for
 * drinks) and per serving when the label gives a serving size.
 */

export interface OffProduct {
  code: string;
  name: string;
  brand?: string;
  /** Pack size as printed, e.g. "400 g". */
  quantity?: string;
  /** Serving as printed, e.g. "15 g". */
  servingLabel?: string;
  servingGrams?: number;
  /** Values are per 100 ml instead of 100 g. */
  liquid: boolean;
  per100: Nutrients;
}

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};

const text = (v: unknown, max = 120): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : undefined;
};

/** Parses an API v2 product response (`{ status, product }`); null when not found or without usable nutrition facts. */
export function parseOffProduct(input: unknown, code: string): OffProduct | null {
  if (!input || typeof input !== 'object') return null;
  const body = input as Record<string, unknown>;
  const product = body.product as Record<string, unknown> | undefined;
  if (!product || typeof product !== 'object' || body.status === 0) return null;
  const n = (product.nutriments ?? {}) as Record<string, unknown>;
  const kj = num(n['energy-kj_100g']) ?? num(n.energy_100g);
  const kcal = num(n['energy-kcal_100g']) ?? (kj !== undefined ? kj / KJ_PER_KCAL : undefined);
  const protein = num(n.proteins_100g);
  const carbs = num(n.carbohydrates_100g);
  const fat = num(n.fat_100g);
  if (kcal === undefined || protein === undefined || carbs === undefined || fat === undefined) return null;
  const per100: Nutrients = { kcal, protein, carbs, fat };
  const satFat = num(n['saturated-fat_100g']);
  const fiber = num(n.fiber_100g);
  const sugars = num(n.sugars_100g);
  if (satFat !== undefined) per100.satFat = satFat;
  if (fiber !== undefined) per100.fiber = fiber;
  if (sugars !== undefined) per100.sugars = sugars;
  if (!isPlausiblePer100(per100)) return null;
  const name = text(product.product_name_es) ?? text(product.product_name) ?? text(product.generic_name_es) ?? text(product.generic_name);
  if (!name) return null;
  const quantity = text(product.quantity, 40);
  const servingGrams = num(product.serving_quantity);
  return {
    code,
    name,
    brand: text(typeof product.brands === 'string' ? product.brands.split(',')[0] : undefined, 60),
    quantity,
    servingLabel: text(product.serving_size, 40),
    servingGrams: servingGrams !== undefined && servingGrams > 0 && servingGrams <= 2000 ? servingGrams : undefined,
    liquid: /\b\d+([.,]\d+)?\s*(ml|cl|l)\b/i.test(quantity ?? '') || /\bml\b/i.test(String(product.serving_size ?? '')),
    per100,
  };
}

export const perServing = (p: OffProduct): Nutrients | null => (p.servingGrams ? scaleNutrients(p.per100, p.servingGrams) : null);
