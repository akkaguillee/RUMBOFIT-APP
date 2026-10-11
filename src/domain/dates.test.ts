import { describe, expect, it } from 'vitest';
import { addDays, addMonths, diffDays, fromDateKey, isDateKey, monthGrid, startOfWeek, toDateKey, weekdayIndex, formatDuration } from './dates';

describe('dates', () => {
  it('builds local keys without UTC shifts', () => {
    const lateNight = new Date(2026, 2, 14, 23, 45);
    expect(toDateKey(lateNight)).toBe('2026-03-14');
    const earlyMorning = new Date(2026, 2, 15, 0, 5);
    expect(toDateKey(earlyMorning)).toBe('2026-03-15');
  });

  it('round-trips keys', () => {
    expect(toDateKey(fromDateKey('2026-10-25'))).toBe('2026-10-25');
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-02-28')).toBe(true);
  });

  it('adds days across DST and month boundaries', () => {
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(diffDays('2026-03-28', '2026-04-02')).toBe(5);
  });

  it('clamps month arithmetic', () => {
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2026-01-15', 12)).toBe('2027-01-15');
  });

  it('uses Monday as the first weekday', () => {
    expect(weekdayIndex('2026-10-12')).toBe(0); // Monday
    expect(weekdayIndex('2026-10-11')).toBe(6); // Sunday
    expect(startOfWeek('2026-10-11')).toBe('2026-10-05');
    const grid = monthGrid('2026-10-11');
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe('2026-09-28');
  });

  it('formats durations', () => {
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(3725)).toBe('1:02:05');
  });
});
