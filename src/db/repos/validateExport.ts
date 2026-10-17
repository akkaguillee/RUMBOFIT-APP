import { isProfilePhoto } from '@/domain/validation';
import type { TableName } from '../db';

/* Row-level validation for backups. A file that passes is safe to render:
   every field the screens read without a fallback is present and well typed. */

type Row = Record<string, unknown>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (v: unknown) => typeof v === 'string' && DATE.test(v);
const optDate = (v: unknown) => v === undefined || isDate(v);
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const optNum = (v: unknown) => v === undefined || v === null || num(v);
const str = (v: unknown) => typeof v === 'string';
const optStr = (v: unknown) => v === undefined || str(v);
const bool = (v: unknown) => typeof v === 'boolean';
const obj = (v: unknown): v is Row => typeof v === 'object' && v !== null && !Array.isArray(v);
const arrOf = (v: unknown, pred: (x: unknown) => boolean) => Array.isArray(v) && v.every(pred);
const oneOf =
  <T extends string>(...values: T[]) =>
  (v: unknown) =>
    values.includes(v as T);

const goal = oneOf('lose', 'recomp', 'maintain', 'gain', 'fitness', 'strength', 'habits', 'consistency');
const sex = oneOf('male', 'female', 'unspecified');
const bodyFigure = oneOf('male', 'female', 'neutral');
const activity = oneOf('sedentary', 'light', 'moderate', 'active', 'very_active');
const units = oneOf('metric', 'imperial');
const weekday = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 6;
const autoId = (v: unknown) => v === undefined || (Number.isInteger(v) && (v as number) > 0);

const setKind = oneOf('warmup', 'normal', 'drop', 'failure');
const set = (s: unknown) =>
  obj(s) &&
  str(s.uid) &&
  bool(s.done) &&
  optNum(s.kg) &&
  optNum(s.reps) &&
  optNum(s.durationSec) &&
  optNum(s.distanceKm) &&
  (s.kind === undefined || setKind(s.kind)) &&
  optNum(s.rpe) &&
  optNum(s.avgHr) &&
  optNum(s.level);

const goalList = oneOf('lose', 'recomp', 'maintain', 'gain', 'fitness', 'strength', 'habits', 'consistency');
/** Personalisation blocks are optional objects; their answers are free-form enums kept as given. */
const optObj = (v: unknown) => v === undefined || obj(v);
const activityProfile = (v: unknown) =>
  v === undefined || (obj(v) && str(v.posture) && str(v.job) && num(v.trainingDays) && arrOf(v.activityTypes, str));
const energyPlan = (v: unknown) =>
  v === undefined || (obj(v) && num(v.proteinPerKg) && num(v.fatPct) && optStr(v.targetId) && (v.targetGoal === undefined || goal(v.targetGoal)));
const nutrients = (n: unknown) =>
  obj(n) &&
  num(n.kcal) &&
  num(n.protein) &&
  num(n.carbs) &&
  num(n.fat) &&
  (n.satFat === undefined || num(n.satFat)) &&
  (n.fiber === undefined || num(n.fiber)) &&
  (n.sugars === undefined || num(n.sugars));
const nutrientSource = (v: unknown) => obj(v) && (v.kind === 'usda' || v.kind === 'off' || v.kind === 'ai' || v.kind === 'manual');
const mealItem = (i: unknown) =>
  obj(i) && str(i.name) && optNum(i.grams) && (i.unit === undefined || i.unit === 'ml') && nutrients(i.nutrients) && (i.per100 === undefined || nutrients(i.per100)) && nutrientSource(i.source) && bool(i.estimated);
const mealType = oneOf('breakfast', 'lunch', 'dinner', 'snack');
const mealOrigin = oneOf('photo', 'barcode', 'manual');
const workoutExercise = (e: unknown) => obj(e) && str(e.uid) && str(e.exerciseId) && num(e.restSec) && arrOf(e.sets, set);
const templateExercise = (e: unknown) => obj(e) && str(e.exerciseId) && num(e.sets) && num(e.restSec);

