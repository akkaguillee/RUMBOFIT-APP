import { describe, expect, it } from 'vitest';
import { addDays, keyToTimestamp, startOfWeek, type DateKey } from '../dates';
import { findCatalogExercise } from '../training/catalog';
import type { GoalRecord, Profile, SetEntry, StepsEntry, WaterEntry, WeightEntry, Workout } from '../types';
import { ACHIEVEMENTS, ACHIEVEMENT_COUNT, CATEGORIES, META_ACHIEVEMENTS, RARITIES } from './catalog';
import { diffUnlocks, evaluateAchievements } from './engine';
import { computeMetrics, longestMonthRun, type AchievementData } from './metrics';

// Fixed «today»: Wednesday 14 October 2026. Every fixture is relative to it.
const today = '2026-10-14';
const thisMonday = startOfWeek(today);
/** Day `weekday` (0 = Monday) of the week `weeksAgo` weeks before the current one. */
const day = (weeksAgo: number, weekday = 0): DateKey => addDays(thisMonday, weekday - 7 * weeksAgo);

const profile: Profile = {
  id: 'me',
  name: 'Guille',
  age: 28,
  sex: 'male',
  heightCm: 180,
  goal: 'lose',
  startWeightKg: 90,
  goalWeightKg: 80,
  activityLevel: 'moderate',
  units: 'metric',
  startDate: '2026-01-05',
  trainingDays: [0, 2, 4],
  waterGoalMl: 2000,
  stepsGoal: 8000,
  healthFlags: [],
  createdAt: 1,
  updatedAt: 1,
};

const loseGoal: GoalRecord = { type: 'lose', startWeightKg: 90, goalWeightKg: 80, startDate: '2026-01-05', reached: false };

const base = (over: Partial<AchievementData> = {}): AchievementData => ({
  today,
  profile,
  goals: [loseGoal],
  weights: [],
  water: [],
  steps: [],
  workouts: [],
  templates: [],
  plan: [],
  customExercises: [],
  notes: [],
  bmi: [],
  energy: [],
  snapshots: [],
  resolve: (id) => findCatalogExercise(id),
  ...over,
});

const metrics = (over: Partial<AchievementData> = {}) => computeMetrics(base(over));
const state = (over: Partial<AchievementData>, id: string) => evaluateAchievements(base(over)).states.find((s) => s.def.id === id)!;

let seq = 1;
const weight = (date: DateKey, kg: number, time = '08:00'): WeightEntry => {
  const t = keyToTimestamp(date, time);
  return { id: seq++, date, time, kg, createdAt: t, updatedAt: t };
};
const drink = (date: DateKey, ml: number): WaterEntry => ({ id: seq++, date, time: '12:00', ml, createdAt: seq });
const stepsOn = (date: DateKey, steps: number): StepsEntry => ({ id: seq++, date, steps, updatedAt: seq });

interface Ex {
  id: string;
  sets: Partial<SetEntry>[];
}
const workout = (date: DateKey, exercises: Ex[], over: Partial<Workout> = {}): Workout => {
  const t = keyToTimestamp(date, '18:00');
  const id = seq++;
  return {
    id,
    name: 'Sesión',
    date,
    status: 'completed',
    muscleGroups: [],
    exercises: exercises.map((e, i) => ({
      uid: `${id}-${i}`,
      exerciseId: e.id,
      restSec: 60,
      sets: e.sets.map((s, j) => ({ uid: `${id}-${i}-${j}`, done: true, ...s })),
    })),
    startedAt: t,
    accumulatedSec: 1800,
    durationSec: 1800,
    createdAt: t,
    updatedAt: t,
    ...over,
  };
};
const bench = (date: DateKey, kg = 40) => workout(date, [{ id: 'bench-press', sets: [{ kg, reps: 10 }] }]);

/** One weigh-in per week (Mondays) for the given weekly averages, oldest first, ending last week. */
const weeklyWeights = (kgs: number[]) => kgs.map((kg, i) => weight(day(kgs.length - i, 0), kg));

