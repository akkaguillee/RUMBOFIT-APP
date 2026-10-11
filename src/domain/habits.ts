import { addDays, type DateKey } from './dates';
import type { StepsEntry, WaterEntry } from './types';

export const WATER_PRESETS_ML = [150, 250, 330, 500] as const;

export function waterByDay(entries: WaterEntry[]): Map<DateKey, number> {
  const map = new Map<DateKey, number>();
  for (const e of entries) map.set(e.date, (map.get(e.date) ?? 0) + e.ml);
  return map;
}

export function stepsByDay(entries: StepsEntry[]): Map<DateKey, number> {
  const map = new Map<DateKey, number>();
  for (const e of entries) map.set(e.date, (map.get(e.date) ?? 0) + e.steps);
  return map;
}

export function lastNDays(today: DateKey, n: number): DateKey[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
}

/** Consecutive days ending today (or yesterday, so the day isn't "lost" yet) satisfying `predicate`. */
export function currentStreak(today: DateKey, predicate: (d: DateKey) => boolean): number {
  let start = today;
  if (!predicate(today)) start = addDays(today, -1);
  let count = 0;
  for (let d = start; predicate(d); d = addDays(d, -1)) {
    count += 1;
    if (count > 3650) break;
  }
  return count;
}

export function longestStreak(sortedDays: DateKey[]): number {
  let best = 0;
  let run = 0;
  let prev: DateKey | null = null;
  for (const d of sortedDays) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export function average(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export function percent(value: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.round((value / goal) * 100);
}
