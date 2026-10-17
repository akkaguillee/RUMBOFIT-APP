import type { GramsConfidence, ImageQuality, PhotoAnalysis } from '@/domain/nutrition/analysis';
import { itemFromPer100 } from '@/domain/nutrition/meals';
import { per100Of, scaleNutrients, sumNutrients, type OptionalNutrient } from '@/domain/nutrition/nutrients';
import type { OffProduct } from '@/domain/nutrition/off';
import type { UsdaFood } from '@/domain/nutrition/usda';
import type { MealItem, NutrientSource, Nutrients } from '@/domain/types';
import type { NutrientLookup } from './api';

/**
 * The editable result of a scan before it is saved. Values come from a
 * database, the package, the user, or (marked as an estimate) the typical
 * values the AI gives for each food, which USDA verifies when it can. An item
 * without any reliable value stays visibly unresolved and the meal cannot be
 * saved until the user fixes or removes it.
 */

export type ItemStatus = 'loading' | 'ok' | 'none' | 'error';

/** Where the amount comes from: a photo estimate, the package, the user, or nothing yet. */
export type AmountSource = 'photo' | 'label' | 'user' | 'default';

/** Checking estimated values against the database: running, confirmed, or not confirmed. */
export type VerifyState = 'pending' | 'verified' | 'unverified';

export interface DraftItem {
  key: string;
  name: string;
  /** English search terms for FoodData Central. */
  query: string;
  grams: number;
  unit?: 'ml';
  amount: AmountSource;
  confidence?: GramsConfidence;
  preparation?: string;
  status: ItemStatus;
  per100?: Nutrients;
  source?: NutrientSource;
  alternatives: UsdaFood[];
  serving?: { grams: number; label?: string };
  verify?: VerifyState;
  /** Where the food is in the photo (fractions), for the labels on the picture. */
  at?: { x: number; y: number };
}

export interface Draft {
  origin: 'photo' | 'barcode' | 'manual';
  dish: string;
  items: DraftItem[];
  caveats: string[];
  quality?: ImageQuality;
  code?: string;
  brand?: string;
}

let seq = 0;
export const newKey = (): string => `f${(seq++).toString(36)}`;

export const MAX_GRAMS = 5000;
export const clampGrams = (g: number): number => Math.min(MAX_GRAMS, Math.max(1, Math.round(g)));

export const usdaSource = (f: UsdaFood): NutrientSource => ({ kind: 'usda', id: f.fdcId, label: f.description, dataType: f.dataType });

const DATA_TYPE: Record<string, string> = {
  'Survey (FNDDS)': 'plato preparado',
  'SR Legacy': 'referencia',
  Foundation: 'alimento básico',
  Branded: 'producto de marca',
};

/** What kind of FoodData Central entry a food is, in words. */
export const dataTypeLabel = (t: string): string => DATA_TYPE[t] ?? t;

/**
 * Items with estimated values are ready at once (and, when `verify` is true,
 * checked against the database afterwards); items without them wait for the
 * database, or need the user when there is none.
 */
export function draftFromAnalysis(a: PhotoAnalysis, opts: { verify: boolean } = { verify: true }): Draft {
  return {
    origin: 'photo',
    dish: a.dish || a.items[0]?.name || 'Comida',
    caveats: a.caveats,
    quality: a.quality,
    items: a.items.map((it) => ({
      key: newKey(),
      name: it.name,
      query: it.query,
      grams: clampGrams(it.grams),
      amount: 'photo',
      confidence: it.confidence,
      preparation: it.preparation,
      ...(it.at ? { at: it.at } : {}),
      ...(it.per100
        ? { status: 'ok' as const, per100: it.per100, source: { kind: 'ai' as const, label: it.name }, ...(opts.verify ? { verify: 'pending' as const } : {}) }
        : { status: opts.verify ? ('loading' as const) : ('none' as const) }),
      alternatives: [],
    })),
  };
}