describe('milestone catalog', () => {
  const all = [...ACHIEVEMENTS, ...META_ACHIEVEMENTS];

  it('has unique ids and names, and every milestone is complete', () => {
    const ids = all.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    const names = all.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
    expect(ACHIEVEMENT_COUNT).toBe(all.length);
    expect(ACHIEVEMENT_COUNT).toBeGreaterThanOrEqual(120);
    const categories = new Set(CATEGORIES.map((c) => c.id));
    const m = metrics();
    for (const a of all) {
      expect(a.name.trim(), a.id).not.toBe('');
      expect(a.description.trim().length, a.id).toBeGreaterThan(10);
      expect(categories.has(a.category), a.id).toBe(true);
      expect(Object.keys(RARITIES), a.id).toContain(a.rarity);
      expect(a.icon, a.id).toBeTruthy();
      expect(a.target, a.id).toBeGreaterThan(0);
      expect(typeof a.metric, a.id).toBe('function');
      expect(Number.isFinite(a.metric(m)), a.id).toBe(true);
    }
  });

  it('keeps every original milestone id', () => {
    const ids = new Set(all.map((a) => a.id));
    const original = [
      'first-rumbo', 'first-step', 'starting-point', 'underway', 'first-record', 'week-started', 'three-days', 'first-week',
      'two-weeks', 'month-commitment', 'steel-constancy', 'habit-builder', 'back-on-track', 'first-change', 'weigh-in-10',
      'intermediate-goal', 'quarter-way', 'halfway', 'last-stretch', 'goal-reached', 'new-stage', 'steady-weight', 'first-drop',
      'hydration-on', 'hydrated-week', 'hydration-habit', 'hundred-liters', 'hydration-master', 'first-move', 'lets-walk',
      'steady-pace', 'explorer', 'personal-goal', 'long-road', 'million-steps', 'first-session', 'three-workouts', 'discipline',
      'plan-done', 'muscle-explorer', 'smart-return', 'twenty-five', 'routine-set', 'ten-hours', 'fifty', 'hundred', 'progression',
      'solid-session', 'ten-tons', 'ten-prs', 'hundred-tons', 'steady-strength', 'active-pause', 'body-cared', 'balanced-week',
      'mindful-recovery', 'weekly-plan', 'first-template', 'your-way', 'journal', 'know-yourself', 'energy-known', 'routine-library',
      'logbook', 'streak-7', 'full-day', 'streak-14', 'full-days-10', 'streak-30', 'month-weighins', 'month-workouts', 'month-water',
      'month-steps', 'month-progress', 'sixty-days', 'ninety-days', 'six-months', 'two-hundred-days', 'first-year', 'rumbo-explorer',
      'habit-recovered', 'ten-weeks', 'three-per-week', 'hundred-weighins', 'collector',
    ];
    expect(original).toHaveLength(85);
    for (const id of original) expect(ids.has(id), id).toBe(true);
  });

  it('spreads milestones over every category and rarity, with hard long-term ones', () => {
    for (const c of CATEGORIES) expect(all.some((a) => a.category === c.id), c.id).toBe(true);
    const legendary = all.filter((a) => a.rarity === 'legendary');
    expect(legendary.length).toBeGreaterThanOrEqual(10);
    expect(all.filter((a) => a.rarity === 'common').length).toBeGreaterThanOrEqual(20);
  });

  it('never asks for speed: no milestone rewards losing or gaining kilos in a set time', () => {
    for (const a of all) {
      expect(a.description, a.id).not.toMatch(/(pierde|perder|baja|bajar|adelgaza|gana|ganar)\s+(\d|un |una |dos |tres )/i);
      expect(a.description, a.id).not.toMatch(/\d+(,\d+)?\s*kg\s+(en|antes de)\s+\d+\s*(días|semanas)/i);
    }
  });
});

