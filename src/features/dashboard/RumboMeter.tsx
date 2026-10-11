import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useEffect, useId } from 'react';

interface Props {
  /** 0..1 progress towards the goal, or null when there is no weight goal. */
  progress: number | null;
  children?: React.ReactNode;
  startLabel?: string;
  goalLabel?: string;
}

const W = 320;
const H = 232;
const CX = W / 2;
const CY = 152;
const R = 128;
const START = 200; // degrees (standard math orientation)
const SWEEP = 220;

const toXY = (deg: number, r = R) => {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY - r * Math.sin(rad) };
};

function arcPath(fromDeg: number, toDeg: number, r = R) {
  const a = toXY(fromDeg, r);
  const b = toXY(toDeg, r);
  const large = Math.abs(fromDeg - toDeg) > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
}

/**
 * A heading-style gauge ("rumbo" = heading): the arc runs from the starting
 * weight to the goal and a luminous marker shows the current position.
 */
export function RumboMeter({ progress, children, startLabel, goalLabel }: Props) {
  const id = useId();
  const reduce = useReducedMotion();
  const p = progress === null ? 0 : Math.max(0, Math.min(1, progress));
  const mv = useMotionValue(reduce ? p : 0);
  const angle = useTransform(mv, (v) => START - SWEEP * v);
  const mx = useTransform(angle, (a) => toXY(a).x);
  const my = useTransform(angle, (a) => toXY(a).y);

  useEffect(() => {
    if (reduce) {
      mv.set(p);
      return;
    }
    const c = animate(mv, p, { duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.15 });
    return () => c.stop();
  }, [p, mv, reduce]);

  const ticks = Array.from({ length: 11 }, (_, i) => i / 10);
  const end = START - SWEEP;
  const s = toXY(START);
  const e = toXY(end);

  return (
    <div className="meter">
      <svg viewBox={`0 0 ${W} ${H}`} className="meter__svg" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#8f182b" />
            <stop offset="60%" stopColor="#e53945" />
            <stop offset="100%" stopColor="#ff7a84" />
          </linearGradient>
          <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        {ticks.map((t) => {
          const deg = START - SWEEP * t;
          const a = toXY(deg, R + 9);
          const b = toXY(deg, R + (t % 0.5 === 0 ? 16 : 13));
          return <line key={t} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="meter__tick" data-major={t === 0 || t === 0.5 || t === 1} />;
        })}
        <path d={arcPath(START, end)} className="meter__track" />
        {progress !== null && (
          <>
            <motion.path
              d={arcPath(START, end)}
              className="meter__glow"
              stroke={`url(#${id}-g)`}
              filter={`url(#${id}-glow)`}
              style={{ pathLength: mv }}
            />
            <motion.path d={arcPath(START, end)} className="meter__fill" stroke={`url(#${id}-g)`} style={{ pathLength: mv }} />
            <motion.circle r="11" className="meter__marker-halo" cx={mx} cy={my} />
            <motion.circle r="6.5" className="meter__marker" cx={mx} cy={my} />
          </>
        )}
        {startLabel && (
          <text x={s.x} y={s.y + 30} className="meter__label" textAnchor="middle">
            {startLabel}
          </text>
        )}
        {goalLabel && (
          <text x={e.x} y={e.y + 30} className="meter__label" textAnchor="middle">
            {goalLabel}
          </text>
        )}
      </svg>
      <div className="meter__center">{children}</div>
    </div>
  );
}
