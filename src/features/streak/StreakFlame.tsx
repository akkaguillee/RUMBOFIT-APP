import { useId } from 'react';
import { cx } from '@/ui/cx';

/*
 * Symmetric flame (mirror axis x = 50): a tall central tongue, two lower side
 * licks and a full rounded base. The inner core is a simple teardrop so the
 * flame still reads clearly at 16 px.
 */
const OUTER =
  'M50 0 C53 18 65 32 69 48 C73 43 77 37 79 28 C87 40 90 56 88 76 C86 100 70 116 50 116 C30 116 14 100 12 76 C10 56 13 40 21 28 C23 37 27 43 31 48 C35 32 47 18 50 0 Z';
const CORE = 'M50 46 C54 60 67 70 67 88 C67 104 59 112 50 112 C41 112 33 104 33 88 C33 70 46 60 50 46 Z';

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
            <stop offset="0" style={{ stopColor: lit ? '#ffb547' : 'var(--flame-off-light)' }} />
            <stop offset="0.55" style={{ stopColor: lit ? '#ff7a2f' : 'var(--flame-off)' }} />
            <stop offset="1" style={{ stopColor: lit ? '#e53945' : 'var(--flame-off-deep)' }} />
          </linearGradient>
          <linearGradient id={`${id}-c`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: lit ? '#fff1c7' : 'var(--flame-off-light)' }} />
            <stop offset="1" style={{ stopColor: lit ? '#ffc24a' : 'var(--flame-off-light)' }} />
          </linearGradient>
        </defs>
        <path d={OUTER} fill={`url(#${id}-o)`} />
        <path d={CORE} fill={`url(#${id}-c)`} className="flame__core" />
      </svg>
    </span>
  );
}