describe('weekly regularity', () => {
  it('counts consecutive weeks with records on 3+ days', () => {
    const water: WaterEntry[] = [];
    for (let w = 1; w <= 4; w++) for (const d of [0, 2, 4]) water.push(water1(day(w, d)));
    expect(metrics({ water }).activeWeeksRun3).toBe(4);
    expect(state({ water }, 'steady-weeks-4').achieved).toBe(true);
    expect(state({ water }, 'steady-weeks-12').current).toBe(4);
    // A week with only two active days breaks the run.
    const broken = water.filter((w) => !(w.date === day(2, 4)));
    expect(metrics({ water: broken }).activeWeeksRun3).toBe(2);
  });

  it('«Semana Completa» needs the seven days of one calendar week', () => {
    const six = [0, 1, 2, 3, 4, 5].map((d) => water1(day(1, d)));
    expect(state({ water: six }, 'full-week').achieved).toBe(false);
    // Seven consecutive days across two weeks are not a full week either.
    const across = [3, 4, 5, 6, 7, 8, 9].map((d) => water1(day(2, d)));
    expect(state({ water: across }, 'full-week').achieved).toBe(false);
    expect(state({ water: [...six, water1(day(1, 6))] }, 'full-week').achieved).toBe(true);
  });

  it('counts the longest logging streak for the long streak milestones', () => {
    const water = Array.from({ length: 60 }, (_, i) => water1(addDays(today, -i - 1)));
    expect(state({ water }, 'streak-3').achieved).toBe(true);
    expect(state({ water }, 'streak-60').achieved).toBe(true);
    expect(state({ water }, 'streak-100').current).toBe(60);
    // A missing day splits it.
    const gap = water.filter((w) => w.date !== addDays(today, -30));
    expect(metrics({ water: gap }).longestStreak).toBe(30);
  });

  it('«Un Año de Rumbo» needs 365 distinct active days', () => {
    const weights = Array.from({ length: 364 }, (_, i) => weight(addDays(today, -i), 85));
    expect(state({ weights }, 'rumbo-year').achieved).toBe(false);
    expect(state({ weights: [...weights, weight(addDays(today, -400), 86)] }, 'rumbo-year').achieved).toBe(true);
  });

  it('«Mes Pleno» needs 25 active days in one calendar month', () => {
    const water = Array.from({ length: 25 }, (_, i) => water1(addDays('2026-09-01', i)));
    expect(state({ water }, 'month-25').achieved).toBe(true);
    expect(state({ water: water.slice(1) }, 'month-25').achieved).toBe(false);
  });

  it('ignores records dated after today', () => {
    const water = [water1(addDays(today, 1)), water1(addDays(today, 2)), water1(addDays(today, 3))];
    const m = metrics({ water: water.map((w) => ({ ...w, ml: 2500 })) });
    expect(m.waterGoalStreak).toBe(0);
    expect(m.waterLitersCapped).toBe(0);
  });
});

function water1(date: DateKey): WaterEntry {
  return drink(date, 250);
}

