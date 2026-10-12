import { diffDays, type DateKey } from '../dates';
import type { TipContext } from './context';
import { isSafeTip } from './safety';
import { DEFAULT_SOURCES } from './source';
import { TIP_EVENTS, type DailyTips, type ShownTip, type Tip, type TipCandidate, type TipDayRecord, type TipHistory, type TipSignals, type TipSource } from './types';

/** A tip shown within this many days is not repeated while an alternative exists. */
export const REPEAT_WINDOW_DAYS = 7;
/** Topics shown in the last few days lose some priority, so the card doesn't talk about water three days running. */
const RECENT_TOPIC_DAYS = 3;
const TOPIC_PENALTY = 12;

/** Whether each significant change has happened today. */
export function tipSignals(ctx: TipContext): TipSignals {
  return {
    comeback: ctx.records.recordedToday && (ctx.records.gapBeforeToday ?? 0) >= 3,
    allGoals: ctx.goalsToday.allMet,
    workout: ctx.training.doneToday,
    weightGoal: !ctx.gentle && ctx.weight.goalReached,
  };
}

/** FNV-1a: a stable tie-break that changes from one day to the next (no Math.random). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const toTip = ({ id, topic, title, body, action }: TipCandidate): Tip => ({ id, topic, title, body, ...(action ? { action } : {}) });

/** Every safe candidate from every source (the first source to propose an id wins). */
export function gatherCandidates(ctx: TipContext, sources: readonly TipSource[] = DEFAULT_SOURCES): TipCandidate[] {
  const seen = new Set<string>();
  const out: TipCandidate[] = [];
  for (const source of sources) {
    for (const c of source.candidates(ctx)) {
      if (seen.has(c.id) || !isSafeTip(c, ctx.gentle)) continue;
      seen.add(c.id);
      out.push(c);
    }
  }
  return out;
}

function resume(id: string, ctx: TipContext, sources: readonly TipSource[]): TipCandidate | null {
  for (const source of sources) {
    const c = source.resume(id, ctx);
    if (c) return isSafeTip(c, ctx.gentle) ? c : null;
  }
  return null;
}

/**
 * Best candidate for today: highest priority, minus a small penalty for topics
 * seen in the last days. Tips shown in the last week are skipped while any
 * alternative exists; if none does, the one shown longest ago comes back first.
 */
function pick(pool: TipCandidate[], recent: readonly ShownTip[], today: DateKey): TipCandidate | null {
  if (!pool.length) return null;
  const lastShown = new Map<string, DateKey>();
  const recentTopics = new Set<string>();
  for (const r of recent) {
    const ago = diffDays(r.date, today);
    if (ago <= REPEAT_WINDOW_DAYS && (lastShown.get(r.id) ?? '') < r.date) lastShown.set(r.id, r.date);
    if (ago > 0 && ago <= RECENT_TOPIC_DAYS) recentTopics.add(r.topic);
  }
  const score = (c: TipCandidate) => c.priority - (recentTopics.has(c.topic) ? TOPIC_PENALTY : 0);
  const fresh = pool.filter((c) => !lastShown.has(c.id));
  const list = fresh.length ? fresh : pool;
  const sorted = [...list].sort(
    (a, b) =>
      (lastShown.get(a.id) ?? '').localeCompare(lastShown.get(b.id) ?? '') ||
      score(b) - score(a) ||
      hash(today + a.id) - hash(today + b.id) ||
      a.id.localeCompare(b.id),
  );
  return sorted[0] ?? null;
}

/**
 * Today's tips. Pure and deterministic: the same inputs always give the same
 * result, and nothing here reads the clock.
 *
 * - One main tip per day. Once stored it stays all day, rebuilt with fresh
 *   numbers, and is only replaced if it stops applying. Without a stored
 *   record, a tip already shown today (per the history) is kept first.
 * - At most one extra tip per day, and only after a significant change since
 *   the first choice (first record after ≥ 3 days, every daily goal met, a
 *   finished workout, the weight goal reached).
 * - No tip shown in the last 7 days is repeated while an alternative exists.
 */
export function selectDailyTips(
  ctx: TipContext,
  history: TipHistory,
  today: DateKey,
  sources: readonly TipSource[] = DEFAULT_SOURCES,
): DailyTips | null {
  const candidates = gatherCandidates(ctx, sources);
  const signals = tipSignals(ctx);
  const recent = history.recent;
  const day = history.day?.date === today ? history.day : null;

  if (!day) {
    // No stored choice for today: either the first run, or the record isn't readable yet while today's
    // history already is (it's saved alongside, e.g. at midnight while the new day key loads). A tip
    // already shown today wins if it still applies, so storage timing can never swap the main tip.
    const shownToday = recent.filter((r) => r.date === today);
    const again = shownToday.reduce<TipCandidate | null>((found, r) => found ?? resume(r.id, ctx, sources), null);
    const main = again ?? pick(candidates, recent, today);
    return main ? { main: toTip(main), record: { date: today, mainId: main.id, baseline: signals } } : null;
  }

  const changed = new Set(TIP_EVENTS.filter((e) => signals[e] && !day.baseline[e]));
  const kept = resume(day.mainId, ctx, sources);

  let extra: TipCandidate | null = null;
  if (day.extraId) {
    // Already chosen today: show it while it applies, never pick a second one.
    if (day.extraId !== kept?.id) extra = resume(day.extraId, ctx, sources);
  } else if (changed.size) {
    extra = pick(
      candidates.filter((c) => c.event && changed.has(c.event) && c.id !== kept?.id),
      recent,
      today,
    );
  }

  // Replacing a main tip that no longer applies: leave the reaction to today's change to the extra tip.
  const others = candidates.filter((c) => c.id !== extra?.id && c.id !== day.mainId);
  const main = kept ?? pick(others.filter((c) => !(c.event && changed.has(c.event))), recent, today) ?? pick(others, recent, today);
  if (!main) return null;

  const extraId = day.extraId ?? extra?.id;
  return {
    main: toTip(main),
    ...(extra ? { extra: toTip(extra) } : {}),
    record: { date: today, mainId: main.id, baseline: day.baseline, ...(extraId ? { extraId } : {}) },
  };
}

export function sameDayRecord(a: TipDayRecord | null | undefined, b: TipDayRecord | null | undefined): boolean {
  if (!a || !b) return a === b;
  return (
    a.date === b.date && a.mainId === b.mainId && a.extraId === b.extraId && TIP_EVENTS.every((e) => a.baseline[e] === b.baseline[e])
  );
}
