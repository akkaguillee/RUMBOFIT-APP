/**
 * Date utilities built around local calendar keys ("YYYY-MM-DD").
 *
 * Records are stored against the user's local calendar day instead of UTC
 * timestamps so that a measurement taken at 23:30 never shows up on the
 * previous or next day after a timezone conversion.
 */

export type DateKey = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now);
}

/** Parses a key as local noon, which keeps arithmetic safe across DST changes. */
export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toDateKey(fromDateKey(value)) === value;
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function addMonths(key: DateKey, months: number): DateKey {
  const d = fromDateKey(key);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return toDateKey(d);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: DateKey, b: DateKey): number {
  const ms = fromDateKey(b).getTime() - fromDateKey(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Monday-based weekday index: 0 = Monday … 6 = Sunday. */
export function weekdayIndex(key: DateKey): number {
  return (fromDateKey(key).getDay() + 6) % 7;
}

export function startOfWeek(key: DateKey): DateKey {
  return addDays(key, -weekdayIndex(key));
}

export function weekDays(key: DateKey): DateKey[] {
  const start = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function monthKey(key: DateKey): string {
  return key.slice(0, 7);
}

export function startOfMonth(key: DateKey): DateKey {
  return `${key.slice(0, 7)}-01`;
}

/** 6×7 grid of days (Monday first) covering the month that contains `key`. */
export function monthGrid(key: DateKey): DateKey[] {
  const first = startOfMonth(key);
  const gridStart = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function rangeKeys(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

export function nowTime(now: Date = new Date()): string {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/** Combines a date key and optional "HH:mm" into a sortable epoch value. */
export function keyToTimestamp(key: DateKey, time?: string): number {
  const d = fromDateKey(key);
  if (time && /^\d{2}:\d{2}$/.test(time)) {
    const [h, m] = time.split(':').map(Number) as [number, number];
    d.setHours(h, m, 0, 0);
  }
  return d.getTime();
}

const locale = 'es-ES';

const fmtFull = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtLong = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' });
const fmtDayMonth = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
const fmtHeader = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' });
const fmtMonthYear = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
const fmtMonthShort = new Intl.DateTimeFormat(locale, { month: 'short' });
const fmtWeekdayShort = new Intl.DateTimeFormat(locale, { weekday: 'short' });

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const clean = (s: string) => s.replace('.', '');

export const formatDate = {
  full: (key: DateKey) => capitalize(fmtFull.format(fromDateKey(key))),
  long: (key: DateKey) => fmtLong.format(fromDateKey(key)),
  dayMonth: (key: DateKey) => clean(fmtDayMonth.format(fromDateKey(key))),
  header: (key: DateKey) => capitalize(fmtHeader.format(fromDateKey(key))),
  monthYear: (key: DateKey) => capitalize(fmtMonthYear.format(fromDateKey(key))),
  monthShort: (key: DateKey) => capitalize(clean(fmtMonthShort.format(fromDateKey(key)))),
  weekdayShort: (key: DateKey) => capitalize(clean(fmtWeekdayShort.format(fromDateKey(key)))),
  relative: (key: DateKey, today: DateKey = todayKey()) => {
    const d = diffDays(key, today);
    if (d === 0) return 'Hoy';
    if (d === 1) return 'Ayer';
    if (d === -1) return 'Mañana';
    if (d > 1 && d < 7) return `Hace ${d} días`;
    return clean(fmtDayMonth.format(fromDateKey(key)));
  },
};

export const WEEKDAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;
export const WEEKDAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 13) return 'Buenos días';
  if (h < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
}

export function formatMinutes(totalSec: number): string {
  const min = Math.round(totalSec / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
