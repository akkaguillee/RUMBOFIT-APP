import { addDays, diffDays, monthKey, startOfWeek, toDateKey, type DateKey } from '../dates';
import { RECOVERY_GROUPS } from '../training/catalog';
import { countPersonalBests, trainedMuscles, workoutVolume, type ExerciseResolver } from '../training/stats';
import type {
  BmiRecord,
  CustomExercise,
  DayNote,
  EnergyRecord,
  GoalRecord,
  PlanDay,
  Profile,
  StepsEntry,
  WaterEntry,
  WeightEntry,
  Workout,
  WorkoutTemplate,
} from '../types';
import { goalProgress } from '../weight';

export interface GoalSnapshot {
  date: DateKey;
  waterGoalMl: number;
  stepsGoal: number;
}

export interface AchievementData {
  today: DateKey;
  profile?: Profile;
  goals: GoalRecord[];
  weights: WeightEntry[];
  water: WaterEntry[];
  steps: StepsEntry[];
  workouts: Workout[];
  templates: WorkoutTemplate[];
  plan: PlanDay[];
  customExercises: CustomExercise[];
  notes: DayNote[];
  bmi: BmiRecord[];
  energy: EnergyRecord[];
  snapshots: GoalSnapshot[];
  resolve: ExerciseResolver;
}

export interface Metrics {
  profileComplete: number;
  goalConfigured: number;
  activeDays: number;
  firstFullTrackingDay: number;
  activityRecords: number;
  maxActiveDaysInWeek: number;
  bestMonthActiveDays: number;
  habitWeeksRun: number;
  comebacks: number;
  habitRecovered: number;
  currentStreak: number;
  longestStreak: number;
  weightDays: number;
  weightEntries: number;
  bestMonthWeighIns: number;
  maxGoalProgressPct: number;
  newStageAfterGoal: number;
  maintainStable: number;
  waterDays: number;
  waterGoalDays: number;
  maxWaterGoalDaysInWeek: number;
  bestMonthWaterGoalDays: number;
  totalWaterLiters: number;
  stepsDays: number;
  stepsGoalDays: number;
  stepsWeeksRun: number;
  bestMonthStepsGoalDays: number;
  totalSteps: number;
  workoutsCompleted: number;
  workoutWeeksRun2: number;
  workoutWeeksRun3: number;
  musclesTrained: number;
  templateWorkouts: number;
  workoutComebacks: number;
  trainingHours: number;
  personalBests: number;
  totalVolumeKg: number;
  maxSetsInSession: number;
  recoverySessions: number;
  balancedWeeks: number;
  bestMonthWorkouts: number;
  planConfigured: number;
  templates: number;
  customExercises: number;
  notes: number;
  bmiRecords: number;
  energyRecords: number;
  fullDays: number;
  bestMonthGoalDays: number;
  activeMonths: number;
  weeksWith3ActiveDays: number;
  featuresUsed: number;
}

const maxOf = (values: Iterable<number>) => {
  let m = 0;
  for (const v of values) m = Math.max(m, v);
  return m;
};

