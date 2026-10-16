import { nowTime, todayKey, type DateKey } from '@/domain/dates';
import { goalProgress } from '@/domain/weight';
import type { ActivityLevel, ActivityProfile, FoodHabits, GoalType, HealthFlag, MotivationProfile, Profile, Sex, Units, Wellbeing } from '@/domain/types';
import { assertRange, assertText, isProfilePhoto, LIMITS, ValidationError } from '@/domain/validation';
import { db } from '../db';
import { scheduleSync } from '../sync';

export interface ProfileInput {
  name: string;
  age?: number;
  sex: Sex;
  heightCm?: number;
  goal: GoalType;
  currentWeightKg?: number;
  startWeightKg?: number;
  goalWeightKg?: number;
  activityLevel: ActivityLevel;
  units: Units;
  startDate: DateKey;
  trainingDays: number[];
  waterGoalMl: number;
  stepsGoal: number;
  healthFlags?: HealthFlag[];
  goalNote?: string;
  secondaryGoals?: GoalType[];
  activity?: ActivityProfile;
  food?: FoodHabits;
  motivation?: MotivationProfile;
  wellbeing?: Wellbeing;
  consentAt?: number;
}

function validate(input: ProfileInput) {
  assertText(input.name, 'El nombre', 40);
  if (input.age !== undefined) assertRange(input.age, LIMITS.age);
  if (input.heightCm !== undefined) assertRange(input.heightCm, LIMITS.heightCm);
  if (input.currentWeightKg !== undefined) assertRange(input.currentWeightKg, LIMITS.weightKg);
  if (input.startWeightKg !== undefined) assertRange(input.startWeightKg, LIMITS.weightKg);
  if (input.goalWeightKg !== undefined) assertRange(input.goalWeightKg, LIMITS.weightKg);
  assertRange(input.waterGoalMl, LIMITS.waterGoalMl);
  assertRange(input.stepsGoal, LIMITS.stepsGoal);
  if (input.startDate > todayKey()) throw new ValidationError('La fecha de inicio no puede estar en el futuro.');
}

