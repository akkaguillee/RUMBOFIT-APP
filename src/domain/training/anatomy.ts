import { addDays, type DateKey } from '../dates';
import type { BodyFigure, Exercise, MuscleGroup, Profile, Workout } from '../types';

/**
 * Muscle map model. Every region drawn on the body map has a stable id, a
 * visible name, the training group it belongs to and the views where it is
 * visible. Exercises reach regions as primary or secondary movers; sessions
 * and weeks are aggregated from the sets actually stored, never from the
 * name of a routine.
 */

export type BodyView = 'front' | 'back';
export type MuscleRole = 'primary' | 'secondary';

export const MUSCLE_IDS = [
  'chest',
  'front-delts',
  'side-delts',
  'rear-delts',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'traps',
  'lats',
  'lower-back',
  'glutes',
  'quads',
  'adductors',
  'hamstrings',
  'calves',
] as const;

export type MuscleId = (typeof MUSCLE_IDS)[number];

export interface MuscleDef {
  id: MuscleId;
  /** Name shown to the user. */
  label: string;
  /** Training group it belongs to (same taxonomy as exercises and plans). */
  group: MuscleGroup;
  /** Views where the region is drawn; the first one shows it best. */
  views: readonly BodyView[];
}

export const MUSCLES: readonly MuscleDef[] = [
  { id: 'chest', label: 'Pectorales', group: 'chest', views: ['front'] },
  { id: 'front-delts', label: 'Deltoides anterior', group: 'shoulders', views: ['front'] },
  { id: 'side-delts', label: 'Deltoides lateral', group: 'shoulders', views: ['front', 'back'] },
  { id: 'rear-delts', label: 'Deltoides posterior', group: 'shoulders', views: ['back'] },
  { id: 'biceps', label: 'Bíceps', group: 'biceps', views: ['front'] },
  { id: 'triceps', label: 'Tríceps', group: 'triceps', views: ['back', 'front'] },
  { id: 'forearms', label: 'Antebrazos', group: 'forearms', views: ['front', 'back'] },
  { id: 'abs', label: 'Abdominales', group: 'core', views: ['front'] },
  { id: 'obliques', label: 'Oblicuos', group: 'core', views: ['front', 'back'] },
  { id: 'traps', label: 'Trapecio', group: 'back', views: ['back', 'front'] },
  { id: 'lats', label: 'Dorsales', group: 'back', views: ['back', 'front'] },
  { id: 'lower-back', label: 'Zona lumbar', group: 'back', views: ['back'] },
  { id: 'glutes', label: 'Glúteos', group: 'glutes', views: ['back'] },
  { id: 'quads', label: 'Cuádriceps', group: 'quads', views: ['front'] },
  { id: 'adductors', label: 'Aductores', group: 'adductors', views: ['front', 'back'] },
  { id: 'hamstrings', label: 'Isquiotibiales', group: 'hamstrings', views: ['back'] },
  { id: 'calves', label: 'Gemelos y sóleo', group: 'calves', views: ['back', 'front'] },
];

const BY_ID = new Map(MUSCLES.map((m) => [m.id, m]));

export const muscleDef = (id: MuscleId): MuscleDef => BY_ID.get(id)!;
export const muscleName = (id: MuscleId): string => BY_ID.get(id)!.label;
export const isMuscleId = (v: unknown): v is MuscleId => typeof v === 'string' && BY_ID.has(v as MuscleId);

