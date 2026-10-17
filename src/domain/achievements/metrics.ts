import { addDays, addMonths, diffDays, monthKey, startOfWeek, toDateKey, type DateKey } from '../dates';
import { RECOVERY_GROUPS } from '../training/catalog';
import { personalBestsIn, trainedMuscles, workoutVolume, type ExerciseResolver } from '../training/stats';
import type {
  BmiRecord,
  CustomExercise,
  DayNote,
  EnergyRecord,
  GoalRecord,
  MuscleGroup,
  PlanDay,
  Profile,
  StepsEntry,
  WaterEntry,
  WeightEntry,
  Workout,
  WorkoutTemplate,
} from '../types';
import { goalProgress, sortWeights } from '../weight';

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

  // ── Weekly regularity and sustained habits ──
  /** Longest run of consecutive weeks with records on at least 3 days. */
  activeWeeksRun3: number;
  /** Longest run of consecutive weeks with at least one weigh-in. */
  weighInWeeksRun: number;
  /** Longest window of consecutive weeks moving towards the weight goal at a gradual pace (finished weeks). */
  steadyProgressWeeks: number;
  /** After reaching a weight goal: longest run of finished weeks whose average stays within ±2 kg of it. */
  goalKeptWeeks: number;
  /** Maintenance goal: longest run of finished weeks with weigh-ins, all inside a 3 kg band. */
  maintainWeeksRun: number;
  /** Longest run of consecutive days meeting the water goal. */
  waterGoalStreak: number;
  /** Longest run of consecutive weeks meeting the water goal on at least 5 days. */
  waterWeeksRun5: number;
  /** Litres of water, each day counting at most that day's goal (drinking more never adds). */
  waterLitersCapped: number;
  maxWorkoutsInWeek: number;
  /** Days meeting both the water and the steps goal. */
  doubleGoalDays: number;
  /** Weeks with 5+ water-goal days, 5+ steps-goal days and 3+ workouts. */
  idealWeeks: number;
  idealWeeksRun: number;
  /** Longest run of finished weeks with 3–5 training days (so at least 2 rest days). */
  restfulWeeksRun: number;
  /** Longest run of consecutive weeks with a mobility or recovery exercise done. */
  recoveryWeeksRun: number;
  /** Completed workouts with at least one cardio exercise done. */
  cardioSessions: number;
  /** Kilometres logged in done cardio sets (one decimal). */
  cardioKm: number;
  /** How many of the 12 main muscle groups have been trained (exercises actually done). */
  majorMusclesTrained: number;
  /** Longest run of consecutive calendar months with at least one personal best. */
  prMonthsRun: number;
  /** Regular milestones currently achieved. Filled in by the engine; always 0 here. */
  milestonesAchieved: number;
}

/** The twelve main muscle groups of the muscle map (cardio, mobility, recovery and full body excluded). */
export const MAJOR_MUSCLES: MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'core',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'adductors',
];

/** Weight milestones never reward changing faster than this share of body weight per week. */
export const MAX_WEEKLY_PACE = 0.01;
/** Smallest net change of the weekly average that counts as getting closer to a weight goal. */
export const MIN_PROGRESS_KG = 0.5;
/** Band around the goal weight that counts as keeping it. */
export const KEEP_BAND_KG = 2;
/** Band that counts as a stable weight while maintaining. */
export const MAINTAIN_BAND_KG = 3;

// Weights are stored with up to two decimals: compare bands with a small tolerance.
const EPS = 1e-6;

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

/** Longest run of consecutive calendar months ("YYYY-MM") contained in `months`. */
export function longestMonthRun(months: Iterable<string>): number {
  const sorted = [...new Set(months)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const m of sorted) {
    run = prev && monthKey(addMonths(`${prev}-01`, 1)) === m ? run + 1 : 1;
    best = Math.max(best, run);
    prev = m;
  }
  return best;
}

interface WeekMean {
  week: DateKey;
  kg: number;
}

/** Average weight of every week (Monday key) with at least one weigh-in, in week order. */
function weeklyMeans(entries: Pick<WeightEntry, 'date' | 'kg'>[]): WeekMean[] {
  const sums = new Map<DateKey, { sum: number; n: number }>();
  for (const e of entries) {
    const week = startOfWeek(e.date);
    const s = sums.get(week) ?? { sum: 0, n: 0 };
    s.sum += e.kg;
    s.n += 1;
    sums.set(week, s);
  }
  return [...sums.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, { sum, n }]) => ({ week, kg: sum / n }));
}

