import { motion, useReducedMotion } from 'motion/react';
import { useId, type ReactNode } from 'react';

interface Props {
  value: number; // 0..1+
  size?: number;
  label: string;
  children?: ReactNode;
}

const wave = (w: number, amp: number) => {
  // Two periods wide so it can loop seamlessly by translating one period.
  let d = `M 0 ${amp}`;
  const period = w;
  for (let x = 0; x < period * 2; x += period / 2) {
    d += ` Q ${x + period / 4} ${x % period === 0 ? -amp : amp * 3} ${x + period / 2} ${amp}`;
  }
  d += ` V 400 H 0 Z`;
  return d;
};

/** Glass vessel whose liquid level rises smoothly with each registered drink. */
export function WaterVessel({ value, size = 220, label, children }: Props) {
  const id = useId();
  const reduce = useReducedMotion();
  const p = Math.max(0, Math.min(1, value));
  const level = size * (1 - p) - (p >= 1 ? 8 : 0);
  return (
    <div
      className={p > 0.42 ? 'vessel vessel--submerged' : 'vessel'}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${Math.round(value * 100)} %`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <clipPath id={`${id}-c`}>
            <circle cx={size / 2} cy={size / 2} r={size / 2 - 6} />
          </clipPath>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--series-water) 70%, #fff)' }} />
            <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--series-water) 80%, #001030)' }} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 2} className="vessel__rim" />
        <g clipPath={`url(#${id}-c)`}>
          <circle cx={size / 2} cy={size / 2} r={size / 2} className="vessel__bg" />
          <motion.g initial={{ y: reduce ? level : size }} animate={{ y: level }} transition={{ type: 'spring', stiffness: 60, damping: 16 }}>
            <g className={reduce ? undefined : 'vessel__wave vessel__wave--back'}>
              <path d={wave(size, 7)} style={{ fill: 'var(--series-water)', opacity: 0.35 }} />
            </g>
            <g className={reduce ? undefined : 'vessel__wave'}>
              <path d={wave(size, 9)} fill={`url(#${id}-g)`} transform="translate(0 6)" />
            </g>
          </motion.g>
          <ellipse cx={size * 0.32} cy={size * 0.26} rx={size * 0.16} ry={size * 0.07} className="vessel__glint" transform={`rotate(-28 ${size * 0.32} ${size * 0.26})`} />
        </g>
      </svg>
      <div className="vessel__center">{children}</div>
    </div>
  );
}
