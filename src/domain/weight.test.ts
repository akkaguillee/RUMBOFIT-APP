import { describe, expect, it } from 'vitest';
import type { WeightEntry } from './types';
import { assessTrend, buildPoints, changeOverDays, filterRange, goalDirection, goalProgress, latestWeight, sortWeights } from './weight';

const w = (date: string, kg: number, time?: string): WeightEntry => ({ date, kg, time, createdAt: 1, updatedAt: 1 });

describe('weight', () => {
  it('computes progress from start to target', () => {
    // 90 → 85 with goal 80: 5 kg lost, 50 % of the way
    expect(goalProgress(90, 85, 80)).toBeCloseTo(0.5);
    expect(goalProgress(60, 63, 66)).toBeCloseTo(0.5);
    expect(goalProgress(70, 70, 70)).toBeNull();
    expect(goalDirection('lose', 90, 80)).toBe('down');
    expect(goalDirection('gain', 60, 66)).toBe('up');
  });

  it('sorts by date and time', () => {
    const sorted = sortWeights([w('2026-01-02', 80, '08:00'), w('2026-01-01', 81), w('2026-01-02', 79.5, '07:00')]);
    expect(sorted.map((e) => e.kg)).toEqual([81, 79.5, 80]);
    expect(latestWeight(sorted)?.kg).toBe(80);
  });

  it('keeps same-day untimed records in logging order', () => {
    const morning = new Date(2026, 9, 11, 8, 0).getTime();
    const later = new Date(2026, 9, 11, 13, 0).getTime();
    const a: WeightEntry = { date: '2026-10-11', kg: 85.4, createdAt: later, updatedAt: later };
    const b: WeightEntry = { date: '2026-10-11', kg: 84.7, time: '11:50', createdAt: later + 5, updatedAt: later + 5 };
    const c: WeightEntry = { date: '2026-10-11', kg: 86, createdAt: morning, updatedAt: morning };
    expect(sortWeights([a, b, c]).map((e) => e.kg)).toEqual([86, 84.7, 85.4]);
  });

  it('breaks same-minute ties by logging order', () => {
    const a: WeightEntry = { date: '2026-10-11', time: '12:15', kg: 85.4, createdAt: 1_000_999, updatedAt: 1 };
    const b: WeightEntry = { date: '2026-10-11', time: '12:15', kg: 84.7, createdAt: 1_001_001, updatedAt: 1 };
    expect(sortWeights([b, a]).map((e) => e.kg)).toEqual([85.4, 84.7]);
  });

  it('filters ranges with real records only', () => {
    const entries = [w('2026-01-01', 90), w('2026-09-20', 86), w('2026-10-10', 85)];
    expect(filterRange(entries, '30d', '2026-10-11')).toHaveLength(2);
    expect(filterRange(entries, '7d', '2026-10-11')).toHaveLength(1);
    expect(filterRange(entries, 'all', '2026-10-11')).toHaveLength(3);
  });

  it('builds tooltip points with deltas', () => {
    const pts = buildPoints(sortWeights([w('2026-10-01', 90), w('2026-10-05', 89), w('2026-10-09', 88.4)]), 90, 80);
    expect(pts[0]?.deltaPrev).toBeNull();
    expect(pts[2]?.deltaPrev).toBe(-0.6);
    expect(pts[2]?.deltaStart).toBe(-1.6);
    expect(pts[2]?.progress).toBeCloseTo(0.16);
  });

  it('requires enough data for a trend', () => {
    const t = assessTrend([w('2026-10-10', 80), w('2026-10-11', 80.4)], 'down', '2026-10-11');
    expect(t.reliable).toBe(false);
    expect(t.label).toBe('Datos insuficientes');
  });

  it('judges the trend, not a single day', () => {
    const entries = [w('2026-09-25', 82), w('2026-09-29', 81.6), w('2026-10-03', 81.1), w('2026-10-07', 80.8), w('2026-10-11', 81.0)];
    const t = assessTrend(entries, 'down', '2026-10-11');
    expect(t.reliable).toBe(true);
    expect(t.tone).toBe('good');
  });

  it('does not use records far older than the window', () => {
    expect(changeOverDays([w('2026-09-01', 90), w('2026-10-11', 85.4)], 7, '2026-10-11')).toBeNull();
  });

  it('compares with a week ago', () => {
    const c = changeOverDays([w('2026-10-01', 82), w('2026-10-04', 81.5), w('2026-10-11', 81)], 7, '2026-10-11');
    expect(c?.from.kg).toBe(81.5);
    expect(c?.delta).toBe(-0.5);
  });
});
