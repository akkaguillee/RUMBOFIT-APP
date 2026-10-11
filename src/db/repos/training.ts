import { keyToTimestamp, nowTime, todayKey, type DateKey } from '@/domain/dates';
import { trainedMuscles, uid, workoutElapsedSec } from '@/domain/training/stats';
import type {
  ExerciseMeasure,
  MuscleGroup,
  PlanDay,
  SetEntry,
  TemplateExercise,
  Workout,
  WorkoutExercise,
  WorkoutTemplate,
} from '@/domain/types';
import { assertRange, assertText, LIMITS, ValidationError } from '@/domain/validation';
import { db, type StoredCustomExercise } from '../db';
import { makeResolver, scheduleSync } from '../sync';

// ── Custom exercises ───────────────────────────────────────────────────

export interface ExerciseInput {
  name: string;
  muscle: MuscleGroup;
  measure: ExerciseMeasure;
  equipment?: string;
  tip?: string;
}

export async function createExercise(input: ExerciseInput): Promise<string> {
  const id = `custom-${uid()}`;
  const record: StoredCustomExercise = {
    id,
    name: assertText(input.name, 'El nombre', 60),
    muscle: input.muscle,
    measure: input.measure,
    equipment: input.equipment?.trim() || 'Personalizado',
    tip: input.tip?.trim() || undefined,
    custom: true,
    createdAt: Date.now(),
  };
  await db.exercises.put(record);
  scheduleSync();
  return id;
}

export async function updateExercise(id: string, input: ExerciseInput): Promise<void> {
  await db.exercises.update(id, {
    name: assertText(input.name, 'El nombre', 60),
    muscle: input.muscle,
    measure: input.measure,
    equipment: input.equipment?.trim() || 'Personalizado',
    tip: input.tip?.trim() || undefined,
  });
}

/** Exercises used in the history are archived instead of deleted so past sessions stay readable. */
export async function deleteExercise(id: string): Promise<'deleted' | 'archived'> {
  const used = (await db.workouts.toArray()).some((w) => w.exercises.some((e) => e.exerciseId === id));
  if (used) {
    await db.exercises.update(id, { archived: true });
  } else {
    await db.exercises.delete(id);
  }
  scheduleSync();
  return used ? 'archived' : 'deleted';
}

// ── Templates ──────────────────────────────────────────────────────────

export interface TemplateInput {
  name: string;
  muscleGroups: MuscleGroup[];
  exercises: TemplateExercise[];
  notes?: string;
}

function validateTemplate(input: TemplateInput) {
  assertText(input.name, 'El nombre', 60);
  if (!input.exercises.length) throw new ValidationError('Añade al menos un ejercicio a la plantilla.');
  for (const e of input.exercises) {
    if (e.sets < 1 || e.sets > 20) throw new ValidationError('Cada ejercicio debe tener entre 1 y 20 series.');
    assertRange(e.restSec, LIMITS.restSec);
  }
}

export async function saveTemplate(input: TemplateInput, id?: number): Promise<number> {
  validateTemplate(input);
  const now = Date.now();
  if (id !== undefined) {
    await db.templates.update(id, { ...input, name: input.name.trim(), updatedAt: now });
    scheduleSync();
    return id;
  }
  const newId = (await db.templates.add({ ...input, name: input.name.trim(), createdAt: now, updatedAt: now })) as number;
  scheduleSync();
  return newId;
}

export async function deleteTemplate(id: number): Promise<void> {
  await db.transaction('rw', db.templates, db.plan, async () => {
    await db.templates.delete(id);
    const plans = await db.plan.toArray();
    for (const p of plans) if (p.templateId === id) await db.plan.update(p.weekday, { templateId: undefined });
  });
  scheduleSync();
}

