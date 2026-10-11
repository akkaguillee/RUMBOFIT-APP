import { evaluateAchievements, diffUnlocks } from '@/domain/achievements/engine';
import type { AchievementData } from '@/domain/achievements/metrics';
import { todayKey } from '@/domain/dates';
import { findCatalogExercise } from '@/domain/training/catalog';
import type { ExerciseResolver } from '@/domain/training/stats';
import type { Exercise } from '@/domain/types';
import { db, type StoredCustomExercise } from './db';

export function makeResolver(custom: StoredCustomExercise[]): ExerciseResolver & { (id: string): Exercise | undefined } {
  const map = new Map<string, Exercise>(custom.map((c) => [c.id, c]));
  return (id: string) => findCatalogExercise(id) ?? map.get(id);
}

export async function loadAchievementData(today = todayKey()): Promise<AchievementData> {
  const [profile, goals, weights, water, steps, workouts, templates, plan, customExercises, notes, bmi, energy, snapshots] =
    await Promise.all([
      db.profile.get('me'),
      db.goals.toArray(),
      db.weights.toArray(),
      db.water.toArray(),
      db.steps.toArray(),
      db.workouts.toArray(),
      db.templates.toArray(),
      db.plan.toArray(),
      db.exercises.toArray(),
      db.notes.toArray(),
      db.bmi.toArray(),
      db.energy.toArray(),
      db.snapshots.toArray(),
    ]);
  return {
    today,
    profile,
    goals,
    weights,
    water,
    steps,
    workouts,
    templates,
    plan,
    customExercises: customExercises.filter((c) => !c.archived),
    notes,
    bmi,
    energy,
    snapshots,
    resolve: makeResolver(customExercises),
  };
}

let running: Promise<void> | null = null;
let queued = false;

/** Recomputes achievements from the stored records and persists the diff. */
export async function syncAchievements(): Promise<void> {
  if (running) {
    queued = true;
    return running;
  }
  running = (async () => {
    try {
      const data = await loadAchievementData();
      if (!data.profile) return;
      const { states } = evaluateAchievements(data);
      await db.transaction('rw', db.achievements, async () => {
        const persisted = await db.achievements.toArray();
        const { unlock, revoke } = diffUnlocks(states, persisted);
        const now = Date.now();
        if (unlock.length) {
          await db.achievements.bulkPut(unlock.map((id, i) => ({ id, unlockedAt: now + i, seen: false })));
        }
        if (revoke.length) await db.achievements.bulkDelete(revoke);
      });
    } finally {
      running = null;
      if (queued) {
        queued = false;
        void syncAchievements();
      }
    }
  })();
  return running;
}

let timer: ReturnType<typeof setTimeout> | undefined;

export function scheduleSync(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void syncAchievements(), 150);
}
