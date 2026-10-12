import { describe, expect, it } from 'vitest';
import { addDays, type DateKey } from '../dates';
import type { Profile } from '../types';
import type { TipContext, TipInputs } from './context';
import { ctxFor, lastDays, planDay, profile, steps, TODAY, water, weight, workout } from './fixtures';
import { gatherCandidates, REPEAT_WINDOW_DAYS, sameDayRecord, selectDailyTips, tipSignals } from './select';
import { ruleSource } from './source';
import { parseDayRecord, parseHistory, rememberShown, staleDayKeys, tipDayKey, TIP_HISTORY_KEY } from './storage';
import type { DailyTips, ShownTip, TipCandidate, TipDayRecord, TipSource } from './types';

const RICH: Partial<Profile> = {
  activity: { posture: 'sitting', job: 'desk', trainingDays: 3, activityTypes: ['walking'], experience: 'beginner' },
  food: { difficulties: ['impulse', 'portions', 'planning'], eatingOut: 'daily' },
  motivation: { blockers: ['time', 'stress', 'results'], dailyMinutes: 10, style: 'small' },
  wellbeing: { sleepHours: 'lt6', stress: 'high' },
};

/** Simulates the hook: today's stored record plus the shown-tips history. */
class Day {
  record: TipDayRecord | null = null;
  recent: ShownTip[] = [];
  run(ctx: TipContext, today: DateKey = ctx.today, sources?: TipSource[]): DailyTips {
    const day = this.record?.date === today ? this.record : null;
    const tips = selectDailyTips(ctx, { day, recent: this.recent }, today, sources);
    if (!tips) throw new Error('no tip');
    this.record = tips.record;
    this.recent = rememberShown(this.recent, tips.extra ? [tips.main, tips.extra] : [tips.main], today);
    return tips;
  }
}

const at = (today: DateKey, patch: Partial<TipInputs> = {}) => ctxFor({ ...patch, today });