/** Splits week-ordered items into runs of consecutive weeks. */
function weekRuns<T extends { week: DateKey }>(items: T[]): T[][] {
  const runs: T[][] = [];
  for (const it of items) {
    const last = runs[runs.length - 1];
    const prev = last?.[last.length - 1];
    if (last && prev && addDays(prev.week, 7) === it.week) last.push(it);
    else runs.push([it]);
  }
  return runs;
}

interface WeightGoalPeriod {
  from: DateKey;
  to: DateKey;
  startKg: number;
  goalKg: number;
  /** −1 when the goal is to lose weight, +1 to gain. */
  dir: 1 | -1;
  /** Kilograms between the start and the goal. */
  total: number;
}

/** Lose/gain goal periods with both weights set (the same periods the goal-progress milestones use). */
function weightGoalPeriods(goals: GoalRecord[], today: DateKey): WeightGoalPeriod[] {
  return goals.flatMap((g): WeightGoalPeriod[] => {
    if ((g.type !== 'lose' && g.type !== 'gain') || g.startWeightKg === undefined || g.goalWeightKg === undefined) return [];
    const total = Math.abs(g.goalWeightKg - g.startWeightKg);
    if (total < 0.05) return [];
    return [
      {
        from: g.startDate,
        to: g.endDate ?? today,
        startKg: g.startWeightKg,
        goalKg: g.goalWeightKg,
        dir: g.goalWeightKg < g.startWeightKg ? -1 : 1,
        total,
      },
    ];
  });
}

/** Periods in which the goal was to maintain weight. Without goal history, the profile goal applies. */
function maintainPeriods(goals: GoalRecord[], profile: Profile | undefined, today: DateKey): [DateKey, DateKey][] {
  if (!goals.length) return profile?.goal === 'maintain' ? [['0000-01-01', today]] : [];
  return goals.filter((g) => g.type === 'maintain').map((g): [DateKey, DateKey] => [g.startDate, g.endDate ?? today]);
}

/**
 * Longest window of consecutive weeks with weigh-ins in which the weekly average
 * ends at least {@link MIN_PROGRESS_KG} closer to the goal (or reaches it) and no
 * week moves towards the goal faster than {@link MAX_WEEKLY_PACE} of body weight.
 * A fast week splits the window: speed is never rewarded. Only finished weeks
 * count, so the average of the week in progress can't unlock and then withdraw it.
 */
export function steadyProgressWeeks(goals: GoalRecord[], weights: WeightEntry[], today: DateKey): number {
  const thisWeek = startOfWeek(today);
  let best = 0;
  for (const p of weightGoalPeriods(goals, today)) {
    // Kilograms covered towards the goal; going past the goal earns nothing extra.
    const covered = (kg: number) => Math.min(p.total, (kg - p.startKg) * p.dir);
    const means = weeklyMeans(weights.filter((w) => w.date >= p.from && w.date <= p.to && startOfWeek(w.date) < thisWeek));
    for (const run of weekRuns(means)) {
      let from = 0;
      for (let k = 1; k <= run.length; k++) {
        const tooFast = k < run.length && (run[k]!.kg - run[k - 1]!.kg) * p.dir > MAX_WEEKLY_PACE * run[k - 1]!.kg + EPS;
        if (k < run.length && !tooFast) continue;
        const segment = run.slice(from, k);
        for (let i = 0; i < segment.length; i++) {
          for (let j = segment.length - 1; j > i && j - i + 1 > best; j--) {
            const a = covered(segment[i]!.kg);
            const b = covered(segment[j]!.kg);
            if (b - a >= MIN_PROGRESS_KG - EPS || (b >= p.total - EPS && b > a)) {
              best = j - i + 1;
              break;
            }
          }
        }
        from = k;
      }
    }
  }
  return best;
}

/**
 * After the first weigh-in that reaches a weight goal: longest run of
 * consecutive finished weeks (from the following week) whose average weight
 * stays within {@link KEEP_BAND_KG} of that goal.
 */