export function draftFromProduct(p: OffProduct): Draft {
  const serving = p.servingGrams ? { grams: p.servingGrams, label: p.servingLabel } : undefined;
  return {
    origin: 'barcode',
    dish: p.name,
    brand: p.brand,
    code: p.code,
    caveats: [],
    items: [
      {
        key: newKey(),
        name: p.name,
        query: '',
        grams: clampGrams(serving?.grams ?? 100),
        ...(p.liquid ? { unit: 'ml' as const } : {}),
        amount: serving ? 'label' : 'default',
        status: 'ok',
        per100: p.per100,
        source: { kind: 'off', id: p.code, label: p.brand ? `${p.name} · ${p.brand}` : p.name },
        alternatives: [],
        serving,
      },
    ],
  };
}

export const emptyDraft = (): Draft => ({ origin: 'manual', dish: '', items: [], caveats: [] });

const mapItems = (draft: Draft, fn: (it: DraftItem) => DraftItem): Draft => ({ ...draft, items: draft.items.map(fn) });
const mapItem = (draft: Draft, key: string, fn: (it: DraftItem) => DraftItem): Draft => mapItems(draft, (it) => (it.key === key ? fn(it) : it));

/** How far database energy may be from the estimate and still confirm it. */
export const VERIFY_TOLERANCE = 0.35;

const agrees = (a: Nutrients, b: Nutrients) => Math.abs(a.kcal - b.kcal) <= Math.max(25, VERIFY_TOLERANCE * Math.max(a.kcal, b.kcal));

/**
 * Puts the database answers on the items. An item waiting for values takes
 * the match; an estimated item is confirmed (and takes the database values)
 * when the match agrees with it, and otherwise keeps the estimate with the
 * database entry offered as an alternative, since a wrong match is likelier
 * than a wildly wrong typical value.
 */
export function applyLookups(draft: Draft, results: readonly NutrientLookup[]): Draft {
  const byId = new Map(results.map((r) => [r.id, r]));
  return mapItems(draft, (it) => {
    const r = byId.get(it.key);
    if (it.status === 'loading') {
      if (!r || r.failed) return { ...it, status: 'error' };
      if (!r.match) return { ...it, status: 'none', alternatives: r.alternatives };
      return { ...it, status: 'ok', per100: r.match.per100, source: usdaSource(r.match), alternatives: r.alternatives, verify: 'verified' };
    }
    if (it.verify !== 'pending' || !it.per100) return it;
    if (!r?.match) return { ...it, verify: 'unverified', alternatives: r?.alternatives ?? it.alternatives };
    if (agrees(it.per100, r.match.per100)) {
      return { ...it, per100: r.match.per100, source: usdaSource(r.match), alternatives: r.alternatives, verify: 'verified' };
    }
    return { ...it, verify: 'unverified', alternatives: [r.match, ...r.alternatives].slice(0, 5) };
  });
}

/** The database could not be asked: estimates stay as they are, items without values need the user. */
export const failLookups = (draft: Draft): Draft =>
  mapItems(draft, (it) => (it.status === 'loading' ? { ...it, status: 'error' } : it.verify === 'pending' ? { ...it, verify: 'unverified' } : it));
export const retryLookups = (draft: Draft): Draft => mapItems(draft, (it) => (it.status === 'error' ? { ...it, status: 'loading' } : it));
export const waitingKeys = (draft: Draft): { id: string; query: string }[] =>
  draft.items.filter((it) => (it.status === 'loading' || it.verify === 'pending') && it.query).map((it) => ({ id: it.key, query: it.query }));

export const setGrams = (draft: Draft, key: string, grams: number): Draft =>
  mapItem(draft, key, (it) => ({ ...it, grams: clampGrams(grams), amount: 'user', confidence: undefined }));

/** The amount shown is right as it is (e.g. 100 g of a product without serving data). */
export const confirmAmount = (draft: Draft, key: string): Draft => mapItem(draft, key, (it) => ({ ...it, amount: it.amount === 'default' ? 'user' : it.amount }));

export const renameItem = (draft: Draft, key: string, name: string): Draft => mapItem(draft, key, (it) => ({ ...it, name }));

