import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { streakInfo } from './streak';

const today = '2026-10-14'; // a Wednesday
const empty = { weights: [], water: [], steps: [], workouts: [] };
const water = (date: string) => ({ date, time: '10:00', ml: 250, createdAt: 0 });

describe('streakInfo', () => {
  it('counts consecutive active days ending today', () => {
    const data = { ...empty, water: [0, -1, -2].map((n) => water(addDays(today, n))) };
    const s = streakInfo(data, today);
    expect(s.current).toBe(3);
    expect(s.todayActive).toBe(true);
    expect(s.longest).toBe(3);
  });

  it('keeps the streak alive while today is still open', () => {
    const data = { ...empty, water: [-1, -2].map((n) => water(addDays(today, n))) };
    const s = streakInfo(data, today);
    expect(s.current).toBe(2);
    expect(s.todayActive).toBe(false);
  });

  it('breaks after a missed day but remembers the record', () => {
    const data = { ...empty, water: [-2, -3, -4, -5].map((n) => water(addDays(today, n))) };
    const s = streakInfo(data, today);
    expect(s.current).toBe(0);
    expect(s.longest).toBe(4);
  });

  it('ignores zero-step days and unfinished workouts, and maps the current week', () => {
    const data = {
      ...empty,
      steps: [{ date: today, steps: 0, updatedAt: 0 }],
      workouts: [{ date: addDays(today, -1), status: 'active' as const }] as never[],
      weights: [{ date: '2026-10-12', kg: 80, createdAt: 0, updatedAt: 0 }],
    };
    const s = streakInfo(data, today);
    expect(s.current).toBe(0);
    expect(s.week.map((d) => d.active)).toEqual([true, false, false, false, false, false, false]);
    expect(s.week[0]!.date).toBe('2026-10-12');
    expect(s.week[3]!.future).toBe(true);
  });
});
