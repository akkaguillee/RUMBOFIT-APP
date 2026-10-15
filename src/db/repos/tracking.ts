import { calculateBmi, calculateEnergy, currentAge, type EnergyInput } from '@/domain/health';
import { isDateKey, nowTime, todayKey, type DateKey } from '@/domain/dates';
import type { ActivityLevel, BmiRecord, EnergyRecord, GoalType, Sex, WeightEntry } from '@/domain/types';
import { round } from '@/domain/units';
import { sortWeights } from '@/domain/weight';
import { assertRange, LIMITS, ValidationError } from '@/domain/validation';
import { db } from '../db';
import { scheduleSync } from '../sync';
import { ensureSnapshot, updateProfile } from './profile';

function assertDate(date: DateKey) {
  if (!isDateKey(date)) throw new ValidationError('La fecha no es válida.');
  if (date > todayKey()) throw new ValidationError('No puedes registrar datos en fechas futuras.');
}

const cleanNote = (note?: string) => {
  const n = note?.trim();
  if (n && n.length > 280) throw new ValidationError('La nota no puede superar 280 caracteres.');
  return n || undefined;
};

// ── Weight ─────────────────────────────────────────────────────────────

export interface WeightInput {
  date: DateKey;
  time?: string;
  kg: number;
  note?: string;
}

export async function addWeight(input: WeightInput): Promise<number> {
  assertDate(input.date);
  assertRange(input.kg, LIMITS.weightKg);
  const now = Date.now();
  const id = await db.weights.add({
    date: input.date,
    time: input.time || undefined,
    kg: round(input.kg, 2),
    note: cleanNote(input.note),
    createdAt: now,
    updatedAt: now,
  });
  scheduleSync();
  return id as number;
}

export async function updateWeight(id: number, input: WeightInput): Promise<void> {
  assertDate(input.date);
  assertRange(input.kg, LIMITS.weightKg);
  const patch: Partial<WeightEntry> = {
    date: input.date,
    time: input.time || undefined,
    kg: round(input.kg, 2),
    note: cleanNote(input.note),
    updatedAt: Date.now(),
  };
  await db.weights.update(id, patch);
  scheduleSync();
}

export async function deleteWeight(id: number): Promise<void> {
  await db.weights.delete(id);
  scheduleSync();
}

/** Same-day records, used to warn about possible duplicates before saving. */
export async function weightsOn(date: DateKey): Promise<WeightEntry[]> {
  return db.weights.where('date').equals(date).toArray();
}

// ── Water ──────────────────────────────────────────────────────────────

export async function addWater(date: DateKey, ml: number, time = nowTime()): Promise<number> {
  assertDate(date);
  assertRange(ml, LIMITS.waterMl);
  await ensureSnapshot(date);
  const id = await db.water.add({ date, ml: Math.round(ml), time, createdAt: Date.now() });
  scheduleSync();
  return id as number;
}

export async function updateWater(id: number, ml: number, time: string): Promise<void> {
  assertRange(ml, LIMITS.waterMl);
  await db.water.update(id, { ml: Math.round(ml), time });
  scheduleSync();
}

export async function deleteWater(id: number): Promise<void> {
  await db.water.delete(id);
  scheduleSync();
}

// ── Steps (one total per day) ──────────────────────────────────────────

export async function setSteps(date: DateKey, steps: number, distanceKm?: number): Promise<void> {
  assertDate(date);
  assertRange(steps, LIMITS.steps);
  if (distanceKm !== undefined) assertRange(distanceKm, LIMITS.distanceKm);
  await ensureSnapshot(date);
  const existing = await db.steps.where('date').equals(date).first();
  const record = { date, steps: Math.round(steps), distanceKm, updatedAt: Date.now() };
  if (existing?.id !== undefined) await db.steps.update(existing.id, record);
  else await db.steps.add(record);
  scheduleSync();
}

export async function addSteps(date: DateKey, steps: number): Promise<void> {
  const existing = await db.steps.where('date').equals(date).first();
  await setSteps(date, (existing?.steps ?? 0) + steps, existing?.distanceKm);
}

export async function deleteSteps(date: DateKey): Promise<void> {
  await db.steps.where('date').equals(date).delete();
  scheduleSync();
}

// ── Notes ──────────────────────────────────────────────────────────────