function countBy<T>(items: Iterable<T>, key: (t: T) => string): Map<string, number> {
  const map = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

/** Longest run of consecutive weeks (Monday keys) contained in `weeks`. */
export function longestWeekRun(weeks: Iterable<DateKey>): number {
  const sorted = [...new Set(weeks)].sort();
  let best = 0;
  let run = 0;
  let prev: DateKey | null = null;
  for (const w of sorted) {
    run = prev && addDays(prev, 7) === w ? run + 1 : 1;
    best = Math.max(best, run);
    prev = w;
  }
  return best;
}

export function longestDayRun(sortedDays: DateKey[]): number {
  let best = 0;
  let run = 0;
  let prev: DateKey | null = null;
  for (const d of sortedDays) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export function computeMetrics(data: AchievementData): Metrics {
  const { profile, today, resolve } = data;
  const completed = data.workouts.filter((w) => w.status === 'completed').sort((a, b) => a.startedAt - b.startedAt);

  // Daily goals in force on each date (falls back to the current profile goals).
  const snap = new Map(data.snapshots.map((s) => [s.date, s]));
  const waterGoalFor = (d: DateKey) => snap.get(d)?.waterGoalMl ?? profile?.waterGoalMl ?? 2000;
  const stepsGoalFor = (d: DateKey) => snap.get(d)?.stepsGoal ?? profile?.stepsGoal ?? 8000;

  const waterTotals = new Map<DateKey, number>();
  for (const w of data.water) waterTotals.set(w.date, (waterTotals.get(w.date) ?? 0) + w.ml);
  const stepsTotals = new Map<DateKey, number>();
  for (const s of data.steps) if (s.steps > 0) stepsTotals.set(s.date, (stepsTotals.get(s.date) ?? 0) + s.steps);

  const weightDaysSet = new Set(data.weights.map((w) => w.date));
  const workoutDays = new Set(completed.map((w) => w.date));
  const waterGoalDaysSet = new Set([...waterTotals].filter(([d, ml]) => ml >= waterGoalFor(d)).map(([d]) => d));
  const stepsGoalDaysSet = new Set([...stepsTotals].filter(([d, n]) => n >= stepsGoalFor(d)).map(([d]) => d));

  const activeSet = new Set<DateKey>([...weightDaysSet, ...waterTotals.keys(), ...stepsTotals.keys(), ...workoutDays]);
  const activeDays = [...activeSet].filter((d) => d <= today).sort();

  // Tracking types per day (for "first full day").
  const typesPerDay = new Map<DateKey, number>();
  for (const set of [weightDaysSet, new Set(waterTotals.keys()), new Set(stepsTotals.keys()), workoutDays]) {
    for (const d of set) typesPerDay.set(d, (typesPerDay.get(d) ?? 0) + 1);
  }

  const goalDays = new Set<DateKey>([...waterGoalDaysSet, ...stepsGoalDaysSet, ...workoutDays]);
  const fullDays = [...waterGoalDaysSet].filter((d) => stepsGoalDaysSet.has(d) && workoutDays.has(d)).length;

  const activeByWeek = countBy(activeDays, startOfWeek);
  const goalDaysByWeek = countBy(goalDays, startOfWeek);
  const waterGoalByWeek = countBy(waterGoalDaysSet, startOfWeek);
  const stepsGoalByWeek = countBy(stepsGoalDaysSet, startOfWeek);
  const workoutsByWeek = countBy(completed, (w) => startOfWeek(w.date));

  // Comebacks: a new record after 7+ days without any. Only gaps that happen
  // while the user already used RUMBO count (backfilled history doesn't).
  const joined = profile ? toDateKey(new Date(profile.createdAt)) : today;
  let comebacks = 0;
  let habitRecovered = 0;
  for (let i = 1; i < activeDays.length; i++) {
    if ((activeDays[i - 1] as DateKey) < joined) continue;
    const gap = diffDays(activeDays[i - 1] as DateKey, activeDays[i] as DateKey);
    if (gap >= 8) {
      comebacks += 1;
      const after = activeDays.slice(i);
      if (longestDayRun(after.slice(0, 7)) >= 7) habitRecovered += 1;
    }
  }

  let workoutComebacks = 0;
  const wDays = [...workoutDays].sort();
  for (let i = 1; i < wDays.length; i++) {
    if ((wDays[i - 1] as DateKey) < joined) continue;
    if (diffDays(wDays[i - 1] as DateKey, wDays[i] as DateKey) >= 15) workoutComebacks += 1;
  }

  // Current streak (today or ending yesterday).
  let currentStreak = 0;
  {
    let d = activeSet.has(today) ? today : addDays(today, -1);
    while (activeSet.has(d)) {
      currentStreak += 1;
      d = addDays(d, -1);
    }
  }

  // Weight goal progress, evaluated per goal period so changing a goal never erases past progress.
  const goals = [...data.goals].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const progressByGoal = goals.map((g) => {
    if (!['lose', 'gain'].includes(g.type) || g.startWeightKg === undefined || g.goalWeightKg === undefined) return 0;
    const end = g.endDate ?? today;
    let best = 0;
    for (const w of data.weights) {
      if (w.date < g.startDate || w.date > end) continue;
      const p = goalProgress(g.startWeightKg, w.kg, g.goalWeightKg);
      if (p !== null) best = Math.max(best, p);
    }
    return best;
  });
  const maxGoalProgressPct = Math.floor(maxOf(progressByGoal.map((p) => p * 100)));
  const newStageAfterGoal = progressByGoal.some((p, i) => p >= 1 && i < goals.length - 1) ? 1 : 0;

  // Maintenance: last 28 days with ≥4 weigh-ins inside a 3 kg band.
  let maintainStable = 0;
  if (profile?.goal === 'maintain') {
    const recent = data.weights.filter((w) => w.date >= addDays(today, -27) && w.date <= today);
    const kgs = recent.map((w) => w.kg);
    if (recent.length >= 4 && Math.max(...kgs) - Math.min(...kgs) <= 3) maintainStable = 1;
  }

  const recoverySessions = completed.filter((w) =>
    trainedMuscles(w, resolve).some((m) => RECOVERY_GROUPS.includes(m)),
  ).length;
  const recoveryWeeks = new Set(
    completed.filter((w) => trainedMuscles(w, resolve).some((m) => RECOVERY_GROUPS.includes(m))).map((w) => startOfWeek(w.date)),
  );
  const balancedWeeks = [...workoutsByWeek].filter(([wk, n]) => n >= 3 && recoveryWeeks.has(wk)).length;

  const muscles = new Set<string>();
  for (const w of completed) for (const m of trainedMuscles(w, resolve)) muscles.add(m);

  const monthCount = (days: Iterable<DateKey>) => maxOf(countBy(days, monthKey).values());

  const usedFeatures = [
    data.weights.length > 0,
    data.water.length > 0,
    stepsTotals.size > 0,
    completed.length > 0,
    data.notes.length > 0,
    data.bmi.length > 0,
    data.energy.length > 0,
  ].filter(Boolean).length;

  const profileComplete =
    profile && profile.name && profile.heightCm && profile.age && profile.startWeightKg !== undefined ? 1 : 0;
  const goalConfigured = profile
    ? ['lose', 'gain'].includes(profile.goal)
      ? profile.goalWeightKg !== undefined
        ? 1
        : 0
      : 1
    : 0;

  return {
    profileComplete,
    goalConfigured,
    activeDays: activeDays.length,
    firstFullTrackingDay: maxOf(typesPerDay.values()) >= 2 ? 1 : 0,
    activityRecords: stepsTotals.size + completed.length,
    maxActiveDaysInWeek: maxOf(activeByWeek.values()),
    bestMonthActiveDays: monthCount(activeDays),
    habitWeeksRun: longestWeekRun([...goalDaysByWeek].filter(([, n]) => n >= 4).map(([w]) => w)),
    comebacks,
    habitRecovered,
    currentStreak,
    longestStreak: longestDayRun(activeDays),
    weightDays: weightDaysSet.size,
    weightEntries: data.weights.length,
    bestMonthWeighIns: monthCount(data.weights.map((w) => w.date)),
    maxGoalProgressPct,
    newStageAfterGoal,
    maintainStable,
    waterDays: waterTotals.size,
    waterGoalDays: waterGoalDaysSet.size,
    maxWaterGoalDaysInWeek: maxOf(waterGoalByWeek.values()),
    bestMonthWaterGoalDays: monthCount(waterGoalDaysSet),
    totalWaterLiters: Math.floor([...waterTotals.values()].reduce((a, b) => a + b, 0) / 1000),
    stepsDays: stepsTotals.size,
    stepsGoalDays: stepsGoalDaysSet.size,
    stepsWeeksRun: longestWeekRun([...stepsGoalByWeek].filter(([, n]) => n >= 4).map(([w]) => w)),
    bestMonthStepsGoalDays: monthCount(stepsGoalDaysSet),
    totalSteps: [...stepsTotals.values()].reduce((a, b) => a + b, 0),
    workoutsCompleted: completed.length,
    workoutWeeksRun2: longestWeekRun([...workoutsByWeek].filter(([, n]) => n >= 2).map(([w]) => w)),
    workoutWeeksRun3: longestWeekRun([...workoutsByWeek].filter(([, n]) => n >= 3).map(([w]) => w)),
    musclesTrained: [...muscles].filter((m) => !['cardio', 'mobility', 'recovery'].includes(m)).length,
    templateWorkouts: completed.filter((w) => w.templateId !== undefined).length,
    workoutComebacks,
    trainingHours: Math.floor(completed.reduce((a, w) => a + w.durationSec, 0) / 3600),
    personalBests: countPersonalBests(completed, resolve),
    totalVolumeKg: completed.reduce((a, w) => a + workoutVolume(w, resolve), 0),
    maxSetsInSession: maxOf(completed.map((w) => w.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0))),
    recoverySessions,
    balancedWeeks,
    bestMonthWorkouts: monthCount(completed.map((w) => w.date)),
    planConfigured: data.plan.some((p) => p.rest || p.muscleGroups.length > 0 || p.templateId !== undefined) ? 1 : 0,
    templates: data.templates.length,
    customExercises: data.customExercises.length,
    notes: data.notes.filter((n) => n.text.trim()).length,
    bmiRecords: data.bmi.length,
    energyRecords: data.energy.length,
    fullDays,
    bestMonthGoalDays: monthCount(goalDays),
    activeMonths: new Set(activeDays.map(monthKey)).size,
    weeksWith3ActiveDays: [...activeByWeek.values()].filter((n) => n >= 3).length,
    featuresUsed: usedFeatures,
  };
}
