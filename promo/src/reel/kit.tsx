import { getLength, getPointAtLength } from '@remotion/paths';
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import shots from './shots.json';
import { FONT, V } from './theme';
import { SUBS } from './timing';
import { useLayout } from './layout';

/* ── Motion ─────────────────────────────────────────────────────────────── */
export const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
export const easeInOut = Easing.bezier(0.77, 0, 0.175, 1);
export const easeSoft = Easing.bezier(0.45, 0, 0.25, 1);
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const prog = (f: number, a: number, b: number, e = easeOut) => interpolate(f, [a, b], [0, 1], { ...CLAMP, easing: e });
/** 0 → 1 → 0 window. */
export const win = (f: number, a: number, b: number, fadeIn = 10, fadeOut = 10) => prog(f, a, a + fadeIn) * (1 - prog(f, b - fadeOut, b, easeInOut));

/** Eased value between keyframes [[frame, value], …]. */
export function keys(f: number, pts: [number, number][], e = easeInOut) {
  if (pts.length === 1) return pts[0]![1];
  return interpolate(
    f,
    pts.map((p) => p[0]),
    pts.map((p) => p[1]),
    { ...CLAMP, easing: e },
  );
}

export function useSpr(at: number, config: { damping?: number; stiffness?: number; mass?: number } = {}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - at, fps, config: { damping: 20, stiffness: 140, mass: 1, ...config } });
}
export function spr(f: number, at: number, config: { damping?: number; stiffness?: number; mass?: number } = {}) {
  return spring({ frame: f - at, fps: 30, config: { damping: 20, stiffness: 140, mass: 1, ...config } });
}

export const shotUrl = (name: string) => staticFile(`reel/${name}.jpg`);
export const seqUrl = (name: string, i: number) => staticFile(`reel/seq/${name}/${String(i).padStart(3, '0')}.jpg`);
export const shotH = (name: string) => (shots as Record<string, { h: number }>)[name]?.h ?? 797;

/* ── Background ─────────────────────────────────────────────────────────── */
export function Stage({ light = 0, accent = V.acc, glow = 1 }: { light?: number; accent?: string; glow?: number }) {
  const f = useCurrentFrame();
  const { W, H } = useLayout();
  const t = f / 30;
  const a = { x: W * 0.28 + Math.sin(t * 0.21) * 70, y: H * 0.3 + Math.cos(t * 0.17) * 60 };
  const b = { x: W * 0.78 + Math.cos(t * 0.19) * 60, y: H * 0.72 + Math.sin(t * 0.23) * 70 };
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: V.bg }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(120% 70% at 50% 0%, #17132a 0%, ${V.bg} 55%, ${V.bgDeep} 100%)` }} />
      <div style={{ position: 'absolute', inset: 0, opacity: light, background: `radial-gradient(120% 80% at 50% 0%, #ffffff 0%, ${V.bgLight} 55%, #e6e1f4 100%)` }} />
      <Blob x={a.x} y={a.y} r={W * 0.95} color={accent} alpha={(0.3 - light * 0.12) * glow} />
      <Blob x={b.x} y={b.y} r={W * 0.85} color={light > 0.5 ? '#c9b8ff' : '#6c3be8'} alpha={(0.22 - light * 0.06) * glow} />
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - light, background: 'radial-gradient(120% 85% at 50% 48%, transparent 45%, rgba(3,2,8,0.75) 100%)' }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${staticFile('fx/grain.png')})`,
          backgroundPosition: `${(f * 137) % 256}px ${(f * 71) % 256}px`,
          opacity: 0.035,
          mixBlendMode: light > 0.5 ? 'multiply' : 'screen',
        }}
      />
    </div>
  );
}

function Blob({ x, y, r, color, alpha }: { x: number; y: number; r: number; color: string; alpha: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        background: `radial-gradient(closest-side, ${hexA(color, alpha)}, ${hexA(color, alpha * 0.35)} 45%, transparent 75%)`,
      }}
    />
  );
}

export function hexA(hex: string, a: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${clamp(a, 0, 1)})`;
}

/* ── Phone: real screens in a clean frame ───────────────────────────────── */
export const SCREEN_W = 390;
export const SCREEN_H = 797;
const BAR_PT = 46; // iOS status bar above the 797 pt captures