describe('selectDailyTips', () => {
  it('is deterministic and never reads the clock', () => {
    const ctx = ctxFor({ profile: profile(RICH), water: [water(TODAY, 500)] });
    const a = selectDailyTips(ctx, { recent: [] }, TODAY);
    const b = selectDailyTips(ctx, { recent: [] }, TODAY);
    expect(a).toEqual(b);
    expect(a?.record).toEqual({ date: TODAY, mainId: a?.main.id, baseline: tipSignals(ctx) });
    expect(a?.extra).toBeUndefined();
  });

  it('keeps the same main tip all day while it still applies, with fresh numbers', () => {
    const day = new Day();
    const noTraining = profile({ trainingDays: [] });
    const first = day.run(ctxFor({ profile: noTraining, water: [water(addDays(TODAY, -1), 1500), water(TODAY, 250)] }));
    expect(first.main.id).toBe('water-today');
    expect(first.main.title).toBe('Te faltan 1,75 L de agua');

    // More data during the day: other tips now outrank it, but today's tip stays.
    const later = day.run(
      ctxFor({ water: [water(addDays(TODAY, -1), 1500), water(TODAY, 1250)], plan: [planDay(2, 'Pierna')], profile: profile(RICH) }),
    );
    expect(later.main.id).toBe('water-today');
    expect(later.main.title).toBe('Te faltan 750 ml de agua');
    expect(later.record.mainId).toBe(first.record.mainId);
    expect(later.extra).toBeUndefined();
  });

  it('chooses again only when the stored tip no longer applies', () => {
    const day = new Day();
    const base = { profile: profile(RICH), plan: [planDay(2, 'Pierna')], steps: [steps(addDays(TODAY, -1), 4000)] };
    const first = day.run(ctxFor(base));
    expect(first.main.id).toBe('training-planned');

    // The planned workout is done: the main tip changes, and the change itself becomes the extra tip.
    const done = day.run(ctxFor({ ...base, workouts: [workout(TODAY)] }));
    expect(done.main.id).not.toBe('training-planned');
    expect(done.main.id).not.toBe('workout-done');
    expect(done.extra?.id).toBe('workout-done');
    expect(done.record.baseline).toEqual(first.record.baseline);

    // The new choice is stable from then on.
    expect(day.run(ctxFor({ ...base, workouts: [workout(TODAY)] })).main.id).toBe(done.main.id);
  });

  it('keeps the tip already shown today when the day record is missing (e.g. history saved first at midnight)', () => {
    const ctx = ctxFor({ profile: profile(RICH) });
    const first = selectDailyTips(ctx, { recent: [] }, TODAY)!;
    const recent = rememberShown([], [first.main], TODAY);
    const again = selectDailyTips(ctx, { day: null, recent }, TODAY)!;
    expect(again.main.id).toBe(first.main.id);
    expect(again.record).toEqual(first.record);
    // Only today's entries count: yesterday's tip is still not repeated.
    const tomorrow = addDays(TODAY, 1);
    expect(selectDailyTips(at(tomorrow, { profile: profile(RICH) }), { day: null, recent }, tomorrow)?.main.id).not.toBe(first.main.id);
  });

  it('keeps the planned-workout tip when the session starts', () => {
    const day = new Day();
    const base = { profile: profile(RICH), plan: [planDay(2, 'Pierna')], steps: [steps(addDays(TODAY, -1), 4000)] };
    expect(day.run(ctxFor(base)).main.id).toBe('training-planned');
    const started = day.run(ctxFor({ ...base, workouts: [workout(TODAY, 'active')] }));
    expect(started.main).toMatchObject({ id: 'training-planned', body: expect.stringContaining('ya está en marcha') });
    expect(day.recent.filter((r) => r.date === TODAY).map((r) => r.id)).toEqual(['training-planned']);
  });

  it('celebrates the weight goal once, not every week while it is kept', () => {
    const day = new Day();
    const celebrated: DateKey[] = [];
    for (let i = 0; i < 60; i++) {
      const today = addDays(TODAY, i);
      const weighIns = lastDays(i + 1, today).filter((_, j) => j % 3 === 0).map((d) => weight(d, 79.5));
      const tips = day.run(at(today, { profile: profile(RICH), weights: [weight('2026-06-01', 90), ...weighIns] }));
      if (tips.main.id === 'weight-goal-reached' || tips.extra?.id === 'weight-goal-reached') celebrated.push(today);
    }
    expect(celebrated).toEqual([TODAY]);
  });

  it('does not repeat a tip shown in the last 7 days while alternatives exist', () => {
    const day = new Day();
    const shown: { date: DateKey; id: string; alternatives: number }[] = [];
    for (let i = 0; i < 21; i++) {
      const today = addDays(TODAY, i);
      const ctx = at(today, { profile: profile(RICH), water: lastDays(3, today).map((d) => water(d, 500)) });
      const before = new Set(shown.filter((s) => s.date >= addDays(today, -REPEAT_WINDOW_DAYS)).map((s) => s.id));
      const alternatives = gatherCandidates(ctx).filter((c) => !before.has(c.id)).length;
      const { main } = day.run(ctx);
      if (alternatives > 0) expect(before.has(main.id), `${today}: ${main.id}`).toBe(false);
      shown.push({ date: today, id: main.id, alternatives });
    }
    expect(new Set(shown.slice(0, 8).map((s) => s.id)).size).toBe(8);
  });

  it('repeats a tip only when there is no alternative, oldest first', () => {
    const only = (ids: string[]): TipSource => ({
      id: 'test',
      candidates: () => ids.map((id, i) => ({ id, topic: 'mindset', title: 'Título', body: 'Texto del consejo.', priority: 50 - i })),
      resume: () => null,
    });
    const day = new Day();
    const ids = [0, 1, 2, 3].map((i) => day.run(at(addDays(TODAY, i)), addDays(TODAY, i), [only(['a', 'b'])]).main.id);
    expect(ids).toEqual(['a', 'b', 'a', 'b']);
  });

  it('adds one extra tip only after a significant change during the day', () => {
    const day = new Day();
    const away = { water: [water(addDays(TODAY, -6), 250)], plan: [planDay(2, 'Pierna')] };
    const morning = day.run(ctxFor(away));
    expect(morning.main.id).toBe('comeback-return');
    expect(morning.extra).toBeUndefined();

    // Ordinary changes: no extra.
    expect(day.run(ctxFor({ ...away, steps: [] })).extra).toBeUndefined();

    // First record after 6 days away: the main tip stays (now in the past tense) and the extra acknowledges it.
    const back = day.run(ctxFor({ ...away, water: [...away.water, water(TODAY, 250)] }));
    expect(back.main.id).toBe('comeback-return');
    expect(back.main.body).toContain('Habían pasado 6 días desde tu último registro');
    expect(back.main.body).not.toMatch(/Han pasado|regístrala/);
    expect(back.extra?.id).toBe('comeback-done');

    // Later the workout is finished too: still the same single extra tip.
    const later = day.run(ctxFor({ ...away, water: [...away.water, water(TODAY, 250)], workouts: [workout(TODAY)] }));
    expect(later.extra?.id).toBe('comeback-done');
    expect(later.record.extraId).toBe('comeback-done');
  });

  it('gives no extra tip for changes that had already happened when the day’s tip was chosen', () => {
    const day = new Day();
    const data = { water: [water(TODAY, 2000)], steps: [steps(TODAY, 9000)], profile: profile({ trainingDays: [] }) };
    const first = day.run(ctxFor(data));
    expect(first.main.id).toBe('goals-all-met');
    expect(first.record.baseline.allGoals).toBe(true);
    expect(day.run(ctxFor(data)).extra).toBeUndefined();
  });

  it('reacts to all goals met and to the weight goal reached', () => {
    const goals = new Day();
    const p = profile({ trainingDays: [] });
    goals.run(ctxFor({ profile: p, water: [water(TODAY, 500)] }));
    expect(goals.run(ctxFor({ profile: p, water: [water(TODAY, 2000)], steps: [steps(TODAY, 8000)] })).extra?.id).toBe('goals-all-met');

    const weightDay = new Day();
    weightDay.run(ctxFor({ weights: [weight(addDays(TODAY, -1), 81)] }));
    const reached = weightDay.run(ctxFor({ weights: [weight(addDays(TODAY, -1), 81), weight(TODAY, 79.9)] }));
    expect(reached.extra?.id).toBe('weight-goal-reached');
  });

  it('never celebrates weight changes with minors or health flags', () => {
    for (const patch of [{ age: 16, ageRecordedOn: TODAY }, { healthFlags: ['eating_disorder' as const] }]) {
      const day = new Day();
      const p = profile(patch);
      day.run(ctxFor({ profile: p, weights: [weight(addDays(TODAY, -1), 81)] }));
      const after = day.run(ctxFor({ profile: p, weights: [weight(addDays(TODAY, -1), 81), weight(TODAY, 79.9)] }));
      expect(after.extra).toBeUndefined();
      expect(after.main.id).not.toMatch(/weight|progress|weighing/);
    }
  });

  it('starts fresh on a new day and ignores records stored for other days', () => {
    const day = new Day();
    const first = day.run(ctxFor({ profile: profile(RICH) }));
    const next = day.run(at(addDays(TODAY, 1), { profile: profile(RICH) }));
    expect(next.record.date).toBe(addDays(TODAY, 1));
    expect(next.main.id).not.toBe(first.main.id);
  });

  it('accepts other sources (such as cached AI tips) and filters unsafe ones', () => {
    const extraSource = (tips: TipCandidate[]): TipSource => ({
      id: 'ai-cache',
      candidates: () => tips,
      resume: (id) => tips.find((t) => t.id === id) ?? null,
    });
    const good: TipCandidate = { id: 'ai-1', topic: 'sleep', title: 'Una idea para hoy', body: 'Cena un poco antes y sal a caminar después.', priority: 99 };
    const unsafe: TipCandidate[] = [
      { ...good, id: 'ai-2', body: 'Haz un ayuno de 24 horas.' },
      { ...good, id: 'ai-3', action: { label: 'Ver', to: '/nutricion' as never } },
      { ...good, id: 'ai-4', title: '' },
      // Unknown topic: the card has no icon for it and the history would drop it, so it would repeat daily.
      { ...good, id: 'ai-7', topic: 'nutrition' as never },
      { ...good, id: 'ai-8', action: { label: ' ', to: '/habitos' } },
    ];
    const ctx = ctxFor();
    const picked = selectDailyTips(ctx, { recent: [] }, TODAY, [extraSource([...unsafe, good]), ruleSource]);
    expect(picked?.main.id).toBe('ai-1');
    expect(gatherCandidates(ctx, [extraSource(unsafe)])).toEqual([]);

    const weightTip: TipCandidate = { ...good, id: 'ai-5', body: 'Te ayudará a perder peso.', priority: 99 };
    const minor = ctxFor({ profile: profile({ age: 15, ageRecordedOn: TODAY }) });
    expect(gatherCandidates(minor, [extraSource([weightTip, { ...good, id: 'ai-6', weight: true }])])).toEqual([]);
  });
});

