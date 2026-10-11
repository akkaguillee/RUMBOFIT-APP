import { beforeEach, describe, expect, it } from 'vitest';
import { todayKey, addDays } from '@/domain/dates';
import { db } from './db';
import { createProfile, updateProfile } from './repos/profile';
import { addWater, addWeight, deleteWeight, setSteps, addSteps } from './repos/tracking';
import { exerciseEntry, finishWorkout, mutateExercises, startWorkout, getActiveWorkout } from './repos/training';
import { deleteAllData, exportAll, importAll, parseExport } from './repos/data';
import { syncAchievements } from './sync';

const today = todayKey();

async function seedProfile() {
  await createProfile({
    name: 'Guille',
    age: 28,
    sex: 'male',
    heightCm: 180,
    goal: 'lose',
    currentWeightKg: 85,
    startWeightKg: 90,
    goalWeightKg: 80,
    activityLevel: 'moderate',
    units: 'metric',
    startDate: addDays(today, -30),
    trainingDays: [0, 2, 4],
    waterGoalMl: 2000,
    stepsGoal: 8000,
  });
}

describe('repositories', () => {
  beforeEach(async () => {
    await deleteAllData();
  });

  it('creates the profile with real initial records', async () => {
    await seedProfile();
    const weights = await db.weights.toArray();
    expect(weights.map((w) => w.kg).sort()).toEqual([85, 90]);
    expect(await db.goals.count()).toBe(1);
    expect((await db.snapshots.get(today))?.waterGoalMl).toBe(2000);
  });

  it('rejects invalid values and future dates', async () => {
    await seedProfile();
    await expect(addWeight({ date: today, kg: 5 })).rejects.toThrow(/peso/i);
    await expect(addWeight({ date: addDays(today, 1), kg: 80 })).rejects.toThrow(/futuras/);
    await expect(addWater(today, 0)).rejects.toThrow();
  });

  it('syncs achievements from records and revokes when deleted', async () => {
    await seedProfile();
    await syncAchievements();
    let ids = (await db.achievements.toArray()).map((a) => a.id);
    expect(ids).toContain('first-rumbo');
    expect(ids).toContain('halfway');
    // Delete the current weight: progress falls back to 0 % and halfway is withdrawn.
    const current = (await db.weights.toArray()).find((w) => w.kg === 85)!;
    await deleteWeight(current.id!);
    await syncAchievements();
    ids = (await db.achievements.toArray()).map((a) => a.id);
    expect(ids).not.toContain('halfway');
    expect(ids).toContain('first-step');
  });

  it('keeps one steps total per day', async () => {
    await seedProfile();
    await setSteps(today, 3000);
    await addSteps(today, 2500);
    const rows = await db.steps.where('date').equals(today).toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.steps).toBe(5500);
  });

  it('runs a workout lifecycle keeping only completed sets', async () => {
    await seedProfile();
    const id = await startWorkout({ name: 'Pecho', exercises: [exerciseEntry('bench-press', [{ kg: 40, reps: 12 }, { kg: 45, reps: 10 }])] });
    expect((await getActiveWorkout())?.id).toBe(id);
    // A second start returns the same active session.
    expect(await startWorkout({ name: 'Otro' })).toBe(id);
    await mutateExercises(id, (exs) => {
      exs[0]!.sets[0]!.done = true;
      return exs;
    });
    const done = await finishWorkout(id, { rpe: 7 });
    expect(done.status).toBe('completed');
    expect(done.exercises[0]?.sets).toHaveLength(1);
    expect(done.muscleGroups).toContain('chest');
    expect(await getActiveWorkout()).toBeUndefined();
  });

  it('records goal history when the goal changes', async () => {
    await seedProfile();
    await updateProfile({ goalWeightKg: 78 });
    const goals = await db.goals.toArray();
    expect(goals).toHaveLength(2);
    expect(goals.filter((g) => !g.endDate)).toHaveLength(1);
  });

  it('exports and imports a full backup', async () => {
    await seedProfile();
    await addWater(today, 250);
    const file = parseExport(JSON.stringify(await exportAll()));
    await deleteAllData();
    expect(await db.profile.count()).toBe(0);
    await importAll(file);
    expect((await db.profile.get('me'))?.name).toBe('Guille');
    expect(await db.water.count()).toBe(1);
    expect(() => parseExport('{"format":"other"}')).toThrow();
  });
});
