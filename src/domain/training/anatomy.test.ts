import { describe, expect, it } from 'vitest';
import type { Exercise, Workout } from '../types';
import {
  CONDITIONING_GROUPS,
  exerciseMuscles,
  exercisesForMuscle,
  figureFor,
  GROUP_MUSCLES,
  loadLevel,
  MAPPED_EXERCISE_IDS,
  muscleDef,
  MUSCLE_IDS,
  MUSCLES,
  plannedSession,
  sessionGroups,
  sessionMuscles,
  weekMuscles,
} from './anatomy';
import { EXERCISE_CATALOG, findCatalogExercise } from './catalog';

const custom: Exercise = { id: 'custom-1', name: 'Remo en máquina X', muscle: 'back', secondary: ['biceps'], equipment: 'Máquina', measure: 'weight_reps', custom: true };
const resolve = (id: string) => findCatalogExercise(id) ?? (id === custom.id ? custom : undefined);

const sets = (done: number, pending = 0) => [
  ...Array.from({ length: done }, (_, i) => ({ uid: `d${i}`, reps: 10, kg: 20, done: true })),
  ...Array.from({ length: pending }, (_, i) => ({ uid: `p${i}`, reps: 10, kg: 20, done: false })),
];

const workout = (id: number, date: string, exercises: [string, number, number?][], status: Workout['status'] = 'completed'): Workout => ({
  id,
  name: 'Sesión',
  date,
  status,
  muscleGroups: [],
  exercises: exercises.map(([exerciseId, done, pending], i) => ({ uid: `e${i}`, exerciseId, restSec: 90, sets: sets(done, pending) })),
  startedAt: id,
  accumulatedSec: 3000,
  durationSec: 3000,
  createdAt: id,
  updatedAt: id,
});

describe('anatomy model', () => {
  it('gives every region a stable id, a name, a group and at least one view', () => {
    expect(MUSCLES.map((m) => m.id)).toEqual([...MUSCLE_IDS]);
    for (const m of MUSCLES) {
      expect(m.label.length).toBeGreaterThan(2);
      expect(m.views.length).toBeGreaterThan(0);
      expect(GROUP_MUSCLES[m.group]).toContain(m.id);
    }
  });

  it('maps every strength exercise of the catalog, and only real catalog ids', () => {
    const strength = EXERCISE_CATALOG.filter((e) => !CONDITIONING_GROUPS.includes(e.muscle));
    expect(strength.map((e) => e.id).sort()).toEqual([...MAPPED_EXERCISE_IDS].sort());
    for (const e of strength) {
      const m = exerciseMuscles(e);
      expect(m.source).toBe('exercise');
      expect(m.primary.length).toBeGreaterThan(0);
      expect(m.primary.some((p) => m.secondary.includes(p))).toBe(false);
    }
  });

  it("keeps each exercise's main group among its prime movers", () => {
    // Full-body lifts have no single group, and the abductors (gluteus medius) live in the glutes region.
    const exceptions = new Set(['hip-abduction']);
    for (const e of EXERCISE_CATALOG) {
      if (CONDITIONING_GROUPS.includes(e.muscle) || e.muscle === 'full_body' || exceptions.has(e.id)) continue;
      const groups = exerciseMuscles(e).primary.map((id) => muscleDef(id).group);
      expect(groups, e.id).toContain(e.muscle);
    }
  });

  it('draws nothing for cardio, mobility, recovery or a missing exercise, and says why', () => {
    expect(exerciseMuscles(findCatalogExercise('run'))).toMatchObject({ primary: [], secondary: [], source: 'none', reason: 'conditioning' });
    expect(exerciseMuscles(findCatalogExercise('yoga-flow'))).toMatchObject({ source: 'none', reason: 'conditioning' });
    expect(exerciseMuscles(undefined)).toMatchObject({ source: 'none', reason: 'unknown' });
    expect(exerciseMuscles({ id: 'custom-2', name: 'Circuito', muscle: 'full_body' })).toMatchObject({ source: 'none', reason: 'general' });
  });

  it('falls back to the whole group for custom exercises', () => {
    expect(exerciseMuscles(custom)).toEqual({ primary: ['lats', 'traps', 'lower-back'], secondary: ['biceps'], source: 'group' });
  });
});