export async function templateFromWorkout(workout: Workout, name: string): Promise<number> {
  return saveTemplate({
    name,
    muscleGroups: workout.muscleGroups,
    exercises: workout.exercises.map((ex) => {
      const done = ex.sets.filter((s) => s.done);
      const ref = done[done.length - 1] ?? ex.sets[0];
      return {
        exerciseId: ex.exerciseId,
        sets: Math.max(1, done.length || ex.sets.length),
        reps: ref?.reps,
        kg: ref?.kg,
        durationSec: ref?.durationSec,
        restSec: ex.restSec,
      };
    }),
  });
}

// ── Weekly plan ────────────────────────────────────────────────────────

export async function savePlan(days: PlanDay[]): Promise<void> {
  for (const d of days) {
    if (d.weekday < 0 || d.weekday > 6) throw new ValidationError('Día de la semana no válido.');
    if (d.label.length > 40) throw new ValidationError('El nombre del día es demasiado largo.');
  }
  await db.transaction('rw', db.plan, async () => {
    await db.plan.clear();
    await db.plan.bulkPut(days.map((d) => ({ ...d, label: d.label.trim() })));
  });
  scheduleSync();
}

// ── Workouts ───────────────────────────────────────────────────────────

export function newSet(prefill: Partial<SetEntry> = {}): SetEntry {
  return { uid: uid(), done: false, ...prefill, completedAt: undefined };
}

export function exerciseEntry(exerciseId: string, sets: Partial<SetEntry>[] = [{}], restSec = 90): WorkoutExercise {
  return { uid: uid(), exerciseId, restSec, sets: sets.map((s) => newSet({ ...s, done: false })) };
}

export interface StartWorkoutInput {
  name: string;
  date?: DateKey;
  templateId?: number;
  muscleGroups?: MuscleGroup[];
  exercises?: WorkoutExercise[];
}

export async function getActiveWorkout(): Promise<Workout | undefined> {
  return db.workouts.where('status').equals('active').first();
}

export async function startWorkout(input: StartWorkoutInput): Promise<number> {
  const existing = await getActiveWorkout();
  if (existing?.id !== undefined) return existing.id;
  const now = Date.now();
  const workout: Workout = {
    name: input.name.trim() || 'Entrenamiento',
    date: input.date ?? todayKey(),
    time: nowTime(),
    status: 'active',
    templateId: input.templateId,
    muscleGroups: input.muscleGroups ?? [],
    exercises: input.exercises ?? [],
    startedAt: now,
    runningSince: now,
    accumulatedSec: 0,
    durationSec: 0,
    createdAt: now,
    updatedAt: now,
  };
  return (await db.workouts.add(workout)) as number;
}

export async function startFromTemplate(template: WorkoutTemplate): Promise<number> {
  return startWorkout({
    name: template.name,
    templateId: template.id,
    muscleGroups: template.muscleGroups,
    exercises: template.exercises.map((t) =>
      exerciseEntry(
        t.exerciseId,
        Array.from({ length: t.sets }, () => ({ reps: t.reps, kg: t.kg, durationSec: t.durationSec })),
        t.restSec,
      ),
    ),
  });
}

export async function repeatWorkout(source: Workout): Promise<number> {
  return startWorkout({
    name: source.name,
    templateId: source.templateId,
    muscleGroups: source.muscleGroups,
    exercises: source.exercises.map((ex) =>
      exerciseEntry(
        ex.exerciseId,
        ex.sets.filter((s) => s.done).map((s) => ({ reps: s.reps, kg: s.kg, durationSec: s.durationSec, distanceKm: s.distanceKm })),
        ex.restSec,
      ),
    ),
  });
}

export async function updateWorkout(id: number, patch: Partial<Workout>): Promise<void> {
  await db.workouts.update(id, { ...patch, updatedAt: Date.now() });
}

export async function mutateExercises(id: number, mutate: (exercises: WorkoutExercise[]) => WorkoutExercise[]): Promise<void> {
  await db.transaction('rw', db.workouts, async () => {
    const w = await db.workouts.get(id);
    if (!w) return;
    await db.workouts.update(id, { exercises: mutate(structuredClone(w.exercises)), updatedAt: Date.now() });
  });
}