export function goalKeptWeeks(goals: GoalRecord[], weights: WeightEntry[], today: DateKey): number {
  const thisWeek = startOfWeek(today);
  const sorted = sortWeights(weights.filter((w) => w.date <= today));
  let best = 0;
  for (const p of weightGoalPeriods(goals, today)) {
    const reached = sorted.find((w) => w.date >= p.from && w.date <= p.to && (goalProgress(p.startKg, w.kg, p.goalKg) ?? 0) >= 1);
    if (!reached) continue;
    const reachedWeek = startOfWeek(reached.date);
    const after = sorted.filter((w) => {
      const week = startOfWeek(w.date);
      return week > reachedWeek && week < thisWeek;
    });
    const kept = weeklyMeans(after).filter((m) => Math.abs(m.kg - p.goalKg) <= KEEP_BAND_KG + EPS);
    best = Math.max(best, longestWeekRun(kept.map((m) => m.week)));
  }
  return best;
}

/**
 * Maintenance goal: longest run of consecutive finished weeks with weigh-ins in
 * which every weigh-in stays inside a {@link MAINTAIN_BAND_KG} band.
 */
export function maintainWeeksRun(goals: GoalRecord[], profile: Profile | undefined, weights: WeightEntry[], today: DateKey): number {
  const thisWeek = startOfWeek(today);
  let best = 0;
  for (const [from, to] of maintainPeriods(goals, profile, today)) {
    const range = new Map<DateKey, { lo: number; hi: number }>();
    for (const w of weights) {
      if (w.date < from || w.date > to || w.date > today) continue;
      const week = startOfWeek(w.date);
      if (week >= thisWeek) continue;
      const r = range.get(week);
      range.set(week, r ? { lo: Math.min(r.lo, w.kg), hi: Math.max(r.hi, w.kg) } : { lo: w.kg, hi: w.kg });
    }
    const weeks = [...range.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, r]) => ({ week, ...r }));
    for (const run of weekRuns(weeks)) {
      for (let i = 0; i < run.length && run.length - i > best; i++) {
        let lo = Infinity;
        let hi = -Infinity;
        for (let j = i; j < run.length; j++) {
          lo = Math.min(lo, run[j]!.lo);
          hi = Math.max(hi, run[j]!.hi);
          if (hi - lo > MAINTAIN_BAND_KG + EPS) break;
          best = Math.max(best, j - i + 1);
        }
      }
    }
  }
  return best;
}

/**
 * «Equilibrio»: within a maintenance period, some weigh-in closes a 28-day
 * window with at least 4 weigh-ins inside a 3 kg band. Windows are anchored to
 * each weigh-in, so later records never undo a window that already qualified.
 */
function stableMaintainWindow(goals: GoalRecord[], profile: Profile | undefined, weights: WeightEntry[], today: DateKey): boolean {
  for (const [from, to] of maintainPeriods(goals, profile, today)) {
    const entries = sortWeights(weights.filter((w) => w.date >= from && w.date <= to && w.date <= today));
    for (let i = 3; i < entries.length; i++) {
      const since = addDays(entries[i]!.date, -27);
      let lo = Infinity;
      let hi = -Infinity;
      let n = 0;
      for (let j = i; j >= 0 && entries[j]!.date >= since; j--) {
        n += 1;
        lo = Math.min(lo, entries[j]!.kg);
        hi = Math.max(hi, entries[j]!.kg);
      }
      if (n >= 4 && hi - lo <= MAINTAIN_BAND_KG + EPS) return true;
    }
  }
  return false;
}

/** Primary muscles of the exercises that have at least one done set (planned groups don't count). */
function doneMuscles(w: Workout, resolve: ExerciseResolver): Set<MuscleGroup> {
  const set = new Set<MuscleGroup>();
  for (const ex of w.exercises) {
    if (!ex.sets.some((s) => s.done)) continue;
    const m = resolve(ex.exerciseId)?.muscle;
    if (m) set.add(m);
  }
  return set;
}