describe('weight tracking', () => {
  it('rewards weekly weigh-ins, not daily ones', () => {
    const weights = [1, 2, 3, 4].map((w) => weight(day(w, 3), 85));
    expect(metrics({ weights }).weighInWeeksRun).toBe(4);
    expect(state({ weights }, 'weekly-weigh-4').achieved).toBe(true);
    // Many weigh-ins inside one week still count as one week.
    const daily = Array.from({ length: 7 }, (_, i) => weight(day(1, i), 85));
    expect(metrics({ weights: daily }).weighInWeeksRun).toBe(1);
    // A week without weighing breaks the run.
    expect(metrics({ weights: weights.filter((w) => w.date !== day(2, 3)) }).weighInWeeksRun).toBe(2);
  });

  it('«Progreso Sostenido»: six finished weeks moving towards the goal at a gradual pace', () => {
    const weights = weeklyWeights([90, 89.6, 89.2, 88.9, 88.5, 88.1]);
    expect(metrics({ weights }).steadyProgressWeeks).toBe(6);
    expect(state({ weights }, 'steady-progress-6').achieved).toBe(true);
    expect(state({ weights }, 'steady-progress-12').current).toBe(6);
  });

  it('never rewards speed: a week faster than 1 % of body weight splits the window', () => {
    // 90 → 88.5 is a 1.5 kg drop in one week (> 0.9 kg).
    const weights = weeklyWeights([90, 89.7, 89.4, 87.9, 87.6, 87.3]);
    expect(metrics({ weights }).steadyProgressWeeks).toBe(3);
    expect(state({ weights }, 'steady-progress-6').achieved).toBe(false);
  });

  it('needs at least 0,5 kg of real progress and ignores going past the goal', () => {
    const flat = weeklyWeights([85, 85.1, 84.9, 85, 84.8, 84.7]);
    expect(metrics({ weights: flat }).steadyProgressWeeks).toBe(0);
    // Moving away from the goal is not progress.
    const up = weeklyWeights([84, 84.3, 84.6, 84.9, 85.2, 85.5]);
    expect(metrics({ weights: up }).steadyProgressWeeks).toBe(0);
    // Already beyond the goal (80): further loss earns nothing.
    const below = weeklyWeights([79.5, 79.2, 78.9, 78.6, 78.3, 78]);
    expect(metrics({ weights: below }).steadyProgressWeeks).toBe(0);
  });

  it('only counts finished weeks and only goals with a target weight', () => {
    // Five finished weeks plus this week: the current week is not counted yet.
    const weights = [...weeklyWeights([90, 89.6, 89.2, 88.8, 88.4]), weight(today, 88)];
    expect(metrics({ weights }).steadyProgressWeeks).toBe(5);
    const maintain = { ...profile, goal: 'maintain' as const };
    const steady = weeklyWeights([90, 89.6, 89.2, 88.9, 88.5, 88.1]);
    expect(metrics({ weights: steady, profile: maintain, goals: [{ type: 'maintain', startDate: '2026-01-05', reached: false }] }).steadyProgressWeeks).toBe(0);
  });

  it('works for weight gain goals with the same gradual cap', () => {
    const gain: GoalRecord = { type: 'gain', startWeightKg: 60, goalWeightKg: 66, startDate: '2026-01-05', reached: false };
    const weights = weeklyWeights([60, 60.3, 60.6, 60.8, 61.1, 61.4]);
    expect(metrics({ weights, goals: [gain], profile: { ...profile, goal: 'gain', startWeightKg: 60, goalWeightKg: 66 } }).steadyProgressWeeks).toBe(6);
    const fast = weeklyWeights([60, 61.5, 63, 64.5, 66, 67.5]);
    expect(metrics({ weights: fast, goals: [gain] }).steadyProgressWeeks).toBe(0);
  });

  it('«Objetivo Consolidado»: four finished weeks within ±2 kg after reaching the goal', () => {
    const goal: GoalRecord = { type: 'lose', startWeightKg: 90, goalWeightKg: 84, startDate: '2026-01-05', reached: false };
    const reached = weight(day(6, 2), 84);
    const kept = [weight(day(5, 0), 84.5), weight(day(4, 0), 85.8), weight(day(3, 0), 84.2), weight(day(2, 0), 84.9)];
    expect(metrics({ goals: [goal], weights: [weight(day(10, 0), 90), reached, ...kept] }).goalKeptWeeks).toBe(4);
    expect(state({ goals: [goal], weights: [reached, ...kept] }, 'goal-kept').achieved).toBe(true);
    // Going well below the goal is not "keeping" it either (82,5 is 1,5 kg under: still fine; 81,5 is not).
    const under = [weight(day(5, 0), 82.5), weight(day(4, 0), 81.5), weight(day(3, 0), 84.2), weight(day(2, 0), 84.9)];
    expect(metrics({ goals: [goal], weights: [reached, ...under] }).goalKeptWeeks).toBe(2);
    // A week averaging 2,5 kg above the goal breaks the run.
    const slip = [weight(day(5, 0), 84.5), weight(day(4, 0), 86.5), weight(day(3, 0), 84.2), weight(day(2, 0), 84.9)];
    expect(metrics({ goals: [goal], weights: [reached, ...slip] }).goalKeptWeeks).toBe(2);
    // Without reaching the goal first, nothing counts.
    expect(metrics({ goals: [goal], weights: kept }).goalKeptWeeks).toBe(0);
    // The week in progress is not judged yet.
    expect(metrics({ goals: [goal], weights: [weight(day(1, 2), 84), weight(today, 84.3)] }).goalKeptWeeks).toBe(0);
  });

  it('«Equilibrio Duradero»: twelve finished weeks inside a 3 kg band while maintaining', () => {
    const maintain = { ...profile, goal: 'maintain' as const };
    const goals: GoalRecord[] = [{ type: 'maintain', startDate: '2026-01-05', reached: false }];
    const kgs = [70, 71, 70.5, 72, 71.5, 70.2, 71.8, 72.4, 71, 70.6, 71.9, 72.1];
    const weights = weeklyWeights(kgs);
    expect(metrics({ profile: maintain, goals, weights }).maintainWeeksRun).toBe(12);
    expect(state({ profile: maintain, goals, weights }, 'maintain-12').achieved).toBe(true);
    // One weigh-in outside the band (73,5 vs 70) breaks the window.
    const out = weeklyWeights([...kgs.slice(0, 6), 73.5, ...kgs.slice(7)]);
    expect(metrics({ profile: maintain, goals, weights: out }).maintainWeeksRun).toBeLessThan(12);
    // Not a maintenance goal: it doesn't apply.
    expect(metrics({ weights }).maintainWeeksRun).toBe(0);
  });

  it('keeps «Equilibrio» once earned, even months later or after changing goal', () => {
    // Four stable weigh-ins in March while maintaining; nothing since.
    const goals: GoalRecord[] = [
      { type: 'maintain', startDate: '2026-03-01', endDate: '2026-06-01', reached: false },
      { type: 'lose', startWeightKg: 72, goalWeightKg: 69, startDate: '2026-06-01', reached: false },
    ];
    const weights = ['2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23'].map((d, i) => weight(d, 71 + i * 0.5));
    expect(metrics({ goals, weights }).maintainStable).toBe(1);
    // The original rule still applies too (last 28 days with a maintenance goal).
    const maintain = { ...profile, goal: 'maintain' as const };
    const recent = [1, 8, 15, 22].map((n) => weight(addDays(today, -n), 70));
    expect(metrics({ profile: maintain, goals: [], weights: recent }).maintainStable).toBe(1);
    // A 3,5 kg spread is not stable.
    const wide = ['2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23'].map((d, i) => weight(d, 70 + i * 1.2));
    expect(metrics({ goals, weights: wide }).maintainStable).toBe(0);
  });
});