/** Regions behind each training group, used when only the group is known (custom exercises). */
export const GROUP_MUSCLES: Record<MuscleGroup, readonly MuscleId[]> = {
  chest: ['chest'],
  back: ['lats', 'traps', 'lower-back'],
  shoulders: ['front-delts', 'side-delts', 'rear-delts'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearms'],
  core: ['abs', 'obliques'],
  quads: ['quads'],
  hamstrings: ['hamstrings'],
  glutes: ['glutes'],
  calves: ['calves'],
  adductors: ['adductors'],
  full_body: [],
  cardio: [],
  mobility: [],
  recovery: [],
};

/** Cardio, mobility and recovery work is real training, but it does not load one muscle region. */
export const CONDITIONING_GROUPS: readonly MuscleGroup[] = ['cardio', 'mobility', 'recovery'];

type Mapping = readonly [primary: readonly MuscleId[], secondary?: readonly MuscleId[]];

/**
 * Prime movers and assisting muscles for each catalog exercise. Secondary
 * muscles are the ones that clearly assist or stabilise under load, not
 * every muscle that is active.
 */
const EXERCISE_MUSCLES: Record<string, Mapping> = {
  // Pecho
  'bench-press': [['chest'], ['front-delts', 'triceps']],
  'incline-db-press': [['chest'], ['front-delts', 'triceps']],
  'db-bench-press': [['chest'], ['front-delts', 'triceps']],
  'cable-fly': [['chest'], ['front-delts']],
  'pec-deck': [['chest'], ['front-delts']],
  'push-up': [['chest'], ['front-delts', 'triceps', 'abs']],
  'dips-chest': [['chest'], ['triceps', 'front-delts']],
  'machine-chest-press': [['chest'], ['front-delts', 'triceps']],
  // Espalda
  'lat-pulldown': [['lats'], ['biceps', 'traps', 'rear-delts']],
  'seated-cable-row': [['lats', 'traps'], ['rear-delts', 'biceps']],
  'db-row': [['lats'], ['traps', 'rear-delts', 'biceps']],
  'pull-up': [['lats'], ['biceps', 'traps', 'rear-delts']],
  'barbell-row': [['lats', 'traps'], ['rear-delts', 'biceps', 'lower-back', 'hamstrings']],
  deadlift: [['lower-back', 'glutes', 'hamstrings'], ['quads', 'traps', 'forearms']],
  't-bar-row': [['lats', 'traps'], ['rear-delts', 'biceps']],
  'straight-arm-pulldown': [['lats'], ['triceps']],
  'back-extension': [['lower-back'], ['glutes', 'hamstrings']],
  // Hombros
  'overhead-press': [['front-delts'], ['side-delts', 'triceps', 'traps']],
  'db-shoulder-press': [['front-delts'], ['side-delts', 'triceps']],
  'lateral-raise': [['side-delts'], ['front-delts', 'traps']],
  'rear-delt-fly': [['rear-delts'], ['traps']],
  'face-pull': [['rear-delts'], ['traps']],
  'cable-lateral-raise': [['side-delts'], ['front-delts', 'traps']],
  // Bíceps
  'biceps-curl': [['biceps'], ['forearms']],
  'hammer-curl': [['biceps'], ['forearms']],
  'barbell-curl': [['biceps'], ['forearms']],
  'preacher-curl': [['biceps'], ['forearms']],
  'cable-curl': [['biceps'], ['forearms']],
  // Tríceps
  'triceps-pushdown': [['triceps']],
  'overhead-triceps': [['triceps']],
  'skull-crusher': [['triceps']],
  'close-grip-bench': [['triceps'], ['chest', 'front-delts']],
  'bench-dips': [['triceps'], ['chest', 'front-delts']],
  // Antebrazos
  'wrist-curl': [['forearms']],
  'farmer-walk': [['forearms'], ['traps', 'abs', 'obliques']],
  'dead-hang': [['forearms'], ['lats']],
  // Core
  plank: [['abs'], ['obliques']],
  crunch: [['abs'], ['obliques']],
  'leg-raise': [['abs'], ['obliques']],
  'dead-bug': [['abs'], ['obliques']],
  'pallof-press': [['obliques'], ['abs']],
  'side-plank': [['obliques'], ['abs']],
  'cable-crunch': [['abs'], ['obliques']],
  'ab-wheel': [['abs'], ['obliques', 'lats']],
  // Cuádriceps
  squat: [['quads', 'glutes'], ['adductors', 'lower-back']],
  'leg-press': [['quads'], ['glutes', 'adductors']],
  'leg-extension': [['quads']],
  lunge: [['quads', 'glutes'], ['adductors', 'hamstrings']],
  'bulgarian-split-squat': [['quads', 'glutes'], ['adductors', 'hamstrings']],
  'goblet-squat': [['quads', 'glutes'], ['adductors']],
  'hack-squat': [['quads'], ['glutes', 'adductors']],
  // Isquiotibiales
  'leg-curl': [['hamstrings'], ['calves']],
  'romanian-deadlift': [['hamstrings', 'glutes'], ['lower-back']],
  'good-morning': [['hamstrings', 'lower-back'], ['glutes']],
  'nordic-curl': [['hamstrings']],
  // Glúteos
  'hip-thrust': [['glutes'], ['hamstrings']],
  'glute-bridge': [['glutes'], ['hamstrings']],
  'cable-kickback': [['glutes'], ['hamstrings']],
  'step-up': [['glutes', 'quads'], ['hamstrings']],
  // Gemelos (gastrocnemio y sóleo)
  'standing-calf-raise': [['calves']],
  'seated-calf-raise': [['calves']],
  // Aductores y abductores (los abductores, glúteo medio y menor, están en la región de glúteos)
  'hip-adduction': [['adductors']],
  'hip-abduction': [['glutes']],
  'copenhagen-plank': [['adductors'], ['obliques']],
  // Cuerpo completo
  'kettlebell-swing': [['glutes', 'hamstrings'], ['lower-back', 'forearms']],
  burpee: [['quads', 'chest'], ['glutes', 'front-delts', 'triceps', 'abs']],
  thruster: [['quads', 'glutes', 'front-delts'], ['triceps', 'abs']],
  'clean-press': [['glutes', 'hamstrings', 'traps', 'front-delts'], ['quads', 'lower-back', 'triceps']],
};

/** Catalog ids with their own anatomy (for tests and documentation). */
export const MAPPED_EXERCISE_IDS: readonly string[] = Object.keys(EXERCISE_MUSCLES);

export type UnmappedReason = 'conditioning' | 'general' | 'unknown';

export interface ExerciseMuscles {
  primary: MuscleId[];
  secondary: MuscleId[];
  /** `exercise`: anatomy of that exercise; `group`: only its general group is known; `none`: no region. */
  source: 'exercise' | 'group' | 'none';
  /** Why nothing is drawn: cardio/mobility/recovery work, a group too general (full body) or a missing exercise. */
  reason?: UnmappedReason;
}

export type AnatomyExercise = Pick<Exercise, 'id' | 'name' | 'muscle' | 'secondary'>;
export type AnatomyResolver = (id: string) => AnatomyExercise | undefined;

const unique = <T>(xs: Iterable<T>): T[] => [...new Set(xs)];

export function exerciseMuscles(exercise: AnatomyExercise | undefined): ExerciseMuscles {
  if (!exercise) return { primary: [], secondary: [], source: 'none', reason: 'unknown' };
  const mapped = EXERCISE_MUSCLES[exercise.id];
  if (mapped) return { primary: [...mapped[0]], secondary: [...(mapped[1] ?? [])], source: 'exercise' };
  const primary = unique(GROUP_MUSCLES[exercise.muscle] ?? []);
  const secondary = unique((exercise.secondary ?? []).flatMap((g) => GROUP_MUSCLES[g] ?? [])).filter((m) => !primary.includes(m));
  if (!primary.length && !secondary.length) {
    return { primary, secondary, source: 'none', reason: CONDITIONING_GROUPS.includes(exercise.muscle) ? 'conditioning' : 'general' };
  }
  return { primary, secondary, source: 'group' };
}

// ── Sessions ────────────────────────────────────────────────────────────

/** Minimal shape shared by an active or completed workout and a template turned into planned sets. */
export interface SessionExerciseInput {
  exerciseId: string;
  sets: readonly { done: boolean }[];
}

export interface MuscleHit {
  exerciseId: string;
  name: string;
  role: MuscleRole;
  /** Completed sets of that exercise. */
  done: number;
  /** Sets of that exercise in the session (completed or still to do). */
  total: number;
}

export interface MuscleState {
  id: MuscleId;
  /** Strongest role reached with completed sets. */
  done: MuscleRole | null;
  /** Strongest role still to do, only when it adds to what is done. */
  pending: MuscleRole | null;
  /** Completed sets where it is a primary mover. */
  direct: number;
  /** Completed sets where it assists. */
  indirect: number;
  hits: MuscleHit[];
}

export type ExerciseStatus = 'done' | 'partial' | 'pending';

export interface SessionExercise {
  exerciseId: string;
  name: string;
  muscles: ExerciseMuscles;
  done: number;
  total: number;
  status: ExerciseStatus;
}

export interface SessionMuscles {
  muscles: Partial<Record<MuscleId, MuscleState>>;
  exercises: SessionExercise[];
  /** Exercises that draw nothing, with the reason. */
  unmapped: SessionExercise[];
  /** Exercises drawn from their general group only (custom exercises). */
  approximate: SessionExercise[];
  doneSets: number;
  totalSets: number;
}

const stronger = (a: MuscleRole | null, b: MuscleRole | null): MuscleRole | null => (a === 'primary' || b === 'primary' ? 'primary' : (a ?? b));

export function sessionMuscles(exercises: readonly SessionExerciseInput[], resolve: AnatomyResolver): SessionMuscles {
  const muscles: Partial<Record<MuscleId, MuscleState>> = {};
  const list: SessionExercise[] = [];
  let doneSets = 0;
  let totalSets = 0;
  for (const ex of exercises) {
    const info = resolve(ex.exerciseId);
    const anatomy = exerciseMuscles(info);
    const total = ex.sets.length;
    const done = ex.sets.filter((s) => s.done).length;
    doneSets += done;
    totalSets += total;
    // An exercise without sets yet is still planned work.
    const remaining = total === 0 ? 1 : total - done;
    const status: ExerciseStatus = total > 0 && done === total ? 'done' : done > 0 ? 'partial' : 'pending';
    const name = info?.name ?? 'Ejercicio eliminado';
    list.push({ exerciseId: ex.exerciseId, name, muscles: anatomy, done, total, status });
    const roles: [MuscleId, MuscleRole][] = [
      ...anatomy.primary.map((m): [MuscleId, MuscleRole] => [m, 'primary']),
      ...anatomy.secondary.map((m): [MuscleId, MuscleRole] => [m, 'secondary']),
    ];
    for (const [id, role] of roles) {
      const st = (muscles[id] ??= { id, done: null, pending: null, direct: 0, indirect: 0, hits: [] });
      st.hits.push({ exerciseId: ex.exerciseId, name, role, done, total });
      if (done > 0) {
        st.done = stronger(st.done, role);
        if (role === 'primary') st.direct += done;
        else st.indirect += done;
      }
      if (remaining > 0) st.pending = stronger(st.pending, role);
    }
  }
  for (const st of Object.values(muscles)) {
    if (st.done === 'primary' || (st.done === 'secondary' && st.pending !== 'primary')) st.pending = null;
    st.hits.sort((a, b) => (a.role === b.role ? b.done - a.done : a.role === 'primary' ? -1 : 1));
  }
  return {
    muscles,
    exercises: list,
    unmapped: list.filter((e) => e.muscles.source === 'none'),
    approximate: list.filter((e) => e.muscles.source === 'group'),
    doneSets,
    totalSets,
  };
}

/** A template (or anything with a set count) as planned work: nothing is done yet. */
export function plannedSession(exercises: readonly { exerciseId: string; sets: number }[]): SessionExerciseInput[] {
  return exercises.map((e) => ({ exerciseId: e.exerciseId, sets: Array.from({ length: Math.max(0, e.sets) }, () => ({ done: false })) }));
}

/** Groups of the primary muscles reached in a session, most worked first. */
export function sessionGroups(session: SessionMuscles): MuscleGroup[] {
  const score = new Map<MuscleGroup, number>();
  for (const st of Object.values(session.muscles)) {
    const sets = st.hits.filter((h) => h.role === 'primary').reduce((n, h) => n + Math.max(1, h.total), 0);
    if (!sets) continue;
    const g = muscleDef(st.id).group;
    score.set(g, (score.get(g) ?? 0) + sets);
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
}

// ── Weeks ───────────────────────────────────────────────────────────────

export type LoadLevel = 1 | 2 | 3;

/** Weekly effective sets (secondary sets count half) for each level. */
export const LOAD_LEVELS: readonly { level: LoadLevel; min: number; label: string }[] = [
  { level: 1, min: 0, label: 'Menos de 4 series' },
  { level: 2, min: 4, label: '4 a 9 series' },
  { level: 3, min: 10, label: '10 series o más' },
];

export const effectiveSets = (direct: number, indirect: number): number => direct + indirect / 2;

export function loadLevel(effective: number): LoadLevel | 0 {
  if (effective <= 0) return 0;
  return effective >= 10 ? 3 : effective >= 4 ? 2 : 1;
}

export interface WeekMuscleState {
  id: MuscleId;
  direct: number;
  indirect: number;
  effective: number;
  level: LoadLevel;
  /** Sessions that reached it. */
  sessions: number;
  /** Exercises that reached it during the week, with completed sets added up. */
  hits: MuscleHit[];
}

export interface WeekMuscles {
  start: DateKey;
  end: DateKey;
  /** Completed sessions in the week. */
  sessions: number;
  muscles: Partial<Record<MuscleId, WeekMuscleState>>;
  /** Exercises that drew nothing during the week (cardio, mobility…), by name. */
  unmapped: SessionExercise[];
  approximate: SessionExercise[];
}

/** Completed sessions from Monday `start` to Sunday. Sessions in progress never count. */
export function weekMuscles(workouts: readonly Workout[], start: DateKey, resolve: AnatomyResolver): WeekMuscles {
  const end = addDays(start, 6);
  const inWeek = workouts.filter((w) => w.status === 'completed' && w.date >= start && w.date <= end);
  const muscles: Partial<Record<MuscleId, WeekMuscleState>> = {};
  const unmapped = new Map<string, SessionExercise>();
  const approximate = new Map<string, SessionExercise>();
  for (const w of inWeek) {
    const s = sessionMuscles(w.exercises, resolve);
    for (const e of s.unmapped) unmapped.set(e.exerciseId, e);
    for (const e of s.approximate) approximate.set(e.exerciseId, e);
    for (const st of Object.values(s.muscles)) {
      if (!st.done) continue;
      const acc = (muscles[st.id] ??= { id: st.id, direct: 0, indirect: 0, effective: 0, level: 1, sessions: 0, hits: [] });
      acc.direct += st.direct;
      acc.indirect += st.indirect;
      acc.sessions += 1;
      for (const h of st.hits) {
        if (!h.done) continue;
        const prev = acc.hits.find((x) => x.exerciseId === h.exerciseId && x.role === h.role);
        if (prev) {
          prev.done += h.done;
          prev.total += h.total;
        } else acc.hits.push({ ...h });
      }
    }
  }
  for (const st of Object.values(muscles)) {
    st.effective = effectiveSets(st.direct, st.indirect);
    st.level = (loadLevel(st.effective) || 1) as LoadLevel;
    st.hits.sort((a, b) => (a.role === b.role ? b.done - a.done : a.role === 'primary' ? -1 : 1));
  }
  return { start, end, sessions: inWeek.length, muscles, unmapped: [...unmapped.values()], approximate: [...approximate.values()] };
}

// ── Library and figure ──────────────────────────────────────────────────

/** Exercises of the library that train a muscle, prime movers first. */
export function exercisesForMuscle<T extends AnatomyExercise>(id: MuscleId, library: readonly T[]): { exercise: T; role: MuscleRole }[] {
  const out: { exercise: T; role: MuscleRole }[] = [];
  for (const exercise of library) {
    const m = exerciseMuscles(exercise);
    if (m.primary.includes(id)) out.push({ exercise, role: 'primary' });
    else if (m.secondary.includes(id)) out.push({ exercise, role: 'secondary' });
  }
  return out.sort((a, b) => (a.role === b.role ? 0 : a.role === 'primary' ? -1 : 1));
}

/** The figure chosen in Perfil, or the one that follows the sex given in onboarding. */
export function figureFor(profile: Pick<Profile, 'sex' | 'bodyFigure'> | null | undefined): BodyFigure {
  if (profile?.bodyFigure) return profile.bodyFigure;
  if (profile?.sex === 'male') return 'male';
  if (profile?.sex === 'female') return 'female';
  return 'neutral';
}
