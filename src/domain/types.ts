import type { DateKey } from './dates';

export type Sex = 'male' | 'female' | 'unspecified';
export type Units = 'metric' | 'imperial';
export type GoalType = 'lose' | 'maintain' | 'gain' | 'fitness' | 'strength' | 'habits';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export interface Profile {
  id: 'me';
  name: string;
  /** Age as entered by the user on `ageRecordedOn`. */
  age?: number;
  ageRecordedOn?: DateKey;
  sex: Sex;
  heightCm?: number;
  goal: GoalType;
  /** Weight at the beginning of the current goal. */
  startWeightKg?: number;
  goalWeightKg?: number;
  activityLevel: ActivityLevel;
  units: Units;
  startDate: DateKey;
  /** Monday-based weekday indexes the user can usually train. */
  trainingDays: number[];
  waterGoalMl: number;
  stepsGoal: number;
  /** Health flags that make standard calorie targets inappropriate. */
  healthFlags: HealthFlag[];
  createdAt: number;
  updatedAt: number;
}

export type HealthFlag = 'pregnancy' | 'eating_disorder' | 'medical_condition';

export interface GoalRecord {
  id?: number;
  type: GoalType;
  startWeightKg?: number;
  goalWeightKg?: number;
  startDate: DateKey;
  endDate?: DateKey;
  reached: boolean;
}

export interface WeightEntry {
  id?: number;
  date: DateKey;
  time?: string;
  kg: number;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WaterEntry {
  id?: number;
  date: DateKey;
  time: string;
  ml: number;
  createdAt: number;
}

export interface StepsEntry {
  id?: number;
  date: DateKey;
  steps: number;
  /** Distance typed by the user (real), if any. */
  distanceKm?: number;
  updatedAt: number;
}

export interface DayNote {
  date: DateKey;
  text: string;
  updatedAt: number;
}

export interface BmiRecord {
  id?: number;
  date: DateKey;
  kg: number;
  heightCm: number;
  bmi: number;
  createdAt: number;
}

export interface EnergyRecord {
  id?: number;
  date: DateKey;
  createdAt: number;
  inputs: {
    kg: number;
    heightCm: number;
    age: number;
    sex: Sex;
    activityLevel: ActivityLevel;
    goal: GoalType;
  };
  bmr: number;
  tdee: number;
  target?: number;
}

// ── Training ───────────────────────────────────────────────────────────

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'core'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'adductors'
  | 'full_body'
  | 'cardio'
  | 'mobility'
  | 'recovery';

export type ExerciseMeasure = 'weight_reps' | 'reps' | 'time' | 'distance_time';

export interface Exercise {
  id: string;
  name: string;
  muscle: MuscleGroup;
  secondary?: MuscleGroup[];
  equipment: string;
  measure: ExerciseMeasure;
  tip?: string;
  caution?: string;
  custom?: boolean;
}

export interface CustomExercise extends Exercise {
  custom: true;
  createdAt: number;
}

export interface SetEntry {
  uid: string;
  kg?: number;
  reps?: number;
  durationSec?: number;
  distanceKm?: number;
  done: boolean;
  completedAt?: number;
}

export interface WorkoutExercise {
  uid: string;
  exerciseId: string;
  restSec: number;
  notes?: string;
  sets: SetEntry[];
}

export interface Workout {
  id?: number;
  name: string;
  date: DateKey;
  time?: string;
  status: 'active' | 'completed';
  templateId?: number;
  muscleGroups: MuscleGroup[];
  exercises: WorkoutExercise[];
  /** Wall-clock based timer, so it keeps running when the app is closed. */
  startedAt: number;
  runningSince?: number;
  accumulatedSec: number;
  endedAt?: number;
  durationSec: number;
  restEndsAt?: number;
  restTotalSec?: number;
  rpe?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TemplateExercise {
  exerciseId: string;
  sets: number;
  reps?: number;
  kg?: number;
  durationSec?: number;
  restSec: number;
}

export interface WorkoutTemplate {
  id?: number;
  name: string;
  muscleGroups: MuscleGroup[];
  exercises: TemplateExercise[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PlanDay {
  weekday: number;
  label: string;
  muscleGroups: MuscleGroup[];
  templateId?: number;
  rest: boolean;
}

// ── Achievements ───────────────────────────────────────────────────────

export interface AchievementUnlock {
  id: string;
  unlockedAt: number;
  seen: boolean;
}

export interface Setting<T = unknown> {
  key: string;
  value: T;
}