describe('hydration', () => {
  it('counts the longest run of days meeting the water goal', () => {
    const water = Array.from({ length: 7 }, (_, i) => waterGoal(addDays(today, -i - 1)));
    expect(state({ water }, 'water-streak-7').achieved).toBe(true);
    const short = water.map((w) => (w.date === addDays(today, -4) ? { ...w, ml: 1500 } : w));
    expect(metrics({ water: short }).waterGoalStreak).toBe(3);
  });

  it('counts consecutive weeks with 5+ water-goal days', () => {
    const water: WaterEntry[] = [];
    for (let w = 1; w <= 4; w++) for (let d = 0; d < 5; d++) water.push(waterGoal(day(w, d)));
    expect(metrics({ water }).waterWeeksRun5).toBe(4);
    expect(state({ water }, 'water-weeks-4').achieved).toBe(true);
    const four = water.filter((w) => w.date !== day(3, 0));
    expect(metrics({ water: four }).waterWeeksRun5).toBe(2);
  });

  it('never rewards drinking above the goal: each day adds at most the goal', () => {
    const water = [drink(day(1, 0), 4000), drink(day(1, 1), 1500), drink(day(1, 2), 2000)];
    // 2 + 1,5 + 2 = 5,5 L counted, not 7,5 L.
    expect(metrics({ water }).waterLitersCapped).toBe(5);
    expect(metrics({ water }).totalWaterLiters).toBe(7);
  });

  it('uses the goal in force on each day for the capped litres', () => {
    const water = [drink(day(1, 0), 3000)];
    const snapshots = [{ date: day(1, 0), waterGoalMl: 2500, stepsGoal: 8000 }];
    expect(computeMetrics(base({ water, snapshots })).waterLitersCapped).toBe(2);
  });
});

function waterGoal(date: DateKey): WaterEntry {
  return drink(date, 2000);
}

