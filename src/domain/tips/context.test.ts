import { describe, expect, it } from 'vitest';
import { addDays } from '../dates';
import type { ActivityProfile } from '../types';
import { ctxFor, lastDays, planDay, profile, steps, TODAY, water, weight, workout } from './fixtures';

describe('buildTipContext', () => {
  it('leaves everything unknown without records instead of inventing numbers', () => {
    const c = ctxFor();
    expect(c.records).toMatchObject({ any: false, lastDate: null, daysSinceLast: null, gapBeforeToday: null, recordedToday: false });
    expect(c.weight).toMatchObject({ count: 0, daysSinceWeighIn: null, change14: null, slope14: null, trend: 'unknown', progress: null, goalReached: false });
    expect(c.weight.latestKg).toBeUndefined();
    expect(c.water).toMatchObject({ todayMl: 0, tracking: false, goalDaysLast7: 0 });
    expect(c.steps).toMatchObject({ today: 0, tracking: false, avgLast7: null });
    expect(c.streak.current).toBe(0);
  });

  it('reads the goal, its direction and the sensitive situations', () => {
    expect(ctxFor().direction).toBe('down');
    expect(ctxFor({ profile: profile({ goal: 'gain', startWeightKg: 60, goalWeightKg: 66 }) }).direction).toBe('up');
    expect(ctxFor({ profile: profile({ goal: 'fitness' }) }).direction).toBe('none');

    const minor = ctxFor({ profile: profile({ age: 16, ageRecordedOn: TODAY }) });
    expect(minor).toMatchObject({ minor: true, gentle: true });
    expect(ctxFor({ profile: profile({ healthFlags: ['pregnancy'] }) })).toMatchObject({ minor: false, gentle: true });
    expect(ctxFor()).toMatchObject({ minor: false, gentle: false });
  });

  it('measures the time since the last record of any kind', () => {
    const away = ctxFor({ water: [water(addDays(TODAY, -4), 250)] });
    expect(away.records).toMatchObject({ any: true, daysSinceLast: 4, recordedToday: false, gapBeforeToday: 4 });

    const back = ctxFor({ water: [water(addDays(TODAY, -4), 250)], steps: [steps(TODAY, 1200)] });
    expect(back.records).toMatchObject({ daysSinceLast: 0, recordedToday: true, gapBeforeToday: 4 });
  });

  it('compares today’s water and steps with the goals and counts goal days of the last week', () => {
    const days = lastDays(7);
    const c = ctxFor({
      water: [...days.slice(0, 5).map((d) => water(d, 2000)), water(TODAY, 500)],
      steps: days.map((d, i) => steps(d, i < 6 ? 9000 : 3000)),
    });
    expect(c.water).toMatchObject({ todayMl: 500, goalMl: 2000, tracking: true, goalDaysLast7: 5 });
    expect(c.steps).toMatchObject({ today: 3000, goal: 8000, tracking: true, goalDaysLast7: 6 });
    expect(c.steps.avgLast7).toBe(Math.round((9000 * 6 + 3000) / 7));
    expect(c.goalsToday).toEqual({ met: 0, total: 3, allMet: false }); // Wednesday is a training day
  });

  it('uses the goals that were in force on past days', () => {
    const day = addDays(TODAY, -1);
    const c = ctxFor({ water: [water(day, 1500)], snapshots: [{ date: day, waterGoalMl: 1500, stepsGoal: 8000 }] });
    expect(c.water.goalDaysLast7).toBe(1);
  });

  it('derives the 14-day weight trend against the goal direction', () => {
    const days = lastDays(14);
    const down = days.map((d, i) => weight(d, 85 - i * 0.05));
    expect(ctxFor({ weights: down }).weight).toMatchObject({ trend: 'favorable', fast: false, count: 14, latestKg: 85 - 13 * 0.05 });

    const up = days.map((d, i) => weight(d, 85 + i * 0.05));
    expect(ctxFor({ weights: up }).weight.trend).toBe('against');

    const flat = days.map((d) => weight(d, 85));
    expect(ctxFor({ weights: flat }).weight.trend).toBe('stable');

    const fast = days.map((d, i) => weight(d, 85 - i * 0.3));
    expect(ctxFor({ weights: fast }).weight).toMatchObject({ trend: 'favorable', fast: true });

    // Two records are not enough to talk about a trend.
    const few = ctxFor({ weights: [weight(addDays(TODAY, -10), 86), weight(TODAY, 85)] });
    expect(few.weight).toMatchObject({ trend: 'unknown', slope14: null });
    expect(few.weight.change14).toBeCloseTo(-1);

    // Nor are several weigh-ins on the same day (morning and evening differ by more than a week's change).
    const twoDays = [weight(addDays(TODAY, -7), 85), { ...weight(TODAY, 85), time: '07:00' }, { ...weight(TODAY, 86.5), time: '21:00' }];
    const sameDay = ctxFor({ weights: twoDays });
    expect(sameDay.weight).toMatchObject({ trend: 'unknown', slope14: null, fast: false });
  });

  it('knows when the weight goal is reached, and since when', () => {
    const c = ctxFor({ weights: [weight(addDays(TODAY, -1), 79.8)] });
    expect(c.weight).toMatchObject({ goalReached: true, daysSinceWeighIn: 1, reachedDaysAgo: 1 });
    expect(ctxFor({ weights: [weight(TODAY, 84)] }).weight).toMatchObject({ goalReached: false, reachedDaysAgo: null });

    // Counted from the first weigh-in that reached it, not the latest one.
    const weighIns = [weight(addDays(TODAY, -30), 85), weight(addDays(TODAY, -20), 79.9), weight(addDays(TODAY, -10), 80.4), weight(TODAY, 79.6)];
    const holding = ctxFor({ weights: weighIns });
    expect(holding.weight).toMatchObject({ goalReached: true, reachedDaysAgo: 20 });
  });

  it('reads today’s plan, finished workouts and consecutive training days', () => {
    const plan = [planDay(2, 'Pierna'), planDay(3, '', true)];
    const pending = ctxFor({ plan });
    expect(pending.training).toMatchObject({ hasPlan: true, plannedToday: true, plannedLabel: 'Pierna', doneToday: false, plannedPerWeek: 1 });

    const done = ctxFor({ plan, workouts: [workout(addDays(TODAY, -2)), workout(addDays(TODAY, -1)), workout(TODAY)] });
    expect(done.training).toMatchObject({ doneToday: true, consecutiveDays: 3, completedLast7: 3, completedTotal: 3 });

    const active = ctxFor({ workouts: [workout(TODAY, 'active')] });
    expect(active.training).toMatchObject({ activeSession: true, doneToday: false, completedTotal: 0 });

    // Without a plan, the training days from the profile are used.
    expect(ctxFor({ profile: profile({ trainingDays: [1] }) }).training.plannedToday).toBe(false);
  });

  it('counts the streak with the same definition as the streak card', () => {
    const c = ctxFor({ water: lastDays(5, addDays(TODAY, -1)).map((d) => water(d, 250)) });
    expect(c.streak).toEqual({ current: 5, longest: 5, todayActive: false });
  });

  it('ignores future-dated records', () => {
    const c = ctxFor({ water: [water(addDays(TODAY, 1), 2000)], weights: [weight(addDays(TODAY, 2), 70)] });
    expect(c.records.any).toBe(false);
    expect(c.weight.count).toBe(0);
  });

  it('exposes activity, answers and how old the profile data is', () => {
    const c = ctxFor({
      profile: profile({
        activity: { posture: 'sitting', job: 'desk', trainingDays: 2, activityTypes: ['walking'], experience: 'beginner' },
        motivation: { dailyMinutes: 10, blockers: ['time'] },
        wellbeing: { stress: 'high' },
        updatedAt: new Date(2026, 6, 1, 12).getTime(),
      }),
    });
    expect(c.activity).toMatchObject({ posture: 'sitting', job: 'desk', trainingDaysPerWeek: 2, experience: 'beginner' });
    expect(c.motivation.dailyMinutes).toBe(10);
    expect(c.profileData).toMatchObject({ hasHeight: true, hasAge: true, personalised: true });
    expect(c.profileData.daysSinceUpdate).toBe(105);

    expect(ctxFor({ profile: profile({ heightCm: undefined, food: {}, motivation: { blockers: [] } }) }).profileData).toMatchObject({
      hasHeight: false,
      personalised: false,
    });
    expect(ctxFor({ profile: profile({ updatedAt: 0 }) }).profileData.daysSinceUpdate).toBeNull();

    // The activity questions are mandatory in onboarding: only the optional groups count as personalised.
    const activity: ActivityProfile = { posture: 'sitting', job: 'desk', trainingDays: 0, activityTypes: [] };
    expect(ctxFor({ profile: profile({ activity, food: {}, motivation: {}, wellbeing: {} }) }).profileData.personalised).toBe(false);
    expect(ctxFor({ profile: profile({ activity, wellbeing: { stress: 'skip' } }) }).profileData.personalised).toBe(true);
  });
});
