import { describe, expect, it } from 'vitest';
import { addDays } from '../dates';
import type { Profile } from '../types';
import type { TipContext, TipInputs } from './context';
import { ctxFor, lastDays, planDay, profile, steps, TODAY, water, weight, workout } from './fixtures';
import { RULES } from './rules';
import { containsForbidden, FORBIDDEN_TERMS, isSafeTip, mentionsWeightChange } from './safety';
import { ruleSource } from './source';
import { TIP_ROUTES, type TipCandidate } from './types';

const yesterday = addDays(TODAY, -1);

/** Situations from real data: every rule should apply in at least one of them. */
const DATA: Record<string, Partial<TipInputs>> = {
  empty: {},
  away: { water: [water(addDays(TODAY, -5), 250)] },
  back: { water: [water(addDays(TODAY, -5), 250), water(TODAY, 250)] },
  missedYesterday: { water: [water(addDays(TODAY, -2), 250)] },
  goalReached: { weights: [weight(addDays(TODAY, -20), 90), weight(yesterday, 79.8)] },
  pastGoal: { weights: lastDays(14).map((d, i) => weight(d, 79.8 - i * 0.05)) },
  allGoals: { water: [water(TODAY, 2000)], steps: [steps(TODAY, 9000)], workouts: [workout(TODAY)], plan: [planDay(2, 'Pierna')] },
  activeSession: { workouts: [workout(TODAY, 'active')] },
  activePlanned: { workouts: [workout(TODAY, 'active')], plan: [planDay(2, 'Pierna')] },
  fastLoss: { weights: lastDays(14).map((d, i) => weight(d, 88 - i * 0.3)) },
  onTrack: { weights: lastDays(14).map((d, i) => weight(d, 88 - i * 0.05)) },
  stable: { weights: lastDays(14).map((d) => weight(d, 85)) },
  against: { weights: lastDays(14).map((d, i) => weight(d, 85 + i * 0.05)) },
  staleWeighIn: { weights: [weight(addDays(TODAY, -10), 85)] },
  dailyWeighIns: { weights: lastDays(7).map((d) => weight(d, 85)) },
  training: { workouts: lastDays(3).map((d) => workout(d)), plan: [planDay(2, 'Pierna')] },
  planned: { plan: [planDay(2, 'Pierna'), planDay(0, '')], workouts: [workout(addDays(TODAY, -5))] },
  streak8: { water: lastDays(8).map((d) => water(d, 2500)), steps: lastDays(8).map((d) => steps(d, 9000)) },
  streak4: { water: [...lastDays(4, yesterday).map((d) => water(d, 1000))] },
  partialToday: { water: [water(yesterday, 1500), water(TODAY, 600)], steps: [steps(yesterday, 6000), steps(TODAY, 2500)] },
  zeroToday: { water: [water(yesterday, 1500)], steps: [steps(yesterday, 6000)] },
};

const RICH: Partial<Profile> = {
  activity: { posture: 'sitting', job: 'desk', trainingDays: 3, activityTypes: ['strength', 'walking'], experience: 'beginner' },
  food: {
    improve: 'yes',
    pattern: 'vegan',
    restrictions: ['soy'],
    difficulties: ['impulse', 'portions', 'planning', 'choosing'],
    eatingOut: 'daily',
    water: 'low',
    schedule: 'skips',
  },
  motivation: {
    blockers: ['time', 'stress', 'knowledge', 'results', 'motivation', 'social'],
    hardest: 'consistency',
    dailyMinutes: 10,
    dropReasons: ['perfectionism', 'busy'],
    motivators: ['challenges'],
    style: 'small',
    firstFocus: 'water',
  },
  wellbeing: { sleepHours: 'lt6', rest: 'poor', stress: 'high', regularSchedule: 'no', improve: ['sleep', 'screens', 'stress', 'water'] },
};

const PROFILES: Record<string, Partial<Profile>> = {
  plain: {},
  rich: RICH,
  richOtherAnswers: {
    activity: { posture: 'moving', job: 'physical', trainingDays: 6, activityTypes: ['sports'], experience: 'advanced' },
    food: { schedule: 'skips', eatingOut: 'several', pattern: 'omnivore', restrictions: ['egg'], difficulties: ['consistency'] },
    motivation: { dailyMinutes: 20, style: 'challenging', hardest: 'start', dropReasons: ['no_results'] },
    wellbeing: { stress: 'medium', improve: ['screens'] },
  },
  sixtyMinutes: { motivation: { dailyMinutes: 60, blockers: ['time'] }, goal: 'strength', startWeightKg: undefined, goalWeightKg: undefined },
  maintain: { goal: 'maintain', startWeightKg: undefined, goalWeightKg: undefined, motivation: { blockers: ['time'] } },
  gain: { goal: 'gain', startWeightKg: 80, goalWeightKg: 92 },
  outdated: { startDate: '2026-01-01', updatedAt: new Date(2026, 2, 1, 12).getTime() },
  minor: { ...RICH, age: 16, ageRecordedOn: TODAY },
  minorPlain: { age: 15, ageRecordedOn: TODAY, goal: 'lose' },
  pregnancy: { ...RICH, healthFlags: ['pregnancy'] },
  eatingDisorder: { ...RICH, healthFlags: ['eating_disorder'], goal: 'gain', startWeightKg: 50, goalWeightKg: 56 },
  medical: { healthFlags: ['medical_condition'] },
};

