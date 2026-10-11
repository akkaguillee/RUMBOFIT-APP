import { describe, expect, it } from 'vitest';
import { addDays } from '../dates';
import { findCatalogExercise } from '../training/catalog';
import type { Profile, WaterEntry, WeightEntry } from '../types';
import { ACHIEVEMENTS, ACHIEVEMENT_COUNT } from './catalog';
import { diffUnlocks, evaluateAchievements, nextAchievement } from './engine';
import type { AchievementData } from './metrics';

const profile: Profile = {
  id: 'me',
  name: 'Guille',
  age: 28,
  sex: 'male',
  heightCm: 180,
  goal: 'lose',
  startWeightKg: 90,
  goalWeightKg: 80,
  activityLevel: 'moderate',
  units: 'metric',
  startDate: '2026-09-01',
  trainingDays: [0, 2, 4],
  waterGoalMl: 2000,
  stepsGoal: 8000,
  healthFlags: [],
  createdAt: 1,
  updatedAt: 1,
};

const base = (over: Partial<AchievementData> = {}): AchievementData => ({
  today: '2026-10-11',
  profile,
  goals: [{ type: 'lose', startWeightKg: 90, goalWeightKg: 80, startDate: '2026-09-01', reached: false }],
  weights: [],
  water: [],
  steps: [],
  workouts: [],
  templates: [],
  plan: [],
  customExercises: [],
  notes: [],
  bmi: [],
  energy: [],
  snapshots: [],
  resolve: (id) => findCatalogExercise(id),
  ...over,
});

const state = (data: AchievementData, id: string) => evaluateAchievements(data).states.find((s) => s.def.id === id)!;

describe('achievement catalog', () => {
  it('has a broad catalog with unique ids and every rarity', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ACHIEVEMENT_COUNT).toBeGreaterThanOrEqual(75);
    const rarities = new Set(ACHIEVEMENTS.map((a) => a.rarity));
    expect(rarities.size).toBe(5);
  });
});

describe('achievement engine', () => {
  it('does not unlock anything without records', () => {
    const { states } = evaluateAchievements(base({ profile: { ...profile, age: undefined } }));
    const achieved = states.filter((s) => s.achieved).map((s) => s.def.id);
    expect(achieved).toEqual(['starting-point']);
  });

  it('computes weight goal progress from real records', () => {
    const weights: WeightEntry[] = [
      { date: '2026-09-01', kg: 90, createdAt: 1, updatedAt: 1 },
      { date: '2026-10-10', kg: 85, createdAt: 2, updatedAt: 2 },
    ];
    const data = base({ weights });
    expect(state(data, 'halfway').achieved).toBe(true);
    expect(state(data, 'last-stretch').achieved).toBe(false);
    expect(state(data, 'last-stretch').current).toBe(50);
  });

  it('marks weight milestones as not applicable for non-weight goals', () => {
    const s = state(base({ profile: { ...profile, goal: 'strength' }, goals: [] }), 'halfway');
    expect(s.applicable).toBe(false);
  });

  it('evaluates water goals against the goal in force that day', () => {
    const days = ['2026-10-01', '2026-10-02', '2026-10-03'];
    const water: WaterEntry[] = days.map((date, i) => ({ date, time: '10:00', ml: 2000, createdAt: i }));
    expect(state(base({ water }), 'hydration-on').achieved).toBe(true);
    // Raising today's goal must not retroactively revoke past days.
    const snapshots = days.map((date) => ({ date, waterGoalMl: 2000, stepsGoal: 8000 }));
    const raised = base({ water, snapshots, profile: { ...profile, waterGoalMl: 3000 } });
    expect(state(raised, 'hydration-on').achieved).toBe(true);
  });

  it('ignores gaps in history backfilled before joining', () => {
    const weights: WeightEntry[] = [
      { date: '2026-09-01', kg: 90, createdAt: 1, updatedAt: 1 },
      { date: '2026-10-11', kg: 85, createdAt: 2, updatedAt: 2 },
    ];
    const joinedToday = { ...profile, createdAt: new Date(2026, 9, 11, 10).getTime() };
    expect(state(base({ weights, profile: joinedToday }), 'back-on-track').achieved).toBe(false);
  });

  it('counts distinct active days and comebacks', () => {
    const water: WaterEntry[] = [];
    for (let i = 0; i < 7; i++) water.push({ date: addDays('2026-09-01', i), time: '09:00', ml: 250, createdAt: i });
    water.push({ date: '2026-09-20', time: '09:00', ml: 250, createdAt: 99 });
    const data = base({ water });
    expect(state(data, 'first-week').achieved).toBe(true);
    expect(state(data, 'back-on-track').achieved).toBe(true);
    expect(state(data, 'streak-7').achieved).toBe(true);
  });

  it('never unlocks twice and revokes when records disappear', () => {
    const weights: WeightEntry[] = [{ date: '2026-10-10', kg: 85, createdAt: 1, updatedAt: 1 }];
    const { states } = evaluateAchievements(base({ weights }));
    const first = diffUnlocks(states, []);
    expect(first.unlock).toContain('first-step');
    const persisted = first.unlock.map((id) => ({ id, unlockedAt: 1, seen: false }));
    expect(diffUnlocks(states, persisted).unlock).toHaveLength(0);
    const { states: after } = evaluateAchievements(base({ weights: [] }));
    expect(diffUnlocks(after, persisted).revoke).toContain('first-step');
  });

  it('suggests the next reachable achievement', () => {
    const next = nextAchievement(evaluateAchievements(base()).states);
    expect(next).toBeDefined();
    expect(next?.achieved).toBe(false);
  });
});
