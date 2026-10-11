import { addDays, addMonths, diffDays, keyToTimestamp, toDateKey, type DateKey } from './dates';
import type { GoalType, WeightEntry } from './types';
import { clamp, round } from './units';

export type Direction = 'down' | 'up' | 'none';
export type Tone = 'good' | 'warn' | 'bad' | 'neutral';

/**
 * Sortable instant for a weight record. Records without an explicit time use
 * their creation time when it falls on the same day (so same-day records keep
 * the order they were logged in), or midday otherwise.
 */
export const entryTime = (e: Pick<WeightEntry, 'date' | 'time' | 'createdAt'>): number => {
  if (e.time) return keyToTimestamp(e.date, e.time);
  const created = new Date(e.createdAt);
  if (toDateKey(created) === e.date) return e.createdAt;
  return keyToTimestamp(e.date);
};

export function sortWeights<T extends Pick<WeightEntry, 'date' | 'time' | 'createdAt'>>(entries: T[]): T[] {
  // Same instant (e.g. two records in the same minute): keep logging order.
  return [...entries].sort((a, b) => entryTime(a) - entryTime(b) || a.createdAt - b.createdAt);
}

export function latestWeight(entries: WeightEntry[]): WeightEntry | undefined {
  const sorted = sortWeights(entries);
  return sorted[sorted.length - 1];
}

export function goalDirection(goal: GoalType, startKg?: number, targetKg?: number): Direction {
  if (startKg === undefined || targetKg === undefined) {
    if (goal === 'lose') return 'down';
    if (goal === 'gain') return 'up';
    return 'none';
  }
  if (Math.abs(targetKg - startKg) < 0.05) return 'none';
  return targetKg < startKg ? 'down' : 'up';
}

/**
 * Fraction of the way from start to target (0 = start, 1 = target reached).
 * Returns null when there is no distance to cover.
 */
export function goalProgress(startKg: number, currentKg: number, targetKg: number): number | null {
  const total = targetKg - startKg;
  if (Math.abs(total) < 0.05) return null;
  return (currentKg - startKg) / total;
}

export function goalProgressClamped(startKg: number, currentKg: number, targetKg: number): number | null {
  const p = goalProgress(startKg, currentKg, targetKg);
  return p === null ? null : clamp(p, 0, 1);
}

export type RangeId = '7d' | '30d' | '90d' | '6m' | '1y' | 'all';

export const RANGES: { id: RangeId; label: string; long: string }[] = [
  { id: '7d', label: '7D', long: 'Últimos 7 días' },
  { id: '30d', label: '30D', long: 'Últimos 30 días' },
  { id: '90d', label: '90D', long: 'Últimos 90 días' },
  { id: '6m', label: '6M', long: 'Últimos 6 meses' },
  { id: '1y', label: '1A', long: 'Último año' },
  { id: 'all', label: 'Todo', long: 'Todo el historial' },
];

export function rangeStart(range: RangeId, today: DateKey): DateKey | null {
  switch (range) {
    case '7d':
      return addDays(today, -6);
    case '30d':
      return addDays(today, -29);
    case '90d':
      return addDays(today, -89);
    case '6m':
      return addMonths(today, -6);
    case '1y':
      return addMonths(today, -12);
    case 'all':
      return null;
  }
}

export function filterRange<T extends { date: DateKey }>(entries: T[], range: RangeId, today: DateKey): T[] {
  const start = rangeStart(range, today);
  return entries.filter((e) => (start === null || e.date >= start) && e.date <= today);
}

/**
 * Time-aware exponential moving average (τ = 7 days). It is a smoothed
 * reading of the trend and is always shown separately from real data.
 */
export function trendSeries(sorted: WeightEntry[], tauDays = 7): number[] {
  const out: number[] = [];
  let prev: { t: number; v: number } | null = null;
  for (const e of sorted) {
    const t = entryTime(e) / 86_400_000;
    if (!prev) {
      prev = { t, v: e.kg };
    } else {
      const dt = Math.max(0, t - prev.t);
      const alpha = 1 - Math.exp(-dt / tauDays);
      prev = { t, v: prev.v + alpha * (e.kg - prev.v) };
    }
    out.push(round(prev.v, 2));
  }
  return out;
}

/** Least-squares slope in kg per week. */
export function slopePerWeek(sorted: WeightEntry[]): number | null {
  if (sorted.length < 2) return null;
  const xs = sorted.map((e) => entryTime(e) / (86_400_000 * 7));
  const ys = sorted.map((e) => e.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * ((ys[i] as number) - my);
    den += (x - mx) ** 2;
  });
  if (den === 0) return null;
  return num / den;
}

export interface TrendAssessment {
  tone: Tone;
  label: string;
  detail: string;
  slopeKgWeek: number | null;
  reliable: boolean;
}

