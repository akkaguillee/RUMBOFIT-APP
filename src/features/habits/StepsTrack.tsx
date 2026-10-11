import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useEffect, useId, useMemo, type ReactNode } from 'react';

/* Stadium-shaped running track (viewBox units). The centre line starts at
   the middle of the bottom straight and runs clockwise. */
const VB = { w: 320, h: 200 };
const R = 70;
const LEFT = 100;
const RIGHT = 220;
const TOP = 30;
const BOTTOM = 170;
const CY = 100;
const HALF = (RIGHT - LEFT) / 2; // 60
const STRAIGHT = RIGHT - LEFT; // 120
const ARC = Math.PI * R;
const PERIMETER = 2 * STRAIGHT + 2 * ARC;
const TRACK = `M160,${BOTTOM} H${LEFT} A${R},${R} 0 0 1 ${LEFT},${TOP} H${RIGHT} A${R},${R} 0 0 1 ${RIGHT},${BOTTOM} Z`;

function pointAt(fraction: number): { x: number; y: number; angle: number } {
  let s = (((fraction % 1) + 1) % 1) * PERIMETER;
  if (fraction >= 1) s = PERIMETER - 0.001;
  if (s < HALF) return { x: 160 - s, y: BOTTOM, angle: 180 };
  s -= HALF;
  if (s < ARC) {
    const phi = Math.PI / 2 + s / R;
    return { x: LEFT + R * Math.cos(phi), y: CY + R * Math.sin(phi), angle: (phi * 180) / Math.PI + 90 };
  }
  s -= ARC;
  if (s < STRAIGHT) return { x: LEFT + s, y: TOP, angle: 0 };
  s -= STRAIGHT;
  if (s < ARC) {
    const phi = -Math.PI / 2 + s / R;
    return { x: RIGHT + R * Math.cos(phi), y: CY + R * Math.sin(phi), angle: (phi * 180) / Math.PI + 90 };
  }
  s -= ARC;
  return { x: RIGHT - s, y: BOTTOM, angle: 180 };
}

const MILESTONES = [0.25, 0.5, 0.75];

interface Props {
  /** Steps / goal. Values above 1 keep the runner on the finish line. */
  progress: number;
  /** Changes whenever the goal is reached through a new entry → confetti burst. */
  burst: number;
  children?: ReactNode;
  label: string;
}

/**
 * Motion-graphics progress for steps: the lap draws itself along a running
 * track (trim path), a glowing runner leads the line with a pulse, milestone
 * flags light up as they are passed, and reaching the goal fires a burst.
 */
export function StepsTrack({ progress, burst, children, label }: Props) {
  const id = useId().replace(/:/g, '');
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, progress));
  const mv = useMotionValue(reduce ? clamped : 0);

  useEffect(() => {
    if (reduce) {
      mv.set(clamped);
      return;
    }
    const c = animate(mv, clamped, { type: 'spring', stiffness: 60, damping: 18, mass: 1.1, delay: 0.15 });
    return () => c.stop();
  }, [clamped, mv, reduce]);

  const dash = useTransform(mv, (v) => Math.max(v, 0.0001));
  const headX = useTransform(mv, (v) => pointAt(v).x);
  const headY = useTransform(mv, (v) => pointAt(v).y);
  const headOpacity = useTransform(mv, (v) => (v > 0.004 ? 1 : 0));
  const lapOpacity = useTransform(mv, (v) => (v > 0.002 ? 1 : 0));
  const finish = pointAt(0);

  const particles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2 + (i % 2 ? 0.2 : 0);
        const dist = 46 + (i % 3) * 16;
        return { i, x: Math.cos(a) * dist, y: Math.sin(a) * dist, rot: (i * 47) % 360, tone: i % 3 };
      }),
    [],
  );

  return (
    <div className="track" role="img" aria-label={`${label}: ${Math.round(progress * 100)} %`}>
      <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="track__svg" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-lap`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: 'color-mix(in srgb, var(--series-steps) 70%, #fff)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--series-steps)' }} />
          </linearGradient>
          <filter id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>

        {/* Track band, lane lines and infield */}
        <path d={TRACK} className="track__band" />
        <path d={TRACK} className="track__lane" />
        <rect x={LEFT - R + 26} y={TOP + 26} width={STRAIGHT + 2 * R - 52} height={BOTTOM - TOP - 52} rx={R - 26} className="track__infield" />

        {/* Start / finish line */}
        <g className="track__finish">
          {[0, 1, 2, 3].map((k) => (
            <rect key={k} x={finish.x - 3} y={BOTTOM - 13 + k * 6.5} width={3} height={6.5} className={k % 2 ? 'is-dark' : ''} />
          ))}
          {[0, 1, 2, 3].map((k) => (
            <rect key={`b${k}`} x={finish.x} y={BOTTOM - 13 + k * 6.5} width={3} height={6.5} className={k % 2 ? '' : 'is-dark'} />
          ))}
        </g>

        {/* Milestones at 25 / 50 / 75 % */}
        {MILESTONES.map((m) => {
          const p = pointAt(m);
          const passed = clamped >= m;
          return (
            <g key={m} transform={`translate(${p.x} ${p.y}) rotate(${p.angle})`}>
              <motion.line
                x1={0}
                x2={0}
                y1={-15}
                y2={15}
                className="track__tick"
                animate={{ opacity: passed ? 1 : 0.35 }}
                transition={{ duration: 0.4, delay: passed && !reduce ? 0.3 + m * 1.1 : 0 }}
                data-passed={passed}
              />
            </g>
          );
        })}

        {/* The lap: glow underlay + crisp stroke, both drawn like a trim path */}
        <motion.path d={TRACK} className="track__lap-glow" style={{ pathLength: dash, opacity: lapOpacity }} filter={`url(#${id}-glow)`} />
        <motion.path d={TRACK} className="track__lap" stroke={`url(#${id}-lap)`} style={{ pathLength: dash, opacity: lapOpacity }} />

        {/* Runner */}
        <motion.g style={{ x: headX, y: headY, opacity: headOpacity }}>
          {!reduce && (
            <motion.circle
              r={8}
              className="track__pulse"
              animate={{ scale: [1, 2.4], opacity: [0.55, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
          <circle r={8} className="track__head" />
          <circle r={3.2} className="track__head-core" />
        </motion.g>

        {/* Goal burst */}
        {!reduce && burst > 0 && (
          <g key={burst} transform={`translate(${VB.w / 2} ${VB.h / 2})`}>
            {particles.map((p) => (
              <motion.rect
                key={p.i}
                x={-3}
                y={-1.5}
                width={6}
                height={3}
                rx={1.5}
                className={`track__spark track__spark--${p.tone}`}
                initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 0.4 }}
                animate={{ x: p.x * 1.9, y: p.y * 1.25, rotate: p.rot, opacity: 0, scale: 1.2 }}
                transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
              />
            ))}
          </g>
        )}
      </svg>
      {children && <div className="track__center">{children}</div>}
    </div>
  );
}
