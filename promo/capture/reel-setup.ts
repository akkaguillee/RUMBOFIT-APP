import { expect, type Page } from '@playwright/test';
import { dateKey, dismissCelebration } from '../../e2e/helpers';

async function advance(page: Page, name = 'Continuar') {
  const screen = page.locator('.onb__step');
  const before = await screen.getAttribute('data-screen');
  await page.getByRole('button', { name, exact: true }).click();
  await expect(screen).not.toHaveAttribute('data-screen', before ?? '');
  await expect(screen).toHaveCount(1);
}

/**
 * The reel's demo: a clearly fictitious profile («Alex», goal «Mejorar mi
 * constancia») and example records written through the app's own
 * repositories, with the clock at 9:40 so the home greets «Buenos días».
 */
export async function setupDemo(page: Page, opts: { welcome?: (page: Page) => Promise<void> } = {}) {
  // Morning light for the greeting; time keeps flowing normally from there.
  const now = new Date();
  now.setHours(9, 40, 0, 0);
  await page.clock.install({ time: now });
  await page.clock.resume();
  await page.addInitScript(() => {
    localStorage.setItem('rumbo.intro', 'off');
    // The video draws Rumbi itself; the floating assistant would duplicate it.
    if (!localStorage.getItem('rumbo.rumbi')) localStorage.setItem('rumbo.rumbi', JSON.stringify({ enabled: false, side: 'right', y: 0.78 }));
    if (!localStorage.getItem('rumbo.evolutionRange')) localStorage.setItem('rumbo.evolutionRange', '90d');
  });

  // ── Welcome screen (before any data) ─────────────────────────────────────
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Empezar', exact: true })).toBeVisible();
  await page.waitForTimeout(2500);
  if (opts.welcome) await opts.welcome(page);

  // ── Demo profile: «Alex», goal «Mejorar mi constancia» ───────────────────
  await advance(page, 'Empezar');
  await page.getByRole('textbox', { name: 'Nombre o alias' }).fill('Alex');
  await page.getByRole('textbox', { name: 'Edad' }).fill('29');
  await page.getByRole('textbox', { name: 'Altura' }).fill('172');
  await page.getByRole('textbox', { name: 'Peso actual' }).fill('70,4');
  await page.getByRole('radio', { name: 'Prefiero no indicarlo' }).click();
  await page.getByRole('button', { name: /Empezaste antes/ }).click();
  await page.getByRole('textbox', { name: 'Peso inicial' }).fill('71,2');
  await page.getByRole('textbox', { name: 'Fecha de inicio' }).fill(dateKey(-60));
  await advance(page);
  await page.getByRole('radio', { name: /Mejorar mi constancia/ }).click();
  await advance(page);
  await page.getByRole('radiogroup', { name: '¿Cómo pasas la mayor parte del día?' }).getByRole('radio', { name: /De pie/ }).click();
  await page.getByRole('radiogroup', { name: '¿Cuántos días entrenas a la semana?' }).getByRole('radio', { name: '3 días', exact: true }).click();
  await advance(page);
  await advance(page, 'Ahora no');
  await advance(page, 'Ahora no');
  await page.getByRole('checkbox', { name: /Entiendo que estos datos se guardan solo en este dispositivo/ }).check();
  await page.getByRole('button', { name: 'Crear mi RUMBO' }).click();
  await dismissCelebration(page);
  await expect(page.getByRole('heading', { name: /Alex/ })).toBeVisible();

  // ── Demo records (through the app's repositories) ────────────────────────
  const days = Array.from({ length: 70 }, (_, i) => dateKey(-i));
  await page.evaluate(async ({ days }) => {
    const t = await import('/src/db/repos/tracking.ts');
    const tr = await import('/src/db/repos/training.ts');
    // Weight: small ups and downs around the same value (not a transformation).
    const kg = [71.0, 71.3, 70.9, 71.1, 70.8, 71.0, 70.7, 70.9, 71.1, 70.8, 70.6, 70.9, 70.7, 70.5, 70.8, 70.6, 70.4, 70.7, 70.5];
    for (let k = 0, i = 57; i >= 3; i -= 3, k++) await t.addWeight({ date: days[i]!, kg: kg[k]!, time: '08:15' });
    // Water and steps every day for two weeks (a streak), today in progress.
    const water = [2100, 2400, 1900, 2300, 2500, 2200, 2000, 2450, 2300, 2600, 2150, 2400, 2350, 2500];
    const steps = [7400, 9200, 6800, 8600, 10100, 7900, 8300, 9800, 7600, 8900, 9400, 8100, 9600, 8700];
    for (let i = 14; i >= 1; i--) {
      await t.addWater(days[i]!, water[14 - i]!, '11:00');
      await t.setSteps(days[i]!, steps[14 - i]!);
    }
    await t.addWater(days[0]!, 500, '09:10');
    await t.addWater(days[0]!, 750, '12:40');
    await t.addWater(days[0]!, 500, '16:20');
    await t.setSteps(days[0]!, 6420);
    // Routines and a weekly plan (Tue / Thu / Sat; the app counts weekdays from Monday = 0).
    const torso = await tr.saveTemplate({
      name: 'Torso',
      muscleGroups: ['chest', 'back', 'shoulders'],
      exercises: [
        { exerciseId: 'bench-press', sets: 3, reps: 8, kg: 42.5, restSec: 90 },
        { exerciseId: 'lat-pulldown', sets: 3, reps: 10, kg: 40, restSec: 90 },
        { exerciseId: 'overhead-press', sets: 3, reps: 8, kg: 25, restSec: 90 },
      ],
    } as never);
    const pierna = await tr.saveTemplate({
      name: 'Pierna',
      muscleGroups: ['quads', 'hamstrings', 'glutes'],
      exercises: [
        { exerciseId: 'squat', sets: 3, reps: 8, kg: 50, restSec: 120 },
        { exerciseId: 'romanian-deadlift', sets: 3, reps: 10, kg: 40, restSec: 90 },
      ],
    } as never);
    const completo = await tr.saveTemplate({
      name: 'Cuerpo completo',
      muscleGroups: ['chest', 'back', 'quads'],
      exercises: [
        { exerciseId: 'deadlift', sets: 3, reps: 5, kg: 60, restSec: 120 },
        { exerciseId: 'bench-press', sets: 3, reps: 8, kg: 42.5, restSec: 90 },
      ],
    } as never);
    await tr.savePlan([
      { weekday: 1, label: 'Torso', muscleGroups: ['chest', 'back', 'shoulders'], templateId: torso, rest: false },
      { weekday: 3, label: 'Pierna', muscleGroups: ['quads', 'hamstrings', 'glutes'], templateId: pierna, rest: false },
      { weekday: 5, label: 'Cuerpo completo', muscleGroups: ['chest', 'back', 'quads'], templateId: completo, rest: false },
    ] as never);
    // Past sessions over five weeks, loads rising a little at times.
    const plan: [string, [string, number, number][]][] = [
      ['Torso', [['bench-press', 37.5, 8], ['lat-pulldown', 35, 10], ['overhead-press', 20, 8]]],
      ['Pierna', [['squat', 42.5, 8], ['romanian-deadlift', 35, 10]]],
      ['Cuerpo completo', [['deadlift', 50, 5], ['bench-press', 37.5, 8]]],
    ];
    let n = 0;
    for (let i = 34; i >= 1; i--) {
      const wd = new Date(`${days[i]}T12:00:00`).getDay();
      if (wd !== 2 && wd !== 4 && wd !== 6) continue; // Tue / Thu / Sat, as in the plan
      const [name, exs] = plan[wd === 2 ? 0 : wd === 4 ? 1 : 2]!;
      const step = Math.floor(n / 4) * 2.5;
      await tr.logPastWorkout({
        name,
        date: days[i]!,
        durationSec: 2700 + (n % 4) * 240,
        exercises: exs.map(([id, kg, reps]) => tr.exerciseEntry(id, [{ kg: kg + step, reps }, { kg: kg + step, reps }, { kg: kg + step, reps: reps - 1 }])),
        rpe: 7,
      } as never);
      n++;
    }
  }, { days });

}
