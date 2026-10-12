import { useEffect, useMemo } from 'react';
import { db } from '@/db/db';
import { useAchievementData, useSetting } from '@/db/hooks';
import { buildTipContext } from '@/domain/tips/context';
import { sameDayRecord, selectDailyTips } from '@/domain/tips/select';
import { parseDayRecord, parseHistory, rememberShown, staleDayKeys, TIP_DAY_PREFIX, TIP_HISTORY_KEY, tipDayKey } from '@/domain/tips/storage';
import type { Tip } from '@/domain/tips/types';
import { useToday } from '@/ui/useToday';

export type DailyTipsState = { status: 'loading' } | { status: 'empty' } | { status: 'ready'; main: Tip; extra?: Tip };

/**
 * Today's tips from the user's real records. The day's choice is stored under
 * `tips:day:<date>` (older day keys are deleted) and the tips shown recently
 * under `tips:history`, so the main tip stays the same all day, reloads
 * included, and nothing is repeated within a week while there are alternatives.
 * Everything runs on the device when the app is open: no background work.
 */
export function useDailyTips(): DailyTipsState {
  const raw = useAchievementData();
  const today = useToday();
  const [storedDay, setDay] = useSetting<unknown>(tipDayKey(today), null);
  const [storedHistory, setHistory] = useSetting<unknown>(TIP_HISTORY_KEY, []);

  const day = useMemo(() => parseDayRecord(storedDay, today), [storedDay, today]);
  const recent = useMemo(() => parseHistory(storedHistory), [storedHistory]);
  const loaded = raw !== undefined && storedDay !== undefined && storedHistory !== undefined;
  const profile = raw?.data.profile;

  const tips = useMemo(() => {
    if (!loaded || !raw || !profile) return null;
    const { weights, water, steps, workouts, plan, snapshots } = raw.data;
    const ctx = buildTipContext({ profile, weights, water, steps, workouts, plan, snapshots, today });
    return selectDailyTips(ctx, { day, recent }, today);
  }, [loaded, raw, profile, day, recent, today]);

  // Persist only what changed: the reads above come back with the same values, so this settles at once.
  useEffect(() => {
    if (!tips) return;
    if (!sameDayRecord(tips.record, day)) void setDay(tips.record).catch(() => undefined);
    const next = rememberShown(recent, tips.extra ? [tips.main, tips.extra] : [tips.main], today);
    if (next !== recent) void setHistory(next).catch(() => undefined);
  }, [tips, day, recent, today, setDay, setHistory]);

  // One choice per day is all that is kept.
  useEffect(() => {
    if (!loaded) return;
    db.settings
      .where('key')
      .startsWith(TIP_DAY_PREFIX)
      .primaryKeys()
      .then((keys) => {
        const stale = staleDayKeys(keys, today);
        return stale.length ? db.settings.bulkDelete(stale) : undefined;
      })
      .catch(() => undefined);
  }, [loaded, today]);

  if (!loaded) return { status: 'loading' };
  if (!tips) return { status: 'empty' };
  return { status: 'ready', main: tips.main, ...(tips.extra ? { extra: tips.extra } : {}) };
}