describe('steps and movement', () => {
  it('counts days meeting the water and steps goals together', () => {
    const d1 = day(1, 0);
    const d2 = day(1, 1);
    const data = { water: [waterGoal(d1), waterGoal(d2)], steps: [stepsOn(d1, 9000), stepsOn(d2, 5000)] };
    expect(metrics(data).doubleGoalDays).toBe(1);
    expect(state(data, 'double-goal').achieved).toBe(true);
    expect(state(data, 'double-goal-30').current).toBe(1);
  });

  it('adds cumulative steps for «Cien Mil Pasos»', () => {
    const steps = Array.from({ length: 10 }, (_, i) => stepsOn(addDays(today, -i - 1), 9999));
    expect(state({ steps }, 'steps-100k').achieved).toBe(false);
    expect(state({ steps: [...steps, stepsOn(addDays(today, -20), 10)] }, 'steps-100k').achieved).toBe(true);
  });

  it('counts cardio sessions and kilometres only from cardio sets actually done', () => {
    const workouts = [
      workout(day(3, 0), [{ id: 'run', sets: [{ distanceKm: 5.25, durationSec: 1800 }] }]),
      workout(day(2, 0), [{ id: 'walk', sets: [{ distanceKm: 3.1 }, { distanceKm: 4, done: false }] }]),
      // Farmer walks have a distance but are not cardio.
      workout(day(1, 0), [{ id: 'farmer-walk', sets: [{ distanceKm: 0.2 }] }]),
      // A planned cardio day where only bench press was done.
      workout(day(1, 2), [{ id: 'bench-press', sets: [{ kg: 40, reps: 10 }] }], { muscleGroups: ['cardio'] }),
    ];
    const m = metrics({ workouts });
    expect(m.cardioSessions).toBe(2);
    expect(m.cardioKm).toBe(8.3);
    expect(state({ workouts }, 'marathon-stages').current).toBe(8.3);
    const many = Array.from({ length: 10 }, (_, i) => workout(addDays(today, -i - 1), [{ id: 'run', sets: [{ distanceKm: 4.3 }] }]));
    expect(state({ workouts: many }, 'cardio-10').achieved).toBe(true);
    expect(state({ workouts: many }, 'marathon-stages').achieved).toBe(true);
  });
});