describe('session muscles', () => {
  it('separates completed work from what is still pending', () => {
    // Overhead press done (front delts primary; side delts, triceps, traps assist); pushdowns still to do.
    const s = sessionMuscles(workout(1, '2026-10-12', [['overhead-press', 3], ['triceps-pushdown', 0, 3]], 'active').exercises, resolve);
    expect(s.muscles['front-delts']).toMatchObject({ done: 'primary', pending: null, direct: 3, indirect: 0 });
    // Triceps assisted the press and are the target of the pending exercise: both are shown.
    expect(s.muscles.triceps).toMatchObject({ done: 'secondary', pending: 'primary', direct: 0, indirect: 3 });
    expect(s.muscles.chest).toBeUndefined();
    expect(s.exercises.map((e) => e.status)).toEqual(['done', 'pending']);
    expect([s.doneSets, s.totalSets]).toEqual([3, 6]);
  });

  it('marks a partly done exercise and keeps opening the screen harmless', () => {
    const exercises = workout(1, '2026-10-12', [['bench-press', 1, 2]], 'active').exercises;
    const before = structuredClone(exercises);
    const s = sessionMuscles(exercises, resolve);
    expect(s.exercises[0]!.status).toBe('partial');
    expect(s.muscles.chest).toMatchObject({ done: 'primary', direct: 1 });
    expect(exercises).toEqual(before);
  });

  it('shows a template as planned work only', () => {
    const s = sessionMuscles(plannedSession([{ exerciseId: 'squat', sets: 4 }, { exerciseId: 'leg-curl', sets: 3 }]), resolve);
    expect(s.muscles.quads).toMatchObject({ done: null, pending: 'primary', direct: 0 });
    expect(s.muscles.adductors).toMatchObject({ done: null, pending: 'secondary' });
    expect(s.muscles.hamstrings).toMatchObject({ pending: 'primary' });
    expect(Object.values(s.muscles).every((m) => m.done === null)).toBe(true);
    expect(sessionGroups(s)).toEqual(['quads', 'glutes', 'hamstrings']);
  });

  it('updates when exercises change and reports what cannot be drawn', () => {
    const w = workout(1, '2026-10-12', [['lat-pulldown', 3], ['treadmill', 1], [custom.id, 2], ['gone', 1]]);
    const s = sessionMuscles(w.exercises, resolve);
    expect(s.muscles.lats?.done).toBe('primary');
    expect(s.unmapped.map((e) => [e.name, e.muscles.reason])).toEqual([
      ['Cinta', 'conditioning'],
      ['Ejercicio eliminado', 'unknown'],
    ]);
    expect(s.approximate.map((e) => e.name)).toEqual([custom.name]);
    const without = sessionMuscles(w.exercises.filter((e) => e.exerciseId !== 'lat-pulldown'), resolve);
    expect(without.muscles['rear-delts']).toBeUndefined();
    // The custom row still reaches the back group as a whole.
    expect(without.muscles.lats?.done).toBe('primary');
  });

  it('ignores the routine name and its stored groups', () => {
    const w = { ...workout(1, '2026-10-12', [['crunch', 2]]), name: 'Pierna y glúteo', muscleGroups: ['quads', 'glutes'] as Workout['muscleGroups'] };
    const s = sessionMuscles(w.exercises, resolve);
    expect(Object.keys(s.muscles).sort()).toEqual(['abs', 'obliques']);
  });
});

describe('weekly muscles', () => {
  const history = [
    workout(1, '2026-10-05', [['bench-press', 4]]), // last week
    workout(2, '2026-10-12', [['bench-press', 4], ['push-up', 3]]),
    workout(3, '2026-10-14', [['incline-db-press', 4], ['triceps-pushdown', 3]]),
    workout(4, '2026-10-15', [['squat', 5]], 'active'), // in progress: never counted
    workout(5, '2026-10-19', [['deadlift', 5]]), // next week
  ];

  it('adds up completed sets of the week, secondary sets count half', () => {
    const w = weekMuscles(history, '2026-10-12', resolve);
    expect(w.sessions).toBe(2);
    expect(w.end).toBe('2026-10-18');
    expect(w.muscles.chest).toMatchObject({ direct: 11, indirect: 0, effective: 11, level: 3, sessions: 2 });
    // Triceps: 3 direct + (4 + 3 + 4) assisting → 3 + 5.5
    expect(w.muscles.triceps).toMatchObject({ direct: 3, indirect: 11, effective: 8.5, level: 2 });
    expect(w.muscles.abs).toMatchObject({ direct: 0, indirect: 3, effective: 1.5, level: 1 });
    expect(w.muscles.quads).toBeUndefined();
    expect(w.muscles.chest?.hits.map((h) => [h.exerciseId, h.done])).toEqual([
      ['bench-press', 4],
      ['incline-db-press', 4],
      ['push-up', 3],
    ]);
  });

  it('keeps each week separate', () => {
    const last = weekMuscles(history, '2026-10-05', resolve);
    expect(last.sessions).toBe(1);
    expect(last.muscles.chest?.direct).toBe(4);
    expect(weekMuscles(history, '2026-09-28', resolve)).toMatchObject({ sessions: 0, muscles: {} });
  });

  it('uses fixed load levels', () => {
    expect([0, 0.5, 3.5, 4, 9.5, 10, 18].map(loadLevel)).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });
});

describe('library and figure', () => {
  it('lists the exercises that train a muscle, prime movers first', () => {
    const hits = exercisesForMuscle('triceps', EXERCISE_CATALOG);
    expect(hits[0]!.role).toBe('primary');
    expect(hits.find((h) => h.exercise.id === 'bench-press')?.role).toBe('secondary');
    expect(hits.findIndex((h) => h.role === 'secondary')).toBeGreaterThan(hits.findLastIndex((h) => h.role === 'primary'));
  });

  it('follows the sex from onboarding unless Perfil sets a figure', () => {
    expect(figureFor({ sex: 'male' })).toBe('male');
    expect(figureFor({ sex: 'female' })).toBe('female');
    expect(figureFor({ sex: 'unspecified' })).toBe('neutral');
    expect(figureFor({ sex: 'male', bodyFigure: 'female' })).toBe('female');
    expect(figureFor(null)).toBe('neutral');
  });
});
