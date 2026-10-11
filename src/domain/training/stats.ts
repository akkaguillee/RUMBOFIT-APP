import { addDays, startOfWeek, type DateKey } from '../dates';
import type { Exercise, ExerciseMeasure, MuscleGroup, SetEntry, Workout } from '../types';
import { round } from '../units';

export type ExerciseResolver = (id: string) => Pick<Exercise, 'measure' | 'muscle' | 'name'> | undefined;

export function workoutElapsedSec(w: Pick<Workout, 'accumulatedSec' | 'runningSince'>, now = Date.now()): number {
  const running = w.runningSince ? Math.max(0, (now - w.runningSince) / 1000) : 0;
  return Math.floor(w.accumulatedSec + running);
}

export function setVolume(set: SetEntry, measure: ExerciseMeasure): number {
  if (!set.done || measure !== 'weight_reps') return 0;
  return (set.kg ?? 0) * (set.reps ?? 0);
}

export function workoutVolume(w: Workout, resolve: ExerciseResolver): number {
  let total = 0;
  for (const ex of w.exercises) {
    const measure = resolve(ex.exerciseId)?.measure ?? 'weight_reps';
    for (const s of ex.sets) total += setVolume(s, measure);
  }
  return Math.round(total);
}

export function completedSets(w: Workout): number {
  return w.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0);
}

export function totalSets(w: Workout): number {
  return w.exercises.reduce((n, ex) => n + ex.sets.length, 0);
}

export function isSetFilled(set: SetEntry, measure: ExerciseMeasure): boolean {
  switch (measure) {
    case 'weight_reps':
      return (set.reps ?? 0) > 0;
    case 'reps':
      return (set.reps ?? 0) > 0;
    case 'time':
      return (set.durationSec ?? 0) > 0;
    case 'distance_time':
      return (set.durationSec ?? 0) > 0 || (set.distanceKm ?? 0) > 0;
  }
}

/** Epley estimate. Only computed up to 12 reps, where it is reasonably reliable. */
export function estimateOneRepMax(kg: number, reps: number): number | null {
  if (kg <= 0 || reps <= 0 || reps > 12) return null;
  if (reps === 1) return kg;
  return round(kg * (1 + reps / 30), 1);
}

export interface RecordValue {
  value: number;
  date: DateKey;
  detail?: string;
}

export interface ExerciseRecords {
  maxKg?: RecordValue;
  est1RM?: RecordValue;
  maxReps?: RecordValue;
  maxDuration?: RecordValue;
  maxDistance?: RecordValue;
  bestVolume?: RecordValue;
  sessions: number;
}

const better = (cur: RecordValue | undefined, value: number, date: DateKey, detail?: string): RecordValue | undefined =>
  !cur || value > cur.value ? { value, date, detail } : cur;

export function exerciseRecords(workouts: Workout[], exerciseId: string): ExerciseRecords {
  const rec: ExerciseRecords = { sessions: 0 };
  const completed = workouts.filter((w) => w.status === 'completed').sort((a, b) => a.startedAt - b.startedAt);
  for (const w of completed) {
    let sessionVolume = 0;
    let used = false;
    for (const ex of w.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const s of ex.sets) {
        if (!s.done) continue;
        used = true;
        if (s.kg && s.reps) {
          rec.maxKg = better(rec.maxKg, s.kg, w.date, `${s.reps} reps`);
          const est = estimateOneRepMax(s.kg, s.reps);
          if (est) rec.est1RM = better(rec.est1RM, est, w.date, `${s.kg} kg × ${s.reps}`);
          sessionVolume += s.kg * s.reps;
        }
        if (s.reps) rec.maxReps = better(rec.maxReps, s.reps, w.date);
        if (s.durationSec) rec.maxDuration = better(rec.maxDuration, s.durationSec, w.date);
        if (s.distanceKm) rec.maxDistance = better(rec.maxDistance, s.distanceKm, w.date);
      }
    }
    if (used) rec.sessions += 1;
    if (sessionVolume > 0) rec.bestVolume = better(rec.bestVolume, Math.round(sessionVolume), w.date);
  }
  return rec;
}

export interface PersonalBest {
  exerciseId: string;
  kind: 'weight' | 'reps' | 'duration' | 'distance';
  value: number;
  previous: number;
}

/**
 * Records registered in a workout compared with all earlier completed
 * sessions. The first time an exercise is done is not counted as a record.
 */
