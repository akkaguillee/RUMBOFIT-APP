import type { Units } from './types';

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;
export const ML_PER_FLOZ = 29.5735;

const nf = (digits: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: digits });
const nfFixed = (digits: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const intFmt = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 0,
  // es-ES skips grouping for 4-digit numbers by default; "always" keeps 8.500 readable.
  useGrouping: 'always',
} as Intl.NumberFormatOptions);

export function formatNumber(value: number, digits = 1): string {
  return nf(digits).format(value);
}

export function formatFixed(value: number, digits = 1): string {
  return nfFixed(digits).format(value);
}

export function formatInt(value: number): string {
  return intFmt.format(Math.round(value));
}

export function formatSigned(value: number, digits = 1, unit = ''): string {
  const rounded = Number(value.toFixed(digits));
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '±';
  return `${sign}${formatNumber(Math.abs(rounded), digits)}${unit ? ` ${unit}` : ''}`;
}

/** Parses user input accepting both comma and dot as decimal separators. */
export function parseDecimal(input: string): number | null {
  const normalized = input.trim().replace(/\s/g, '').replace(',', '.');
  if (normalized === '' || !/^-?\d*\.?\d+$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export const weightUnit = (u: Units) => (u === 'metric' ? 'kg' : 'lb');
export const kgToDisplay = (kg: number, u: Units) => (u === 'metric' ? kg : kg / KG_PER_LB);
export const displayToKg = (v: number, u: Units) => (u === 'metric' ? v : v * KG_PER_LB);

export const heightUnit = (u: Units) => (u === 'metric' ? 'cm' : 'in');
export const cmToDisplay = (cm: number, u: Units) => (u === 'metric' ? cm : cm / CM_PER_IN);
export const displayToCm = (v: number, u: Units) => (u === 'metric' ? v : v * CM_PER_IN);

export const volumeUnit = (u: Units) => (u === 'metric' ? 'ml' : 'fl oz');
export const mlToDisplay = (ml: number, u: Units) => (u === 'metric' ? ml : ml / ML_PER_FLOZ);
export const displayToMl = (v: number, u: Units) => (u === 'metric' ? v : v * ML_PER_FLOZ);

export const distanceUnit = (u: Units) => (u === 'metric' ? 'km' : 'mi');
export const kmToDisplay = (km: number, u: Units) => (u === 'metric' ? km : km / 1.609344);

export function formatWeight(kg: number, u: Units, digits = 1): string {
  return `${formatNumber(kgToDisplay(kg, u), digits)} ${weightUnit(u)}`;
}

export function formatHeight(cm: number, u: Units): string {
  if (u === 'metric') return `${formatNumber(cm, 0)} cm`;
  const totalIn = cm / CM_PER_IN;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return `${ft} ft ${inch} in`;
}

export function formatVolume(ml: number, u: Units): string {
  if (u === 'metric') {
    return ml >= 1000 ? `${formatNumber(ml / 1000, 2)} L` : `${formatInt(ml)} ml`;
  }
  return `${formatNumber(ml / ML_PER_FLOZ, 1)} fl oz`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
