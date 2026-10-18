import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { fitsKrophed } from '../../../src/brand/krophed';
import { RUNNER_VIEWBOX, WORDMARK_TEXT_VIEWBOX, runnerPaths, wordmarkPaths } from '../../../src/brand/logoPaths';
import { clamp, ease, easeInOut, prog } from '../ui';
import shots from './shots.json';
import { BRAND_GRAD, C, FONT, FPS, useLayout } from './theme';

export { clamp, ease, easeInOut, prog };

/* ── Real captures (390 × 844 pt at 3×, see promo/capture) ─────────────── */
export const shot = (name: string) => staticFile(`pasos/app/${name}.png`);
/** Height in pt of a capture (full-page captures are taller than 844). */
export const shotH = (name: string) => (shots as Record<string, number>)[name] ?? 844;

/** Status bar height (pt) drawn above every capture, as on a phone. */
export const BAR = 47;
export const SCREEN_H = 844 + BAR;

/**
 * Current time in timeline frames (30 per second), fractional when the
 * composition renders faster: every beat, spring and track reads this clock.
 */
export function useT(): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (frame * FPS) / fps;
}

/** Eased value between keyframes [[frame, value], …]. */
export function keys(frame: number, pts: [number, number][], easing = easeInOut) {
  return interpolate(
    frame,
    pts.map((p) => p[0]),
    pts.map((p) => p[1]),
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing },
  );
}

/** 0 → 1 → 0 window with soft edges. */
export function windowed(frame: number, a: number, b: number, fadeIn = 10, fadeOut = fadeIn) {
  return prog(frame, a, a + fadeIn) * (1 - prog(frame, b - fadeOut, b, easeInOut));
}

export function useSpr(at: number, config: { damping?: number; stiffness?: number; mass?: number } = {}) {
  const frame = useT();
  return spring({ frame: frame - at, fps: FPS, config: { damping: 20, stiffness: 120, mass: 1, ...config } });
}

/* ── Backdrop: the app's deep violet-black with soft moving light ──────── */
export function Stage({ glow = 1, x = 0.5, y = 0.42, tint = C.violet, light = 0 }: { glow?: number; x?: number; y?: number; tint?: string; light?: number }) {
  const frame = useT();
  const { W, H } = useLayout();
  const t = frame / 30;
  const dx = Math.sin(t * 0.31) * 60;
  const dy = Math.cos(t * 0.23) * 44;
  const r = Math.max(W, H) * 1.05;
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.bg, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: W * x + dx - r / 2,
          top: H * y + dy - r / 2,
          width: r,
          height: r,
          borderRadius: '50%',
          background: `radial-gradient(closest-side, ${tint}${hex(0.34 * glow)}, ${C.deep}${hex(0.26 * glow)} 46%, transparent 76%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: W * (1 - x) - dx * 0.6 - r * 0.35,
          top: H * 0.92 - dy - r * 0.35,
          width: r * 0.7,
          height: r * 0.7,
          borderRadius: '50%',
          background: `radial-gradient(closest-side, ${C.deep}${hex(0.32 * glow)}, transparent 72%)`,
        }}
      />
      {light > 0 && <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(70% 45% at 50% 40%, rgba(201,184,255,${0.12 * light}), transparent 70%)` }} />}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 85% at 50% 45%, transparent 45%, rgba(4,3,8,0.85) 100%)' }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${staticFile('fx/grain.png')})`,
          backgroundPosition: `${(frame * 137) % 256}px ${(frame * 71) % 256}px`,
          opacity: 0.035,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

/** Two-digit hex alpha. */
export function hex(a: number) {
  return Math.round(clamp(a) * 255)
    .toString(16)
    .padStart(2, '0');
}