const scenarios: { name: string; ctx: TipContext; tips: TipCandidate[] }[] = [];
for (const [p, patch] of Object.entries(PROFILES)) {
  for (const [d, data] of Object.entries(DATA)) {
    const ctx = ctxFor({ ...data, profile: profile(patch) });
    scenarios.push({ name: `${p}/${d}`, ctx, tips: ruleSource.candidates(ctx) });
  }
}
/** Plus every tip as it reads when it was chosen earlier today and still holds (some only exist that way). */
const allTips = scenarios.flatMap((s) => [...s.tips, ...RULES.flatMap((r) => ruleSource.resume(r.id, s.ctx) ?? [])]);

const APP_PATHS = ['/', '/progresos', '/calendario', '/entreno', '/entreno/sesion', '/habitos', '/hitos', '/perfil'];
const TABS: Record<string, string[]> = {
  '/progresos': ['evolucion', 'registros', 'imc', 'calorias'],
  '/habitos': ['agua', 'pasos'],
  '/entreno': ['plan', 'historial', 'ejercicios', 'plantillas', 'stats'],
};
const ANCHORS = ['preferencias', 'personal', 'goal'];

describe('tip rules', () => {
  it('has 25–40 templates with unique ids', () => {
    expect(RULES.length).toBeGreaterThanOrEqual(25);
    expect(RULES.length).toBeLessThanOrEqual(40);
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
  });

  it('every rule applies in some real situation', () => {
    const seen = new Set(allTips.map((t) => t.id));
    expect(RULES.map((r) => r.id).filter((id) => !seen.has(id))).toEqual([]);
  });

  it('never uses forbidden words in any output', () => {
    const direct = /(^|[^\p{L}])(ayun\p{L}*|castig\p{L}*|culpa\p{L}*|compens\p{L}*|detox|pecado)|quemar calor[ií]as|sin excusas/iu;
    for (const t of allTips) {
      const text = `${t.title} ${t.body} ${t.action?.label ?? ''}`;
      expect(text, t.id).not.toMatch(direct);
      expect(containsForbidden(t), t.id).toBe(false);
    }
    expect(FORBIDDEN_TERMS).toEqual(expect.arrayContaining(['ayuno', 'castigo', 'culpa', 'quemar calorías']));
  });

  it('gives minors and health-flag profiles only general wellbeing tips', () => {
    const gentleRules = new Set(RULES.filter((r) => r.gentle).map((r) => r.id));
    const gentle = scenarios.filter((s) => s.ctx.gentle);
    expect(gentle.length).toBeGreaterThan(50);
    for (const s of gentle) {
      for (const t of s.tips) {
        expect(gentleRules.has(t.id), `${s.name}: ${t.id}`).toBe(true);
        expect(t.weight, `${s.name}: ${t.id}`).toBeFalsy();
        expect(mentionsWeightChange(t), `${s.name}: ${t.id}`).toBe(false);
        expect(t.topic).not.toMatch(/^(progress|weighing|food)$/);
      }
      expect(s.tips.some((t) => t.id === 'wellbeing-professional')).toBe(true);
    }
    // Rules about weight are always flagged, so other sources' safety checks catch them too.
    for (const r of RULES.filter((r) => r.topic === 'progress' || r.topic === 'weighing' || r.event === 'weightGoal')) expect(r.weight).toBe(true);
  });

  it('only links to routes and tabs that exist', () => {
    for (const route of TIP_ROUTES) {
      const url = new URL(route, 'https://rumbo.local');
      expect(APP_PATHS).toContain(url.pathname);
      const tab = url.searchParams.get('tab');
      if (tab) expect(TABS[url.pathname]).toContain(tab);
      if (url.hash) expect(ANCHORS).toContain(url.hash.slice(1));
    }
    for (const t of allTips) if (t.action) expect(TIP_ROUTES as readonly string[]).toContain(t.action.to);
  });

  it('writes complete, short copy with real numbers only', () => {
    for (const t of allTips) {
      const text = `${t.title} ${t.body} ${t.action?.label ?? ''}`;
      expect(text, t.id).not.toMatch(/undefined|NaN|null|Infinity|\s{2}|\p{Extended_Pictographic}/u);
      expect(t.title.length, t.id).toBeLessThanOrEqual(40);
      expect(t.body.length, t.id).toBeLessThanOrEqual(200);
      expect(t.title, t.id).toMatch(/^[¿A-ZÁÉÍÓÚÑ0-9]/);
      expect(t.title, t.id).not.toMatch(/\.$/);
      expect(t.body, t.id).toMatch(/^[A-ZÁÉÍÓÚÑ¿«]/);
      expect(t.body, t.id).toMatch(/[.»]$/);
      expect(t.action?.label.length ?? 0, t.id).toBeLessThanOrEqual(24);
      expect(isSafeTip(t, false), t.id).toBe(true);
    }
  });

  it('uses the user’s own numbers and units', () => {
    const c = ctxFor({ water: [water(yesterday, 1500), water(TODAY, 600)], steps: [steps(yesterday, 100), steps(TODAY, 2500)] });
    const tips = ruleSource.candidates(c);
    expect(tips.find((t) => t.id === 'water-today')).toMatchObject({ title: 'Te faltan 1,4 L de agua', body: expect.stringContaining('Llevas 600 ml de 2 L') });
    expect(tips.find((t) => t.id === 'steps-today')).toMatchObject({ title: 'Te faltan 5.500 pasos', body: expect.stringContaining('Varios paseos cortos') });
    const close = ruleSource.candidates(ctxFor({ steps: [steps(yesterday, 100), steps(TODAY, 6000)] })).find((t) => t.id === 'steps-today');
    expect(close).toMatchObject({ title: 'Te faltan 2.000 pasos', body: expect.stringContaining('Unos 20 minutos caminando te acercan a tu objetivo de 8.000.') });

    const imperial = ruleSource.candidates(ctxFor({ profile: profile({ units: 'imperial' }), water: [water(yesterday, 500), water(TODAY, 500)] }));
    expect(imperial.find((t) => t.id === 'water-today')?.body).toContain('fl oz');
  });

  it('adapts planning staples to the eating pattern and allergies', () => {
    const body = (p: Partial<Profile>) =>
      ruleSource.candidates(ctxFor({ profile: profile({ food: { difficulties: ['planning'], ...p.food } }) })).find((t) => t.id === 'food-planning')?.body;
    expect(body({})).toContain('huevos, legumbre cocida, verdura congelada y fruta');
    expect(body({ food: { pattern: 'vegan' } })).toContain('tofu, legumbre cocida');
    expect(body({ food: { pattern: 'vegan', restrictions: ['soy'] } })).toContain('básicos fáciles: legumbre cocida, verdura congelada y fruta.');
  });

  it('celebrates the weight goal in the week it is reached, not every week after', () => {
    const ids = (weights: ReturnType<typeof weight>[]) => ruleSource.candidates(ctxFor({ weights })).map((t) => t.id);
    expect(ids([weight(addDays(TODAY, -20), 85), weight(addDays(TODAY, -3), 79.9)])).toContain('weight-goal-reached');
    const holding = [weight(addDays(TODAY, -40), 85), weight(addDays(TODAY, -30), 79.9), weight(addDays(TODAY, -2), 79.7)];
    expect(ids(holding)).not.toContain('weight-goal-reached');
  });

  it('never talks about moving towards the goal once it is reached', () => {
    const tips = ruleSource.candidates(ctxFor(DATA.pastGoal));
    expect(tips.find((t) => t.id === 'progress-on-track')).toMatchObject({
      title: 'Ya estás en tu objetivo',
      body: expect.stringContaining('no hace falta seguir bajando'),
    });
    for (const t of tips) expect(`${t.title} ${t.body}`, t.id).not.toMatch(/hacia tu objetivo|no siempre es lineal/);
    const stableAtGoal = ruleSource.candidates(ctxFor({ weights: lastDays(14).map((d) => weight(d, 79.5)) })).map((t) => t.id);
    expect(stableAtGoal).not.toContain('progress-nonlinear');
  });

  it('words the gradual-pace tip for the goal’s direction', () => {
    const lose = ruleSource.candidates(ctxFor(DATA.fastLoss)).find((t) => t.id === 'progress-gradual');
    expect(lose?.body).toContain('come lo suficiente');
    const fastGain = { profile: profile(PROFILES.gain), weights: lastDays(14).map((d, i) => weight(d, 80 + i * 0.15)) };
    const gain = ruleSource.candidates(ctxFor(fastGain)).find((t) => t.id === 'progress-gradual');
    expect(gain?.body).toContain('haz los cambios poco a poco');
    expect(gain?.body).not.toContain('come lo suficiente');
  });

  it('keeps today’s workout tip while the session is open, and drops it once finished', () => {
    const plan = [planDay(2, 'Pierna')];
    expect(ruleSource.resume('training-planned', ctxFor({ plan, workouts: [workout(TODAY, 'active')] }))).toMatchObject({
      title: 'Hoy tienes entreno',
      body: expect.stringContaining('ya está en marcha'),
      action: { to: '/entreno/sesion' },
    });
    expect(ruleSource.resume('training-planned', ctxFor({ plan, workouts: [workout(TODAY)] }))).toBeNull();
  });

  it('sizes time-poor micro-habits to the minutes the user has', () => {
    const tip = (dailyMinutes: 10 | 20 | 30 | 45 | 60) =>
      ruleSource.candidates(ctxFor({ profile: profile({ motivation: { dailyMinutes, blockers: ['time'] } }) })).find((t) => t.id === 'time-micro');
    expect(tip(10)?.title).toBe('Tus 10 minutos cuentan');
    expect(tip(20)?.title).toBe('Tus 20 minutos cuentan');
    expect(tip(45)?.body).toContain('Reserva tus 45 minutos');
  });
});
