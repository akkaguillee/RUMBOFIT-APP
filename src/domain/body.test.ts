import { describe, expect, it } from 'vitest';
import {
  activityBasis,
  bmiBand,
  bmiScalePosition,
  bmiSeries,
  bmiSnapshot,
  describeActivity,
  energyEstimate,
  guardDeficit,
  keepUnitsTogether,
  latestWeightUpTo,
  missingText,
} from './body';
import { calculateEnergy } from './health';
import type { Profile, WeightEntry } from './types';

const TODAY = '2026-10-12';

let seq = 0;
const w = (date: string, kg: number, time?: string): WeightEntry => ({ id: ++seq, date, time, kg, createdAt: seq, updatedAt: seq });

const profile = (patch: Partial<Profile> = {}): Profile => ({
  id: 'me',
  name: 'Ana',
  age: 30,
  ageRecordedOn: TODAY,
  sex: 'male',
  heightCm: 180,
  goal: 'maintain',
  activityLevel: 'moderate',
  units: 'metric',
  startDate: '2026-01-01',
  trainingDays: [0, 2, 4],
  waterGoalMl: 2000,
  stepsGoal: 8000,
  healthFlags: [],
  createdAt: new Date(2026, 0, 1, 9).getTime(),
  updatedAt: new Date(2026, 0, 1, 9).getTime(),
  ...patch,
});

describe('BMI bands and scale', () => {
  it('uses the WHO boundaries 18,5 / 25 / 30', () => {
    expect(bmiBand(18.4).id).toBe('under');
    expect(bmiBand(18.5).id).toBe('normal');
    expect(bmiBand(24.9).id).toBe('normal');
    expect(bmiBand(25).id).toBe('over');
    expect(bmiBand(29.9).id).toBe('over');
    expect(bmiBand(30).id).toBe('obese');
    expect(bmiBand(52).id).toBe('obese');
  });

  it('places the marker linearly inside equal-width bands and clamps the ends', () => {
    expect(bmiScalePosition(18.5)).toBeCloseTo(0.25);
    expect(bmiScalePosition(25)).toBeCloseTo(0.5);
    expect(bmiScalePosition(30)).toBeCloseTo(0.75);
    expect(bmiScalePosition(21.75)).toBeCloseTo(0.375);
    expect(bmiScalePosition(12)).toBe(0);
    expect(bmiScalePosition(48)).toBe(1);
  });
});

