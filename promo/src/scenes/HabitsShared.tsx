/**
 * Shared by Progress and Habits: the geometry of the water vessel, the water
 * surface maths and a backdrop driven by the GLOBAL frame, so the internal
 * match cut at 420 (trend line → water surface) is pixel-continuous.
 */
import type { CSSProperties } from 'react';
import { Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { INK } from '../ui';

/** Outer glass of the vessel (canvas px). */
export const VESSEL = { x: 96, y: 652, w: 360, h: 600, r: 88 } as const;
/** Inner cavity that holds the water. */
export const VESSEL_IN = { x: 108, y: 664, w: 336, h: 576, r: 76 } as const;

/**
 * Where the Progress trend line ends up, flattened into a ripple: the water
 * line at level 0 inside the vessel (the visible chord of the rounded bottom).
 */
export const MATCH_LINE = { x0: 160, x1: 392, y: 1236, amp: 4, width: 5, color: '#8fc3ff' } as const;

export const WATER = { hi: '#7cb8ff', mid: '#3b8cff', deep: '#0f3f9e', line: '#8fc3ff' } as const;

const TAU = Math.PI * 2;

/** Front water surface offset (unit amplitude) at x for the global frame gf. */
export function frontWave(x: number, gf: number) {
  return 0.65 * Math.sin((x / 230) * TAU + gf * 0.12) + 0.35 * Math.sin((x / 140) * TAU - gf * 0.085 + 1.3);
}

/** Back water surface: longer, slower, travelling the other way. */
export function backWave(x: number, gf: number) {
  return 0.6 * Math.sin((x / 310) * TAU - gf * 0.075 + 2.2) + 0.4 * Math.sin((x / 175) * TAU + gf * 0.1 + 0.4);
}

export type Pt = { x: number; y: number };

export const polyline = (pts: Pt[]) => 'M' + pts.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L');

/** es-ES with the thousands dot always on (Intl drops it for 4-digit numbers: 6420 → "6.420"). */
export function fmtInt(n: number) {
  const s = Math.round(n).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Copy of ui.tsx Backdrop that takes the global frame, so the light does not jump at the internal cut. */
export function GlobalBackdrop({ gf, glow = 0.55, glowY = 0.45 }: { gf: number; glow?: number; glowY?: number }) {
  const t = gf / 30;
  const dx = Math.sin(t * 0.6) * 60;
  const dy = Math.cos(t * 0.45) * 40;
  return (
    <div style={{ position: 'absolute', inset: 0, background: INK, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: 540 + dx - 900,
          top: 1920 * glowY + dy - 900,
          width: 1800,
          height: 1800,
          borderRadius: '50%',
          background: `radial-gradient(closest-side, rgba(229,57,69,${0.55 * glow}), rgba(143,24,43,${0.28 * glow}) 45%, transparent 75%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: -400 - dx,
          top: -500,
          width: 1400,
          height: 1400,
          borderRadius: '50%',
          background: `radial-gradient(closest-side, rgba(255,90,99,${0.16 * glow}), transparent 70%)`,
        }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 50% 45%, transparent 45%, rgba(0,0,0,0.75) 100%)' }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${staticFile('fx/grain.png')})`,
          backgroundRepeat: 'repeat',
          backgroundPosition: `${(gf * 137) % 256}px ${(gf * 71) % 256}px`,
          opacity: 0.045,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

/** Small uppercase tracked label (same size as the eyebrow), neutral colour. */
export const MICRO: CSSProperties = {
  fontSize: 26,
  fontWeight: 700,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.5)',
  lineHeight: 1,
  whiteSpace: 'nowrap',
};

// ── Vessel glass (rendered by Progress from gf 402 and by Habits) ─────────

const EO_V = Easing.bezier(0.16, 1, 0.3, 1);
const IO_V = Easing.bezier(0.65, 0, 0.35, 1);
const pv = (gf: number, a: number, b: number, e = EO_V) => interpolate(gf, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: e });

/** Draw-in of the vessel outline (0 → 1) for the global frame. */
export const vesselDraw = (gf: number) => pv(gf, 402, 432, IO_V);

/** Left half of the vessel outline from bottom centre up to top centre (right half is mirrored). */
const V_HALF = (() => {
  const { x, y, w, h, r } = VESSEL;
  const cx = x + w / 2;
  return `M ${cx} ${y + h} L ${x + r} ${y + h} A ${r} ${r} 0 0 1 ${x} ${y + h - r} L ${x} ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} L ${cx} ${y}`;
})();

/** Half-width of the vessel cavity at canvas height y (0 outside). */
export function cavityHalf(y: number) {
  const { y: top, h, w, r } = VESSEL_IN;
  const bottom = top + h;
  const flat = w / 2 - r;
  if (y < top || y > bottom) return 0;
  if (y > bottom - r) return flat + Math.sqrt(Math.max(0, r * r - (y - (bottom - r)) ** 2));
  if (y < top + r) return flat + Math.sqrt(Math.max(0, r * r - (top + r - y) ** 2));
  return w / 2;
}

/** The glass of the water vessel: outline draws from the bottom up both sides, then the frosted body fades in. */
export function VesselGlass({ gf }: { gf: number }) {
  const d = vesselDraw(gf);
  if (d <= 0) return null;
  const body = pv(gf, 412, 440);
  const ticks = pv(gf, 426, 446);
  const { x, y, w, h, r } = VESSEL;
  const cx = x + w / 2;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: w,
          height: h,
          borderRadius: r,
          opacity: body,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.035))',
          backdropFilter: 'blur(24px) saturate(160%)',
          WebkitBackdropFilter: 'blur(24px) saturate(160%)',
          boxShadow: 'inset 0 1.5px 0 rgba(255,255,255,0.32), inset 0 0 0 1.5px rgba(255,255,255,0.07), 0 40px 80px -30px rgba(0,0,0,0.85)',
        }}
      />
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <defs>
          <linearGradient id="vs-edge" gradientUnits="userSpaceOnUse" x1="0" y1={y} x2="0" y2={y + h}>
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="1" stopColor="#8fc3ff" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <path d={V_HALF} fill="none" stroke="url(#vs-edge)" strokeWidth={2.5} strokeLinecap="round" opacity={1 - 0.55 * body} {...drawnV(d)} />
        <path d={V_HALF} transform={`translate(${2 * cx} 0) scale(-1 1)`} fill="none" stroke="url(#vs-edge)" strokeWidth={2.5} strokeLinecap="round" opacity={1 - 0.55 * body} {...drawnV(d)} />
        {/* measuring ticks on the right inner wall: 25 / 50 / 75 / 100 % */}
        {[0.25, 0.5, 0.75, 1].map((lv, i) => {
          const ty = VESSEL_IN.y + VESSEL_IN.h - lv * VESSEL_IN.h;
          const t = clampV((ticks - i * 0.15) / 0.55);
          const x1 = VESSEL_IN.x + VESSEL_IN.w - 22;
          return <line key={i} x1={x1} x2={x1 - (lv === 0.5 || lv === 1 ? 28 : 16) * t} y1={ty} y2={ty} stroke="rgba(255,255,255,0.28)" strokeWidth={2} strokeLinecap="round" />;
        })}
        {/* long vertical reflection on the left wall */}
        <rect x={x + 26} y={y + 70} width={10} height={h - 140} rx={5} fill="rgba(255,255,255,0.10)" opacity={body} />
      </svg>
    </>
  );
}