/* ── Phone with real screens ──────────────────────────────────────────── */
export interface Layer {
  /** Capture name. A «-full» capture scrolls under the real header and tab bar of `chrome`. */
  src: string;
  /** Scroll (pt) for full-page captures. */
  scroll?: number;
  /** Viewport capture whose tab bar stays fixed over a scrolling capture. */
  chrome?: string;
  /** Viewport capture for the fixed header (a scrolled one, where the header has its background). */
  chromeTop?: string;
  opacity?: number;
  /** CSS clip-path in screen pixels. */
  clip?: string;
  /** Status bar ink. */
  light?: boolean;
  /** Translate the whole layer (px), e.g. a sheet sliding. */
  dy?: number;
}

export function phoneGeom(width: number) {
  const bezel = width * 0.034;
  const innerW = width - 2 * bezel;
  const k = innerW / 390;
  const screenH = SCREEN_H * k;
  return { bezel, innerW, k, screenH, height: screenH + 2 * bezel, radius: width * 0.15, innerRadius: width * 0.12 };
}

/** A point of the screen, in capture pt, as px relative to the phone's centre. */
export function phonePt(width: number, px: number, py: number) {
  const g = phoneGeom(width);
  return { x: -width / 2 + g.bezel + px * g.k, y: -g.height / 2 + g.bezel + (BAR + py) * g.k };
}

