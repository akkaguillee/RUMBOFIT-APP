import type { CSSProperties } from 'react';
import { fitsKrophed, krophedWidth } from '@/brand/krophed';
import { cx } from './cx';

interface DisplayProps {
  text: string;
  className?: string;
  /** Upper bound for the fitted size (CSS length). */
  max?: string;
}

/**
 * A short word set in Krophed, sized to fill its container (needs an ancestor
 * with container-type: inline-size). Krophed has no accents, ñ, ¿ or ¡: text
 * it cannot set in full falls back to the interface sans-serif instead of
 * mixing faces. Decorative: the page keeps its real heading.
 */
export function Display({ text: raw, className, max }: DisplayProps) {
  // Upper-cased in the string itself: Krophed draws its own lowercase c and o.
  const text = raw.toLocaleUpperCase('es');
  const fits = fitsKrophed(text);
  const style = { '--display-em': (krophedWidth(text) * 1.03).toFixed(3), ...(max ? { '--display-max': max } : {}) } as CSSProperties;
  return (
    <span className={cx(fits ? 'display' : 'display-fallback', className)} style={fits ? style : undefined} aria-hidden="true">
      {text}
    </span>
  );
}
