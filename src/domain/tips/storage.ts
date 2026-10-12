import { diffDays, isDateKey, type DateKey } from '../dates';
import { TIP_EVENTS, TIP_TOPICS, type ShownTip, type Tip, type TipDayRecord, type TipSignals, type TipTopic } from './types';

/**
 * How the day's choice and the recent history are kept in the settings table.
 * Values may come from an imported backup, so they are validated on the way in.
 */

export const TIP_DAY_PREFIX = 'tips:day:';
export const TIP_HISTORY_KEY = 'tips:history';

/** History entries older than this are dropped (only the last week matters for repeats). */
export const HISTORY_KEEP_DAYS = 21;
const HISTORY_MAX = 60;

export const tipDayKey = (date: DateKey) => `${TIP_DAY_PREFIX}${date}`;

/** Day keys other than today's: safe to delete, so storage never grows. */
export const staleDayKeys = (keys: readonly string[], today: DateKey) => keys.filter((k) => k.startsWith(TIP_DAY_PREFIX) && k !== tipDayKey(today));

const TOPICS = new Set<string>(TIP_TOPICS);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 80;

export function parseDayRecord(value: unknown, today: DateKey): TipDayRecord | null {
  if (!isObject(value) || value.date !== today || !isId(value.mainId)) return null;
  const raw = isObject(value.baseline) ? value.baseline : {};
  const baseline = Object.fromEntries(TIP_EVENTS.map((e) => [e, raw[e] === true])) as TipSignals;
  return { date: today, mainId: value.mainId, baseline, ...(isId(value.extraId) ? { extraId: value.extraId } : {}) };
}

export function parseHistory(value: unknown): ShownTip[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v): ShownTip[] =>
    isObject(v) && isId(v.id) && typeof v.topic === 'string' && TOPICS.has(v.topic) && typeof v.date === 'string' && isDateKey(v.date)
      ? [{ id: v.id, topic: v.topic as TipTopic, date: v.date }]
      : [],
  );
}

/**
 * Adds today's shown tips to the history and drops old entries. Returns the
 * same array when nothing changed, so callers can skip the write.
 */
export function rememberShown(recent: ShownTip[], tips: readonly Tip[], today: DateKey): ShownTip[] {
  const kept = recent.filter((r) => Math.abs(diffDays(r.date, today)) <= HISTORY_KEEP_DAYS);
  const added = tips.filter((t) => !kept.some((r) => r.id === t.id && r.date === today)).map((t) => ({ id: t.id, topic: t.topic, date: today }));
  if (!added.length && kept.length === recent.length && kept.length <= HISTORY_MAX) return recent;
  return [...kept, ...added].slice(-HISTORY_MAX);
}