describe('bmiSnapshot', () => {
  it('uses the latest weight and the profile height', () => {
    const s = bmiSnapshot(profile(), [w('2026-10-01', 90), w('2026-10-10', 85)], TODAY);
    expect(s.status).toBe('ok');
    if (s.status !== 'ok') return;
    expect(s.bmi).toBe(26.2);
    expect(s.kg).toBe(85);
    expect(s.weighedOn).toBe('2026-10-10');
    expect(s.band?.id).toBe('over');
    expect(s.category?.id).toBe('over');
    expect(s.position).toBeGreaterThan(0.5);
    expect(s.notes).toEqual([]);
  });

  it('gives the reference weight range for the height', () => {
    const s = bmiSnapshot(profile(), [w('2026-10-10', 70)], TODAY);
    if (s.status !== 'ok') throw new Error('expected ok');
    expect(s.reference).toEqual({ minKg: 59.9, maxKg: 80.7 });
    expect(s.band?.id).toBe('normal');
  });

  it('never applies adult categories to minors', () => {
    const s = bmiSnapshot(profile({ age: 15 }), [w('2026-10-10', 60)], TODAY);
    if (s.status !== 'ok') throw new Error('expected ok');
    expect(s.ageGroup).toBe('minor');
    expect(s.band).toBeNull();
    expect(s.category).toBeNull();
    expect(s.position).toBeNull();
    expect(s.reference).toBeNull();
    expect(s.noBandReason).toBe('minor');
    expect(s.interpretation).toMatch(/percentiles/);
  });

  it('shows no adult categories during pregnancy or breastfeeding', () => {
    const s = bmiSnapshot(profile({ sex: 'female', healthFlags: ['pregnancy'] }), [w('2026-10-10', 82)], TODAY);
    if (s.status !== 'ok') throw new Error('expected ok');
    expect(s.bmi).toBe(25.3);
    expect(s.ageGroup).toBe('adult');
    expect(s.noBandReason).toBe('pregnancy');
    expect(s.band).toBeNull();
    expect(s.category).toBeNull();
    expect(s.position).toBeNull();
    expect(s.reference).toBeNull();
    expect(s.interpretation).toMatch(/embarazo/);
    // Other flags do not change how the BMI itself is read.
    const other = bmiSnapshot(profile({ healthFlags: ['medical_condition'] }), [w('2026-10-10', 82)], TODAY);
    if (other.status !== 'ok') throw new Error('expected ok');
    expect(other.band?.id).toBe('over');
    expect(other.noBandReason).toBeNull();
  });

  it('counts birthdays since the age was recorded', () => {
    const s = bmiSnapshot(profile({ age: 17, ageRecordedOn: '2025-09-01' }), [w('2026-10-10', 60)], TODAY);
    if (s.status !== 'ok') throw new Error('expected ok');
    expect(s.ageGroup).toBe('adult');
  });

  it('uses adult categories with a note when the age is unknown', () => {
    const s = bmiSnapshot(profile({ age: undefined, ageRecordedOn: undefined }), [w('2026-10-10', 58)], TODAY);
    if (s.status !== 'ok') throw new Error('expected ok');
    expect(s.ageGroup).toBe('unknown');
    expect(s.band?.id).toBe('under');
    expect(s.notes.length).toBe(1);
  });

  it('asks only for what is missing', () => {
    expect(bmiSnapshot(profile({ heightCm: undefined }), [w('2026-10-10', 60)], TODAY)).toEqual({ status: 'missing', fields: ['height'] });
    expect(bmiSnapshot(profile(), [], TODAY)).toEqual({ status: 'missing', fields: ['weight'] });
    expect(bmiSnapshot(profile({ heightCm: undefined }), [], TODAY)).toEqual({ status: 'missing', fields: ['weight', 'height'] });
  });

  it('ignores records after today', () => {
    const s = bmiSnapshot(profile(), [w('2026-10-10', 81), w('2026-10-20', 70)], TODAY);
    if (s.status !== 'ok') throw new Error('expected ok');
    expect(s.kg).toBe(81);
  });
});

describe('bmiSeries', () => {
  it('keeps one point per day using the last record of that day', () => {
    const series = bmiSeries([w('2026-10-02', 80, '20:00'), w('2026-10-01', 82), w('2026-10-02', 81, '07:30')], 180);
    expect(series.map((p) => p.date)).toEqual(['2026-10-01', '2026-10-02']);
    expect(series[1]!.kg).toBe(80);
    expect(series[1]!.bmi).toBe(24.7);
    expect(series[0]!.bmi).toBe(25.3);
  });

  it('is empty without a height', () => {
    expect(bmiSeries([w('2026-10-01', 82)], undefined)).toEqual([]);
  });
});

describe('activity factor', () => {
  it('explains the level with daily life when it matches the answers', () => {
    const b = activityBasis(profile({ activityLevel: 'light', activity: { posture: 'sitting', job: 'desk', trainingDays: 3, activityTypes: ['strength'] } }));
    expect(b.source).toBe('daily-life');
    expect(b.level).toBe('light');
    expect(b.factor).toBe(1.375);
    expect(b.summary).toBe('Sentado la mayor parte del día · 3 días de entreno por semana');
  });

  it('respects a level picked by hand over the estimate', () => {
    const b = activityBasis(profile({ activityLevel: 'very_active', activity: { posture: 'sitting', job: 'desk', trainingDays: 3, activityTypes: ['strength'] } }));
    expect(b).toMatchObject({ source: 'manual', level: 'very_active', factor: 1.9 });
  });

  it('falls back to the stored level', () => {
    const b = activityBasis(profile({ activityLevel: 'active' }));
    expect(b).toMatchObject({ source: 'profile', level: 'active', factor: 1.725 });
  });

  it('mentions a physical job when it changes the base', () => {
    expect(describeActivity({ posture: 'standing', job: 'physical', trainingDays: 0 })).toBe('De pie la mayor parte del día · trabajo físico · sin entrenamientos');
    expect(describeActivity({ posture: 'moving', job: 'physical', trainingDays: 1 })).toBe('En movimiento la mayor parte del día · 1 día de entreno por semana');
  });
});

