import type { AchievementData } from './achievements/metrics';
import { addDays, startOfWeek, type DateKey } from './dates';

export interface StreakInfo {
  /** Consecutive active days ending today (or yesterday, while today is still open). */
  current: number;
  longest: number;
  /** Whether today already counts. */
  todayActive: boolean;
  /** The 7 days of the current week (Monday first) and whether each was active. */
  week: { date: DateKey; active: boolean; future: boolean }[];
}

/**
 * A day is active with any real record: weight, water, steps or a completed
 * workout — the same definition the milestones use, so both always agree.
 */
export function activeDaySet(data: Pick<AchievementData, 'weights' | 'water' | 'steps' | 'workouts'>): Set<DateKey> {
  return new Set<DateKey>([
    ...data.weights.map((w) => w.date),
    ...data.water.map((w) => w.date),
    ...data.steps.filter((s) => s.steps > 0).map((s) => s.date),
    ...data.workouts.filter((w) => w.status === 'completed').map((w) => w.date),
  ]);
}

export function streakInfo(data: Pick<AchievementData, 'weights' | 'water' | 'steps' | 'workouts'>, today: DateKey): StreakInfo {
  const active = activeDaySet(data);
  const todayActive = active.has(today);

  let current = 0;
  for (let d = todayActive ? today : addDays(today, -1); active.has(d); d = addDays(d, -1)) current += 1;

  let longest = 0;
  let run = 0;
  let prev: DateKey | null = null;
  for (const d of [...active].filter((x) => x <= today).sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  const monday = startOfWeek(today);
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    return { date, active: active.has(date), future: date > today };
  });

  return { current, longest, todayActive, week };
}
