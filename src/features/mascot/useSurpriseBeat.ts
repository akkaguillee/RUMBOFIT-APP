import { useEffect, useState } from 'react';
import type { MascotExpression } from './expression';

/**
 * A short "oh!" before the face settles: returns 'surprised' for `ms` after
 * `trigger` changes to a new non-empty value while mounted (for example when
 * an extra tip appears), then `face`. A value present on mount does not count.
 */
export function useSurpriseBeat(face: MascotExpression, trigger: string | undefined, ms = 750): MascotExpression {
  const [seen, setSeen] = useState(trigger);
  const [beat, setBeat] = useState<string | null>(null);
  if (trigger !== seen) {
    setSeen(trigger);
    setBeat(trigger ?? null);
  }
  useEffect(() => {
    if (!beat) return;
    const id = window.setTimeout(() => setBeat(null), ms);
    return () => window.clearTimeout(id);
  }, [beat, ms]);
  return beat ? 'surprised' : face;
}