/** Uses another database food for an item (keeps the amount). */
export const chooseFood = (draft: Draft, key: string, food: UsdaFood, name?: string): Draft =>
  mapItem(draft, key, (it) => ({ ...it, name: name || it.name, status: 'ok', per100: food.per100, source: usdaSource(food), verify: undefined }));

/** Uses typical values estimated by the AI for an item (keeps the amount). */
export const chooseEstimate = (draft: Draft, key: string, per100: Nutrients, name: string): Draft =>
  mapItem(draft, key, (it) => ({ ...it, name: name || it.name, status: 'ok', per100, source: { kind: 'ai', label: name || it.name }, verify: undefined }));

/** Values typed by the user, per 100 g. */
export const setManualValues = (draft: Draft, key: string, per100: Nutrients, name: string): Draft =>
  mapItem(draft, key, (it) => ({ ...it, name, status: 'ok', per100, source: { kind: 'manual' }, unit: undefined, verify: undefined }));

export const removeItem = (draft: Draft, key: string): Draft => ({ ...draft, items: draft.items.filter((it) => it.key !== key) });
export const addItem = (draft: Draft, item: DraftItem): Draft => ({ ...draft, items: [...draft.items, item] });

export function itemValues(it: DraftItem): Nutrients | null {
  return it.status === 'ok' && it.per100 ? scaleNutrients(it.per100, it.grams) : null;
}

export interface DraftSummary {
  /** Sum of the items with values. */
  total: Nutrients;
  /** Optional nutrients some item does not report (left out of the total). */
  missing: OptionalNutrient[];
  grams: number;
  ready: number;
  /** Items still without values. */
  pending: number;
  /** Some amount is a visual estimate. */
  estimated: boolean;
  /** Some values are AI estimates not confirmed in a database. */
  aiValues: boolean;
  liquid: boolean;
}

export function summarize(draft: Draft): DraftSummary {
  const ok = draft.items.filter((it) => it.status === 'ok' && it.per100);
  const { total, missing } = sumNutrients(ok.map((it) => scaleNutrients(it.per100!, it.grams)));
  return {
    total,
    missing,
    grams: ok.reduce((a, it) => a + it.grams, 0),
    ready: ok.length,
    pending: draft.items.length - ok.length,
    estimated: ok.some((it) => it.amount === 'photo'),
    aiValues: ok.some((it) => it.source?.kind === 'ai'),
    liquid: ok.length > 0 && ok.every((it) => it.unit === 'ml'),
  };
}

export type Basis = 'portion' | 'per100' | 'serving';

const single = (draft: Draft): DraftItem | undefined => (draft.items.length === 1 && draft.items[0]?.status === 'ok' ? draft.items[0] : undefined);

export function availableBases(draft: Draft): Basis[] {
  return single(draft)?.serving ? ['portion', 'per100', 'serving'] : ['portion', 'per100'];
}

/** Values for the portion eaten, per 100 g (or ml) of the food or plate, or per serving of a product. */
export function valuesFor(draft: Draft, basis: Basis): Nutrients | null {
  const s = summarize(draft);
  if (!s.ready) return null;
  if (basis === 'portion') return s.total;
  const one = single(draft);
  if (basis === 'serving') return one?.serving && one.per100 ? scaleNutrients(one.per100, one.serving.grams) : null;
  return one?.per100 ?? per100Of(s.total, s.grams);
}

export const unresolved = (draft: Draft): DraftItem[] => draft.items.filter((it) => it.status !== 'ok' || it.amount === 'default');

export const canSave = (draft: Draft): boolean => draft.items.length > 0 && unresolved(draft).length === 0;

export function toMealItems(draft: Draft): MealItem[] {
  return draft.items
    .filter((it) => it.status === 'ok' && it.per100 && it.source)
    .map((it) => itemFromPer100({ name: it.name, per100: it.per100!, grams: it.grams, source: it.source!, estimated: it.amount === 'photo', unit: it.unit }));
}
