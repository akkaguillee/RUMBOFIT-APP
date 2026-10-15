import type { CSSProperties, ReactNode } from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { clamp, easeInOut, prog } from '../ui';

/* ── Palette: RUMBO black, white and red; lime only for progress. ─────────── */
export const C = {
  ink: '#050506',
  charcoal: 'rgba(20, 21, 20, 0.86)',
  text: '#ffffff',
  text2: 'rgba(255,255,255,0.72)',
  text3: 'rgba(255,255,255,0.5)',
  red: '#e53945',
  redHi: '#ff5a63',
  redDeep: '#8f182b',
  progress: '#b8f055',
  warn: '#f6c544',
  water: '#3f8fea',
  steps: '#e3a516',
} as const;

export const RED_GRAD = 'linear-gradient(100deg, #ff8a7a 0%, #ff4552 48%, #c81d35 100%)';

/** Real captures from the app (390 × 797 pt at 3×), see promo/public/app. */
export const SHOT_ASPECT = 797 / 390;
export const shot = (name: string) => staticFile(`app/${name}.png`);

/* ── Motion helpers ─────────────────────────────────────────────────────── */
export function useSpr(at: number, config: { damping?: number; stiffness?: number; mass?: number } = {}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - at, fps, config: { damping: 18, stiffness: 120, mass: 1, ...config } });
}

/** Smooth 0→1→0 window: fades in over `fade` frames from `a`, out over `fade` frames before `b`. */
export function windowed(frame: number, a: number, b: number, fade = 12) {
  return prog(frame, a, a + fade) * (1 - prog(frame, b - fade, b, easeInOut));
}

