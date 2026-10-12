/** Shared fixtures for the tips tests (only imported by *.test.ts). */
import { addDays, type DateKey } from '../dates';
import type { PlanDay, Profile, StepsEntry, WaterEntry, WeightEntry, Workout } from '../types';
import { buildTipContext, type TipInputs } from './context';

export const TODAY: DateKey = '2026-10-14'; // a Wednesday

export const baseProfile: Profile = {
  id: 'me',
  name: 'Guille',
  age: 30,
  ageRecordedOn: '2026-01-01',
  sex: 'male',
  heightCm: 180,
  goal: 'lose',
  startWeightKg: 90,
  goalWeightKg: 80,
  activityLevel: 'moderate',
  units: 'metric',
  startDate: '2026-06-01',
  trainingDays: [0, 2, 4],
  waterGoalMl: 2000,
  stepsGoal: 8000,
  healthFlags: [],
  createdAt: 1,
  updatedAt: new Date(2026, 9, 1, 12).getTime(),
};

export const profile = (patch: Partial<Profile> = {}): Profile => ({ ...baseProfile, ...patch });

export const weight = (date: DateKey, kg: number): WeightEntry => ({ date, kg, createdAt: 0, updatedAt: 0 });
export const water = (date: DateKey, ml: number): WaterEntry => ({ date, time: '10:00', ml, createdAt: 0 });
export const steps = (date: DateKey, n: number): StepsEntry => ({ date, steps: n, updatedAt: 0 });
export const workout = (date: DateKey, status: Workout['status'] = 'completed'): Workout => ({
  name: 'Entreno',
  date,
  status,
  muscleGroups: ['full_body'],
  exercises: [],
  startedAt: 0,
  accumulatedSec: 0,
  durationSec: 1800,
  createdAt: 0,
  updatedAt: 0,
});
export const planDay = (weekday: number, label = '', rest = false): PlanDay => ({ weekday, label, muscleGroups: ['full_body'], rest });

/** `n` days ending on `end` (inclusive), oldest first. */
export const lastDays = (n: number, end: DateKey = TODAY) => Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));

export function ctxFor(patch: Partial<TipInputs> = {}) {
  return buildTipContext({ profile: baseProfile, weights: [], water: [], steps: [], workouts: [], plan: [], today: TODAY, ...patch });
}