export async function createProfile(input: ProfileInput): Promise<void> {
  validate(input);
  const now = Date.now();
  const today = todayKey();
  const start = input.startWeightKg ?? input.currentWeightKg;
  const profile: Profile = {
    id: 'me',
    name: input.name.trim(),
    age: input.age,
    ageRecordedOn: input.age !== undefined ? today : undefined,
    sex: input.sex,
    heightCm: input.heightCm,
    goal: input.goal,
    startWeightKg: start,
    goalWeightKg: input.goalWeightKg,
    activityLevel: input.activityLevel,
    units: input.units,
    startDate: input.startDate,
    trainingDays: [...input.trainingDays].sort(),
    waterGoalMl: input.waterGoalMl,
    stepsGoal: input.stepsGoal,
    healthFlags: input.healthFlags ?? [],
    ...(input.goalNote ? { goalNote: input.goalNote.trim().slice(0, 80) } : {}),
    ...(input.secondaryGoals?.length ? { secondaryGoals: input.secondaryGoals } : {}),
    ...(input.activity ? { activity: input.activity } : {}),
    ...(input.food ? { food: input.food } : {}),
    ...(input.motivation ? { motivation: input.motivation } : {}),
    ...(input.wellbeing ? { wellbeing: input.wellbeing } : {}),
    ...(input.consentAt ? { consentAt: input.consentAt } : {}),
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction('rw', [db.profile, db.goals, db.weights, db.snapshots], async () => {
    await db.profile.put(profile);
    await db.goals.add({
      type: input.goal,
      startWeightKg: start,
      goalWeightKg: input.goalWeightKg,
      startDate: input.startDate,
      reached: false,
    });
    // The initial weight is a real value given by the user for their start date.
    if (input.startWeightKg !== undefined && input.currentWeightKg !== undefined && input.startDate < today) {
      await db.weights.add({ date: input.startDate, kg: input.startWeightKg, note: 'Peso inicial', createdAt: now, updatedAt: now });
    }
    if (input.currentWeightKg !== undefined) {
      await db.weights.add({ date: today, time: nowTime(), kg: input.currentWeightKg, createdAt: now + 1, updatedAt: now + 1 });
    } else if (input.startWeightKg !== undefined) {
      await db.weights.add({ date: input.startDate, kg: input.startWeightKg, note: 'Peso inicial', createdAt: now, updatedAt: now });
    }
    await db.snapshots.put({ date: today, waterGoalMl: input.waterGoalMl, stepsGoal: input.stepsGoal });
  });
  scheduleSync();
}

export type ProfilePatch = Partial<Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * Updates the profile. Changing the goal closes the current goal record and
 * opens a new one, so achievements earned under the previous goal persist.
 */
export async function updateProfile(patch: ProfilePatch): Promise<void> {
  const current = await db.profile.get('me');
  if (!current) throw new ValidationError('No hay perfil creado.');
  const next: Profile = { ...current, ...patch, updatedAt: Date.now() };
  if (patch.name !== undefined) next.name = assertText(patch.name, 'El nombre', 40);
  if (patch.age !== undefined) {
    assertRange(patch.age, LIMITS.age);
    next.ageRecordedOn = todayKey();
  }
  if (patch.heightCm !== undefined) assertRange(patch.heightCm, LIMITS.heightCm);
  if (patch.goalWeightKg !== undefined) assertRange(patch.goalWeightKg, LIMITS.weightKg);
  if (patch.startWeightKg !== undefined) assertRange(patch.startWeightKg, LIMITS.weightKg);
  if (patch.waterGoalMl !== undefined) assertRange(patch.waterGoalMl, LIMITS.waterGoalMl);
  if (patch.stepsGoal !== undefined) assertRange(patch.stepsGoal, LIMITS.stepsGoal);
  if (patch.trainingDays) next.trainingDays = [...patch.trainingDays].sort();

  const goalChanged =
    next.goal !== current.goal ||
    next.goalWeightKg !== current.goalWeightKg ||
    next.startWeightKg !== current.startWeightKg;

  const today = todayKey();
  await db.transaction('rw', [db.profile, db.goals, db.snapshots, db.weights], async () => {
    if (goalChanged) {
      const open = (await db.goals.toArray()).filter((g) => !g.endDate);
      const weights = await db.weights.toArray();
      for (const g of open) {
        let reached = false;
        if (g.startWeightKg !== undefined && g.goalWeightKg !== undefined) {
          reached = weights.some((w) => w.date >= g.startDate && goalProgress(g.startWeightKg!, w.kg, g.goalWeightKg!)! >= 1);
        }
        await db.goals.update(g.id!, { endDate: today, reached });
      }
      await db.goals.add({
        type: next.goal,
        startWeightKg: next.startWeightKg,
        goalWeightKg: next.goalWeightKg,
        startDate: today,
        reached: false,
      });
    }
    await db.profile.put(next);
    if (patch.waterGoalMl !== undefined || patch.stepsGoal !== undefined) {
      await db.snapshots.put({ date: today, waterGoalMl: next.waterGoalMl, stepsGoal: next.stepsGoal });
    }
  });
  scheduleSync();
}

/** Sets or removes the profile photo. It stays in this device's database (and in backups the user exports). */
export async function setProfilePhoto(photo: string | undefined): Promise<void> {
  if (photo !== undefined && !isProfilePhoto(photo)) throw new ValidationError('La foto no es válida. Prueba con otra imagen.');
  await updateProfile({ photo });
}

/** Daily goals are snapshotted per day so later goal changes don't rewrite history. */
export async function ensureSnapshot(date: DateKey): Promise<void> {
  const existing = await db.snapshots.get(date);
  if (existing) return;
  const profile = await db.profile.get('me');
  if (!profile) return;
  await db.snapshots.put({ date, waterGoalMl: profile.waterGoalMl, stepsGoal: profile.stepsGoal });
}