describe('tip storage', () => {
  it('validates stored records and history', () => {
    const record = { date: TODAY, mainId: 'water-today', baseline: { comeback: false, allGoals: true, workout: false, weightGoal: false } };
    expect(parseDayRecord(record, TODAY)).toEqual(record);
    expect(parseDayRecord({ ...record, extraId: 'workout-done' }, TODAY)?.extraId).toBe('workout-done');
    expect(parseDayRecord(record, addDays(TODAY, 1))).toBeNull();
    expect(parseDayRecord({ date: TODAY }, TODAY)).toBeNull();
    expect(parseDayRecord({ date: TODAY, mainId: 'x', baseline: 'nope' }, TODAY)?.baseline).toEqual({
      comeback: false,
      allGoals: false,
      workout: false,
      weightGoal: false,
    });
    expect(parseDayRecord('junk', TODAY)).toBeNull();

    expect(parseHistory('junk')).toEqual([]);
    expect(parseHistory([{ id: 'a', topic: 'water', date: TODAY }, { id: 'b', topic: 'nope', date: TODAY }, { id: 'c', topic: 'sleep', date: '2026-13-01' }, null])).toEqual([
      { id: 'a', topic: 'water', date: TODAY },
    ]);
  });

  it('remembers shown tips once per day and prunes old entries', () => {
    const tip = { id: 'a', topic: 'water' as const, title: 'T', body: 'B.' };
    const recent: ShownTip[] = [{ id: 'old', topic: 'sleep', date: addDays(TODAY, -40) }];
    const next = rememberShown(recent, [tip], TODAY);
    expect(next).toEqual([{ id: 'a', topic: 'water', date: TODAY }]);
    expect(rememberShown(next, [tip], TODAY)).toBe(next);
  });

  it('compares day records and lists stale day keys', () => {
    const a = { date: TODAY, mainId: 'x', baseline: { comeback: false, allGoals: false, workout: false, weightGoal: false } };
    expect(sameDayRecord(a, { ...a, baseline: { ...a.baseline } })).toBe(true);
    expect(sameDayRecord(a, { ...a, extraId: 'y' })).toBe(false);
    expect(sameDayRecord(null, null)).toBe(true);
    expect(staleDayKeys([tipDayKey(TODAY), tipDayKey(addDays(TODAY, -1)), TIP_HISTORY_KEY, 'streak:celebrated'], TODAY)).toEqual([
      tipDayKey(addDays(TODAY, -1)),
    ]);
  });
});
