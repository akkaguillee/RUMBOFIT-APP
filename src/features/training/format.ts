import type { ExerciseMeasure, SetEntry } from '@/domain/types';
import { formatDuration } from '@/domain/dates';
import { formatNumber } from '@/domain/units';

export function formatSet(set: Pick<SetEntry, 'kg' | 'reps' | 'durationSec' | 'distanceKm'>, measure: ExerciseMeasure): string {
  switch (measure) {
    case 'weight_reps':
      return `${set.kg !== undefined ? `${formatNumber(set.kg, 2)} kg` : '—'} × ${set.reps ?? '—'}`;
    case 'reps':
      return `${set.reps ?? '—'} reps`;
    case 'time':
      return set.durationSec ? formatDuration(set.durationSec) : '—';
    case 'distance_time':
      return [set.distanceKm ? `${formatNumber(set.distanceKm, 2)} km` : '', set.durationSec ? formatDuration(set.durationSec) : ''].filter(Boolean).join(' · ') || '—';
  }
}

/** Parses "mm:ss", "h:mm:ss" or plain minutes. */
export function parseDuration(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  if (/^\d+([.,]\d+)?$/.test(s)) return Math.round(Number(s.replace(',', '.')) * 60);
  const parts = s.split(':').map((p) => Number(p));
  if (parts.some((p) => Number.isNaN(p) || p < 0)) return null;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  return null;
}

export function durationToInput(sec?: number): string {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const REST_OPTIONS = [30, 45, 60, 90, 120, 150, 180, 240];