describe('training regularity', () => {
  it('«Semana Activa» needs two sessions in one week', () => {
    expect(state({ workouts: [bench(day(1, 0)), bench(day(2, 0))] }, 'active-week').achieved).toBe(false);
    expect(state({ workouts: [bench(day(1, 0)), bench(day(1, 3))] }, 'active-week').achieved).toBe(true);
  });

  it('weekly training milestones count runs of weeks, never daily streaks', () => {
    const workouts: Workout[] = [];
    for (let w = 1; w <= 12; w++) for (const d of [0, 2, 4]) workouts.push(bench(day(w, d)));
    expect(state({ workouts }, 'routine-12').achieved).toBe(true);
    expect(state({ workouts }, 'elite-discipline').achieved).toBe(true);
    expect(state({ workouts }, 'routine-26').current).toBe(12);
    // A single week with two sessions keeps the 2/week run but breaks the 3/week one.
    const lighter = workouts.filter((w) => w.date !== day(6, 4));
    expect(state({ workouts: lighter }, 'routine-12').achieved).toBe(true);
    expect(state({ workouts: lighter }, 'elite-discipline').achieved).toBe(false);
  });

  it('«Descanso Inteligente» rewards 3–5 training days with rest, in finished weeks only', () => {
    const workouts: Workout[] = [];
    for (let w = 1; w <= 4; w++) for (const d of [0, 2, 4]) workouts.push(bench(day(w, d)));
    expect(metrics({ workouts }).restfulWeeksRun).toBe(4);
    expect(state({ workouts }, 'smart-rest').achieved).toBe(true);
    // Training six days in a week leaves too little rest: that week doesn't count
    // (weeks 4–3 still make a run of two; week 1 restarts).
    const noRest = [...workouts, ...[1, 3, 5].map((d) => bench(day(2, d)))];
    expect(metrics({ workouts: noRest }).restfulWeeksRun).toBe(2);
    expect(state({ workouts: noRest }, 'smart-rest').achieved).toBe(false);
    // Two sessions on the same day are one training day.
    const sameDay = [bench(day(1, 0)), bench(day(1, 0)), bench(day(1, 2))];
    expect(metrics({ workouts: sameDay }).restfulWeeksRun).toBe(0);
    // The week in progress is not judged yet.
    const current = [0, 1, 2].map((d) => bench(day(0, d)));
    expect(metrics({ workouts: current }).restfulWeeksRun).toBe(0);
  });

  it('«Cuidado Constante» counts weeks with a mobility or recovery exercise really done', () => {
    const workouts = [1, 2, 3, 4].map((w) => workout(day(w, 5), [{ id: w % 2 ? 'yoga-flow' : 'stretching', sets: [{ durationSec: 900 }] }]));
    expect(metrics({ workouts }).recoveryWeeksRun).toBe(4);
    expect(state({ workouts }, 'recovery-weeks-4').achieved).toBe(true);
    // A session planned as mobility where only bench press was done doesn't count.
    const planned = workouts.map((w) => (w.date === day(2, 5) ? workout(w.date, [{ id: 'bench-press', sets: [{ kg: 40, reps: 8 }] }], { muscleGroups: ['mobility'] }) : w));
    expect(metrics({ workouts: planned }).recoveryWeeksRun).toBe(2);
  });

  it('«Mapa Completo» needs the twelve main muscle groups', () => {
    const ids = ['bench-press', 'barbell-row', 'lateral-raise', 'biceps-curl', 'triceps-pushdown', 'wrist-curl', 'plank', 'squat', 'leg-curl', 'hip-thrust', 'standing-calf-raise'];
    const workouts = [workout(day(1, 0), ids.map((id) => ({ id, sets: [{ kg: 10, reps: 10, durationSec: 60 }] })))];
    expect(metrics({ workouts }).majorMusclesTrained).toBe(11);
    const all = [...workouts, workout(day(1, 2), [{ id: 'hip-adduction', sets: [{ kg: 20, reps: 12 }] }])];
    expect(state({ workouts: all }, 'full-map').achieved).toBe(true);
    // Undone sets don't count.
    const undone = [...workouts, workout(day(1, 2), [{ id: 'hip-adduction', sets: [{ kg: 20, reps: 12, done: false }] }])];
    expect(metrics({ workouts: undone }).majorMusclesTrained).toBe(11);
  });

  it('«Fuerza en Progreso» needs personal bests in three consecutive months', () => {
    const workouts = [bench('2026-08-05', 40), bench('2026-08-12', 42.5), bench('2026-09-09', 45), bench('2026-10-07', 47.5)];
    expect(metrics({ workouts }).prMonthsRun).toBe(3);
    expect(metrics({ workouts }).personalBests).toBe(3);
    expect(state({ workouts }, 'strength-months-3').achieved).toBe(true);
    // No record in September: the run restarts.
    const gap = [bench('2026-08-05', 40), bench('2026-08-12', 42.5), bench('2026-09-09', 40), bench('2026-10-07', 47.5)];
    expect(metrics({ workouts: gap }).prMonthsRun).toBe(1);
  });

  it('finds consecutive months across the turn of the year', () => {
    expect(longestMonthRun(['2025-11', '2025-12', '2026-01', '2026-03'])).toBe(3);
    expect(longestMonthRun([])).toBe(0);
  });
});