const ROW_CHECKS: Record<TableName, (r: Row) => boolean> = {
  profile: (r) =>
    r.id === 'me' &&
    str(r.name) &&
    goal(r.goal) &&
    sex(r.sex) &&
    activity(r.activityLevel) &&
    units(r.units) &&
    isDate(r.startDate) &&
    arrOf(r.trainingDays, weekday) &&
    num(r.waterGoalMl) &&
    num(r.stepsGoal) &&
    (r.healthFlags === undefined || arrOf(r.healthFlags, str)) &&
    optNum(r.age) &&
    optDate(r.ageRecordedOn) &&
    optNum(r.heightCm) &&
    optNum(r.startWeightKg) &&
    optNum(r.goalWeightKg) &&
    optStr(r.goalNote) &&
    (r.secondaryGoals === undefined || arrOf(r.secondaryGoals, goalList)) &&
    activityProfile(r.activity) &&
    optObj(r.food) &&
    optObj(r.motivation) &&
    optObj(r.wellbeing) &&
    energyPlan(r.energyPlan) &&
    optNum(r.consentAt) &&
    (r.bodyFigure === undefined || bodyFigure(r.bodyFigure)) &&
    (r.photo === undefined || isProfilePhoto(r.photo)) &&
    num(r.createdAt) &&
    num(r.updatedAt),
  goals: (r) => autoId(r.id) && goal(r.type) && isDate(r.startDate) && optDate(r.endDate) && bool(r.reached) && optNum(r.startWeightKg) && optNum(r.goalWeightKg),
  weights: (r) => autoId(r.id) && isDate(r.date) && num(r.kg) && optStr(r.time) && optStr(r.note) && num(r.createdAt) && num(r.updatedAt),
  water: (r) => autoId(r.id) && isDate(r.date) && num(r.ml) && str(r.time) && num(r.createdAt),
  steps: (r) => autoId(r.id) && isDate(r.date) && num(r.steps) && optNum(r.distanceKm) && num(r.updatedAt),
  notes: (r) => isDate(r.date) && str(r.text),
  bmi: (r) => autoId(r.id) && isDate(r.date) && num(r.kg) && num(r.heightCm) && num(r.bmi) && num(r.createdAt),
  energy: (r) => autoId(r.id) && isDate(r.date) && num(r.bmr) && num(r.tdee) && optNum(r.target) && obj(r.inputs) && num(r.inputs.kg) && num(r.createdAt),
  exercises: (r) => str(r.id) && str(r.name) && str(r.muscle) && str(r.measure) && str(r.equipment) && (r.secondary === undefined || arrOf(r.secondary, str)),
  workouts: (r) =>
    autoId(r.id) &&
    str(r.name) &&
    isDate(r.date) &&
    (r.status === 'active' || r.status === 'completed') &&
    arrOf(r.muscleGroups, str) &&
    arrOf(r.exercises, workoutExercise) &&
    num(r.startedAt) &&
    num(r.accumulatedSec) &&
    num(r.durationSec) &&
    optNum(r.runningSince) &&
    optNum(r.endedAt) &&
    optNum(r.restEndsAt),
  templates: (r) => autoId(r.id) && str(r.name) && arrOf(r.muscleGroups, str) && arrOf(r.exercises, templateExercise),
  plan: (r) => weekday(r.weekday) && str(r.label) && arrOf(r.muscleGroups, str) && bool(r.rest) && optNum(r.templateId),
  achievements: (r) => str(r.id) && num(r.unlockedAt) && bool(r.seen),
  snapshots: (r) => isDate(r.date) && num(r.waterGoalMl) && num(r.stepsGoal),
  settings: (r) => str(r.key),
  meals: (r) =>
    autoId(r.id) &&
    isDate(r.date) &&
    str(r.time) &&
    mealType(r.meal) &&
    str(r.name) &&
    arrOf(r.items, mealItem) &&
    mealOrigin(r.origin) &&
    num(r.createdAt) &&
    num(r.updatedAt),
};

/** Fields that must be unique within a table (primary keys and unique indexes). */
const UNIQUE: Partial<Record<TableName, string[]>> = {
  profile: ['id'],
  goals: ['id'],
  weights: ['id'],
  water: ['id'],
  steps: ['id', 'date'],
  notes: ['date'],
  bmi: ['id'],
  energy: ['id'],
  exercises: ['id'],
  workouts: ['id'],
  templates: ['id'],
  plan: ['weekday'],
  achievements: ['id'],
  snapshots: ['date'],
  settings: ['key'],
  meals: ['id'],
};

export const TABLE_LABELS: Record<TableName, string> = {
  profile: 'el perfil',
  goals: 'los objetivos',
  weights: 'los registros de peso',
  water: 'el agua',
  steps: 'los pasos',
  notes: 'las notas',
  bmi: 'el IMC',
  energy: 'las calorías',
  exercises: 'los ejercicios personalizados',
  workouts: 'los entrenamientos',
  templates: 'las plantillas',
  plan: 'el plan semanal',
  achievements: 'los hitos',
  snapshots: 'los objetivos diarios',
  settings: 'los ajustes',
  meals: 'las comidas',
};

/** Returns the first table with an invalid or duplicated row, or null if all rows are valid. */
export function findInvalidTable(tables: Partial<Record<TableName, unknown[]>>): TableName | null {
  for (const [name, rows] of Object.entries(tables) as [TableName, unknown[]][]) {
    const check = ROW_CHECKS[name];
    if (!rows.every((r) => obj(r) && check(r))) return name;
    for (const field of UNIQUE[name] ?? []) {
      const seen = new Set<unknown>();
      for (const r of rows as Row[]) {
        const v = r[field];
        if (v === undefined) continue;
        if (seen.has(v)) return name;
        seen.add(v);
      }
    }
  }
  return null;
}
