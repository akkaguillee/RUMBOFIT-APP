import type { DateKey } from './dates';

export type Sex = 'male' | 'female' | 'unspecified';
/** Figure drawn by the muscle map. */
export type BodyFigure = 'male' | 'female' | 'neutral';
export type Units = 'metric' | 'imperial';
export type GoalType = 'lose' | 'recomp' | 'maintain' | 'gain' | 'fitness' | 'strength' | 'habits' | 'consistency';
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
  /** Free text when the main goal is "Otro objetivo personal". */
  goalNote?: string;
  secondaryGoals?: GoalType[];
  activity?: ActivityProfile;
  food?: FoodHabits;
  motivation?: MotivationProfile;
  wellbeing?: Wellbeing;
  /** Choices saved from Progreso › Calorías › «Ajustar el cálculo». */
  energyPlan?: EnergyPlan;
  /** When the user agreed to store this information on the device. */
  consentAt?: number;
  /** Figure for the muscle map chosen in Perfil; when unset it follows `sex`. */
  bodyFigure?: BodyFigure;
  /** Profile photo picked by the user, as a small square JPEG data URL kept on the device. */
  photo?: string;
  createdAt: number;
  updatedAt: number;
}

export type HealthFlag = 'pregnancy' | 'eating_disorder' | 'medical_condition';

/**
 * Calorie target and macro split picked in «Ajustar el cálculo». The target only
 * applies while the goal it was picked for is still the profile goal.
 */
export interface EnergyPlan {
  targetId?: string;
  targetGoal?: GoalType;
  proteinPerKg: number;
  fatPct: number;
}

// ── Personalisation gathered in onboarding (all optional, editable in Perfil) ──
// "unsure" = «No lo sé / No estoy seguro»; "skip" = «Prefiero no responder».

export type DietType = 'omnivore' | 'flexitarian' | 'pescatarian' | 'vegetarian' | 'vegan';
export type Allergen = 'gluten' | 'lactose' | 'egg' | 'nuts' | 'peanut' | 'soy' | 'fish' | 'shellfish';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

/** Daily life and training, used to estimate the activity factor. */
export interface ActivityProfile {
  /** Most of the day: sitting, on your feet, or moving / carrying. */
  posture: 'sitting' | 'standing' | 'moving';
  job: 'desk' | 'standing' | 'physical' | 'student' | 'home' | 'none' | 'other';
  /** Training sessions per week (0–7). */
  trainingDays: number;
  activityTypes: ('strength' | 'cardio' | 'walking' | 'sports' | 'yoga' | 'other')[];
  experience?: ExperienceLevel;
}

export interface FoodHabits {
  improve?: 'yes' | 'a_bit' | 'no' | 'unsure';
  quality?: 'good' | 'irregular' | 'improvable' | 'unsure' | 'skip';
  pattern?: DietType | 'none' | 'unsure' | 'skip';
  /** Allergies, intolerances or important preferences (never treated as a diagnosis). */
  restrictions?: Allergen[];
  difficulties?: ('planning' | 'portions' | 'consistency' | 'choosing' | 'impulse')[];
  eatingOut?: 'rarely' | 'weekly' | 'several' | 'daily' | 'unsure';
  water?: 'low' | 'medium' | 'high' | 'unsure';
  schedule?: 'regular' | 'irregular' | 'skips' | 'late' | 'unsure' | 'skip';
}

export interface MotivationProfile {
  blockers?: ('time' | 'motivation' | 'results' | 'knowledge' | 'stress' | 'injury' | 'social' | 'other')[];
  hardest?: 'start' | 'consistency' | 'results' | 'unsure';
  /** Minutes a day the user can dedicate to looking after themselves. */
  dailyMinutes?: 10 | 20 | 30 | 45 | 60;
  dropReasons?: ('boredom' | 'no_results' | 'busy' | 'fatigue' | 'perfectionism' | 'other')[];
  motivators?: ('progress' | 'streaks' | 'tips' | 'challenges' | 'health' | 'routine')[];
  style?: 'small' | 'balanced' | 'challenging';
  firstFocus?: 'movement' | 'food' | 'sleep' | 'water' | 'consistency' | 'weight';
  /** Free answer for "Otro". */
  note?: string;
}

export interface Wellbeing {
  sleepHours?: 'lt6' | '6to7' | '7to8' | 'gt8' | 'skip';
  rest?: 'good' | 'ok' | 'poor' | 'skip';
  stress?: 'low' | 'medium' | 'high' | 'skip';
  regularSchedule?: 'yes' | 'sometimes' | 'no' | 'skip';
  improve?: ('sleep' | 'stress' | 'screens' | 'water' | 'movement' | 'routine')[];
}

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

/** Warm-up sets never count towards volume or personal records. */
export type SetKind = 'warmup' | 'normal' | 'drop' | 'failure';

export interface SetEntry {
  uid: string;
  /** Load in kg (for bodyweight exercises: added load, e.g. a weight belt). */
  kg?: number;
  reps?: number;
  durationSec?: number;
  distanceKm?: number;
  /** Defaults to 'normal' when absent (older records). */
  kind?: SetKind;
  /** Rate of perceived exertion, 6–10 in 0.5 steps. */
  rpe?: number;
  /** Cardio: average heart rate (bpm). */
  avgHr?: number;
  /** Cardio machines: incline (%) or resistance level. */
  level?: number;
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

// ── Food log ─────────────────────────────────────────────────────────────

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/**
 * Nutrients for an amount of food (or per 100 g when used as `per100`).
 * Energy and the three macronutrients are always present; saturated fat,
 * fiber and sugars only when the source provides them.
 */
export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  satFat?: number;
  fiber?: number;
  sugars?: number;
}

/** Where the values of a food come from. */
export type NutrientSource =
  | { kind: 'usda'; id: number; label: string; dataType: string }
  | { kind: 'off'; id: string; label: string }
  /** Typical values per 100 g estimated by the AI from food composition tables (not verified in a database). */
  | { kind: 'ai'; label: string }
  | { kind: 'manual' };

export interface MealItem {
  name: string;
  /** Amount eaten in grams (or millilitres for drinks), when known. */
  grams?: number;
  /** Drinks described per 100 ml. */
  unit?: 'ml';
  /** Values for the amount eaten. */
  nutrients: Nutrients;
  /** Values per 100 g when the source gives them, so the amount can be edited later. */
  per100?: Nutrients;
  source: NutrientSource;
  /** The amount was estimated from a photo, not weighed or read from a label. */
  estimated: boolean;
}

export interface MealEntry {
  id?: number;
  date: DateKey;
  time: string;
  meal: MealType;
  name: string;
  items: MealItem[];
  origin: 'photo' | 'barcode' | 'manual';
  createdAt: number;
  updatedAt: number;
}
