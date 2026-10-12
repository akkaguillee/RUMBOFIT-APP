import { describe, expect, it } from 'vitest';
import { bmiCategory, calculateBmi, calculateEnergy, calculateMacros, currentAge, estimateActivityLevel, mifflinStJeor, weightForBmi } from './health';

describe('BMI', () => {
  it('computes kg / m²', () => {
    expect(calculateBmi(85, 180)).toBe(26.2);
    expect(calculateBmi(60, 165)).toBe(22);
  });

  it('classifies adults with WHO ranges', () => {
    expect(bmiCategory(17.9)?.id).toBe('under');
    expect(bmiCategory(18.5)?.id).toBe('normal');
    expect(bmiCategory(24.99)?.id).toBe('normal');
    expect(bmiCategory(25)?.id).toBe('over');
    expect(bmiCategory(31)?.id).toBe('obese1');
    expect(bmiCategory(41)?.id).toBe('obese3');
  });

  it('does not apply adult ranges to minors', () => {
    expect(bmiCategory(22, 15)).toBeNull();
  });

  it('inverts BMI to weight', () => {
    expect(weightForBmi(18.5, 180)).toBe(59.9);
  });
});

describe('energy', () => {
  it('applies Mifflin-St Jeor', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 1780
    expect(mifflinStJeor(80, 180, 30, 'male')).toBe(1780);
    // 10*60 + 6.25*165 - 5*30 - 161 = 1320.25
    expect(mifflinStJeor(60, 165, 30, 'female')).toBeCloseTo(1320.25);
  });

  it('separates BMR from TDEE and never double-counts training', () => {
    const r = calculateEnergy({ kg: 80, heightCm: 180, age: 30, sex: 'male', activityLevel: 'moderate', goal: 'lose' });
    expect(r.bmr).toBe(1780);
    expect(r.tdee).toBe(Math.round(1780 * 1.55));
    expect(r.maintenance).toBe(2760);
    const lose = r.targets.find((t) => t.id === 'lose');
    expect(lose?.kcal).toBe(2760 - 500 + 0); // 20% capped at 500 kcal
    expect(r.targets.every((t) => t.kcal >= 1780)).toBe(true);
  });

  it('keeps targets above basal metabolism for sedentary users', () => {
    const r = calculateEnergy({ kg: 50, heightCm: 155, age: 60, sex: 'female', activityLevel: 'sedentary', goal: 'lose' });
    const floor = Math.round(r.bmr / 10) * 10;
    for (const t of r.targets) expect(t.kcal).toBeGreaterThanOrEqual(floor - 10);
  });

  it('only shows maintenance for minors or sensitive situations', () => {
    const minor = calculateEnergy({ kg: 60, heightCm: 170, age: 16, sex: 'male', activityLevel: 'active', goal: 'lose' });
    expect(minor.targets.map((t) => t.id)).toEqual(['maintain']);
    expect(minor.restrictions.length).toBeGreaterThan(0);
    const ed = calculateEnergy({ kg: 60, heightCm: 170, age: 30, sex: 'female', activityLevel: 'light', goal: 'lose', healthFlags: ['eating_disorder'] });
    expect(ed.targets.map((t) => t.id)).toEqual(['maintain']);
  });

  it('splits macros', () => {
    const m = calculateMacros(2000, 70, 1.8, 25);
    expect(m.proteinG).toBe(126);
    expect(m.fatG).toBe(56);
    expect(m.carbsG).toBe(Math.round((2000 - 504 - 504) / 4));
  });

  it('ages over time', () => {
    expect(currentAge(30, '2025-06-10', '2026-06-09')).toBe(30);
    expect(currentAge(30, '2025-06-10', '2026-06-10')).toBe(31);
  });
});

describe('activity level from daily life', () => {
  it('combines posture, job and weekly training', () => {
    expect(estimateActivityLevel({ posture: 'sitting', job: 'desk', trainingDays: 0 })).toBe('sedentary');
    expect(estimateActivityLevel({ posture: 'sitting', job: 'desk', trainingDays: 2 })).toBe('light');
    expect(estimateActivityLevel({ posture: 'sitting', job: 'desk', trainingDays: 3 })).toBe('light');
    expect(estimateActivityLevel({ posture: 'sitting', job: 'desk', trainingDays: 5 })).toBe('moderate');
    expect(estimateActivityLevel({ posture: 'standing', job: 'standing', trainingDays: 3 })).toBe('moderate');
    expect(estimateActivityLevel({ posture: 'sitting', job: 'physical', trainingDays: 0 })).toBe('moderate');
    expect(estimateActivityLevel({ posture: 'moving', job: 'physical', trainingDays: 6 })).toBe('very_active');
  });

  it('clamps impossible training frequencies', () => {
    expect(estimateActivityLevel({ posture: 'sitting', job: 'none', trainingDays: 12 })).toBe('moderate');
    expect(estimateActivityLevel({ posture: 'sitting', job: 'none', trainingDays: -3 })).toBe('sedentary');
  });
});

describe('energy targets by goal', () => {
  const base = { kg: 80, heightCm: 180, age: 30, sex: 'male' as const, activityLevel: 'moderate' as const };

  it('recommends a moderate deficit for fat loss, never below BMR', () => {
    const r = calculateEnergy({ ...base, goal: 'lose' });
    const rec = r.targets.find((t) => t.recommended)!;
    expect(rec.id).toBe('lose_mild');
    expect(rec.kcal).toBeLessThan(r.maintenance);
    expect(Math.min(...r.targets.map((t) => t.kcal))).toBeGreaterThanOrEqual(Math.round(r.bmr / 10) * 10 - 10);
  });

  it('keeps maintenance as the reference for recomposition, habits and consistency', () => {
    for (const goal of ['recomp', 'habits', 'consistency', 'maintain'] as const) {
      const r = calculateEnergy({ ...base, goal });
      expect(r.targets.find((t) => t.recommended)?.id).toBe('maintain');
    }
  });

  it('suggests a moderate surplus to gain weight', () => {
    const r = calculateEnergy({ ...base, goal: 'gain' });
    const rec = r.targets.find((t) => t.recommended)!;
    expect(rec.kcal - r.maintenance).toBeGreaterThan(0);
    expect(rec.kcal - r.maintenance).toBeLessThanOrEqual(200);
  });

  it('shows only maintenance for minors or sensitive situations', () => {
    expect(calculateEnergy({ ...base, age: 16, goal: 'lose' }).targets.map((t) => t.id)).toEqual(['maintain']);
    expect(calculateEnergy({ ...base, goal: 'lose', healthFlags: ['eating_disorder'] }).targets.map((t) => t.id)).toEqual(['maintain']);
  });
});