export function phoneGeom(w: number) {
  const bezel = w * 0.034;
  const inner = w - 2 * bezel;
  const k = inner / SCREEN_W;
  const h = (SCREEN_H + BAR_PT) * k + 2 * bezel;
  return { bezel, inner, k, h, bar: BAR_PT * k };
}

/** Frame position of a point given in screen pt, for an unrotated phone. */
export function ptToFrame(p: { x: number; y: number; w: number; scale?: number }, px: number, py: number) {
  const g = phoneGeom(p.w);
  const s = p.scale ?? 1;
  const lx = -p.w / 2 + g.bezel + px * g.k;
  const ly = -g.h / 2 + g.bezel + g.bar + py * g.k;
  return { x: p.x + lx * s, y: p.y + ly * s };
}

export interface PhoneProps {
  x: number;
  y: number;
  w: number;
  rx?: number;
  ry?: number;
  rz?: number;
  scale?: number;
  opacity?: number;
  light?: boolean;
  glow?: string;
  /** Screen content in pt (390 × 797). */
  children?: ReactNode;
  /** Drawn on the frame, outside the screen (e.g. the light tracing the edge). */
  frameOverlay?: ReactNode;
  bodyOpacity?: number;
}

export function Phone({ x, y, w, rx = 0, ry = 0, rz = 0, scale = 1, opacity = 1, light = false, glow = V.acc, children, frameOverlay, bodyOpacity = 1 }: PhoneProps) {
  const f = useCurrentFrame();
  const g = phoneGeom(w);
  const radius = w * 0.155;
  const sheen = 28 + ry * 1.2 + Math.sin(f / 60) * 5;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - w / 2,
        top: y - g.h / 2,
        width: w,
        height: g.h,
        opacity,
        transform: `perspective(2600px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${scale})`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius,
          opacity: bodyOpacity,
          background: 'linear-gradient(150deg, #3d3a48 0%, #16141d 35%, #0d0c12 65%, #2c2a35 100%)',
          boxShadow: `0 ${w * 0.16}px ${w * 0.3}px -${w * 0.1}px rgba(2,1,8,0.9), 0 0 0 1.5px rgba(255,255,255,0.08), inset 0 0 0 1.5px rgba(255,255,255,0.1), 0 0 ${w * 0.35}px -${w * 0.08}px ${hexA(glow, 0.45)}`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: g.bezel,
            top: g.bezel,
            width: g.inner,
            height: g.h - 2 * g.bezel,
            borderRadius: radius - g.bezel,
            overflow: 'hidden',
            background: light ? V.bgLight : V.bg,
          }}
        >
          <div style={{ position: 'absolute', left: 0, top: g.bar, width: SCREEN_W, height: SCREEN_H, transform: `scale(${g.k})`, transformOrigin: '0 0', overflow: 'hidden' }}>
            {children}
          </div>
          <StatusBar width={g.inner} height={g.bar} light={light} />
          <div style={{ position: 'absolute', top: g.inner * 0.026, left: '50%', width: g.inner * 0.3, height: g.inner * 0.086, marginLeft: -g.inner * 0.15, borderRadius: 999, background: '#000' }} />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(118deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) ${sheen}%, rgba(255,255,255,0) 74%, rgba(255,255,255,0.04) 100%)`,
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
      {frameOverlay}
    </div>
  );
}

function StatusBar({ width, height, light }: { width: number; height: number; light: boolean }) {
  const u = width / 390;
  const fg = light ? '#15121a' : '#ffffff';
  const cy = height * 0.56;
  return (
    <svg style={{ position: 'absolute', left: 0, top: 0 }} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <text x={34 * u} y={cy + 6 * u} fill={fg} fontSize={16 * u} fontWeight={600} fontFamily={FONT.sans}>
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

/* ── Screens (pt space) ─────────────────────────────────────────────────── */
export function Shot({ src, style }: { src: string; style?: CSSProperties }) {
  return <Img src={shotUrl(src)} style={{ position: 'absolute', left: 0, top: 0, width: SCREEN_W, height: SCREEN_H, ...style }} />;
}

const TOP_PT = 62;
const TAB_PT = 84;

/**
 * A full-page capture scrolled under the app's real bars: the top bar comes
 * from the viewport capture at rest (`top`) and, once scrolled, from a capture
 * taken after a real scroll (`topScrolled`); the tab bar from `tab`.
 */
export function Scrolled({ full, scroll, top, topScrolled, tab }: { full: string; scroll: number; top: string; topScrolled?: string; tab: string }) {
  const h = shotH(full);
  const s = clamp(scroll, 0, Math.max(0, h - SCREEN_H));
  const scrolledBar = topScrolled ? clamp(s / 40) : 0;
  return (
    <>
      <Img src={shotUrl(full)} style={{ position: 'absolute', left: 0, top: -s, width: SCREEN_W, height: h }} />
      <div style={{ position: 'absolute', left: 0, top: 0, width: SCREEN_W, height: TOP_PT, overflow: 'hidden', opacity: 1 - scrolledBar }}>
        <Img src={shotUrl(top)} style={{ width: SCREEN_W, height: SCREEN_H }} />
      </div>
      {topScrolled && (
        <div style={{ position: 'absolute', left: 0, top: 0, width: SCREEN_W, height: TOP_PT, overflow: 'hidden', opacity: scrolledBar }}>
          <Img src={shotUrl(topScrolled)} style={{ width: SCREEN_W, height: SCREEN_H }} />
        </div>
      )}
      <div style={{ position: 'absolute', left: 0, top: SCREEN_H - TAB_PT, width: SCREEN_W, height: TAB_PT, overflow: 'hidden' }}>
        <Img src={shotUrl(tab)} style={{ width: SCREEN_W, height: SCREEN_H, marginTop: -(SCREEN_H - TAB_PT) }} />
      </div>
    </>
  );
}

export type Trans =
  | { kind: 'cut' }
  | { kind: 'fade' | 'lift' | 'slideL' | 'slideR' | 'wipeUp' | 'page'; dur?: number }
  | { kind: 'circle'; dur?: number; x: number; y: number }
  | { kind: 'sheet'; dur?: number; split: number };

export interface Seg {
  from: number;
  render: (f: number) => ReactNode;
  trans?: Trans;
}

/** The phone's screen over time: each segment enters with the app's own kind of transition. */
export function ScreenTrack({ segs }: { segs: Seg[] }) {
  const f = useCurrentFrame();
  let i = -1;
  for (let k = 0; k < segs.length; k++) if (segs[k]!.from <= f) i = k;
  if (i < 0) return null;
  const cur = segs[i]!;
  const prev = segs[i - 1];
  const tr = cur.trans ?? { kind: 'fade' };
  const dur = tr.kind === 'cut' ? 0 : (tr.dur ?? 12);
  const p = dur === 0 ? 1 : prog(f, cur.from, cur.from + dur, tr.kind === 'circle' || tr.kind === 'wipeUp' ? easeInOut : easeOut);
  if (p >= 1 || !prev) return <Layer>{cur.render(f)}</Layer>;
  let under: CSSProperties = {};
  let over: CSSProperties = {};
  let sheetSplit: number | null = null;
  switch (tr.kind) {
    case 'fade':
      over = { opacity: p };
      break;
    case 'lift':
      over = { opacity: p, transform: `translateY(${(1 - p) * 16}px)` };
      under = { opacity: 1 - p * 0.6 };
      break;
    case 'slideL':
      over = { opacity: p, transform: `translateX(${(1 - p) * 46}px)` };
      under = { opacity: 1 - p, transform: `translateX(${-p * 46}px)` };
      break;
    case 'slideR':
      over = { opacity: p, transform: `translateX(${-(1 - p) * 46}px)` };
      under = { opacity: 1 - p, transform: `translateX(${p * 46}px)` };
      break;
    case 'wipeUp':
      over = { clipPath: `inset(${(1 - p) * 100}% 0 0 0)` };
      break;
    case 'page':
      over = { transform: `translateY(${(1 - p) * SCREEN_H * 0.6}px)`, opacity: clamp(p * 2) };
      under = { transform: `translateY(${-p * 60}px) scale(${1 - p * 0.04})`, opacity: 1 - p };
      break;
    case 'circle': {
      const r = p * Math.hypot(Math.max(tr.x, SCREEN_W - tr.x), Math.max(tr.y, SCREEN_H - tr.y));
      over = { clipPath: `circle(${r}px at ${tr.x}px ${tr.y}px)` };
      break;
    }
    case 'sheet':
      sheetSplit = tr.split;
      break;
    default:
      break;
  }
  if (sheetSplit !== null) {
    // A bottom sheet: the dimmed page fades in, the sheet rises from the bottom.
    return (
      <>
        <Layer>{prev.render(f)}</Layer>
        <Layer style={{ opacity: p, clipPath: `inset(0 0 ${SCREEN_H - sheetSplit}px 0)` }}>{cur.render(f)}</Layer>
        <Layer style={{ clipPath: `inset(${sheetSplit}px 0 0 0)`, transform: `translateY(${(1 - p) * (SCREEN_H - sheetSplit)}px)` }}>{cur.render(f)}</Layer>
      </>
    );
  }
  return (
    <>
      <Layer style={under}>{prev.render(f)}</Layer>
      <Layer style={over}>{cur.render(f)}</Layer>
    </>
  );
}

function Layer({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ position: 'absolute', left: 0, top: 0, width: SCREEN_W, height: SCREEN_H, overflow: 'hidden', ...style }}>{children}</div>;
}

/* ── Touch feedback, spotlight, glints (pt space) ───────────────────────── */
export function Tap({ x, y, at, light = false }: { x: number; y: number; at: number; light?: boolean }) {
  const f = useCurrentFrame();
  if (f < at - 6 || f > at + 24) return null;
  const press = prog(f, at - 6, at, easeOut) * (1 - prog(f, at + 2, at + 12, easeOut));
  const ring = prog(f, at, at + 22, easeOut);
  const c = light ? '21,18,26' : '255,255,255';
  return (
    <>
      <div style={{ position: 'absolute', left: x - 22, top: y - 22, width: 44, height: 44, borderRadius: 22, background: `rgba(${c},${0.32 * press})`, transform: `scale(${1.15 - 0.2 * press})` }} />
      <div style={{ position: 'absolute', left: x - 30, top: y - 30, width: 60, height: 60, borderRadius: 30, border: `2px solid rgba(${c},${0.55 * (1 - ring)})`, transform: `scale(${0.5 + ring * 0.9})` }} />
    </>
  );
}

export function Spotlight({ x, y, w, h, r = 22, opacity, color = V.lav }: { x: number; y: number; w: number; h: number; r?: number; opacity: number; color?: string }) {
  if (opacity <= 0.001) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: r,
        opacity,
        boxShadow: `0 0 0 2px ${hexA(color, 0.9)}, 0 0 26px 4px ${hexA(color, 0.45)}, 0 0 0 2000px rgba(6,4,14,0.42)`,
      }}
    />
  );
}

/** A four-point sparkle with a few motes: a small «well done» glint. */
export function Glint({ x, y, at, size = 34, color = '#ffffff' }: { x: number; y: number; at: number; size?: number; color?: string }) {
  const f = useCurrentFrame();
  if (f < at || f > at + 34) return null;
  const s = spr(f, at, { damping: 12, stiffness: 220 });
  const out = prog(f, at + 14, at + 34, easeInOut);
  const motes = [0, 72, 144, 216, 288];
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 0, height: 0 }}>
      <svg
        width={size * 2}
        height={size * 2}
        viewBox="-1 -1 2 2"
        style={{ position: 'absolute', left: -size, top: -size, transform: `scale(${s * (1 - out * 0.4)}) rotate(${s * 45}deg)`, opacity: 1 - out }}
      >
        <path d="M0 -1 C0.08 -0.2 0.2 -0.08 1 0 C0.2 0.08 0.08 0.2 0 1 C-0.08 0.2 -0.2 0.08 -1 0 C-0.2 -0.08 -0.08 -0.2 0 -1Z" fill={color} />
      </svg>
      {motes.map((a, i) => {
        const d = prog(f, at + 2, at + 26, easeOut) * size * 1.4;
        const rad = ((a + 18) * Math.PI) / 180;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: Math.cos(rad) * d - 3,
              top: Math.sin(rad) * d - 3,
              width: 6,
              height: 6,
              borderRadius: 3,
              background: i % 2 ? V.lav : color,
              opacity: (1 - out) * prog(f, at + 2, at + 6),
            }}
          />
        );
      })}
    </div>
  );
}

/* ── Light path: the person's own way, step by step ─────────────────────── */
export function PathLine({
  d,
  p,
  width = 6,
  stepGap = 0,
  head = true,
  color = V.lav,
  opacity = 1,
  fadeTail = 0,
}: {
  d: string;
  p: number;
  width?: number;
  stepGap?: number;
  head?: boolean;
  color?: string;
  opacity?: number;
  /** 0..1: how much of the drawn line has faded from its start. */
  fadeTail?: number;
}) {
  const { W, H } = useLayout();
  const len = useMemo(() => getLength(d), [d]);
  const pp = clamp(p);
  const pt = getPointAtLength(d, len * pp) ?? { x: 0, y: 0 };
  const steps = stepGap > 0 ? Math.floor((len * pp) / stepGap) : 0;
  const id = useMemo(() => `pl${Math.abs(hash(d))}`, [d]);
  const tail = len * clamp(fadeTail);
  if (pp <= 0) return null;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, opacity, overflow: 'visible' }}>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={W} y2="0">
          <stop offset="0" stopColor={V.accHi} />
          <stop offset="1" stopColor={color} />
        </linearGradient>
      </defs>
      <path
        d={d}
        fill="none"
        stroke={hexA(V.acc, 0.35)}
        strokeWidth={width * 3.2}
        strokeLinecap="round"
        strokeDasharray={`0 ${tail} ${Math.max(0, len * pp - tail)} ${len * 2}`}
        style={{ filter: `blur(${width * 1.6}px)` }}
      />
      <path d={d} fill="none" stroke={`url(#${id})`} strokeWidth={width} strokeLinecap="round" strokeDasharray={`0 ${tail} ${Math.max(0, len * pp - tail)} ${len * 2}`} />
      {Array.from({ length: steps }, (_, i) => {
        const at = (i + 1) * stepGap;
        if (at < tail) return null;
        const q = getPointAtLength(d, at) ?? { x: 0, y: 0 };
        const age = clamp((len * pp - at) / (stepGap * 1.2));
        return <circle key={i} cx={q.x} cy={q.y} r={width * (0.9 + 0.5 * (1 - age))} fill="#ffffff" opacity={0.55 + 0.45 * (1 - age)} />;
      })}
      {head && pp > 0 && (
        <>
          <circle cx={pt.x} cy={pt.y} r={width * 5} fill={hexA(V.lav, 0.22)} style={{ filter: `blur(${width * 2}px)` }} />
          <circle cx={pt.x} cy={pt.y} r={width * 1.7} fill="#ffffff" />
        </>
      )}
    </svg>
  );
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/* ── Type ───────────────────────────────────────────────────────────────── */
/** Krophed headline (the wordmark's face; only A–Z, digits and basic punctuation). */
export function KTitle({ text, at, out, size = 96, gradient = [], color = '#fff', stagger = 4, onLight = false }: { text: string; at: number; out?: number; size?: number; gradient?: number[]; color?: string; stagger?: number; onLight?: boolean }) {
  const f = useCurrentFrame();
  const words = text.split(' ');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: size * 0.3, rowGap: size * 0.05 }}>
      {words.map((w, i) => {
        const s = prog(f, at + i * stagger, at + i * stagger + 18, easeOut);
        const leave = out === undefined ? 0 : prog(f, out + i * 2, out + 14 + i * 2, easeInOut);
        const g = gradient.includes(i);
        return (
          <span key={i} style={{ display: 'inline-block', overflow: 'hidden', paddingTop: size * 0.08, paddingBottom: size * 0.04, lineHeight: 1 }}>
            <span
              style={{
                display: 'inline-block',
                fontFamily: FONT.display,
                fontSize: size,
                letterSpacing: '0.02em',
                transform: `translateY(${(1 - s) * 105 - leave * 105}%)`,
                color: g ? 'transparent' : color,
                backgroundImage: g ? (onLight ? `linear-gradient(100deg, ${V.accLo}, ${V.deep})` : `linear-gradient(100deg, ${V.lav}, ${V.accHi} 60%, ${V.accLo})`) : undefined,
                WebkitBackgroundClip: g ? 'text' : undefined,
                backgroundClip: g ? 'text' : undefined,
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

/** Inter heavy line, words rising from a mask. */
export function SansLine({ text, at, out, size = 64, color = '#fff', weight = 800, stagger = 3 }: { text: string; at: number; out?: number; size?: number; color?: string; weight?: number; stagger?: number }) {
  const f = useCurrentFrame();
  const words = text.split(' ');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: size * 0.26 }}>
      {words.map((w, i) => {
        const s = prog(f, at + i * stagger, at + i * stagger + 16, easeOut);
        const leave = out === undefined ? 0 : prog(f, out + i, out + 12 + i, easeInOut);
        return (
          <span key={i} style={{ display: 'inline-block', overflow: 'hidden', lineHeight: 1.12, paddingBottom: size * 0.06 }}>
            <span style={{ display: 'inline-block', fontFamily: FONT.sans, fontWeight: weight, fontSize: size, letterSpacing: '-0.02em', color, transform: `translateY(${(1 - s) * 105 - leave * 105}%)` }}>{w}</span>
          </span>
        );
      })}
    </div>
  );
}

/** The app's handwritten accent (212 Baby Girl), written in from left to right. */
export function HandLine({ text, at, out, size = 70, color = V.lavText }: { text: string; at: number; out?: number; size?: number; color?: string }) {
  const f = useCurrentFrame();
  const p = prog(f, at, at + 22, easeSoft);
  const leave = out === undefined ? 0 : prog(f, out, out + 12, easeInOut);
  return (
    <div
      style={{
        fontFamily: FONT.hand,
        fontSize: size,
        color,
        lineHeight: 1.1,
        textAlign: 'center',
        clipPath: `inset(-20% ${(1 - p) * 100}% -20% 0)`,
        opacity: 1 - leave,
        transform: `translateY(${-leave * 20}px)`,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  );
}

/** Headline block in the top text area. */
export function TitleArea({ children, opacity = 1 }: { children: ReactNode; opacity?: number }) {
  const L = useLayout();
  return (
    <div style={{ position: 'absolute', left: (L.W - L.textW) / 2, width: L.textW, top: L.titleY, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 * L.k, opacity }}>
      {children}
    </div>
  );
}

/* ── Subtitles: short phrases, high contrast, no bouncing ───────────────── */
export function Subtitles() {
  const f = useCurrentFrame();
  const L = useLayout();
  const s = SUBS.find((x) => f >= x.from && f < x.to);
  if (!s) return null;
  const a = prog(f, s.from, s.from + 5, easeOut) * (1 - prog(f, s.to - 4, s.to, easeInOut));
  const parts = s.text.split(/(\{[^}]+\})/g).filter(Boolean);
  const size = 46 * L.k;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: L.H - L.subBottom, display: 'flex', justifyContent: 'center', opacity: a }}>
      <div
        style={{
          maxWidth: L.textW,
          padding: `${size * 0.32}px ${size * 0.62}px`,
          borderRadius: size * 0.55,
          background: 'rgba(10, 8, 18, 0.82)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.07), 0 18px 40px -16px rgba(0,0,0,0.7)',
          fontFamily: FONT.sans,
          fontWeight: 600,
          fontSize: size,
          lineHeight: 1.24,
          color: '#fff',
          textAlign: 'center',
          letterSpacing: '-0.005em',
          transform: `translateY(${(1 - a) * 6}px)`,
        }}
      >
        {parts.map((p, i) =>
          p.startsWith('{') ? (
            <span key={i} style={{ color: V.lavText }}>
              {p.slice(1, -1)}
            </span>
          ) : (
            <span key={i}>{p}</span>
          ),
        )}
      </div>
    </div>
  );
}

/** Discreet note on every scene with app screens: the data is an example. */
export function DemoNote({ opacity = 1, light = false }: { opacity?: number; light?: boolean }) {
  const L = useLayout();
  return (
    <div
      style={{
        position: 'absolute',
        right: L.format === '9x16' ? 150 : 48,
        top: L.format === '9x16' ? 236 - 52 : 30,
        fontFamily: FONT.sans,
        fontSize: 20 * L.k,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: light ? 'rgba(21,18,26,0.5)' : 'rgba(255,255,255,0.45)',
        opacity,
      }}
    >
      Datos de ejemplo
    </div>
  );
}

/* ── Lucide icons used in the scenes ────────────────────────────────────── */
export const IC = {
  droplet: ['M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z', 'M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97'],
  footprints: ['M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z', 'M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z', 'M16 17h4', 'M4 13h4'],
  dumbbell: ['M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z', 'm2.5 21.5 1.4-1.4', 'm20.1 3.9 1.4-1.4', 'M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z', 'm9.6 14.4 4.8-4.8'],
  scale: ['M12 3v18', 'm19 8 3 8a5 5 0 0 1-6 0zV7', 'M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1', 'm5 8 3 8a5 5 0 0 1-6 0zV7', 'M7 21h10'],
  flame: ['M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4'],
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
