import type { CSSProperties, ReactNode } from 'react';
import { Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { RUNNER_VIEWBOX, WORDMARK_TEXT_VIEWBOX, runnerPaths, wordmarkPaths } from '../../src/brand/logoPaths';
import { CORE, OUTER } from '../../src/features/streak/StreakFlame';

export const RED = '#e53945';
export const RED_HI = '#ff5a63';
export const RED_DEEP = '#8f182b';
export const INK = '#050507';
export const RED_GRAD = 'linear-gradient(100deg, #ff7a6b 0%, #ff4552 45%, #c81d35 100%)';

export const ease = Easing.bezier(0.22, 1, 0.36, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/** 0 → 1 between two frames with the brand ease-out. */
export const prog = (f: number, a: number, b: number, e = ease) => interpolate(f, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: e });

export function useSpring(at: number, config: { damping?: number; stiffness?: number; mass?: number } = {}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - at, fps, config: { damping: 18, stiffness: 140, mass: 0.9, ...config } });
}

/** Deterministic pseudo-random numbers (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const fmt = (n: number, decimals = 0) => n.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** Words that rise out of a mask one after another (kinetic type). */
export function Words({
  text,
  at = 0,
  every = 4,
  size = 104,
  weight = 800,
  color = '#fff',
  accent = [],
  align = 'left',
  out,
  lineHeight = 1.02,
  style,
  frames,
}: {
  text: string;
  at?: number;
  /** Explicit start frame for each word (e.g. from the voice timings); overrides at/every. */
  frames?: number[];
  every?: number | number[];
  size?: number;
  weight?: number;
  color?: string;
  /** Indexes of words drawn with the red gradient. */
  accent?: number[];
  align?: 'left' | 'center';
  /** Frame at which the line leaves (words lift away). */
  out?: number;
  lineHeight?: number;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(' ');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start', columnGap: size * 0.26, ...style }}>
      {words.map((w, i) => {
        const start = frames ? (frames[i] ?? frames[frames.length - 1]!) : Array.isArray(every) ? at + (every[i] ?? every[every.length - 1]!) : at + i * every;
        const s = spring({ frame: frame - start, fps, config: { damping: 20, stiffness: 170, mass: 0.8 } });
        const leave = out === undefined ? 0 : prog(frame, out + i * 1.5, out + 9 + i * 1.5, easeInOut);
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
                letterSpacing: '-0.035em',
                color: isAccent ? 'transparent' : color,
                backgroundImage: isAccent ? RED_GRAD : undefined,
                WebkitBackgroundClip: isAccent ? 'text' : undefined,
                backgroundClip: isAccent ? 'text' : undefined,
                filter: `blur(${(1 - s) * 6 + leave * 6}px)`,
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

/** Liquid Glass surface, as in the app: translucent fill, blur, bright top edge. */
export function Glass({ children, style, radius = 48 }: { children: ReactNode; style?: CSSProperties; radius?: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        borderRadius: radius,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.13), rgba(255,255,255,0.05))',
        backdropFilter: 'blur(28px) saturate(170%)',
        WebkitBackdropFilter: 'blur(28px) saturate(170%)',
        boxShadow:
          'inset 0 1.5px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(255,255,255,0.06), inset 0 0 0 1.5px rgba(255,255,255,0.1), 0 40px 80px -30px rgba(0,0,0,0.85), 0 0 60px -20px rgba(229,57,69,0.35)',
        color: '#fff',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** iPhone-like frame holding real screenshots of the app. */
/**
 * Phone mockup. By default the screens cover the display; with `fitWidth` they
 * keep their full width (real 390-pt-wide captures, 1170 × 1992 px) and sit
 * under a status bar, the space above filled with the capture's own top edge.
 */
export function Phone({
  width,
  screens,
  style,
  ratio = 2.06,
  fitWidth = false,
  shotAspect = 1992 / 1170,
}: {
  width: number;
  screens: { src: string; opacity: number; y?: number }[];
  style?: CSSProperties;
  ratio?: number;
  fitWidth?: boolean;
  shotAspect?: number;
}) {
  const h = width * ratio;
  const bezel = width * 0.035;
  const innerW = width - 2 * bezel;
  const innerH = h - 2 * bezel;
  const gap = fitWidth ? Math.max(0, innerH - innerW * shotAspect) : 0;
  return (
    <div
      style={{
        position: 'absolute',
        width,
        height: h,
        borderRadius: width * 0.16,
        background: 'linear-gradient(145deg, #3a3b42, #121217 40%, #2b2c33)',
        padding: bezel,
        boxShadow: '0 80px 160px -40px rgba(0,0,0,0.95), 0 0 0 2px rgba(255,255,255,0.08), 0 0 120px -30px rgba(229,57,69,0.45)',
        ...style,
      }}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: width * 0.13, overflow: 'hidden', background: '#08090d' }}>
        {screens.map((s, i) =>
          fitWidth ? (
            <div key={i} style={{ position: 'absolute', inset: 0, opacity: s.opacity }}>
              {/* status-bar area: the capture's first rows stretched (plain background there) */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  height: gap + 2,
                  backgroundImage: `url(${staticFile(`ui/${s.src}.png`)})`,
                  backgroundSize: '100% 30000%',
                  backgroundPosition: 'top',
                }}
              />
              <Img
                src={staticFile(`ui/${s.src}.png`)}
                style={{ position: 'absolute', left: 0, top: gap, width: '100%', height: 'auto', transform: `translateY(${s.y ?? 0}%)` }}
              />
            </div>
          ) : (
            <Img
              key={i}
              src={staticFile(`ui/${s.src}.png`)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', opacity: s.opacity, transform: `translateY(${s.y ?? 0}%)` }}
            />
          ),
        )}
        {fitWidth && gap > 0 && <StatusBar width={innerW} height={gap} />}
        <div
          style={{
            position: 'absolute',
            top: width * 0.03,
            left: '50%',
            width: width * 0.3,
            height: width * 0.085,
            marginLeft: -width * 0.15,
            borderRadius: 999,
            background: '#000',
          }}
        />
        {/* glass reflection */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 32%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.05) 100%)' }} />
      </div>
    </div>
  );
}

/** Generic iOS-style status bar for the mockup (time, signal, Wi-Fi, battery). */
function StatusBar({ width, height }: { width: number; height: number }) {
  const u = width / 390; // points → px
  const cy = Math.min(height / 2 + 4 * u, 26 * u);
  return (
    <svg style={{ position: 'absolute', left: 0, top: 0 }} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <text x={34 * u} y={cy + 6 * u} fill="#fff" fontSize={16 * u} fontWeight={600} fontFamily="Inter, system-ui, sans-serif">
        9:41
      </text>
      <g fill="#fff" transform={`translate(${width - 92 * u} ${cy - 6 * u})`}>
        {[0, 1, 2, 3].map((k) => (
          <rect key={k} x={k * 5 * u} y={(9 - 3 * k) * u} width={3.4 * u} height={(3 + 3 * k) * u} rx={0.8 * u} />
        ))}
        <path
          transform={`translate(${26 * u} ${-0.5 * u}) scale(${u})`}
          d="M7.7 9.6a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Zm0-3.4c1.5 0 2.8.6 3.8 1.5l-1.1 1.1a3.9 3.9 0 0 0-5.4 0L3.9 7.7a5.4 5.4 0 0 1 3.8-1.5Zm0-3.4c2.4 0 4.6.9 6.2 2.5l-1.1 1.1a7.3 7.3 0 0 0-10.2 0L1.5 5.3a8.8 8.8 0 0 1 6.2-2.5Z"
        />
        <rect x={50 * u} y={0} width={24 * u} height={12 * u} rx={3.5 * u} fill="none" stroke="#fff" strokeOpacity={0.45} strokeWidth={1 * u} />
        <rect x={52 * u} y={2 * u} width={17 * u} height={8 * u} rx={2 * u} />
        <rect x={75 * u} y={4 * u} width={1.6 * u} height={4 * u} rx={0.8 * u} fillOpacity={0.45} />
      </g>
    </svg>
  );
}

export function RunnerLogo({ size, frame, at, color = '#fff' }: { size: number; frame: number; at: number; color?: string }) {
  const lines = runnerPaths.speedLines;
  return (
    <svg viewBox={RUNNER_VIEWBOX} width={size} height={(size * 1600) / 2040} fill={color} fillRule="evenodd" style={{ overflow: 'visible' }}>
      {lines.map((d, i) => {
        const p = prog(frame, at + i * 2, at + 12 + i * 2);
        return <path key={i} d={d} opacity={p} transform={`translate(${(1 - p) * -260} 0)`} />;
      })}
      {[runnerPaths.leg, runnerPaths.body, runnerPaths.head].map((d, i) => {
        const p = prog(frame, at + 4 + i * 3, at + 18 + i * 3);
        return <path key={i} d={d} opacity={p} transform={`translate(${(1 - p) * 120} ${(1 - p) * 60})`} />;
      })}
    </svg>
  );
}

/** RUMBO wordmark with letters rising out of a mask and an optional light sweep across the letters. */
export function Wordmark({ width, frame, at, sweepAt, id = 'wm' }: { width: number; frame: number; at: number; sweepAt?: number; id?: string }) {
  const h = (width * 353) / 2372;
  const sweep = sweepAt === undefined ? -1 : prog(frame, sweepAt, sweepAt + 24, easeInOut);
  const sx = -700 + sweep * 3800;
  return (
    <svg viewBox={WORDMARK_TEXT_VIEWBOX} width={width} height={h} fill="#fff" fillRule="evenodd" style={{ overflow: 'hidden', display: 'block' }}>
      <defs>
        <clipPath id={`${id}-clip`}>
          <rect x="-6" y="-6" width="2372" height="353" />
        </clipPath>
        <linearGradient id={`${id}-sweep`} gradientUnits="userSpaceOnUse" x1={sx - 420} y1="0" x2={sx + 420} y2="0">
          <stop offset="0" stopColor="#ff5a63" stopOpacity="0" />
          <stop offset="0.45" stopColor="#ff5a63" stopOpacity="1" />
          <stop offset="0.55" stopColor="#ffd0d0" stopOpacity="1" />
          <stop offset="1" stopColor="#ff5a63" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        {wordmarkPaths.letters.map((d, i) => {
          const p = prog(frame, at + i * 2.5, at + 16 + i * 2.5);
          return (
            <g key={i} transform={`translate(0 ${(1 - p) * 360})`}>
              <path d={d} />
              {sweep > 0 && sweep < 1 && <path d={d} fill={`url(#${id}-sweep)`} />}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/** The app's streak flame, frame-driven: slow breathing, core flicker and a warm glow. */
export function Flame({ size, frame, seed = 1 }: { size: number; frame: number; seed?: number }) {
  const t = frame / 30;
  const breathe = Math.sin(t * Math.PI * 2 / 1.6 + seed);
  const flick = Math.sin(t * Math.PI * 2 / 0.9 + seed * 2) * 0.5 + Math.sin(t * Math.PI * 2 / 0.37 + seed) * 0.25;
  const sx = 1 + 0.025 * breathe;
  const sy = 1 + 0.045 * breathe + 0.015 * flick;
  const core = 1 + 0.05 * flick;
  const id = `fl${seed}`;
  return (
    <div style={{ position: 'relative', width: size, height: size * 1.16 }}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '60%',
          width: size * 2.1,
          height: size * 2.1,
          transform: `translate(-50%, -50%) scale(${1 + 0.06 * breathe})`,
          borderRadius: '50%',
          background: 'radial-gradient(closest-side, rgba(255,128,48,0.55), rgba(229,57,69,0.18) 55%, transparent)',
          opacity: 0.75 + 0.2 * flick,
        }}
      />
      <svg viewBox="0 0 100 116" width={size} height={size * 1.16} style={{ position: 'relative', overflow: 'visible', transformOrigin: '50% 100%', transform: `scale(${sx}, ${sy})` }}>
        <defs>
          <linearGradient id={`${id}-o`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ee3b3b" />
            <stop offset="0.42" stopColor="#ff5c1c" />
            <stop offset="1" stopColor="#ff9a1f" />
          </linearGradient>
          <radialGradient id={`${id}-b`} cx="0.5" cy="0.95" r="0.7">
            <stop offset="0" stopColor="#ffb72e" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ff7a1a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-c`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd23f" />
            <stop offset="0.6" stopColor="#ffe680" />
            <stop offset="1" stopColor="#fff4c2" />
          </linearGradient>
        </defs>
        <path d={OUTER} fill={`url(#${id}-o)`} />
        <path d={OUTER} fill={`url(#${id}-b)`} />
        <g style={{ transformOrigin: '50px 111px', transform: `scale(${core})` }}>
          <path d={CORE} fill={`url(#${id}-c)`} />
        </g>
      </svg>
    </div>
  );
}

/** Background shared by every scene: deep black, soft red light, vignette and film grain. */
export function Backdrop({ glow = 0.6, glowY = 0.5, hue = 0 }: { glow?: number; glowY?: number; hue?: number }) {
  const frame = useCurrentFrame();
  const t = frame / 30;
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
          filter: `hue-rotate(${hue}deg)`,
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
          backgroundPosition: `${(frame * 137) % 256}px ${(frame * 71) % 256}px`,
          opacity: 0.045,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

/** Diagonal light streak that wipes across a cut. */
export function LightSweep({ at, dur = 14 }: { at: number; dur?: number }) {
  const frame = useCurrentFrame();
  const p = prog(frame, at, at + dur, easeInOut);
  if (p <= 0 || p >= 1) return null;
  const x = -1400 + p * 3300;
  const strength = Math.sin(p * Math.PI);
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          top: -600,
          left: x,
          width: 520,
          height: 3200,
          transform: 'rotate(18deg)',
          background: 'linear-gradient(90deg, transparent, rgba(229,57,69,0.55) 35%, rgba(255,190,190,0.9) 50%, rgba(229,57,69,0.55) 65%, transparent)',
          filter: 'blur(30px)',
          opacity: strength,
          mixBlendMode: 'screen',
        }}
      />
      <div style={{ position: 'absolute', inset: 0, background: `rgba(255,70,80,${0.12 * strength})`, mixBlendMode: 'screen' }} />
    </div>
  );
}

// ── Additions for the 40 s cut ────────────────────────────────────────────

/** Small uppercase label with a short red rule that draws in: "PROGRESO", "HÁBITOS"… */
export function Eyebrow({ text, at, align = 'left' }: { text: string; at: number; align?: 'left' | 'center' }) {
  const frame = useCurrentFrame();
  const line = prog(frame, at, at + 14);
  const txt = prog(frame, at + 4, at + 18);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
      <div style={{ width: 56 * line, height: 3, borderRadius: 2, background: '#ff4552' }} />
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: '#ff8a8f',
          opacity: txt,
          transform: `translateX(${(1 - txt) * -16}px)`,
        }}
      >
        {text}
      </div>
    </div>
  );
}

/** Animated number (es-ES). */
export function Counter({ from, to, at, dur, decimals = 0, style }: { from: number; to: number; at: number; dur: number; decimals?: number; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1) });
  return <span style={{ fontVariantNumeric: 'tabular-nums', ...style }}>{fmt(from + (to - from) * p, decimals)}</span>;
}

/** Stroke that draws itself: put pathLength={1} on the path and spread these props. */
export const drawn = (p: number) => ({ pathLength: 1, strokeDasharray: '1 1', strokeDashoffset: 1 - clamp(p) });

/** Soft dust motes drifting in the light — deterministic, subtle. */
export function Particles({ seed = 1, count = 26, opacity = 0.5, area = { x: 0, y: 0, w: 1080, h: 1920 } }: { seed?: number; count?: number; opacity?: number; area?: { x: number; y: number; w: number; h: number } }) {
  const frame = useCurrentFrame();
  const r = rng(seed);
  const parts = Array.from({ length: count }, () => ({ x: r(), y: r(), s: 2 + r() * 4, v: 0.2 + r() * 0.6, ph: r() * 6.28, a: 0.25 + r() * 0.75 }));
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {parts.map((p, i) => {
        const y = ((p.y * area.h - frame * p.v * 1.6) % area.h + area.h) % area.h;
        const x = p.x * area.w + Math.sin(frame / 40 + p.ph) * 18;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: area.x + x,
              top: area.y + y,
              width: p.s,
              height: p.s,
              borderRadius: '50%',
              background: i % 4 ? 'rgba(255,190,190,0.9)' : 'rgba(255,90,99,0.9)',
              boxShadow: '0 0 10px 2px rgba(255,90,99,0.35)',
              opacity: opacity * p.a * (0.6 + 0.4 * Math.sin(frame / 18 + p.ph)),
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Official logo lockup for the brand and end cards: the runner inside a Liquid
 * Glass medallion (as on the app's welcome screen) above a compact wordmark.
 * `size` is the medallion size; the wordmark width is 2.1× that (never wider than 520 px).
 */
export function LogoLockup({ size = 200, at, sweepAt, id = 'lockup' }: { size?: number; at: number; sweepAt?: number; id?: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - at, fps, config: { damping: 14, stiffness: 120, mass: 0.9 } });
  const shine = sweepAt === undefined ? 0 : prog(frame, sweepAt, sweepAt + 26, easeInOut);
  const wmWidth = Math.min(520, size * 2.1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: size * 0.26 }}>
      <div
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: size * 0.3,
          transform: `scale(${0.6 + 0.4 * pop})`,
          opacity: clamp(pop * 1.4),
          background: 'linear-gradient(160deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05))',
          boxShadow:
            'inset 0 2px 0 rgba(255,255,255,0.45), inset 0 0 0 1.5px rgba(255,255,255,0.14), 0 40px 90px -30px rgba(0,0,0,0.9), 0 0 120px -20px rgba(229,57,69,0.6)',
          backdropFilter: 'blur(24px) saturate(170%)',
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
        }}
      >
        <RunnerLogo size={size * 0.62} frame={frame} at={at + 2} />
        {shine > 0 && shine < 1 && (
          <div
            style={{
              position: 'absolute',
              inset: -size,
              background: `linear-gradient(115deg, transparent ${40 + shine * 40 - 12}%, rgba(255,255,255,0.35) ${40 + shine * 40}%, transparent ${40 + shine * 40 + 12}%)`,
              transform: `translateX(${(shine - 0.5) * size * 1.6}px)`,
            }}
          />
        )}
      </div>
      <Wordmark width={wmWidth} frame={frame} at={at + 10} sweepAt={sweepAt} id={`${id}-wm`} />
    </div>
  );
}
