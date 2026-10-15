import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useId, useState, type ReactNode } from 'react';

interface Props {
  value: number; // 0..1 (values above 1 are shown full)
  size?: number;
  stroke?: number;
  tone?: 'accent' | 'water' | 'steps' | 'good';
  label: string;
  children?: ReactNode;
  className?: string;
}

const gradients: Record<NonNullable<Props['tone']>, [string, string]> = {
  accent: ['var(--acc-lo)', 'var(--acc-lav)'],
  water: ['color-mix(in srgb, var(--series-water) 55%, #001)', 'var(--series-water)'],
  steps: ['color-mix(in srgb, var(--series-steps) 55%, #100)', 'var(--series-steps)'],
  good: ['var(--good-deep)', 'var(--good)'],
};

export function ProgressRing({ value, size = 120, stroke = 10, tone = 'accent', label, children, className }: Props) {
  const id = useId();
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const clamped = Math.max(0, Math.min(1, value));
  const [from, to] = gradients[tone];

  // Reaching the goal while on screen (not on arrival) sends a soft ripple out of the ring.
  const [seen, setSeen] = useState(value);
  const [burst, setBurst] = useState(0);
  if (value !== seen) {
    setSeen(value);
    if (seen < 1 && value >= 1) setBurst((b) => b + 1);
  }

  return (
    <div
      className={className}
      style={{ position: 'relative', width: size, height: size, flex: 'none' }}
      role="img"
      aria-label={`${label}: ${Math.round(value * 100)} %`}
    >
      <AnimatePresence>
        {burst > 0 && !reduce && (
          <motion.span
            key={burst}
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `${Math.max(2, stroke / 3)}px solid ${to}`, pointerEvents: 'none' }}
            initial={{ scale: 0.92, opacity: 0.7 }}
            animate={{ scale: 1.32, opacity: 0, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.75 } }}
            onAnimationComplete={() => setBurst(0)}
          />
        )}
      </AnimatePresence>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: from }} />
            <stop offset="100%" style={{ stopColor: to }} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: 'var(--control-fill-hover)' }} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          // Opacity is animated too: a static style would keep its first-render value.
          initial={{ pathLength: reduce ? clamped : 0, opacity: clamped === 0 ? 0 : 1 }}
          animate={{ pathLength: clamped || 0.0001, opacity: clamped === 0 ? 0 : 1 }}
          transition={{ duration: reduce ? 0 : 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.1, opacity: { duration: 0.2 } }}
        />
      </svg>
      {children && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{children}</div>
      )}
    </div>
  );
}
