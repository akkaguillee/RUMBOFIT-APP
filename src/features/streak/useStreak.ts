import { useMemo } from 'react';
import { useAchievementData } from '@/db/hooks';
import { streakInfo, type StreakInfo } from '@/domain/streak';
import { useToday } from '@/ui/useToday';

/** Live streak, recomputed whenever any record changes. */
export function useStreak(): StreakInfo | undefined {
  const raw = useAchievementData();
  const today = useToday();
  return useMemo(() => (raw ? streakInfo(raw.data, today) : undefined), [raw, today]);
}