describe('energyEstimate', () => {
  const weights = [w('2026-10-10', 80)];

  it('names what is missing', () => {
    expect(missingText(['height'])).toBe('tu altura');
    expect(missingText(['weight', 'height'])).toBe('tu peso y tu altura');
    expect(missingText(['weight', 'height', 'age'])).toBe('tu peso, tu altura y tu edad');
  });

  it('reports missing values instead of inventing them', () => {
    expect(energyEstimate(profile({ age: undefined, ageRecordedOn: undefined, heightCm: undefined }), [], TODAY)).toEqual({
      status: 'missing',
      fields: ['weight', 'height', 'age'],
    });
    expect(energyEstimate(profile({ age: undefined, ageRecordedOn: undefined }), weights, TODAY)).toEqual({ status: 'missing', fields: ['age'] });
  });

  it('computes maintenance with Mifflin-St Jeor × activity factor', () => {
    const e = energyEstimate(profile(), weights, TODAY);
    if (e.status !== 'ok') throw new Error('expected ok');
    expect(e.bmr).toBe(1780);
    expect(e.tdee).toBe(Math.round(1780 * 1.55));
    expect(e.maintenance).toBe(2760);
    expect(e.target?.id).toBe('maintain');
    expect(e.target?.kcal).toBe(2760);
    expect(e.restricted).toBe(false);
    expect(e.guidance).toMatch(/estimación inicial/);
  });

  it('recommends a gentle deficit or surplus depending on the goal', () => {
    const lose = energyEstimate(profile({ goal: 'lose' }), weights, TODAY);
    const gain = energyEstimate(profile({ goal: 'gain' }), weights, TODAY);
    const strength = energyEstimate(profile({ goal: 'strength' }), weights, TODAY);
    const recomp = energyEstimate(profile({ goal: 'recomp' }), weights, TODAY);
    const habits = energyEstimate(profile({ goal: 'habits' }), weights, TODAY);
    if (lose.status !== 'ok' || gain.status !== 'ok' || strength.status !== 'ok' || recomp.status !== 'ok' || habits.status !== 'ok') throw new Error('expected ok');
    expect(lose.target).toMatchObject({ id: 'lose_mild', kcal: 2760 - 280 });
    expect(gain.target).toMatchObject({ id: 'gain_mild', kcal: 2760 + 140 });
    expect(strength.target?.id).toBe('gain_mild');
    expect(recomp.target?.id).toBe('maintain');
    expect(recomp.options.map((t) => t.id)).toEqual(['maintain', 'lose_mild']);
    expect(habits.target?.kcal).toBe(habits.maintenance);
  });

  it('never goes below the basal metabolism, not even by rounding', () => {
    // 28 y, 180 cm, 85,4 kg, sedentary: BMR 1.844; a 20 % deficit would be 1.770 and the
    // BMR rounded to 10 kcal is 1.840, still under it. The floor rounds up to 1.850.
    const e = energyEstimate(profile({ age: 28, goal: 'lose', activityLevel: 'sedentary' }), [w('2026-10-10', 85.4)], TODAY);
    if (e.status !== 'ok') throw new Error('expected ok');
    expect(e.bmr).toBe(1844);
    expect(e.options.find((t) => t.id === 'lose')?.kcal).toBe(1850);
    for (const t of e.options) expect(t.kcal).toBeGreaterThanOrEqual(e.bmr);

    const small = energyEstimate(profile({ sex: 'female', age: 60, heightCm: 150, goal: 'lose', activityLevel: 'sedentary' }), [w('2026-10-10', 48)], TODAY);
    if (small.status !== 'ok') throw new Error('expected ok');
    for (const t of small.options) expect(t.kcal).toBeGreaterThanOrEqual(small.bmr);
  });

  it('shows no target for minors or sensitive situations', () => {
    const minor = energyEstimate(profile({ age: 16, goal: 'lose' }), weights, TODAY);
    const pregnant = energyEstimate(profile({ sex: 'female', goal: 'lose', healthFlags: ['pregnancy'] }), weights, TODAY);
    const ed = energyEstimate(profile({ goal: 'gain', healthFlags: ['eating_disorder'] }), weights, TODAY);
    const medical = energyEstimate(profile({ goal: 'lose', healthFlags: ['medical_condition'] }), weights, TODAY);
    for (const e of [minor, pregnant, ed, medical]) {
      if (e.status !== 'ok') throw new Error('expected ok');
      expect(e.restricted).toBe(true);
      expect(e.target).toBeNull();
      expect(e.options.map((t) => t.id)).toEqual(['maintain']);
      expect(e.restrictions.length).toBeGreaterThan(0);
      expect(e.guidance).toMatch(/profesional/);
    }
  });

  it('shows maintenance only, with a professional note, when the BMI is below the reference interval', () => {
    // 58 kg at 180 cm → 17,9 kg/m²
    for (const goal of ['lose', 'recomp', 'gain', 'strength', 'maintain'] as const) {
      const e = energyEstimate(profile({ goal }), [w('2026-10-10', 58)], TODAY);
      if (e.status !== 'ok') throw new Error('expected ok');
      expect(e.restricted).toBe(true);
      expect(e.target).toBeNull();
      expect(e.options.map((t) => t.id)).toEqual(['maintain']);
      expect(e.options[0]).toMatchObject({ kcal: e.maintenance, recommended: true });
      expect(e.restrictions).toHaveLength(1);
      expect(e.restrictions[0]).toMatch(/IMC.*profesional/);
      expect(e.guidance).toMatch(/profesional/);
    }
    // 18,5 is already inside the interval (60 kg at 180 cm → 18,5)
    const edge = energyEstimate(profile({ goal: 'lose' }), [w('2026-10-10', 60)], TODAY);
    if (edge.status !== 'ok') throw new Error('expected ok');
    expect(edge.restricted).toBe(false);
    expect(edge.target?.id).toBe('lose_mild');
  });

  it('keeps one restriction message per reason (minors are not flagged twice for a low BMI)', () => {
    const e = energyEstimate(profile({ age: 16, goal: 'lose' }), [w('2026-10-10', 50)], TODAY);
    if (e.status !== 'ok') throw new Error('expected ok');
    expect(e.restrictions).toHaveLength(1);
    expect(e.restrictions[0]).toMatch(/menor de edad/);
  });

  it('applies the same guard to the adjustable calculator', () => {
    const raw = calculateEnergy({ kg: 55, heightCm: 175, age: 25, sex: 'female', activityLevel: 'light', goal: 'gain' });
    const guarded = guardDeficit(raw, 55, 175, 25);
    expect(guarded.targets.map((t) => t.id)).toEqual(['maintain']);
    expect(guarded.restrictions).toHaveLength(1);
    const ok = guardDeficit(calculateEnergy({ kg: 70, heightCm: 175, age: 25, sex: 'female', activityLevel: 'light', goal: 'gain' }), 70, 175, 25);
    expect(ok.targets.map((t) => t.id)).toEqual(['maintain', 'gain_mild', 'gain']);
    expect(ok.restrictions).toEqual([]);
  });

  it('uses the activity derived from daily life', () => {
    // Onboarding saves the estimate as the profile level, so both agree.
    const e = energyEstimate(profile({ activityLevel: 'very_active', activity: { posture: 'moving', job: 'physical', trainingDays: 5, activityTypes: [] } }), weights, TODAY);
    if (e.status !== 'ok') throw new Error('expected ok');
    expect(e.activity.level).toBe('very_active');
    expect(e.tdee).toBe(Math.round(1780 * 1.9));
    expect(e.notes.some((n) => n.includes('día a día'))).toBe(false);
  });

  it('dates the estimate with the last day an input changed', () => {
    const old = energyEstimate(profile(), weights, TODAY);
    const fresh = energyEstimate(profile({ updatedAt: new Date(2026, 9, 11, 18).getTime() }), weights, TODAY);
    if (old.status !== 'ok' || fresh.status !== 'ok') throw new Error('expected ok');
    expect(old.basedOn).toBe('2026-10-10');
    expect(fresh.basedOn).toBe('2026-10-11');

    // The record used was corrected today: the estimate changed today.
    const edited: WeightEntry = { ...w('2026-10-10', 79), updatedAt: new Date(2026, 9, 12, 8).getTime() };
    const e = energyEstimate(profile(), [edited], TODAY);
    if (e.status !== 'ok') throw new Error('expected ok');
    expect(e.basedOn).toBe(TODAY);

    // A clock that ran ahead never produces a future date.
    const ahead = energyEstimate(profile({ updatedAt: new Date(2026, 9, 20, 9).getTime() }), weights, TODAY);
    if (ahead.status !== 'ok') throw new Error('expected ok');
    expect(ahead.basedOn).toBe('2026-10-10');
  });

  it('matches a hand-worked example: 28 y man, 180 cm, 85,4 kg, desk job, 3 training days, losing weight', () => {
    const p = profile({ age: 28, goal: 'lose', activityLevel: 'light', activity: { posture: 'sitting', job: 'desk', trainingDays: 3, activityTypes: ['strength'] } });
    const weighIns = [w('2026-10-11', 86.1, '07:40'), w('2026-10-12', 85.9, '07:30'), w('2026-10-12', 85.4, '21:15')];
    const bmi = bmiSnapshot(p, weighIns, TODAY);
    const e = energyEstimate(p, weighIns, TODAY);
    if (bmi.status !== 'ok' || e.status !== 'ok') throw new Error('expected ok');
    // 85,4 / 1,8² = 26,36 → 26,4 (Sobrepeso)
    expect(bmi.kg).toBe(85.4);
    expect(bmi.bmi).toBe(26.4);
    expect(bmi.band?.label).toBe('Sobrepeso');
    // BMR = 10·85,4 + 6,25·180 − 5·28 + 5 = 1.844; sitting + 3 days → light (×1,375)
    expect(e.bmr).toBe(1844);
    expect(e.activity).toMatchObject({ level: 'light', factor: 1.375, source: 'daily-life' });
    // 1.844 × 1,375 = 2.535,5 → 2.536 → maintenance 2.540
    expect(e.tdee).toBe(2536);
    expect(e.maintenance).toBe(2540);
    // Mild deficit: 2.536 − 253,6 = 2.282,4 → 2.280 (recommended); gradual: 2.536 − 500 → 2.040
    expect(e.target).toMatchObject({ id: 'lose_mild', kcal: 2280 });
    expect(e.options.map((t) => [t.id, t.kcal])).toEqual([
      ['maintain', 2540],
      ['lose_mild', 2280],
      ['lose', 2040],
    ]);
    expect(e.restricted).toBe(false);
    expect(e.basedOn).toBe(TODAY);
  });
});

describe('latestWeightUpTo', () => {
  it('picks the last record of the most recent day, by time and then by logging order', () => {
    const evening = w('2026-10-12', 80.2, '21:00');
    const morning = w('2026-10-12', 80.9, '07:00');
    expect(latestWeightUpTo([evening, morning, w('2026-10-11', 81)], TODAY)).toBe(evening);
    // Same minute: the one logged last wins.
    const a = w('2026-10-12', 80.5, '08:00');
    const b = w('2026-10-12', 80.4, '08:00');
    expect(latestWeightUpTo([b, a], TODAY)).toBe(b);
    expect(latestWeightUpTo([w('2026-10-13', 70)], TODAY)).toBeUndefined();
  });
});

describe('keepUnitsTogether', () => {
  it('glues numbers to % and kcal with a non-breaking space', () => {
    expect(keepUnitsTogether('Déficit moderado (≈20 %, máx. 500 kcal).')).toBe('Déficit moderado (≈20\u00a0%, máx. 500\u00a0kcal).');
    expect(keepUnitsTogether('Sin cifras aquí.')).toBe('Sin cifras aquí.');
  });
});
