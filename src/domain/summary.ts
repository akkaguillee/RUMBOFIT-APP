import { toDateKey, type DateKey } from './dates';
import type { AchievementData } from './achievements/metrics';
import type { AchievementUnlock, Workout } from './types';
import { sortWeights } from './weight';

export interface DaySummary {
  date: DateKey;
  weightKg?: number;
  weightCount: number;
  waterMl: number;
  waterGoalMl: number;
  steps: number;
  stepsGoal: number;
  workouts: Workout[];
  note?: string;
  unlocked: string[];
  hasData: boolean;
  goalsMet: number;
  goalsTracked: number;
}

/**
 * Per-day summary used by the calendar and dashboard. A day without data is
 * neutral: it is never marked as failed.
 */
export function buildDaySummaries(data: AchievementData, unlocks: AchievementUnlock[]): Map<DateKey, DaySummary> {
  const map = new Map<DateKey, DaySummary>();
  const snap = new Map(data.snapshots.map((s) => [s.date, s]));
  const get = (date: DateKey): DaySummary => {
    let d = map.get(date);
    if (!d) {
      const s = snap.get(date);
      d = {
        date,
        weightCount: 0,
        waterMl: 0,
        waterGoalMl: s?.waterGoalMl ?? data.profile?.waterGoalMl ?? 2000,
        steps: 0,
        stepsGoal: s?.stepsGoal ?? data.profile?.stepsGoal ?? 8000,
        workouts: [],
        unlocked: [],
        hasData: false,
        goalsMet: 0,
        goalsTracked: 0,
      };
      map.set(date, d);
    }
    return d;
  };
  for (const w of sortWeights(data.weights)) {
    const d = get(w.date);
    d.weightKg = w.kg;
    d.weightCount += 1;
  }
  for (const w of data.water) get(w.date).waterMl += w.ml;
  for (const s of data.steps) get(s.date).steps += s.steps;
  for (const w of data.workouts) if (w.status === 'completed') get(w.date).workouts.push(w);
  for (const n of data.notes) get(n.date).note = n.text;
  for (const u of unlocks) get(toDateKey(new Date(u.unlockedAt))).unlocked.push(u.id);

  for (const d of map.values()) {
    d.hasData = d.weightCount > 0 || d.waterMl > 0 || d.steps > 0 || d.workouts.length > 0;
    if (d.waterMl > 0) {
      d.goalsTracked += 1;
      if (d.waterMl >= d.waterGoalMl) d.goalsMet += 1;
    }
    if (d.steps > 0) {
      d.goalsTracked += 1;
      if (d.steps >= d.stepsGoal) d.goalsMet += 1;
    }
  }
  return map;
}
