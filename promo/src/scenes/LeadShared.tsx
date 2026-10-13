import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { clamp, easeInOut, prog } from '../ui';

/** Scene wrapper: content rises in over the first frames and lifts away over the last ones. */
export function SceneWrap({ length, children, enter = 10, exit = 8, style }: { length: number; children: ReactNode; enter?: number; exit?: number; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const i = enter ? prog(frame, 0, enter) : 1;
  const o = exit ? prog(frame, length - exit, length, easeInOut) : 0;
  return (
    <AbsoluteFill
      style={{
        opacity: clamp(i * 1.2) * (1 - o),
        transform: `translateY(${(1 - i) * 80 - o * 60}px)`,
        filter: `blur(${(1 - i) * 8 + o * 10}px)`,
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

/** Lucide-style icons (24 × 24 viewBox), stroke = currentColor. */
export function Icon({ d, size = 40, color = 'currentColor', strokeWidth = 2 }: { d: string[]; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {d.map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

export const ICON = {
  trophy: ['M6 9H4.5a2.5 2.5 0 0 1 0-5H6', 'M18 9h1.5a2.5 2.5 0 0 0 0-5H18', 'M4 22h16', 'M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22', 'M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22', 'M18 2H6v7a6 6 0 0 0 12 0V2Z'],
  dumbbell: ['M14.4 14.4 9.6 9.6', 'M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z', 'm21.5 21.5-1.4-1.4', 'M3.9 3.9 2.5 2.5', 'M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z'],
  timer: ['M10 2h4', 'M12 14l3-3', 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z'],
  medal: ['M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15', 'M11 12 5.12 2.2', 'm13 12 5.88-9.8', 'M8 7h8', 'M12 22a5 5 0 1 0 0-10 5 5 0 0 0 0 10z', 'M12 18v-2h-.5'],
  check: ['M20 6 9 17l-5-5'],
};

/** A bright spark used to carry light across a match cut. */
export function Spark({ x, y, size, opacity }: { x: number; y: number; size: number; opacity: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'radial-gradient(closest-side, rgba(255,255,255,1), rgba(255,190,120,0.85) 30%, rgba(255,90,60,0.35) 60%, transparent)',
        opacity,
        pointerEvents: 'none',
      }}
    />
  );
}