export async function setNote(date: DateKey, text: string): Promise<void> {
  assertDate(date);
  const t = text.trim();
  if (t.length > 1000) throw new ValidationError('La nota no puede superar 1000 caracteres.');
  if (!t) await db.notes.delete(date);
  else await db.notes.put({ date, text: t, updatedAt: Date.now() });
  scheduleSync();
}

// ── Calculators ────────────────────────────────────────────────────────

export async function saveBmi(kg: number, heightCm: number): Promise<BmiRecord> {
  assertRange(kg, LIMITS.weightKg);
  assertRange(heightCm, LIMITS.heightCm);
  const record: BmiRecord = { date: todayKey(), kg, heightCm, bmi: calculateBmi(kg, heightCm), createdAt: Date.now() };
  record.id = (await db.bmi.add(record)) as number;
  scheduleSync();
  return record;
}

export async function deleteBmi(id: number): Promise<void> {
  await db.bmi.delete(id);
  scheduleSync();
}

export async function saveEnergy(input: EnergyInput, target?: number): Promise<void> {
  const r = calculateEnergy(input);
  const record: EnergyRecord = {
    date: todayKey(),
    createdAt: Date.now(),
    inputs: {
      kg: input.kg,
      heightCm: input.heightCm,
      age: input.age,
      sex: input.sex,
      activityLevel: input.activityLevel,
      goal: input.goal,
    },
    bmr: r.bmr,
    tdee: r.tdee,
    target,
  };
  await db.energy.add(record);
  scheduleSync();
}

export interface CalculationInput {
  kg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activityLevel: ActivityLevel;
  goal: GoalType;
  /** Calorie target picked among the ones offered for `goal`. */
  targetId?: string;
  proteinPerKg: number;
  fatPct: number;
}

/**
 * Saves «Ajustar el cálculo» so every screen agrees with it: the data go to the
 * profile, a different weight becomes today's weight (today's latest record is
 * corrected instead of adding a duplicate), and the estimate joins the history.
 * All or nothing: one transaction.
 */
export async function applyCalculation(input: CalculationInput): Promise<void> {
  assertRange(input.kg, LIMITS.weightKg);
  assertRange(input.heightCm, LIMITS.heightCm);
  assertRange(input.age, LIMITS.age);
  if (!(input.proteinPerKg >= 0.8 && input.proteinPerKg <= 2.5)) throw new ValidationError('La proteína por kilo no es válida.');
  if (!(input.fatPct >= 15 && input.fatPct <= 45)) throw new ValidationError('El porcentaje de grasas no es válido.');
  const today = todayKey();
  const kg = round(input.kg, 2);

  await db.transaction('rw', [db.profile, db.goals, db.snapshots, db.weights, db.energy], async () => {
    const current = await db.profile.get('me');
    if (!current) throw new ValidationError('No hay perfil creado.');
    const energyInput: EnergyInput = {
      kg,
      heightCm: input.heightCm,
      age: input.age,
      sex: input.sex,
      activityLevel: input.activityLevel,
      goal: input.goal,
      healthFlags: current.healthFlags,
    };
    const result = calculateEnergy(energyInput);
    const target = result.targets.find((t) => t.id === input.targetId);

    const weights = await db.weights.toArray();
    const latest = sortWeights(weights.filter((w) => w.date <= today)).at(-1);
    if (!latest || Math.abs(latest.kg - kg) >= 0.01) {
      const last = sortWeights(weights.filter((w) => w.date === today)).at(-1);
      if (last?.id !== undefined) await db.weights.update(last.id, { kg, updatedAt: Date.now() });
      else await db.weights.add({ date: today, time: nowTime(), kg, createdAt: Date.now(), updatedAt: Date.now() });
    }

    await updateProfile({
      heightCm: input.heightCm,
      // Only when it changed: saving the same age must not reset the date it was recorded on.
      ...(input.age !== currentAge(current.age, current.ageRecordedOn, today) ? { age: input.age } : {}),
      sex: input.sex,
      activityLevel: input.activityLevel,
      goal: input.goal,
      energyPlan: {
        targetId: target?.id,
        targetGoal: target ? input.goal : undefined,
        proteinPerKg: input.proteinPerKg,
        fatPct: input.fatPct,
      },
    });

    const record: EnergyRecord = {
      date: today,
      createdAt: Date.now(),
      inputs: { kg, heightCm: input.heightCm, age: input.age, sex: input.sex, activityLevel: input.activityLevel, goal: input.goal },
      bmr: result.bmr,
      tdee: result.tdee,
      target: target?.kcal,
    };
    await db.energy.add(record);
  });
  scheduleSync();
}