const clampV = (v: number) => Math.min(1, Math.max(0, v));
const drawnV = (p: number) => ({ pathLength: 1, strokeDasharray: '1 1', strokeDashoffset: 1 - clampV(p) });

/**
 * Copy of ui.tsx Words (kinetic type) with one fix: words are fully hidden
 * before they enter and after they leave, so the 6 px blur no longer leaks a
 * faint dash at the edge of the mask.
 */
export function WordsB({
  text,
  frames,
  size = 104,
  weight = 800,
  color = '#fff',
  accent = [],
  out,
  lineHeight = 0.98,
  tracking = '-0.035em',
  dim,
}: {
  text: string;
  frames: number[];
  size?: number;
  weight?: number;
  color?: string;
  accent?: number[];
  out?: number;
  lineHeight?: number;
  tracking?: string;
  /** 0 → 1: dims the line to 35 % when the next line takes over. */
  dim?: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(' ');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: size * 0.26, opacity: 1 - 0.65 * (dim ?? 0) }}>
      {words.map((w, i) => {
        const start = frames[i] ?? frames[frames.length - 1]!;
        const s = spring({ frame: frame - start, fps, config: { damping: 20, stiffness: 170, mass: 0.8 } });
        const leave = out === undefined ? 0 : interpolate(frame, [out + i * 1.5, out + 9 + i * 1.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: IO_V });
        const vis = Math.min(1, s * 2.5) * (1 - clampV((leave - 0.55) / 0.45));
        const y = (1 - s) * 105 - leave * 105;
        const isAccent = accent.includes(i);
        return (
          <span key={i} style={{ display: 'inline-block', overflow: 'hidden', paddingBottom: size * 0.12, marginBottom: -size * 0.12, lineHeight }}>
            <span
              style={{
                display: 'inline-block',
                transform: `translateY(${y}%)`,
                fontSize: size,
                fontWeight: weight,
                letterSpacing: tracking,
                color: isAccent ? 'transparent' : color,
                backgroundImage: isAccent ? 'linear-gradient(100deg, #ff7a6b 0%, #ff4552 45%, #c81d35 100%)' : undefined,
                WebkitBackgroundClip: isAccent ? 'text' : undefined,
                backgroundClip: isAccent ? 'text' : undefined,
                filter: `blur(${(1 - s) * 6 + leave * 6}px)`,
                opacity: vis,
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