/**
 * Evaluates the recent trend (last 21 days) against the user's goal. A single
 * day is never judged: fluctuations of water and food are normal.
 */
export function assessTrend(entries: WeightEntry[], direction: Direction, today: DateKey): TrendAssessment {
  const recent = sortWeights(entries.filter((e) => e.date >= addDays(today, -20) && e.date <= today));
  const first = recent[0];
  const last = recent[recent.length - 1];
  const span = first && last ? diffDays(first.date, last.date) : 0;
  if (recent.length < 3 || span < 6) {
    return {
      tone: 'warn',
      label: 'Datos insuficientes',
      detail: 'Registra tu peso al menos 3 veces en una semana para ver una tendencia fiable.',
      slopeKgWeek: null,
      reliable: false,
    };
  }
  const slope = slopePerWeek(recent) ?? 0;
  const stable = Math.abs(slope) < 0.1;
  if (direction === 'none') {
    return stable
      ? { tone: 'good', label: 'Estable', detail: 'Tu peso se mantiene estable.', slopeKgWeek: slope, reliable: true }
      : {
          tone: 'warn',
          label: slope < 0 ? 'Tendencia a la baja' : 'Tendencia al alza',
          detail: 'Hay una ligera variación respecto a tu peso habitual.',
          slopeKgWeek: slope,
          reliable: true,
        };
  }
  if (stable) {
    return {
      tone: 'warn',
      label: 'Estable',
      detail: 'Tu tendencia reciente se mantiene estable. Las mesetas forman parte del proceso.',
      slopeKgWeek: slope,
      reliable: true,
    };
  }
  const favorable = (direction === 'down' && slope < 0) || (direction === 'up' && slope > 0);
  if (favorable) {
    const fast = Math.abs(slope) > 1;
    return {
      tone: fast ? 'warn' : 'good',
      label: 'A favor de tu objetivo',
      detail: fast
        ? 'Avanzas más rápido de lo habitual. Un ritmo gradual suele ser más sostenible.'
        : 'Tu tendencia reciente avanza en la dirección de tu objetivo.',
      slopeKgWeek: slope,
      reliable: true,
    };
  }
  return {
    tone: 'bad',
    label: 'En dirección contraria',
    detail: 'Tu tendencia reciente se aleja de tu objetivo. Es normal tener semanas así; observa cómo evoluciona.',
    slopeKgWeek: slope,
    reliable: true,
  };
}

export interface WeightPoint {
  entry: WeightEntry;
  t: number;
  kg: number;
  trend: number;
  deltaPrev: number | null;
  deltaStart: number | null;
  progress: number | null;
}

export function buildPoints(
  sortedAll: WeightEntry[],
  startKg?: number,
  targetKg?: number,
): WeightPoint[] {
  const trend = trendSeries(sortedAll);
  return sortedAll.map((entry, i) => {
    const prev = i > 0 ? (sortedAll[i - 1] as WeightEntry) : null;
    return {
      entry,
      t: entryTime(entry),
      kg: entry.kg,
      trend: trend[i] as number,
      deltaPrev: prev ? round(entry.kg - prev.kg, 2) : null,
      deltaStart: startKg !== undefined ? round(entry.kg - startKg, 2) : null,
      progress: startKg !== undefined && targetKg !== undefined ? goalProgress(startKg, entry.kg, targetKg) : null,
    };
  });
}

export interface PeriodChange {
  from: WeightEntry;
  to: WeightEntry;
  delta: number;
}

export function periodChange(sortedInRange: WeightEntry[]): PeriodChange | null {
  const from = sortedInRange[0];
  const to = sortedInRange[sortedInRange.length - 1];
  if (!from || !to || from === to) return null;
  return { from, to, delta: round(to.kg - from.kg, 2) };
}

/**
 * Weight change over roughly the last `days` days: compared with the latest
 * record between `days` and `2 × days` ago, or with the earliest record of the
 * window. Older records are not used, so "7 days" never means "40 days".
 */
export function changeOverDays(entries: WeightEntry[], days: number, today: DateKey): PeriodChange | null {
  const sorted = sortWeights(entries.filter((e) => e.date <= today));
  const to = sorted[sorted.length - 1];
  if (!to) return null;
  const cutoff = addDays(today, -days);
  const oldest = addDays(today, -days * 2);
  const before = sorted.filter((e) => e.date <= cutoff && e.date >= oldest);
  const from = before[before.length - 1] ?? sorted.find((e) => e.date > cutoff);
  if (!from || from === to) return null;
  return { from, to, delta: round(to.kg - from.kg, 2) };
}

export function deltaTone(delta: number, direction: Direction, threshold = 0.2): Tone {
  if (Math.abs(delta) < threshold) return 'neutral';
  if (direction === 'none') return 'warn';
  const favorable = (direction === 'down' && delta < 0) || (direction === 'up' && delta > 0);
  return favorable ? 'good' : 'bad';
}
