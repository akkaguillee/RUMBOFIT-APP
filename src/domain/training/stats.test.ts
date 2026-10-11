import { describe, expect, it } from 'vitest';
import type { Workout } from '../types';
import { findCatalogExercise } from './catalog';
import { estimateOneRepMax, exerciseRecords, personalBestsIn, workoutElapsedSec, workoutVolume } from './stats';

const resolve = (id: string) => findCatalogExercise(id);

const workout = (id: number, date: string, sets: [number, number][], startedAt: number): Workout => ({
  id,
  name: 'Pecho',
  date,
  status: 'completed',
  muscleGroups: ['chest'],
  exercises: [
    {
      uid: 'a',
      exerciseId: 'bench-press',
      restSec: 90,
      sets: sets.map(([kg, reps], i) => ({ uid: String(i), kg, reps, done: true })),
    },
  ],
  startedAt,
  accumulatedSec: 3600,
  durationSec: 3600,
  createdAt: startedAt,
  updatedAt: startedAt,
});

describe('training stats', () => {
  it('computes volume of completed sets', () => {
    const w = workout(1, '2026-10-01', [[40, 12], [45, 10], [45, 8]], 1);
    expect(workoutVolume(w, resolve)).toBe(40 * 12 + 45 * 10 + 45 * 8);
  });

  it('distinguishes real records from estimates', () => {
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.7, 1);
    expect(estimateOneRepMax(100, 15)).toBeNull();
    const rec = exerciseRecords([workout(1, '2026-10-01', [[60, 8], [70, 3]], 1)], 'bench-press');
    expect(rec.maxKg?.value).toBe(70);
    expect(rec.est1RM?.value).toBe(77); // 70 × (1 + 3/30) beats 60 × (1 + 8/30) = 76
    expect(rec.sessions).toBe(1);
  });

  it('detects personal bests only against earlier sessions', () => {
    const a = workout(1, '2026-10-01', [[60, 8]], 1);
    const b = workout(2, '2026-10-03', [[62.5, 6]], 2);
    expect(personalBestsIn(a, [a, b], resolve)).toHaveLength(0);
    const prs = personalBestsIn(b, [a, b], resolve);
    expect(prs).toHaveLength(1);
    expect(prs[0]).toMatchObject({ kind: 'weight', value: 62.5, previous: 60 });
  });

  it('keeps the timer running from wall-clock timestamps', () => {
    expect(workoutElapsedSec({ accumulatedSec: 120, runningSince: 1_000_000 }, 1_060_000)).toBe(180);
    expect(workoutElapsedSec({ accumulatedSec: 120 }, 9_999_999)).toBe(120);
  });
});
