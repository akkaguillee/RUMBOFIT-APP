import { beforeEach, describe, expect, it } from 'vitest';
import { todayKey, addDays } from '@/domain/dates';
import { db } from './db';
import { createProfile, setProfilePhoto, updateProfile } from './repos/profile';
import { addWater, addWeight, applyCalculation, deleteWeight, saveBmi, setNote, setSteps, addSteps } from './repos/tracking';
import { createExercise, exerciseEntry, finishWorkout, mutateExercises, startWorkout, getActiveWorkout, updateExercise } from './repos/training';
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

  it('saves «Ajustar el cálculo» to the profile, today\'s weight and the history', async () => {
    await seedProfile();
    const input = { kg: 84, heightCm: 182, age: 29, sex: 'male' as const, activityLevel: 'active' as const, goal: 'lose' as const, targetId: 'lose', proteinPerKg: 2, fatPct: 25 };
    await applyCalculation(input);
    const p = await db.profile.get('me');
    expect(p).toMatchObject({ heightCm: 182, age: 29, activityLevel: 'active', goal: 'lose', energyPlan: { targetId: 'lose', targetGoal: 'lose', proteinPerKg: 2, fatPct: 25 } });
    // Today already had a record (85 kg from the profile): it is corrected, not duplicated.
    let todays = await db.weights.where('date').equals(today).toArray();
    expect(todays.map((w) => w.kg)).toEqual([84]);
    expect(await db.energy.count()).toBe(1);
    // Same weight again: no new weight record.
    await applyCalculation({ ...input, activityLevel: 'moderate' });
    todays = await db.weights.where('date').equals(today).toArray();
    expect(todays).toHaveLength(1);
    expect(await db.energy.count()).toBe(2);
    await expect(applyCalculation({ ...input, heightCm: -5 })).rejects.toThrow(/altura/i);
    await expect(applyCalculation({ ...input, kg: Number.NaN })).rejects.toThrow(/peso/i);
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

  it('rejects backups with malformed rows before touching any data', async () => {
    await seedProfile();
    await setSteps(today, 4000);
    const good = await exportAll();
    const mutate = (fn: (t: Record<string, unknown[]>) => void) => {
      const copy = JSON.parse(JSON.stringify(good));
      fn(copy.tables);
      return JSON.stringify(copy);
    };
    expect(() => parseExport(mutate((t) => (t.profile = [{ id: 'me', name: 'Hack' }])))).toThrow(/perfil/);
    expect(() => parseExport(mutate((t) => (t.weights = [{ id: 5, kg: 80, createdAt: 5, updatedAt: 5 }])))).toThrow(/peso/);
    expect(() => parseExport(mutate((t) => t.steps!.push({ ...(t.steps![0] as object), id: 99 })))).toThrow(/pasos/);
    expect(() => parseExport(mutate((t) => (t.notes = [{ text: 'sin fecha' }])))).toThrow(/notas/);
    expect(() => parseExport(mutate((t) => (t.profile = [])))).toThrow(/perfil/);
    expect(parseExport(JSON.stringify(good)).tables.steps).toHaveLength(1);
  });

  it('keeps the map figure, the profile photo and custom secondary muscles in backups', async () => {
    await seedProfile();
    const photo = `data:image/jpeg;base64,${'QUJD'.repeat(64)}`;
    await updateProfile({ bodyFigure: 'female' });
    await setProfilePhoto(photo);
    // The main group is never repeated among the assisting ones.
    const id = await createExercise({ name: 'Remo en máquina X', muscle: 'back', secondary: ['biceps', 'back'], measure: 'weight_reps' });
    expect((await db.exercises.get(id))?.secondary).toEqual(['biceps']);
    const raw = JSON.stringify(await exportAll());
    await deleteAllData();
    await importAll(parseExport(raw));
    expect(await db.profile.get('me')).toMatchObject({ bodyFigure: 'female', photo });
    expect((await db.exercises.get(id))?.secondary).toEqual(['biceps']);
    // Clearing the assisting groups removes the field.
    await updateExercise(id, { name: 'Remo en máquina X', muscle: 'back', secondary: [], measure: 'weight_reps' });
    expect((await db.exercises.get(id))?.secondary).toBeUndefined();

    // Anything that is not a small inline image never gets in, from the app or from a file.
    const withProfile = (patch: Record<string, unknown>) => {
      const copy = JSON.parse(raw);
      Object.assign(copy.tables.profile[0], patch);
      return JSON.stringify(copy);
    };
    expect(() => parseExport(withProfile({ photo: 'javascript:alert(1)' }))).toThrow(/perfil/);
    expect(() => parseExport(withProfile({ photo: 'data:image/svg+xml;base64,PHN2Zz4=' }))).toThrow(/perfil/);
    expect(() => parseExport(withProfile({ bodyFigure: 'robot' }))).toThrow(/perfil/);
    await expect(setProfilePhoto('data:text/html;base64,PGI+')).rejects.toThrow(/foto/i);
    await setProfilePhoto(undefined);
    expect((await db.profile.get('me'))?.photo).toBeUndefined();
  });

  it('accepts a real backup with workouts, notes and calculators', async () => {
    await seedProfile();
    await addWeight({ date: today, kg: 84.6, note: 'Mañana' });
    await addWater(today, 330);
    await setSteps(today, 9000, 6.2);
    await setNote(today, 'Buen día');
    await saveBmi(84.6, 180);
    const id = await startWorkout({ name: 'Pecho', exercises: [exerciseEntry('bench-press', [{ kg: 40, reps: 12 }])] });
    await mutateExercises(id, (exs) => {
      exs[0]!.sets[0]!.done = true;
      return exs;
    });
    await finishWorkout(id, { rpe: 7 });
    await syncAchievements();
    const file = parseExport(JSON.stringify(await exportAll()));
    expect(file.tables.workouts).toHaveLength(1);
    expect(file.tables.bmi).toHaveLength(1);
  });
});
