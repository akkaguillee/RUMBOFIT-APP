import type { GoalSnapshot } from '../achievements/metrics';
import { addDays, diffDays, toDateKey, weekdayIndex, type DateKey } from '../dates';
import { currentAge } from '../health';
import { activeDaySet, streakInfo } from '../streak';
import { muscleShort } from '../training/catalog';
import type {
  ActivityLevel,
  ActivityProfile,
  FoodHabits,
  GoalType,
  HealthFlag,
  MotivationProfile,
  PlanDay,
  Profile,
  StepsEntry,
  Units,
  WaterEntry,
  WeightEntry,
  Wellbeing,
  Workout,
} from '../types';
import { changeOverDays, goalDirection, goalProgress, slopePerWeek, sortWeights, type Direction } from '../weight';

export interface TipInputs {
  profile: Profile;
  weights: WeightEntry[];
  water: WaterEntry[];
  steps: StepsEntry[];
  workouts: Workout[];
  plan: PlanDay[];
  today: DateKey;
  /** Daily goals in force on past days (the current profile goals otherwise). */
  snapshots?: GoalSnapshot[];
}

/** Recent weight trend relative to the goal; `unknown` without enough records. */
export type WeightTrend = 'unknown' | 'stable' | 'favorable' | 'against' | 'drifting';

/**
 * Everything the tip rules may look at, derived only from real records and
 * the user's own answers. Missing data stays `null`/`undefined` (never a
 * made-up number), so the rules that need it simply don't apply.
 */
export interface TipContext {
  today: DateKey;
  units: Units;
  goal: GoalType;
  secondaryGoals: GoalType[];
  /** Weight direction of the goal: only for "lose" / "gain"; `none` otherwise. */
  direction: Direction;
  age?: number;
  minor: boolean;
  healthFlags: HealthFlag[];
  /** Minor or health flags: general wellbeing tips only, nothing about weight change. */
  gentle: boolean;
  /** Days since the profile was created. */
  daysSinceStart: number;
  records: {
    any: boolean;
    lastDate: DateKey | null;
    /** 0 when there is a record today. */
    daysSinceLast: number | null;
    /** Days between the last record before today and today. */
    gapBeforeToday: number | null;
    recordedToday: boolean;
    activeDaysLast7: number;
    totalActiveDays: number;
  };
  weight: {
    count: number;
    latestKg?: number;
    daysSinceWeighIn: number | null;
    /** Distinct days with a weigh-in in the last 7 days. */
    weighInsLast7: number;
    /** Change over roughly the last 14 days (kg), when there are records to compare. */
    change14: number | null;
    /** kg per week over the last 14 days, only with ≥ 3 records spanning ≥ 6 days. */
    slope14: number | null;
    trend: WeightTrend;
    /** Favorable but faster than a gradual pace. */
    fast: boolean;
    startKg?: number;
    goalKg?: number;
    progress: number | null;
    goalReached: boolean;
    /** While the goal is reached: days since the first weigh-in that reached it (so it is celebrated once, not every week). */
    reachedDaysAgo: number | null;
  };
  water: {
    todayMl: number;
    goalMl: number;
    /** Water logged at least once in the last 14 days. */
    tracking: boolean;
    goalDaysLast7: number;
  };
  steps: {
    today: number;
    goal: number;
    tracking: boolean;
    goalDaysLast7: number;
    /** Average of the days with steps in the last 7 days (≥ 3 such days), else null. */
    avgLast7: number | null;
  };
  training: {
    hasPlan: boolean;
    plannedToday: boolean;
    plannedLabel: string;
    plannedPerWeek: number;
    doneToday: boolean;
    activeSession: boolean;
    completedTotal: number;
    completedLast7: number;
    /** Consecutive days with a finished workout, ending today or yesterday. */
    consecutiveDays: number;
  };
  goalsToday: { met: number; total: number; allMet: boolean };
  streak: { current: number; longest: number; todayActive: boolean };
  activity: {
    level: ActivityLevel;
    posture?: ActivityProfile['posture'];
    job?: ActivityProfile['job'];
    trainingDaysPerWeek?: number;
    types: ActivityProfile['activityTypes'];
    experience?: ActivityProfile['experience'];
  };
  food: FoodHabits;
  motivation: MotivationProfile;
  wellbeing: Wellbeing;
  profileData: {
    hasHeight: boolean;
    hasAge: boolean;
    /** Days since the profile was last saved; null when unknown. */
    daysSinceUpdate: number | null;
    /** Answered (or chose to skip) at least one optional question: food, motivation or wellbeing. */
    personalised: boolean;
  };
}