export function Phone({
  width,
  x,
  y,
  layers,
  rx = 0,
  ry = 0,
  rz = 0,
  scale = 1,
  opacity = 1,
  glow = 0.55,
  glowColor = C.violet,
  children,
  outline,
  blur = 0,
}: {
  width: number;
  x: number;
  y: number;
  layers: Layer[];
  rx?: number;
  ry?: number;
  rz?: number;
  scale?: number;
  opacity?: number;
  glow?: number;
  glowColor?: string;
  children?: ReactNode;
  /** 0–1: draw only the outline of the phone (the path turning into a phone). */
  outline?: number;
  /** Motion blur (px) for whips. */
  blur?: number;
}) {
  const frame = useT();
  const g = phoneGeom(width);
  const sheen = 28 + ry * 1.2 + Math.sin(frame / 60) * 5;
  const body = outline === undefined ? 1 : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - width / 2,
        top: y - g.height / 2,
        width,
        height: g.height,
        opacity,
        transform: `perspective(2600px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${scale})`,
        filter: blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : undefined,
      }}
    >
      {body > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: g.radius,
            background: 'linear-gradient(145deg, #57545f 0%, #1b1a21 30%, #0d0c12 62%, #3a3842 100%)',
            padding: g.bezel,
            boxShadow: `0 80px 140px -50px rgba(0,0,0,0.95), 0 0 0 2px rgba(255,255,255,0.08), inset 0 0 0 1.5px rgba(255,255,255,0.14), 0 0 170px -40px ${glowColor}${hex(glow)}`,
          }}
        >
          <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: g.innerRadius, overflow: 'hidden', background: C.bg }}>
            {layers.map((l, i) => (
              <Screen key={i} layer={l} g={g} />
            ))}
            {/* Dynamic Island */}
            <div style={{ position: 'absolute', top: 11 * g.k, left: '50%', width: 116 * g.k, height: 34 * g.k, marginLeft: -58 * g.k, borderRadius: 999, background: '#000' }} />
            {children}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(118deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0) ${sheen}%, rgba(255,255,255,0) 74%, rgba(255,255,255,0.04) 100%)`,
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>
      )}
      {outline !== undefined && <PhoneOutline width={width} height={g.height} radius={g.radius} p={outline} />}
    </div>
  );
}

function PhoneOutline({ width, height, radius, p }: { width: number; height: number; radius: number; p: number }) {
  // Rounded rectangle starting at the top centre, drawn clockwise.
  const r = radius;
  const w = width;
  const h = height;
  const d = `M ${w / 2} 1 H ${w - r} A ${r} ${r} 0 0 1 ${w - 1} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h - 1} H ${r} A ${r} ${r} 0 0 1 1 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 1 Z`;
  return (
    <svg width={w} height={h} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      <defs>
        <linearGradient id="outline-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={C.lav} />
          <stop offset="1" stopColor={C.violet} />
        </linearGradient>
      </defs>
      <path d={d} fill="none" stroke={C.violet} strokeOpacity={0.5} strokeWidth={14} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} style={{ filter: 'blur(10px)' }} />
      <path d={d} fill="none" stroke="url(#outline-grad)" strokeWidth={4} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} />
    </svg>
  );
}

function Screen({ layer: l, g }: { layer: Layer; g: ReturnType<typeof phoneGeom> }) {
  const k = g.k;
  const full = l.scroll !== undefined;
  const h = shotH(l.src);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: l.opacity ?? 1, clipPath: l.clip, WebkitClipPath: l.clip, transform: l.dy ? `translateY(${l.dy}px)` : undefined }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        {/* The status bar area takes the top colour of the screen. */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: BAR * k + 2, backgroundImage: `url(${shot(l.chrome ?? l.src)})`, backgroundSize: '100% 84400%', backgroundPosition: 'top' }} />
        <div style={{ position: 'absolute', left: 0, top: BAR * k, width: 390 * k, height: 844 * k, overflow: 'hidden' }}>
          <Img src={shot(l.src)} style={{ position: 'absolute', left: 0, top: -(l.scroll ?? 0) * k, width: 390 * k, height: h * k }} />
          {full && l.chrome && (
            <>
              <Slice src={l.chromeTop ?? l.chrome} k={k} x={0} y={0} w={390} h={62} />
              {/* The floating tab bar pill only: content keeps scrolling around it. */}
              <Slice src={l.chrome} k={k} x={10} y={764} w={370} h={68} radius={34} />
            </>
          )}
        </div>
      </div>
      <StatusBar k={k} light={l.light} />
    </div>
  );
}

/** A horizontal band of a viewport capture, kept in place (fixed header or tab bar). */
function Slice({ src, k, x, y, w, h, radius = 0 }: { src: string; k: number; x: number; y: number; w: number; h: number; radius?: number }) {
  return (
    <div style={{ position: 'absolute', left: x * k, top: y * k, width: w * k, height: h * k, overflow: 'hidden', borderRadius: radius * k }}>
      <Img src={shot(src)} style={{ position: 'absolute', left: -x * k, top: -y * k, width: 390 * k, height: 844 * k }} />
    </div>
  );
}

function StatusBar({ k, light }: { k: number; light?: boolean }) {
  const fg = light ? '#14121b' : '#fff';
  const w = 390 * k;
  return (
    <svg style={{ position: 'absolute', left: 0, top: 0 }} width={w} height={BAR * k} viewBox={`0 0 390 ${BAR}`}>
      <text x={36} y={31} fill={fg} fontSize={16} fontWeight={600} fontFamily={FONT.sans}>
        10:30
      </text>
      <g fill={fg} transform="translate(296 19)">
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={i * 5} y={9 - 3 * i} width={3.4} height={3 + 3 * i} rx={0.8} />
        ))}
        <path transform="translate(26 -0.5)" d="M7.7 9.6a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Zm0-3.4c1.5 0 2.8.6 3.8 1.5l-1.1 1.1a3.9 3.9 0 0 0-5.4 0L3.9 7.7a5.4 5.4 0 0 1 3.8-1.5Zm0-3.4c2.4 0 4.6.9 6.2 2.5l-1.1 1.1a7.3 7.3 0 0 0-10.2 0L1.5 5.3a8.8 8.8 0 0 1 6.2-2.5Z" />
        <rect x={50} y={0} width={24} height={12} rx={3.5} fill="none" stroke={fg} strokeOpacity={0.45} />
        <rect x={52} y={2} width={17} height={8} rx={2} />
        <rect x={75} y={4} width={1.6} height={4} rx={0.8} fillOpacity={0.45} />
      </g>
    </svg>
  );
}

/* ── A real piece of the app lifted out of a capture ──────────────────── */
export function Crop({
  src,
  crop,
  width,
  x,
  y,
  opacity = 1,
  scale = 1,
  rx = 0,
  ry = 0,
  rz = 0,
  radius = 22,
  glow = 0.4,
  clip,
}: {
  src: string;
  /** Region in pt of the capture. */
  crop: { x: number; y: number; w: number; h: number };
  width: number;
  /** Centre. */
  x: number;
  y: number;
  opacity?: number;
  scale?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  /** Corner radius in pt. */
  radius?: number;
  glow?: number;
  clip?: string;
}) {
  const k = width / crop.w;
  const h = crop.h * k;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - width / 2,
        top: y - h / 2,
        width,
        height: h,
        opacity,
        borderRadius: radius * k,
        overflow: 'hidden',
        transform: `perspective(2200px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${scale})`,
        boxShadow: `0 60px 110px -40px rgba(0,0,0,0.95), 0 0 0 1.5px rgba(255,255,255,0.09), 0 0 90px -30px ${C.violet}${hex(glow)}`,
        clipPath: clip,
      }}
    >
      <Img src={shot(src)} style={{ position: 'absolute', width: 390 * k, height: shotH(src) * k, left: -crop.x * k, top: -crop.y * k }} />
    </div>
  );
}

/* ── Kinetic headline ─────────────────────────────────────────────────── */
/**
 * Words rise out of a mask one after another. Krophed (the wordmark face) only
 * when every character exists in it, as in the app; otherwise Inter in heavy
 * weight. `accent` words take the brand gradient.
 */
export function Headline({
  text,
  at,
  out,
  size,
  accent = [],
  align = 'center',
  stagger = 4,
  upper,
  color = C.text,
  style,
}: {
  text: string;
  at: number | number[];
  out?: number;
  size: number;
  accent?: number[];
  align?: 'left' | 'center';
  stagger?: number;
  /** Force capitals (display style). */
  upper?: boolean;
  color?: string;
  style?: CSSProperties;
}) {
  const frame = useT();
  const fps = FPS;
  const display = (upper ?? true) && fitsKrophed(text);
  const words = text.split(' ');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start', columnGap: size * (display ? 0.34 : 0.26), ...style }}>
      {words.map((w, i) => {
        const start = Array.isArray(at) ? (at[i] ?? at[at.length - 1]!) : at + i * stagger;
        const s = spring({ frame: frame - start, fps, config: { damping: 24, stiffness: 140, mass: 0.9 } });
        const leave = out === undefined ? 0 : prog(frame, out + i * 2, out + 14 + i * 2, easeInOut);
        const grad = accent.includes(i);
        return (
          <span key={i} style={{ display: 'inline-block', overflow: 'hidden', lineHeight: display ? 1.12 : 1.08, paddingTop: size * 0.05, paddingBottom: size * 0.05 }}>
            <span
              style={{
                display: 'inline-block',
                fontFamily: display ? FONT.display : FONT.sans,
                fontWeight: display ? 500 : 800,
                fontSize: size,
                letterSpacing: display ? '0.02em' : '-0.035em',
                textTransform: display ? 'uppercase' : undefined,
                transform: `translateY(${(1 - s) * 105 + leave * 105}%)`,
                opacity: clamp(s * 1.4) * (1 - leave),
                color: grad ? 'transparent' : color,
                backgroundImage: grad ? BRAND_GRAD : undefined,
                WebkitBackgroundClip: grad ? 'text' : undefined,
                backgroundClip: grad ? 'text' : undefined,
                filter: `blur(${(1 - s) * 4 + leave * 5}px)`,
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

/* ── Tap ripple and achievement sparkle ───────────────────────────────── */
export function Ripple({ x, y, at, size = 90, color = '#fff' }: { x: number; y: number; at: number; size?: number; color?: string }) {
  const frame = useT();
  const p = prog(frame, at, at + 16);
  if (frame < at || p >= 1) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        border: `3px solid ${color}`,
        opacity: 0.55 * (1 - p),
        transform: `scale(${0.4 + p * 0.9})`,
        background: `${color}22`,
      }}
    />
  );
}

/** A soft burst of small stars and dots: a milestone, never a flash. */
export function Sparkle({ x, y, at, radius = 140, count = 12, seed = 1 }: { x: number; y: number; at: number; radius?: number; count?: number; seed?: number }) {
  const frame = useT();
  const parts = useMemo(() => {
    let a = seed * 9301;
    const rnd = () => ((a = (a * 9301 + 49297) % 233280) / 233280);
    return Array.from({ length: count }, (_, i) => ({ ang: (i / count) * Math.PI * 2 + rnd() * 0.5, dist: 0.6 + rnd() * 0.5, size: 10 + rnd() * 14, star: i % 3 === 0, delay: rnd() * 4 }));
  }, [count, seed]);
  if (frame < at || frame > at + 40) return null;
  return (
    <>
      {parts.map((p, i) => {
        const t = prog(frame, at + p.delay, at + p.delay + 30);
        const d = radius * p.dist * t;
        const o = Math.sin(Math.PI * clamp(t * 1.1)) * 0.95;
        const s = p.size * (1 - 0.4 * t);
        return (
          <div key={i} style={{ position: 'absolute', left: x + Math.cos(p.ang) * d - s / 2, top: y + Math.sin(p.ang) * d - s / 2, width: s, height: s, opacity: o }}>
            {p.star ? (
              <svg viewBox="0 0 24 24" width={s} height={s}>
                <path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z" fill={i % 2 ? C.lav : '#fff'} />
              </svg>
            ) : (
              <div style={{ width: s * 0.5, height: s * 0.5, margin: s * 0.25, borderRadius: '50%', background: i % 2 ? C.violetHi : C.lavender }} />
            )}
          </div>
        );
      })}
    </>
  );
}

/* ── The path: a light that draws the way ─────────────────────────────── */
/** Samples an SVG path once (in the browser) so the trail and its head can follow it. */
export function usePathPoints(d: string, samples = 400) {
  return useMemo(() => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    el.setAttribute('d', d);
    const len = el.getTotalLength();
    return Array.from({ length: samples + 1 }, (_, i) => {
      const p = el.getPointAtLength((len * i) / samples);
      return { x: p.x, y: p.y };
    });
  }, [d, samples]);
}

export function pointAt(pts: { x: number; y: number }[], t: number) {
  const f = clamp(t) * (pts.length - 1);
  const i = Math.floor(f);
  const a = pts[i]!;
  const b = pts[Math.min(i + 1, pts.length - 1)]!;
  return { x: a.x + (b.x - a.x) * (f - i), y: a.y + (b.y - a.y) * (f - i) };
}

/** Draws `d` from `from` to `to` (0–1) with a soft glow and a bright head. */
export function Trail({ d, from = 0, to, opacity = 1, width = 6, head = true }: { d: string; from?: number; to: number; opacity?: number; width?: number; head?: boolean }) {
  const { W, H } = useLayout();
  const pts = usePathPoints(d);
  const h = pointAt(pts, to);
  const frame = useT();
  const pulse = 1 + Math.sin(frame / 5) * 0.12;
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0, opacity, overflow: 'visible' }}>
      <defs>
        <linearGradient id="trail-grad" gradientUnits="userSpaceOnUse" x1="0" y1={H} x2={W} y2="0">
          <stop offset="0" stopColor={C.violet} />
          <stop offset="0.6" stopColor={C.violetHi} />
          <stop offset="1" stopColor={C.lav} />
        </linearGradient>
        <radialGradient id="trail-head">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.35" stopColor={C.lav} stopOpacity={0.9} />
          <stop offset="1" stopColor={C.violet} stopOpacity={0} />
        </radialGradient>
      </defs>
      <path d={d} fill="none" stroke={C.violet} strokeOpacity={0.55} strokeWidth={width * 4} strokeLinecap="round" pathLength={1} strokeDasharray={`${Math.max(0, to - from)} 2`} strokeDashoffset={-from} style={{ filter: 'blur(14px)' }} />
      <path d={d} fill="none" stroke="url(#trail-grad)" strokeWidth={width} strokeLinecap="round" pathLength={1} strokeDasharray={`${Math.max(0, to - from)} 2`} strokeDashoffset={-from} />
      {head && to > 0 && to < 1 && <circle cx={h.x} cy={h.y} r={26 * pulse} fill="url(#trail-head)" />}
    </svg>
  );
}

/* ── RUMBO logo, drawn like the app's splash ──────────────────────────── */
export function Logo({ width, at, color = '#fff' }: { width: number; at: number; color?: string }) {
  const frame = useT();
  const fps = FPS;
  const [, , rw, rh] = RUNNER_VIEWBOX.split(' ').map(Number) as [number, number, number, number];
  const [wx, wy, ww, wh] = WORDMARK_TEXT_VIEWBOX.split(' ').map(Number) as [number, number, number, number];
  const markH = width * 0.36;
  const markW = (markH * rw) / rh;
  const wordW = width;
  const wordH = (wordW * wh) / ww;
  const draw = prog(frame, at, at + 22);
  const fill = prog(frame, at + 12, at + 26);
  return (
    <div style={{ width, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: width * 0.07 }}>
      <svg viewBox={RUNNER_VIEWBOX} width={markW} height={markH} style={{ overflow: 'visible' }}>
        {[...runnerPaths.speedLines.map((d, i) => ({ d, key: `s${i}`, delay: 10 + i * 3 })), { d: runnerPaths.leg, key: 'leg', delay: 2 }, { d: runnerPaths.body, key: 'body', delay: 0 }, { d: runnerPaths.head, key: 'head', delay: 4 }].map(
          (p) => {
            const s = spring({ frame: frame - at - p.delay, fps, config: { damping: 20, stiffness: 120 } });
            const isLine = p.key.startsWith('s');
            return (
              <g key={p.key} style={{ transform: isLine ? `translateX(${(1 - s) * 300}px)` : undefined }}>
                <path d={p.d} fill={color} fillOpacity={fill} fillRule="evenodd" stroke={color} strokeWidth={22} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} strokeOpacity={1 - fill * 0.6} />
              </g>
            );
          },
        )}
      </svg>
      <svg viewBox={`${wx} ${wy} ${ww} ${wh}`} width={wordW} height={wordH} style={{ overflow: 'visible' }}>
        {wordmarkPaths.letters.map((d, i) => {
          const s = spring({ frame: frame - at - 8 - i * 3, fps, config: { damping: 22, stiffness: 130 } });
          return <path key={i} d={d} fill={color} fillRule="evenodd" opacity={clamp(s * 1.3)} transform={`translate(${(1 - s) * (i - 2) * 140} 0)`} />;
        })}
      </svg>
    </div>
  );
}

/* ── Captions ─────────────────────────────────────────────────────────── */
export interface Cue {
  line: string;
  text: string;
  key: number[];
  start: number;
  end: number;
}

/** Short phrases in a dark pill: high contrast, no bouncing; key terms in lavender. */
export function Captions({ cues }: { cues: Cue[] }) {
  const frame = useT();
  const L = useLayout();
  const cue = cues.find((c) => frame >= c.start && frame < c.end);
  if (!cue) return null;
  const o = prog(frame, cue.start, cue.start + 4) * (1 - prog(frame, cue.end - 4, cue.end, easeInOut));
  const words = cue.text.split(' ');
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: L.capY, display: 'flex', justifyContent: 'center', transform: 'translateY(-50%)' }}>
      <div
        style={{
          maxWidth: L.format === 'story' ? 820 : 900,
          padding: `${L.capSize * 0.32}px ${L.capSize * 0.62}px`,
          borderRadius: L.capSize * 0.62,
          background: 'rgba(10,9,16,0.8)',
          boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.08), 0 20px 50px -20px rgba(0,0,0,0.8)',
          backdropFilter: 'blur(10px)',
          opacity: o,
          fontFamily: FONT.sans,
          fontSize: L.capSize,
          fontWeight: 600,
          lineHeight: 1.24,
          letterSpacing: '-0.01em',
          color: '#fff',
          textAlign: 'center',
          textWrap: 'balance',
        }}
      >
        {words.map((w, i) => (
          <span key={i} style={cue.key.includes(i) ? { color: C.lavender, fontWeight: 760 } : undefined}>
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