export function personalBestsIn(workout: Workout, history: Workout[], resolve: ExerciseResolver): PersonalBest[] {
  const earlier = history.filter(
    (w) => w.status === 'completed' && w.id !== workout.id && w.startedAt < workout.startedAt,
  );
  const out: PersonalBest[] = [];
  for (const ex of workout.exercises) {
    const measure = resolve(ex.exerciseId)?.measure ?? 'weight_reps';
    const prev = exerciseRecords(earlier, ex.exerciseId);
    if (prev.sessions === 0) continue;
    const done = ex.sets.filter((s) => s.done);
    if (!done.length) continue;
    if (measure === 'weight_reps') {
      const best = Math.max(...done.map((s) => (s.reps ? (s.kg ?? 0) : 0)));
      if (prev.maxKg && best > prev.maxKg.value) {
        out.push({ exerciseId: ex.exerciseId, kind: 'weight', value: best, previous: prev.maxKg.value });
      }
    } else if (measure === 'reps') {
      const best = Math.max(...done.map((s) => s.reps ?? 0));
      if (prev.maxReps && best > prev.maxReps.value) {
        out.push({ exerciseId: ex.exerciseId, kind: 'reps', value: best, previous: prev.maxReps.value });
      }
    } else if (measure === 'time') {
      const best = Math.max(...done.map((s) => s.durationSec ?? 0));
      if (prev.maxDuration && best > prev.maxDuration.value) {
        out.push({ exerciseId: ex.exerciseId, kind: 'duration', value: best, previous: prev.maxDuration.value });
      }
    } else {
      const best = Math.max(...done.map((s) => s.distanceKm ?? 0));
      if (prev.maxDistance && best > prev.maxDistance.value) {
        out.push({ exerciseId: ex.exerciseId, kind: 'distance', value: best, previous: prev.maxDistance.value });
      }
    }
  }
  return out;
}

export function countPersonalBests(workouts: Workout[], resolve: ExerciseResolver): number {
  const completed = workouts.filter((w) => w.status === 'completed').sort((a, b) => a.startedAt - b.startedAt);
  return completed.reduce((n, w) => n + personalBestsIn(w, completed, resolve).length, 0);
}

export function weeklyWorkoutCounts(workouts: Workout[], weeks: number, today: DateKey) {
  const thisWeek = startOfWeek(today);
  const buckets = Array.from({ length: weeks }, (_, i) => ({
    week: addDays(thisWeek, -7 * (weeks - 1 - i)),
    count: 0,
    durationSec: 0,
  }));
  for (const w of workouts) {
    if (w.status !== 'completed') continue;
    const wk = startOfWeek(w.date);
    const b = buckets.find((x) => x.week === wk);
    if (b) {
      b.count += 1;
      b.durationSec += w.durationSec;
    }
  }
  return buckets;
}

export function muscleDistribution(workouts: Workout[], resolve: ExerciseResolver): { muscle: MuscleGroup; sets: number }[] {
  const counts = new Map<MuscleGroup, number>();
  for (const w of workouts) {
    if (w.status !== 'completed') continue;
    for (const ex of w.exercises) {
      const muscle = resolve(ex.exerciseId)?.muscle;
      if (!muscle) continue;
      const n = ex.sets.filter((s) => s.done).length;
      if (n) counts.set(muscle, (counts.get(muscle) ?? 0) + n);
    }
  }
  return [...counts.entries()].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets);
}

/** Sets from the most recent completed session that included the exercise. */
export function lastPerformance(workouts: Workout[], exerciseId: string, excludeId?: number): SetEntry[] | null {
  const sorted = workouts
    .filter((w) => w.status === 'completed' && w.id !== excludeId)
    .sort((a, b) => b.startedAt - a.startedAt);
  for (const w of sorted) {
    const ex = w.exercises.find((x) => x.exerciseId === exerciseId);
    if (ex) {
      const done = ex.sets.filter((s) => s.done);
      if (done.length) return done;
    }
  }
  return null;
}

export function trainedMuscles(w: Workout, resolve: ExerciseResolver): MuscleGroup[] {
  const set = new Set<MuscleGroup>(w.muscleGroups);
  for (const ex of w.exercises) {
    if (!ex.sets.some((s) => s.done)) continue;
    const m = resolve(ex.exerciseId)?.muscle;
    if (m) set.add(m);
  }
  return [...set];
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