export function computeMetrics(data: AchievementData): Metrics {
  const { profile, today, resolve } = data;
  const completed = data.workouts.filter((w) => w.status === 'completed').sort((a, b) => a.startedAt - b.startedAt);
  const past = (d: DateKey) => d <= today;
  const thisWeek = startOfWeek(today);

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

  // Maintenance «Equilibrio». The original rule (last 28 days while the goal is
  // maintenance) is kept so nothing earned under it is withdrawn; a window that
  // qualified during any maintenance period now counts for good, so the
  // milestone no longer disappears (and comes back) as days go by.
  let maintainStable = 0;
  if (profile?.goal === 'maintain') {
    const recent = data.weights.filter((w) => w.date >= addDays(today, -27) && w.date <= today);
    const kgs = recent.map((w) => w.kg);
    if (recent.length >= 4 && Math.max(...kgs) - Math.min(...kgs) <= 3) maintainStable = 1;
  }
  if (!maintainStable && stableMaintainWindow(goals, profile, data.weights, today)) maintainStable = 1;

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

  // ── New metrics: only records up to today, and only what was actually done ──

  // Personal bests per session (same comparison as the «Fuerza» milestones).
  const prCounts = completed.map((w) => personalBestsIn(w, completed, resolve).length);
  const prMonths = new Set(completed.filter((w, i) => (prCounts[i] ?? 0) > 0 && past(w.date)).map((w) => monthKey(w.date)));

  const doneByWorkout = completed.filter((w) => past(w.date)).map((w) => ({ w, muscles: doneMuscles(w, resolve) }));
  const doneMuscleSet = new Set<MuscleGroup>();
  for (const { muscles: ms } of doneByWorkout) for (const m of ms) doneMuscleSet.add(m);
  const recoveryDoneWeeks = doneByWorkout
    .filter(({ muscles: ms }) => RECOVERY_GROUPS.some((g) => ms.has(g)))
    .map(({ w }) => startOfWeek(w.date));

  let cardioKm = 0;
  for (const { w } of doneByWorkout) {
    for (const ex of w.exercises) {
      if (resolve(ex.exerciseId)?.muscle !== 'cardio') continue;
      for (const s of ex.sets) if (s.done && (s.distanceKm ?? 0) > 0) cardioKm += s.distanceKm!;
    }
  }

  const waterGoalDaysPast = [...waterGoalDaysSet].filter(past).sort();
  let waterMlCapped = 0;
  for (const [d, ml] of waterTotals) if (past(d)) waterMlCapped += Math.min(ml, waterGoalFor(d));

  const idealWeekKeys = [...workoutsByWeek]
    .filter(([wk, n]) => wk <= thisWeek && n >= 3 && (waterGoalByWeek.get(wk) ?? 0) >= 5 && (stepsGoalByWeek.get(wk) ?? 0) >= 5)
    .map(([wk]) => wk);

  // Distinct training days per finished week: 3–5 leaves at least two rest days.
  const trainingDaysByWeek = countBy([...workoutDays].filter(past), startOfWeek);
  const restfulWeeks = [...trainingDaysByWeek].filter(([wk, n]) => wk < thisWeek && n >= 3 && n <= 5).map(([wk]) => wk);

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
    personalBests: prCounts.reduce((a, b) => a + b, 0),
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

    activeWeeksRun3: longestWeekRun([...activeByWeek].filter(([, n]) => n >= 3).map(([w]) => w)),
    weighInWeeksRun: longestWeekRun(data.weights.filter((w) => past(w.date)).map((w) => startOfWeek(w.date))),
    steadyProgressWeeks: steadyProgressWeeks(goals, data.weights, today),
    goalKeptWeeks: goalKeptWeeks(goals, data.weights, today),
    maintainWeeksRun: maintainWeeksRun(goals, profile, data.weights, today),
    waterGoalStreak: longestDayRun(waterGoalDaysPast),
    waterWeeksRun5: longestWeekRun(countByWeekAtLeast(waterGoalDaysPast, 5)),
    waterLitersCapped: Math.floor(waterMlCapped / 1000),
    maxWorkoutsInWeek: maxOf(countBy(completed.filter((w) => past(w.date)), (w) => startOfWeek(w.date)).values()),
    doubleGoalDays: waterGoalDaysPast.filter((d) => stepsGoalDaysSet.has(d)).length,
    idealWeeks: idealWeekKeys.length,
    idealWeeksRun: longestWeekRun(idealWeekKeys),
    restfulWeeksRun: longestWeekRun(restfulWeeks),
    recoveryWeeksRun: longestWeekRun(recoveryDoneWeeks),
    cardioSessions: doneByWorkout.filter(({ muscles: ms }) => ms.has('cardio')).length,
    cardioKm: Math.floor(cardioKm * 10 + EPS) / 10,
    majorMusclesTrained: MAJOR_MUSCLES.filter((m) => doneMuscleSet.has(m)).length,
    prMonthsRun: longestMonthRun(prMonths),
    milestonesAchieved: 0,
  };
}

/** Monday keys of the weeks that contain at least `min` of the given days. */
function countByWeekAtLeast(days: DateKey[], min: number): DateKey[] {
  return [...countBy(days, startOfWeek)].filter(([, n]) => n >= min).map(([w]) => w);
}