export async function pauseWorkout(w: Workout): Promise<void> {
  if (!w.runningSince || w.id === undefined) return;
  await updateWorkout(w.id, { accumulatedSec: workoutElapsedSec(w), runningSince: undefined });
}

export async function resumeWorkout(w: Workout): Promise<void> {
  if (w.runningSince || w.id === undefined) return;
  await updateWorkout(w.id, { runningSince: Date.now() });
}

export async function startRest(id: number, seconds: number): Promise<void> {
  await updateWorkout(id, { restEndsAt: Date.now() + seconds * 1000, restTotalSec: seconds });
}

export async function clearRest(id: number): Promise<void> {
  await updateWorkout(id, { restEndsAt: undefined, restTotalSec: undefined });
}

export interface FinishInput {
  rpe?: number;
  notes?: string;
  name?: string;
}

/** Completes the session keeping only completed sets, and returns the saved workout. */
export async function finishWorkout(id: number, input: FinishInput = {}): Promise<Workout> {
  const w = await db.workouts.get(id);
  if (!w) throw new ValidationError('No se encontró el entrenamiento.');
  const custom = await db.exercises.toArray();
  const resolve = makeResolver(custom);
  const exercises = w.exercises
    .map((ex) => ({ ...ex, sets: ex.sets.filter((s) => s.done) }))
    .filter((ex) => ex.sets.length > 0);
  if (!exercises.length) throw new ValidationError('Completa al menos una serie antes de finalizar.');
  const now = Date.now();
  const durationSec = workoutElapsedSec(w, now);
  const done: Workout = {
    ...w,
    name: input.name?.trim() || w.name,
    exercises,
    status: 'completed',
    endedAt: now,
    runningSince: undefined,
    accumulatedSec: durationSec,
    durationSec,
    restEndsAt: undefined,
    restTotalSec: undefined,
    rpe: input.rpe,
    notes: input.notes?.trim() || undefined,
    updatedAt: now,
  };
  done.muscleGroups = trainedMuscles(done, resolve);
  await db.workouts.put(done);
  scheduleSync();
  return done;
}

export async function discardWorkout(id: number): Promise<void> {
  await db.workouts.delete(id);
}

export async function deleteWorkout(id: number): Promise<void> {
  await db.workouts.delete(id);
  scheduleSync();
}

export async function editCompletedWorkout(id: number, patch: Pick<Workout, 'name' | 'date' | 'notes' | 'rpe'>): Promise<void> {
  if (patch.date > todayKey()) throw new ValidationError('La fecha no puede estar en el futuro.');
  await updateWorkout(id, { ...patch, name: assertText(patch.name, 'El nombre', 60) });
  scheduleSync();
}

/** Adds a completed session after the fact (e.g. a run done without the app). */
export async function logPastWorkout(input: {
  name: string;
  date: DateKey;
  durationSec: number;
  exercises: WorkoutExercise[];
  notes?: string;
  rpe?: number;
}): Promise<number> {
  if (input.date > todayKey()) throw new ValidationError('La fecha no puede estar en el futuro.');
  assertRange(input.durationSec, LIMITS.durationSec);
  const custom = await db.exercises.toArray();
  const resolve = makeResolver(custom);
  const now = Date.now();
  // Anchor the session on its own date so history ordering and records stay chronological.
  const startedAt = Math.min(now, keyToTimestamp(input.date, '12:00'));
  const w: Workout = {
    name: assertText(input.name, 'El nombre', 60),
    date: input.date,
    status: 'completed',
    muscleGroups: [],
    exercises: input.exercises.map((ex) => ({ ...ex, sets: ex.sets.map((s) => ({ ...s, done: true })) })),
    startedAt,
    accumulatedSec: input.durationSec,
    durationSec: input.durationSec,
    endedAt: startedAt + input.durationSec * 1000,
    notes: input.notes,
    rpe: input.rpe,
    createdAt: now,
    updatedAt: now,
  };
  w.muscleGroups = trainedMuscles(w, resolve);
  const id = (await db.workouts.add(w)) as number;
  scheduleSync();
  return id;
}