/* ── Krophed headlines (brand display face; texts here are accent-free) ──── */
export function KLine({
  text,
  frames,
  size = 92,
  accent = [],
  align = 'center',
  out,
  color = '#fff',
  track = 0.02,
}: {
  text: string;
  frames: number[];
  size?: number;
  accent?: number[];
  align?: 'left' | 'center';
  out?: number;
  color?: string;
  track?: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(' ');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start', columnGap: size * 0.32 }}>
      {words.map((w, i) => {
        const at = frames[i] ?? frames[frames.length - 1]!;
        const s = spring({ frame: frame - at, fps, config: { damping: 22, stiffness: 150, mass: 0.9 } });
        const leave = out === undefined ? 0 : prog(frame, out + i * 2, out + 12 + i * 2, easeInOut);
        const isAccent = accent.includes(i);
        return (
          <span key={i} style={{ display: 'inline-block', overflow: 'hidden', lineHeight: 1.08, paddingTop: size * 0.06 }}>
            <span
              style={{
                display: 'inline-block',
                fontFamily: 'Krophed, Inter, sans-serif',
                fontSize: size,
                letterSpacing: `${track}em`,
                transform: `translateY(${(1 - s) * 110 - leave * 110}%)`,
                color: isAccent ? 'transparent' : color,
                backgroundImage: isAccent ? RED_GRAD : undefined,
                WebkitBackgroundClip: isAccent ? 'text' : undefined,
                backgroundClip: isAccent ? 'text' : undefined,
                filter: `blur(${(1 - s) * 5 + leave * 6}px)`,
              }}
            >
              {w}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/* ── Cinematic backdrop: black, volumetric red light, rays, grain ──────── */
export function Stage({ glow = 0.7, x = 0.5, y = 0.45, rays = 0, warm = 0 }: { glow?: number; x?: number; y?: number; rays?: number; warm?: number }) {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const dx = Math.sin(t * 0.37) * 50;
  const dy = Math.cos(t * 0.29) * 36;
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.ink, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: 1080 * x + dx - 1000,
          top: 1920 * y + dy - 1000,
          width: 2000,
          height: 2000,
          borderRadius: '50%',
          background: `radial-gradient(closest-side, rgba(229,57,69,${0.5 * glow}), rgba(143,24,43,${0.26 * glow}) 42%, transparent 74%)`,
        }}
      />
      {warm > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 1080 * x - 700,
            top: 1920 * y - 500,
            width: 1400,
            height: 1400,
            borderRadius: '50%',
            background: `radial-gradient(closest-side, rgba(255,170,140,${0.18 * warm}), transparent 70%)`,
          }}
        />
      )}
      {rays > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 1080 * x - 1400,
            top: -700,
            width: 2800,
            height: 2600,
            background: `conic-gradient(from ${180 + Math.sin(t * 0.3) * 6}deg at 50% 0%, transparent 0deg, rgba(255,90,99,${0.08 * rays}) 8deg, transparent 16deg, transparent 22deg, rgba(255,120,120,${0.06 * rays}) 30deg, transparent 40deg, transparent 320deg, rgba(255,90,99,${0.07 * rays}) 332deg, transparent 344deg)`,
            filter: 'blur(18px)',
            mixBlendMode: 'screen',
          }}
        />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(115% 80% at 50% 45%, transparent 42%, rgba(0,0,0,0.82) 100%)' }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${staticFile('fx/grain.png')})`,
          backgroundPosition: `${(frame * 137) % 256}px ${(frame * 71) % 256}px`,
          opacity: 0.04,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

/* ── Phone with real screens, 3D pose and in-screen transitions ─────────── */
export interface Layer {
  src: string;
  /** CSS clip-path for reveals (e.g. a circle growing from a button). */
  clip?: string;
  opacity?: number;
  /** Vertical scroll of the capture, in % of its height. */
  y?: number;
  light?: boolean;
}

export function Phone3D({
  width,
  layers,
  x,
  y,
  rx = 0,
  ry = 0,
  rz = 0,
  scale = 1,
  glow = 0.5,
  opacity = 1,
  children,
}: {
  width: number;
  layers: Layer[];
  x: number;
  y: number;
  rx?: number;
  ry?: number;
  rz?: number;
  scale?: number;
  glow?: number;
  opacity?: number;
  children?: ReactNode;
}) {
  const frame = useCurrentFrame();
  const bezel = width * 0.035;
  const innerW = width - 2 * bezel;
  const shotH = innerW * SHOT_ASPECT;
  const bar = innerW * 0.118; // status bar (47 pt of 390)
  const innerH = shotH + bar;
  const h = innerH + 2 * bezel;
  // A soft reflection that drifts with the pose.
  const sheen = 30 + ry * 1.4 + Math.sin(frame / 50) * 6;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - width / 2,
        top: y - h / 2,
        width,
        height: h,
        opacity,
        transform: `perspective(2400px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${scale})`,
        transformStyle: 'preserve-3d',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: width * 0.155,
          background: 'linear-gradient(145deg, #4a4b52, #141418 38%, #0c0c0f 62%, #34353c)',
          padding: bezel,
          boxShadow: `0 90px 160px -50px rgba(0,0,0,0.95), 0 0 0 2px rgba(255,255,255,0.09), inset 0 0 0 1.5px rgba(255,255,255,0.12), 0 0 160px -40px rgba(229,57,69,${glow})`,
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: width * 0.125, overflow: 'hidden', background: '#0a0a0b' }}>
          {layers.map((l, i) => (
            <div key={i} style={{ position: 'absolute', inset: 0, opacity: l.opacity ?? 1, clipPath: l.clip, WebkitClipPath: l.clip }}>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  height: bar + 2,
                  backgroundImage: `url(${shot(l.src)})`,
                  backgroundSize: '100% 30000%',
                  backgroundPosition: 'top',
                }}
              />
              <Img src={shot(l.src)} style={{ position: 'absolute', left: 0, top: bar, width: '100%', height: shotH, transform: `translateY(${l.y ?? 0}%)` }} />
              <StatusBar width={innerW} height={bar} dark={!l.light} />
            </div>
          ))}
          {/* Dynamic Island */}
          <div style={{ position: 'absolute', top: innerW * 0.028, left: '50%', width: innerW * 0.3, height: innerW * 0.085, marginLeft: -innerW * 0.15, borderRadius: 999, background: '#000' }} />
          {children}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(115deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0) ${sheen}%, rgba(255,255,255,0) 72%, rgba(255,255,255,0.05) 100%)`,
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function StatusBar({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const u = width / 390;
  const fg = dark ? '#fff' : '#0d0e0b';
  const cy = height * 0.55;
  return (
    <svg style={{ position: 'absolute', left: 0, top: 0 }} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <text x={34 * u} y={cy + 6 * u} fill={fg} fontSize={16 * u} fontWeight={600} fontFamily="Inter, system-ui, sans-serif">
        9:41
      </text>
      <g fill={fg} transform={`translate(${width - 92 * u} ${cy - 6 * u})`}>
        {[0, 1, 2, 3].map((k) => (
          <rect key={k} x={k * 5 * u} y={(9 - 3 * k) * u} width={3.4 * u} height={(3 + 3 * k) * u} rx={0.8 * u} />
        ))}
        <path
          transform={`translate(${26 * u} ${-0.5 * u}) scale(${u})`}
          d="M7.7 9.6a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Zm0-3.4c1.5 0 2.8.6 3.8 1.5l-1.1 1.1a3.9 3.9 0 0 0-5.4 0L3.9 7.7a5.4 5.4 0 0 1 3.8-1.5Zm0-3.4c2.4 0 4.6.9 6.2 2.5l-1.1 1.1a7.3 7.3 0 0 0-10.2 0L1.5 5.3a8.8 8.8 0 0 1 6.2-2.5Z"
        />
        <rect x={50 * u} y={0} width={24 * u} height={12 * u} rx={3.5 * u} fill="none" stroke={fg} strokeOpacity={0.45} strokeWidth={1 * u} />
        <rect x={52 * u} y={2 * u} width={17 * u} height={8 * u} rx={2 * u} />
        <rect x={75 * u} y={4 * u} width={1.6 * u} height={4 * u} rx={0.8 * u} fillOpacity={0.45} />
      </g>
    </svg>
  );
}

/** Height of a Phone3D of this width. */
export function phoneHeight(width: number) {
  const bezel = width * 0.035;
  const innerW = width - 2 * bezel;
  return innerW * (SHOT_ASPECT + 0.118) + 2 * bezel;
}

/** Absolute position of a capture point (pt) on an unrotated Phone3D centred at (cx, cy). */
export function onPhone(width: number, cx: number, cy: number, px: number, py: number) {
  const bezel = width * 0.035;
  const p = phonePoint(width, px, py);
  return { x: cx - width / 2 + bezel + p.x, y: cy - phoneHeight(width) / 2 + bezel + p.y };
}

/** Point inside a Phone3D's display, from capture coordinates (pt of the 390-wide capture). */
export function phonePoint(width: number, px: number, py: number) {
  const bezel = width * 0.035;
  const innerW = width - 2 * bezel;
  const k = innerW / 390;
  return { x: px * k, y: innerW * 0.118 + py * k, k };
}

/* ── A real piece of the app lifted out of a capture ────────────────────── */
export function AppCrop({
  src,
  crop,
  width,
  style,
  radius = 28,
}: {
  src: string;
  /** Region in pt of the 390-wide capture. */
  crop: { x: number; y: number; w: number; h: number };
  width: number;
  style?: CSSProperties;
  radius?: number;
}) {
  const k = width / crop.w;
  return (
    <div
      style={{
        position: 'absolute',
        width,
        height: crop.h * k,
        borderRadius: radius,
        overflow: 'hidden',
        boxShadow: '0 50px 100px -40px rgba(0,0,0,0.95), 0 0 0 1.5px rgba(255,255,255,0.1), 0 0 80px -30px rgba(229,57,69,0.45)',
        ...style,
      }}
    >
      <Img src={shot(src)} style={{ position: 'absolute', width: 390 * k, height: 797 * k, left: -crop.x * k, top: -crop.y * k }} />
    </div>
  );
}

/* ── Charcoal card in the app's style ───────────────────────────────────── */
export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute',
        borderRadius: 40,
        background: 'linear-gradient(180deg, rgba(30,31,30,0.92), rgba(18,19,18,0.92))',
        boxShadow: 'inset 0 1.5px 0 rgba(255,255,255,0.12), inset 0 0 0 1.5px rgba(255,255,255,0.05), 0 50px 100px -40px rgba(0,0,0,0.95)',
        color: '#fff',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Label({ children, color = C.text3 }: { children: ReactNode; color?: string }) {
  return <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color }}>{children}</div>;
}

/* ── Lucide icon paths used across scenes ───────────────────────────────── */
export const IC = {
  scale: ['m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z', 'm2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z', 'M7 21h10', 'M12 3v18', 'M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2'],
  droplet: ['M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z'],
  steps: ['M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z', 'M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z', 'M16 17h4', 'M4 13h4'],
  dumbbell: ['M14.4 14.4 9.6 9.6', 'M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z', 'm21.5 21.5-1.4-1.4', 'M3.9 3.9 2.5 2.5', 'M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z'],
  flame: ['M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z'],
  heart: ['M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'],
  trophy: ['M6 9H4.5a2.5 2.5 0 0 1 0-5H6', 'M18 9h1.5a2.5 2.5 0 0 0 0-5H18', 'M4 22h16', 'M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22', 'M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22', 'M18 2H6v7a6 6 0 0 0 12 0V2Z'],
  trendDown: ['M22 17 13.5 8.5 8.5 13.5 2 7', 'M16 17h6v-6'],
  trendUp: ['M22 7 13.5 15.5 8.5 10.5 2 17', 'M16 7h6v6'],
  check: ['M20 6 9 17l-5-5'],
  arrow: ['M5 12h14', 'm12 5 7 7-7 7'],
};

export function Ico({ d, size = 40, color = 'currentColor', stroke = 2 }: { d: string[]; size?: number; color?: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {d.map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

/** Eased value between keyframes [[frame, value], …]. */
export function keys(frame: number, pts: [number, number][]) {
  return interpolate(
    frame,
    pts.map((p) => p[0]),
    pts.map((p) => p[1]),
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeInOut },
  );
}

export { clamp, prog };
