import { useEffect, useState } from 'react';

/** Re-renders every `interval` ms while `active`. Timers derive from timestamps, not ticks. */
export function useNow(interval = 1000, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), interval);
    const onVis = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [interval, active]);
  return now;
}
