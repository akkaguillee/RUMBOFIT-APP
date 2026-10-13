import { useId } from 'react';
import { cx } from '@/ui/cx';

/*
 * Classic flame silhouette: a tall main tongue whose tip curls to the left,
 * a side lick on each flank (the left one taller) and a full round base. The
 * yellow inner flame has its own small lick, so the shape still reads at 16 px.
 * Original artwork drawn for RUMBO.
 */
export const OUTER =
  'M36 3 C48 6 66 16 72 32 C76 42 74 52 77 58 C81 55 85 51 86 45 C93 54 97 66 96 79 C95 100 76 114 50 114 C25 114 5 100 5 79 C5 63 12 50 21 39 C21 46 23 52 27 56 C29 44 36 36 41 28 C45 21 45 12 36 3 Z';
export const CORE = 'M57 46 C62 58 74 68 74 87 C74 103 63 111 50 111 C37 111 28 103 28 91 C28 85 30 80 33 76 C34 81 37 84 41 85 C40 72 48 60 57 46 Z';

interface Props {
  size?: number;
  /** Lit = today already counts. Unlit flames are quiet and grey. */
  lit?: boolean;
  /** Celebration variant: a warmer, slightly stronger glow. */
  intense?: boolean;
  /** Small inline flames (week rows): no glow and no motion. */
  still?: boolean;
  className?: string;
}

/**
 * Streak flame. Its life comes from three slow CSS loops with unrelated
 * durations (breathing scale + lift, core flicker, ambient glow), so the
 * motion never looks like an obvious repeating GIF. Only transform and
 * opacity animate; everything stops with prefers-reduced-motion.
 */
export function StreakFlame({ size = 64, lit = true, intense = false, still = false, className }: Props) {
  const id = useId().replace(/:/g, '');
  return (
    <span
      className={cx('flame', lit ? 'flame--lit' : 'flame--off', intense && 'flame--intense', still && 'flame--still', className)}
      style={{ width: size, height: size * 1.16 }}
      aria-hidden="true"
    >
      {lit && !still && <span className="flame__glow" />}
      <svg viewBox="0 0 100 116" className="flame__svg">
        <defs>
          <linearGradient id={`${id}-o`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: lit ? '#ee3b3b' : 'var(--flame-off-light)' }} />
            <stop offset="0.42" style={{ stopColor: lit ? '#ff5c1c' : 'var(--flame-off)' }} />
            <stop offset="1" style={{ stopColor: lit ? '#ff9a1f' : 'var(--flame-off-deep)' }} />
          </linearGradient>
          <radialGradient id={`${id}-b`} cx="0.5" cy="0.95" r="0.7">
            <stop offset="0" stopColor="#ffb72e" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ff7a1a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-c`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: lit ? '#ffd23f' : 'var(--flame-off-light)' }} />
            <stop offset="0.6" style={{ stopColor: lit ? '#ffe680' : 'var(--flame-off-light)' }} />
            <stop offset="1" style={{ stopColor: lit ? '#fff4c2' : 'var(--flame-off-light)' }} />
          </linearGradient>
        </defs>
        <path d={OUTER} fill={`url(#${id}-o)`} />
        {lit && <path d={OUTER} fill={`url(#${id}-b)`} />}
        <path d={CORE} fill={`url(#${id}-c)`} className="flame__core" />
      </svg>
    </span>
  );
}
