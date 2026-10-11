import { useEffect, useState } from 'react';
import { todayKey } from '@/domain/dates';

/** Current local date key, refreshed at midnight and when the app regains focus. */
export function useToday(): string {
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    const refresh = () => setToday(todayKey());
    const now = new Date();
    const msToMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5).getTime() - now.getTime();
    const t = window.setTimeout(refresh, msToMidnight);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [today]);
  return today;
}
