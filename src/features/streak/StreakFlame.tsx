import { motion, useReducedMotion } from 'motion/react';
import { useId } from 'react';

/* Three flame layers, each with three keyframe shapes that share the exact
   same path structure (M + 6 C + Z) so they morph smoothly into each other. */
const OUTER = [
  'M50 116 C27 116 13 101 13 80 C13 61 25 50 31 30 C38 41 43 47 46 52 C49 36 55 20 57 4 C75 19 87 44 87 75 C87 100 72 116 50 116 Z',
  'M50 116 C26 116 12 100 14 79 C15 60 28 48 34 28 C40 40 44 46 47 50 C52 34 60 19 60 6 C77 22 88 46 86 76 C85 100 71 116 50 116 Z',
  'M50 116 C28 116 14 102 14 81 C14 62 24 52 28 33 C36 43 42 48 45 53 C47 37 52 21 53 3 C72 18 86 42 87 73 C88 99 73 116 50 116 Z',
];
const MID = [
  'M50 114 C35 114 26 104 26 89 C26 76 34 68 38 56 C42 64 45 68 47 71 C50 60 54 50 55 40 C66 50 74 66 74 87 C74 104 64 114 50 114 Z',
  'M50 114 C34 114 25 103 27 88 C28 75 36 66 41 55 C45 63 47 67 49 70 C52 58 57 49 58 42 C68 53 75 68 73 88 C72 104 63 114 50 114 Z',
  'M50 114 C36 114 27 105 27 90 C27 77 33 70 36 59 C41 66 44 70 46 73 C48 61 51 52 51 41 C63 50 73 64 74 86 C75 104 65 114 50 114 Z',
];
const CORE = [
  'M50 112 C42 112 37 106 37 98 C37 90 42 85 45 78 C48 84 50 86 51 88 C53 82 55 77 56 72 C61 78 64 86 63 96 C62 106 57 112 50 112 Z',
  'M50 112 C41 112 36 105 38 97 C39 89 44 84 47 77 C49 83 51 85 52 87 C54 80 57 76 58 73 C63 80 65 88 63 97 C62 106 57 112 50 112 Z',
  'M50 112 C43 112 38 107 38 99 C38 91 42 87 44 80 C47 85 49 87 50 89 C52 83 53 78 53 71 C59 77 63 85 63 95 C63 106 58 112 50 112 Z',
];

/** Embers drifting up from the flame (deterministic layout). */
const EMBERS = [
  { x: 42, drift: -10, r: 1.8, delay: 0, dur: 1.9 },
  { x: 56, drift: 8, r: 1.4, delay: 0.55, dur: 1.6 },
  { x: 49, drift: -4, r: 2.2, delay: 1.1, dur: 2.1 },
  { x: 60, drift: 12, r: 1.3, delay: 1.5, dur: 1.7 },
  { x: 38, drift: -14, r: 1.2, delay: 0.85, dur: 1.8 },
];

const loop = (duration: number, delay = 0) => ({ duration, delay, repeat: Infinity, repeatType: 'mirror' as const, ease: [0.45, 0, 0.55, 1] as const });

interface Props {
  size?: number;
  /** Lit = today already counts. Unlit flames are grey and only breathe. */
  lit?: boolean;
  /** Bigger flicker, glow and embers (celebration). */
  intense?: boolean;
  className?: string;
}

/**
 * Streak flame drawn in SVG and animated with JavaScript keyframes in a
 * motion-graphics style: three morphing layers with offset timing, a sway
 * anchored at the base, a pulsing glow and embers rising off the tip.
 */
export function StreakFlame({ size = 64, lit = true, intense = false, className }: Props) {
  const id = useId().replace(/:/g, '');
  const reduce = useReducedMotion();
  const animate = !reduce;
  const speed = intense ? 0.75 : 1;

  return (
    <svg
      viewBox="0 0 100 120"
      width={size}
      height={size * 1.2}
      className={className}
      aria-hidden="true"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`${id}-o`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" style={{ stopColor: lit ? '#ff3b1d' : 'var(--flame-off-deep)' }} />
          <stop offset="1" style={{ stopColor: lit ? '#ff9a1f' : 'var(--flame-off)' }} />
        </linearGradient>
        <linearGradient id={`${id}-m`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" style={{ stopColor: lit ? '#ff8a00' : 'var(--flame-off)' }} />
          <stop offset="1" style={{ stopColor: lit ? '#ffc93c' : 'var(--flame-off-light)' }} />
        </linearGradient>
        <linearGradient id={`${id}-c`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" style={{ stopColor: lit ? '#ffd84d' : 'var(--flame-off-light)' }} />
          <stop offset="1" style={{ stopColor: lit ? '#fff7d6' : 'var(--flame-off-light)' }} />
        </linearGradient>
        <radialGradient id={`${id}-g`}>
          <stop offset="0" stopColor="#ff8a1f" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff8a1f" stopOpacity="0" />
        </radialGradient>
      </defs>

      {lit && (
        <motion.ellipse
          cx="50"
          cy="82"
          rx="52"
          ry="46"
          fill={`url(#${id}-g)`}
          initial={{ opacity: 0.55, scale: 1 }}
          animate={animate ? { opacity: intense ? [0.6, 1, 0.6] : [0.45, 0.75, 0.45], scale: intense ? [1, 1.15, 1] : [0.95, 1.04, 0.95] } : undefined}
          transition={animate ? { duration: 2.2 * speed, repeat: Infinity, ease: 'easeInOut' } : undefined}
          style={{ transformBox: 'fill-box', transformOrigin: '50% 60%' }}
        />
      )}

      <motion.g
        animate={animate ? (lit ? { rotate: [-2.5, 2.5], scaleY: [1, 1.04] } : { scaleY: [1, 1.02] }) : undefined}
        transition={animate ? loop((lit ? 1.4 : 2.6) * speed) : undefined}
        style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
      >
        <motion.path
          d={OUTER[0]}
          fill={`url(#${id}-o)`}
          animate={animate && lit ? { d: [OUTER[0]!, OUTER[1]!, OUTER[2]!] } : undefined}
          transition={animate && lit ? loop(1.5 * speed) : undefined}
        />
        <motion.path
          d={MID[0]}
          fill={`url(#${id}-m)`}
          animate={animate && lit ? { d: [MID[1]!, MID[2]!, MID[0]!] } : undefined}
          transition={animate && lit ? loop(1.1 * speed, 0.15) : undefined}
        />
        <motion.path
          d={CORE[0]}
          fill={`url(#${id}-c)`}
          animate={animate && lit ? { d: [CORE[2]!, CORE[0]!, CORE[1]!] } : undefined}
          transition={animate && lit ? loop(0.85 * speed, 0.3) : undefined}
        />
      </motion.g>

      {animate &&
        lit &&
        EMBERS.slice(0, intense ? 5 : 3).map((e, i) => (
          <motion.circle
            key={i}
            r={e.r}
            fill="#ffc24a"
            initial={{ cx: e.x, cy: 64, opacity: 0 }}
            animate={{ cx: [e.x, e.x + e.drift], cy: [64, intense ? -8 : 4], opacity: [0, 1, 0] }}
            transition={{
              duration: e.dur * speed,
              delay: e.delay,
              repeat: Infinity,
              ease: 'easeOut',
              opacity: { duration: e.dur * speed, delay: e.delay, repeat: Infinity, times: [0, 0.25, 1] },
            }}
          />
        ))}
    </svg>
  );
}
