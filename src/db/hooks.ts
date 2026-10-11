import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { evaluateAchievements } from '@/domain/achievements/engine';
import { buildDaySummaries } from '@/domain/summary';
import { todayKey, type DateKey } from '@/domain/dates';
import { sortWeights } from '@/domain/weight';
import { EXERCISE_CATALOG } from '@/domain/training/catalog';
import type { Exercise } from '@/domain/types';
import { db } from './db';
import { loadAchievementData, makeResolver } from './sync';

/** `undefined` while loading, `null` when the profile does not exist yet. */
export function useProfile() {
  return useLiveQuery(async () => (await db.profile.get('me')) ?? null, []);
}

export function useWeights() {
  return useLiveQuery(async () => sortWeights(await db.weights.toArray()), []);
}

export function useWaterDay(date: DateKey) {
  return useLiveQuery(
    async () => (await db.water.where('date').equals(date).toArray()).sort((a, b) => a.time.localeCompare(b.time) || a.createdAt - b.createdAt),
    [date],
  );
}

export function useWaterRange(from: DateKey, to: DateKey) {
  return useLiveQuery(() => db.water.where('date').between(from, to, true, true).toArray(), [from, to]);
}

export function useSteps() {
  return useLiveQuery(async () => (await db.steps.toArray()).sort((a, b) => a.date.localeCompare(b.date)), []);
}

export function useNote(date: DateKey) {
  return useLiveQuery(async () => (await db.notes.get(date)) ?? null, [date]);
}

export function useBmiHistory() {
  return useLiveQuery(async () => (await db.bmi.toArray()).sort((a, b) => b.createdAt - a.createdAt), []);
}

export function useEnergyHistory() {
  return useLiveQuery(async () => (await db.energy.toArray()).sort((a, b) => b.createdAt - a.createdAt), []);
}

export function useWorkouts() {
  return useLiveQuery(async () => (await db.workouts.toArray()).sort((a, b) => b.startedAt - a.startedAt), []);
}

export function useCompletedWorkouts() {
  return useLiveQuery(
    async () => (await db.workouts.where('status').equals('completed').toArray()).sort((a, b) => b.startedAt - a.startedAt),
    [],
  );
}

export function useActiveWorkout() {
  return useLiveQuery(async () => (await db.workouts.where('status').equals('active').first()) ?? null, []);
}

export function useWorkout(id: number | undefined) {
  return useLiveQuery(async () => (id === undefined ? null : ((await db.workouts.get(id)) ?? null)), [id]);
}

export function useTemplates() {
  return useLiveQuery(async () => (await db.templates.toArray()).sort((a, b) => b.updatedAt - a.updatedAt), []);
}

export function usePlan() {
  return useLiveQuery(async () => (await db.plan.toArray()).sort((a, b) => a.weekday - b.weekday), []);
}

export function useCustomExercises() {
  return useLiveQuery(() => db.exercises.toArray(), []);
}

/** Catalog + custom exercises (archived ones stay resolvable for history). */
export function useExerciseLibrary() {
  const custom = useCustomExercises();
  return useMemo(() => {
    const resolve = makeResolver(custom ?? []);
    const list: Exercise[] = [...EXERCISE_CATALOG, ...(custom ?? []).filter((c) => !c.archived)];
    return { resolve, list, loading: custom === undefined };
  }, [custom]);
}

export function useAchievementData() {
  return useLiveQuery(async () => {
    const data = await loadAchievementData(todayKey());
    const unlocks = await db.achievements.toArray();
    return { data, unlocks };
  }, []);
}

export function useAchievements() {
  const raw = useAchievementData();
  return useMemo(() => {
    if (!raw) return undefined;
    const { states, metrics } = evaluateAchievements(raw.data);
    const unlockMap = new Map(raw.unlocks.map((u) => [u.id, u]));
    return { states, metrics, unlocks: raw.unlocks, unlockMap, data: raw.data };
  }, [raw]);
}

export function useDaySummaries() {
  const raw = useAchievementData();
  return useMemo(() => (raw ? buildDaySummaries(raw.data, raw.unlocks) : undefined), [raw]);
}

export function useUnseenUnlocks() {
  return useLiveQuery(async () => (await db.achievements.toArray()).filter((u) => !u.seen).sort((a, b) => a.unlockedAt - b.unlockedAt), []);
}

export async function markUnlocksSeen(ids: string[]): Promise<void> {
  await db.achievements.bulkUpdate(ids.map((id) => ({ key: id, changes: { seen: true } })));
}

export function useSetting<T>(key: string, fallback: T): [T | undefined, (value: T) => Promise<void>] {
  const value = useLiveQuery(async () => ((await db.settings.get(key))?.value as T | undefined) ?? fallback, [key]);
  const set = async (v: T) => {
    await db.settings.put({ key, value: v });
  };
  return [value, set];
}