const sumBy = <T>(items: T[], key: (item: T) => DateKey, value: (item: T) => number) => {
  const map = new Map<DateKey, number>();
  for (const item of items) map.set(key(item), (map.get(key(item)) ?? 0) + value(item));
  return map;
};

const answered = (o: object | undefined) => !!o && Object.values(o).some((v) => (Array.isArray(v) ? v.length > 0 : v !== undefined));

function runEndingAt(days: Set<DateKey>, today: DateKey): number {
  let n = 0;
  for (let d = days.has(today) ? today : addDays(today, -1); days.has(d); d = addDays(d, -1)) n += 1;
  return n;
}

export function buildTipContext(input: TipInputs): TipContext {
  const { profile, today } = input;
  // Future-dated records never count for "today".
  const weights = input.weights.filter((w) => w.date <= today);
  const water = input.water.filter((w) => w.date <= today);
  const steps = input.steps.filter((s) => s.date <= today);
  const workouts = input.workouts.filter((w) => w.date <= today);
  const last7 = addDays(today, -6);
  const last14 = addDays(today, -13);

  const age = currentAge(profile.age, profile.ageRecordedOn, today);
  const minor = age !== undefined && age < 18;
  const healthFlags = profile.healthFlags ?? [];
  const weightGoal = profile.goal === 'lose' || profile.goal === 'gain';
  const direction: Direction = weightGoal ? goalDirection(profile.goal, profile.startWeightKg, profile.goalWeightKg) : 'none';

  // ── Records of any kind (same definition as the streak) ──
  const active = activeDaySet({ weights, water, steps, workouts });
  const activeDays = [...active].sort();
  const lastDate = activeDays[activeDays.length - 1] ?? null;
  const before = activeDays.filter((d) => d < today);
  const previous = before[before.length - 1];
  const streak = streakInfo({ weights, water, steps, workouts }, today);

  // ── Weight ──
  const sorted = sortWeights(weights);
  const latest = sorted[sorted.length - 1];
  const recent = sorted.filter((w) => w.date >= last14);
  const span = recent.length > 1 ? diffDays(recent[0]!.date, recent[recent.length - 1]!.date) : 0;
  // Several weigh-ins on one day are not a trend: it takes three different days.
  const slope14 = new Set(recent.map((w) => w.date)).size >= 3 && span >= 6 ? slopePerWeek(recent) : null;
  let trend: WeightTrend = 'unknown';
  if (slope14 !== null) {
    if (Math.abs(slope14) < 0.1) trend = 'stable';
    else if (direction === 'none') trend = 'drifting';
    else trend = (direction === 'down') === (slope14 < 0) ? 'favorable' : 'against';
  }
  const fast = trend === 'favorable' && slope14 !== null && (direction === 'down' ? slope14 < -1 : slope14 > 0.5);
  const startKg = profile.startWeightKg;
  const goalKg = profile.goalWeightKg;
  const progressAt = (kg: number) => (weightGoal && startKg !== undefined && goalKg !== undefined ? goalProgress(startKg, kg, goalKg) : null);
  const progress = latest ? progressAt(latest.kg) : null;
  const goalReached = direction !== 'none' && progress !== null && progress >= 1;
  const firstReached = goalReached ? sorted.find((w) => (progressAt(w.kg) ?? 0) >= 1) : undefined;

  // ── Water and steps (goals as they were on each day) ──
  const snap = new Map((input.snapshots ?? []).map((s) => [s.date, s]));
  const waterGoalFor = (d: DateKey) => snap.get(d)?.waterGoalMl ?? profile.waterGoalMl;
  const stepsGoalFor = (d: DateKey) => snap.get(d)?.stepsGoal ?? profile.stepsGoal;
  const waterDays = sumBy(water, (w) => w.date, (w) => w.ml);
  const stepsDays = sumBy(
    steps.filter((s) => s.steps > 0),
    (s) => s.date,
    (s) => s.steps,
  );
  const inLast7 = ([d]: [DateKey, number]) => d >= last7;
  const waterToday = waterDays.get(today) ?? 0;
  const stepsToday = stepsDays.get(today) ?? 0;
  const stepsWeek = [...stepsDays].filter(inLast7);

  // ── Training ──
  const completed = workouts.filter((w) => w.status === 'completed');
  const doneToday = completed.some((w) => w.date === today);
  const hasPlan = input.plan.length > 0;
  const planDay = input.plan.find((p) => p.weekday === weekdayIndex(today));
  const plannedToday = hasPlan ? !!planDay && !planDay.rest : profile.trainingDays.includes(weekdayIndex(today));
  const plannedLabel = planDay && !planDay.rest ? planDay.label.trim() || planDay.muscleGroups.map(muscleShort).join(' · ') : '';

  const goalsTotal = 2 + (plannedToday ? 1 : 0);
  const goalsMet =
    (waterToday >= profile.waterGoalMl ? 1 : 0) + (stepsToday >= profile.stepsGoal ? 1 : 0) + (plannedToday && doneToday ? 1 : 0);

  const a = profile.activity;

  return {
    today,
    units: profile.units,
    goal: profile.goal,
    secondaryGoals: profile.secondaryGoals ?? [],
    direction,
    age,
    minor,
    healthFlags,
    gentle: minor || healthFlags.length > 0,
    daysSinceStart: Math.max(0, diffDays(profile.startDate, today)),
    records: {
      any: activeDays.length > 0,
      lastDate,
      daysSinceLast: lastDate ? diffDays(lastDate, today) : null,
      gapBeforeToday: previous ? diffDays(previous, today) : null,
      recordedToday: active.has(today),
      activeDaysLast7: activeDays.filter((d) => d >= last7).length,
      totalActiveDays: activeDays.length,
    },
    weight: {
      count: weights.length,
      latestKg: latest?.kg,
      daysSinceWeighIn: latest ? diffDays(latest.date, today) : null,
      weighInsLast7: new Set(weights.filter((w) => w.date >= last7).map((w) => w.date)).size,
      change14: changeOverDays(weights, 14, today)?.delta ?? null,
      slope14,
      trend,
      fast,
      startKg,
      goalKg,
      progress,
      goalReached,
      reachedDaysAgo: firstReached ? diffDays(firstReached.date, today) : null,
    },
    water: {
      todayMl: waterToday,
      goalMl: profile.waterGoalMl,
      tracking: [...waterDays.keys()].some((d) => d >= last14),
      goalDaysLast7: [...waterDays].filter(inLast7).filter(([d, ml]) => ml >= waterGoalFor(d)).length,
    },
    steps: {
      today: stepsToday,
      goal: profile.stepsGoal,
      tracking: [...stepsDays.keys()].some((d) => d >= last14),
      goalDaysLast7: stepsWeek.filter(([d, n]) => n >= stepsGoalFor(d)).length,
      avgLast7: stepsWeek.length >= 3 ? Math.round(stepsWeek.reduce((s, [, n]) => s + n, 0) / stepsWeek.length) : null,
    },
    training: {
      hasPlan,
      plannedToday,
      plannedLabel,
      plannedPerWeek: hasPlan ? input.plan.filter((p) => !p.rest).length : profile.trainingDays.length,
      doneToday,
      activeSession: input.workouts.some((w) => w.status === 'active'),
      completedTotal: completed.length,
      completedLast7: completed.filter((w) => w.date >= last7).length,
      consecutiveDays: runEndingAt(new Set(completed.map((w) => w.date)), today),
    },
    goalsToday: { met: goalsMet, total: goalsTotal, allMet: goalsMet === goalsTotal },
    streak: { current: streak.current, longest: streak.longest, todayActive: streak.todayActive },
    activity: {
      // The saved level wins: it is the estimate unless the user changed it by hand in Perfil.
      level: profile.activityLevel,
      posture: a?.posture,
      job: a?.job,
      trainingDaysPerWeek: a?.trainingDays,
      types: a?.activityTypes ?? [],
      experience: a?.experience,
    },
    food: profile.food ?? {},
    motivation: profile.motivation ?? {},
    wellbeing: profile.wellbeing ?? {},
    profileData: {
      hasHeight: profile.heightCm !== undefined,
      hasAge: age !== undefined,
      daysSinceUpdate: profile.updatedAt > 0 ? Math.max(0, diffDays(toDateKey(new Date(profile.updatedAt)), today)) : null,
      // Activity is asked of everyone during onboarding; only these groups are optional.
      personalised: answered(profile.food) || answered(profile.motivation) || answered(profile.wellbeing),
    },
  };
}
