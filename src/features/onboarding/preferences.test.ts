import { describe, expect, it } from 'vitest';
import type { Profile } from '@/domain/types';
import { unitsApi } from '../shared/units';
import {
  activityAnswersOf,
  activityMissing,
  activityWithDays,
  cleanFood,
  cleanMotivation,
  cleanWellbeing,
  EMPTY_ACTIVITY,
  estimatedLevel,
  goalChoiceOf,
  goalFromChoice,
  habitsToImprove,
  inputOrStored,
  joinList,
  mainDifficulties,
  mainGoalLabel,
  supportStyle,
  targetWeightError,
  toActivityProfile,
  trainingDaysOf,
  waterGoalFor,
  type ActivityAnswers,
} from './preferences';

const kg = (n: number) => `${n} kg`;

describe('goals', () => {
  it('stores «Otro objetivo personal» as habits plus the user words', () => {
    expect(goalFromChoice('other', '  Correr   mi primera 10K ')).toEqual({ goal: 'habits', goalNote: 'Correr mi primera 10K' });
    expect(goalFromChoice('lose', 'ignored')).toEqual({ goal: 'lose' });
    expect(goalChoiceOf('habits', 'Correr mi primera 10K')).toBe('other');
    expect(goalChoiceOf('habits')).toBe('habits');
    expect(mainGoalLabel({ goal: 'habits', goalNote: 'Correr mi primera 10K' })).toBe('Correr mi primera 10K');
    expect(mainGoalLabel({ goal: 'lose' })).toBe('Perder grasa');
  });

  it('validates the target weight against the goal and a healthy BMI', () => {
    expect(targetWeightError('lose', 78, 90, 180, kg)).toBeNull();
    expect(targetWeightError('lose', 92, 90, 180, kg)).toMatch(/menor que tu peso de partida/);
    expect(targetWeightError('gain', 80, 90, 180, kg)).toMatch(/mayor que tu peso de partida/);
    expect(targetWeightError('lose', 55, 90, 180, kg)).toMatch(/IMC de 18,5 \(59\.9 kg/);
    expect(targetWeightError('lose', 10, null, null, kg)).toMatch(/entre 20 kg y 400 kg/);
    expect(targetWeightError('lose', null, 90, 180, kg)).toBeNull();
    // Without a height the healthy minimum cannot be checked, so the target waits for it.
    expect(targetWeightError('lose', 40, 90, null, kg)).toMatch(/Indica tu altura/);
    expect(targetWeightError('gain', 95, null, null, kg)).toMatch(/Indica tu altura/);
  });
});

describe('stored numbers', () => {
  it('keeps a stored value exactly while its field is untouched, in any units', () => {
    const lb = unitsApi('imperial');
    expect(lb.weightToInput(90)).toBe('198,4');
    expect(lb.parseWeight('198,4')).toBe(89.99);
    expect(inputOrStored('198,4', 90, lb.weightToInput, lb.parseWeight)).toBe(90);
    expect(inputOrStored('198', 90, lb.weightToInput, lb.parseWeight)).toBe(89.81);
    expect(inputOrStored('70,9', 180, lb.heightToInput, lb.parseHeight)).toBe(180);
    expect(inputOrStored('80', undefined, lb.weightToInput, lb.parseWeight)).toBe(36.29);
    expect(inputOrStored('abc', 90, lb.weightToInput, lb.parseWeight)).toBeNull();
  });
});

describe('activity answers', () => {
  const answers = (patch: Partial<ActivityAnswers>): ActivityAnswers => ({ ...EMPTY_ACTIVITY, ...patch });

  it('needs posture, job and exercise once the user starts answering', () => {
    expect(activityMissing(EMPTY_ACTIVITY)).toBeNull();
    expect(activityMissing(answers({ posture: 'sitting' }))).toBe(
      'Indica también tu tipo de trabajo y si haces ejercicio para estimar tu nivel de actividad.',
    );
    expect(activityMissing(answers({ posture: 'sitting', job: 'desk', exercises: true, days: [] }))).toMatch(/al menos un día/);
    expect(activityMissing(answers({ posture: 'sitting', job: 'desk', exercises: false, days: [] }))).toBeNull();
    expect(toActivityProfile(answers({ posture: 'sitting', job: 'desk' }))).toBeUndefined();
  });

  it('counts the selected weekdays and estimates the level', () => {
    const a = answers({ posture: 'standing', job: 'standing', exercises: true, days: [4, 0, 2], types: ['strength'], experience: 'beginner' });
    expect(toActivityProfile(a)).toEqual({ posture: 'standing', job: 'standing', trainingDays: 3, activityTypes: ['strength'], experience: 'beginner' });
    expect(trainingDaysOf(a)).toEqual([0, 2, 4]);
    expect(estimatedLevel(a)).toBe('moderate');
  });

  it('drops training details for someone who does not exercise', () => {
    const a = answers({ posture: 'sitting', job: 'desk', exercises: false, days: [0, 2], types: ['cardio'], experience: 'advanced' });
    expect(toActivityProfile(a)).toEqual({ posture: 'sitting', job: 'desk', trainingDays: 0, activityTypes: [] });
    expect(trainingDaysOf(a)).toEqual([]);
    expect(estimatedLevel(a)).toBe('sedentary');
  });

  it('reads the answers back from a stored profile', () => {
    const back = activityAnswersOf({
      activity: { posture: 'moving', job: 'physical', trainingDays: 2, activityTypes: ['sports'], experience: 'advanced' },
      trainingDays: [1, 3],
    });
    expect(back).toEqual({ posture: 'moving', job: 'physical', exercises: true, days: [1, 3], types: ['sports'], experience: 'advanced' });
    expect(activityAnswersOf({ trainingDays: [] })).toEqual(EMPTY_ACTIVITY);
  });

  it('keeps the answers consistent when the training days change in Perfil', () => {
    const profile: Pick<Profile, 'activity' | 'trainingDays'> = {
      activity: { posture: 'sitting', job: 'desk', trainingDays: 3, activityTypes: ['strength'], experience: 'advanced' },
      trainingDays: [0, 2, 4],
    };
    // No training left: no activity types or experience are kept.
    expect(activityWithDays(profile, [])).toEqual({ posture: 'sitting', job: 'desk', trainingDays: 0, activityTypes: [] });
    expect(activityWithDays(profile, [0, 1, 2, 3, 4])).toEqual({ posture: 'sitting', job: 'desk', trainingDays: 5, activityTypes: ['strength'], experience: 'advanced' });
    expect(activityWithDays({ activity: { posture: 'sitting', job: 'desk', trainingDays: 0, activityTypes: [] }, trainingDays: [] }, [1])).toEqual({
      posture: 'sitting',
      job: 'desk',
      trainingDays: 1,
      activityTypes: [],
    });
    expect(activityWithDays({ trainingDays: [] }, [1, 3])).toBeUndefined();
  });
});

describe('food habits', () => {
  it('keeps no details when the user does not want to change how they eat', () => {
    expect(cleanFood({ improve: 'no', quality: 'good', restrictions: ['gluten'], difficulties: ['portions'], water: 'low' })).toEqual({
      improve: 'no',
      water: 'low',
    });
    expect(cleanFood({ improve: 'a_bit', restrictions: [], difficulties: ['impulse'] })).toEqual({ improve: 'a_bit', difficulties: ['impulse'] });
    expect(cleanFood({ restrictions: [] })).toBeUndefined();
  });

  it('suggests a reachable water goal for someone who drinks little', () => {
    expect(waterGoalFor(undefined, 85.4)).toBe(2750);
    expect(waterGoalFor('unsure', 85.4)).toBe(2750);
    expect(waterGoalFor('low', 85.4)).toBe(1500);
    expect(waterGoalFor('medium', 85.4)).toBe(2000);
    expect(waterGoalFor('medium', 50)).toBe(1750);
    expect(waterGoalFor('high')).toBe(2000);
  });
});

describe('motivation and wellbeing', () => {
  it('keeps the free answer only when «Otro» is chosen', () => {
    expect(cleanMotivation({ blockers: ['time'], note: 'Turnos' })).toEqual({ blockers: ['time'] });
    expect(cleanMotivation({ dropReasons: ['other'], note: '  Turnos de noche ' })).toEqual({ dropReasons: ['other'], note: 'Turnos de noche' });
    expect(cleanMotivation({ blockers: [], motivators: [] })).toBeUndefined();
    expect(cleanWellbeing({ improve: [] })).toBeUndefined();
    expect(cleanWellbeing({ stress: 'skip' })).toEqual({ stress: 'skip' });
  });

  it('describes the preferred kind of support', () => {
    expect(supportStyle(undefined)).toBeNull();
    expect(supportStyle({ style: 'small', motivators: ['progress', 'streaks'] })).toEqual({
      title: 'Paso a paso',
      text: 'Metas pequeñas y alcanzables. Te impulsa: ver tu progreso y mantener la racha.',
    });
    expect(supportStyle({ motivators: ['tips'] })?.title).toBe('A tu ritmo');
  });

  it('lists the main difficulties and the habits to improve without repeats', () => {
    expect(mainDifficulties({ blockers: ['time', 'other'], hardest: 'consistency' }, { difficulties: ['impulse', 'portions'] })).toEqual([
      'Falta de tiempo',
      'Mantener la constancia',
      'Las cantidades',
      'Comer por impulso',
    ]);
    expect(habitsToImprove({ firstFocus: 'sleep' }, { improve: ['sleep', 'screens'] })).toEqual(['Descansar mejor', 'Menos pantallas de noche']);
    expect(habitsToImprove(undefined, undefined)).toEqual([]);
  });

  it('joins lists in Spanish', () => {
    expect(joinList(['a'])).toBe('a');
    expect(joinList(['a', 'b', 'c'])).toBe('a, b y c');
  });
});