describe('ideal weeks', () => {
  const idealWeek = (w: number) => [
    ...[0, 1, 2, 3, 4].map((d) => waterGoal(day(w, d))),
    ...[0, 1, 2, 3, 4].map((d) => stepsOn(day(w, d), 9000)),
  ];
  const idealWorkouts = (w: number) => [0, 2, 4].map((d) => bench(day(w, d)));

  it('«Semana Ideal» needs water, steps and training in the same week', () => {
    const entries = idealWeek(1);
    const data = {
      water: entries.filter((e): e is WaterEntry => 'ml' in e),
      steps: entries.filter((e): e is StepsEntry => 'steps' in e),
      workouts: idealWorkouts(1),
    };
    expect(metrics(data).idealWeeks).toBe(1);
    expect(state(data, 'ideal-week').achieved).toBe(true);
    expect(metrics({ ...data, workouts: idealWorkouts(1).slice(1) }).idealWeeks).toBe(0);
  });

  it('«Mes Ideal» chains four ideal weeks', () => {
    const entries = [1, 2, 3, 4].flatMap(idealWeek);
    const data = {
      water: entries.filter((e): e is WaterEntry => 'ml' in e),
      steps: entries.filter((e): e is StepsEntry => 'steps' in e),
      workouts: [1, 2, 3, 4].flatMap(idealWorkouts),
    };
    expect(metrics(data).idealWeeksRun).toBe(4);
    expect(state(data, 'ideal-month').achieved).toBe(true);
  });
});

describe('meta milestones and unlock policy', () => {
  it('collector milestones count the regular milestones achieved', () => {
    const water = Array.from({ length: 30 }, (_, i) => waterGoal(addDays(today, -i - 1)));
    const { states, metrics: m } = evaluateAchievements(base({ water }));
    const regular = states.filter((s) => !META_ACHIEVEMENTS.some((d) => d.id === s.def.id));
    expect(m.milestonesAchieved).toBe(regular.filter((s) => s.achieved).length);
    const c10 = states.find((s) => s.def.id === 'collector-10')!;
    expect(c10.achieved).toBe(m.milestonesAchieved >= 10);
    expect(states.find((s) => s.def.id === 'collector-50')!.current).toBe(Math.min(50, m.milestonesAchieved));
  });

  it('unlocks retroactively only what the records support, once', () => {
    // Records an existing user already had: 45 days of water goals (all of September included).
    const water = Array.from({ length: 45 }, (_, i) => waterGoal(addDays(today, -i - 1)));
    const { states } = evaluateAchievements(base({ water }));
    // What the previous catalog had already unlocked from those records.
    const legacy = ['first-drop', 'hydration-on', 'hydrated-week', 'hydration-habit', 'month-water', 'three-days', 'first-week', 'two-weeks', 'month-commitment', 'steel-constancy', 'habit-builder', 'month-progress', 'streak-7', 'streak-14', 'streak-30', 'week-started'].map((id) => ({ id, unlockedAt: 1, seen: true }));
    const { unlock, revoke } = diffUnlocks(states, legacy);
    expect(unlock).toContain('water-streak-7');
    expect(unlock).toContain('water-weeks-4');
    expect(unlock).toContain('full-week');
    expect(unlock).not.toContain('water-weeks-12');
    expect(unlock).not.toContain('liters-500');
    expect(unlock).not.toContain('first-drop');
    // The update never withdraws what the previous catalog granted.
    expect(revoke).toHaveLength(0);
    // Nothing for actions the user never did.
    expect(unlock.some((id) => ['first-session', 'active-week', 'cardio-10', 'weekly-weigh-4', 'steps-100k'].includes(id))).toBe(false);
    const persisted = [...legacy, ...unlock.map((id) => ({ id, unlockedAt: 2, seen: false }))];
    expect(diffUnlocks(states, persisted).unlock).toHaveLength(0);
  });

  it('time passing alone never withdraws the new milestones', () => {
    const workouts: Workout[] = [];
    for (let w = 1; w <= 4; w++) for (const d of [0, 2, 4]) workouts.push(bench(day(w, d)));
    const weights = weeklyWeights([90, 89.6, 89.2, 88.9, 88.5, 88.1]);
    const water = Array.from({ length: 30 }, (_, i) => waterGoal(addDays(today, -i - 1)));
    const now = evaluateAchievements(base({ workouts, weights, water })).states;
    const later = evaluateAchievements(base({ workouts, weights, water, today: addDays(today, 200) })).states;
    const achievedNow = now.filter((s) => s.achieved).map((s) => s.def.id);
    const achievedLater = new Set(later.filter((s) => s.achieved).map((s) => s.def.id));
    for (const id of achievedNow) expect(achievedLater.has(id), id).toBe(true);
  });
});
