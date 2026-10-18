/**
 * Energy: the pieces that make the cut hit on the beat. Big type that slams in,
 * shockwaves, light rays and particles behind everything, confetti for the
 * wins. All of it reads the timeline clock (useT), so 60 fps is real motion.
 */
import { useMemo } from 'react';
import { spring } from 'remotion';
import { fitsKrophed } from '../../../src/brand/krophed';
import { clamp, easeInOut, hex, prog, useT } from './kit';
import { BRAND_GRAD, C, FONT, FPS, useLayout } from './theme';

/** Deterministic pseudo-random numbers. */
export function rand(seed: number) {
  let a = seed * 9301 + 49297;
  return () => ((a = (a * 9301 + 49297) % 233280) / 233280);
}

/* ── Big type that slams in ───────────────────────────────────────────── */
/**
 * One line of display type: it lands from big and blurred onto its place with
 * a little overshoot and leaves fast. Krophed (the wordmark face) when every
 * character exists in it, Inter Black otherwise. `accent` words take the
 * brand gradient; `echo` adds two outlines that ring out on impact.
 */
export function Slam({
  text,
  at,
  out,
  size,
  y,
  x,
  accent = [],
  echo = true,
  color = C.text,
  from = 2.1,
  align = 'center',
  strike,
  sans = false,
}: {
  text: string;
  at: number;
  out?: number;
  size: number;
  /** Centre line. */
  y: number;
  /** Centre (default: middle of the frame). */
  x?: number;
  accent?: number[];
  echo?: boolean;
  color?: string;
  /** Starting scale. */
  from?: number;
  align?: 'center' | 'left';
  /** Frame at which a violet bar strikes the line through. */
  strike?: number;
  /** Inter Black even when Krophed could set it (to match a line that needs accents). */
  sans?: boolean;
}) {
  const f = useT();
  const { W } = useLayout();
  if (f < at - 1 || (out !== undefined && f > out + 10)) return null;
  const s = spring({ frame: f - at, fps: FPS, config: { damping: 13, stiffness: 260, mass: 0.7 } });
  const leave = out === undefined ? 0 : prog(f, out, out + 8, easeInOut);
  const scale = from + (1 - from) * s + leave * 0.25;
  const blur = Math.max(0, (1 - prog(f, at, at + 5)) * 14) + leave * 10;
  const display = !sans && fitsKrophed(text);
  const words = text.split(' ');
  const font = {
    fontFamily: display ? FONT.display : FONT.sans,
    fontWeight: display ? 500 : 900,
    fontSize: size,
    letterSpacing: display ? '0.02em' : '-0.04em',
    textTransform: display ? ('uppercase' as const) : undefined,
    lineHeight: 1,
    whiteSpace: 'nowrap' as const,
  };
  const cx = x ?? W / 2;
  const body = (ghost?: string) =>
    words.map((w, i) => {
      const grad = accent.includes(i) && !ghost;
      return (
        <span
          key={i}
          style={{
            color: ghost ? 'transparent' : grad ? 'transparent' : color,
            backgroundImage: grad ? BRAND_GRAD : undefined,
            WebkitBackgroundClip: grad ? 'text' : undefined,
            backgroundClip: grad ? 'text' : undefined,
            WebkitTextStroke: ghost ? `2px ${ghost}` : undefined,
          }}
        >
          {w}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      );
    });
  const ring = prog(f, at + 2, at + 16);
  const strikeT = strike === undefined ? 0 : prog(f, strike, strike + 6, easeInOut);
  return (
    <div
      style={{
        position: 'absolute',
        left: align === 'center' ? cx : cx,
        top: y,
        transform: `translate(${align === 'center' ? '-50%' : '0'}, -50%) scale(${scale})`,
        transformOrigin: align === 'center' ? '50% 50%' : '0% 50%',
        opacity: clamp(s * 3) * (1 - leave),
        filter: blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : undefined,
      }}
    >
      {echo &&
        [0, 1].map((k) => {
          const t = clamp(ring - k * 0.25);
          if (t <= 0 || t >= 1) return null;
          return (
            <div key={k} style={{ position: 'absolute', inset: 0, ...font, transform: `scale(${1 + t * (0.28 + k * 0.12)})`, opacity: (1 - t) * 0.5 }}>
              {body(k ? C.violetHi : C.lav)}
            </div>
          );
        })}
      <div style={{ position: 'relative', ...font, textShadow: `0 0 ${size * 0.5}px ${C.violet}66, 0 ${size * 0.06}px ${size * 0.2}px rgba(0,0,0,0.6)` }}>{body()}</div>
      {strike !== undefined && strikeT > 0 && (
        <div
          style={{
            position: 'absolute',
            left: '-4%',
            top: '50%',
            width: '108%',
            height: size * 0.14,
            marginTop: -size * 0.07,
            borderRadius: size,
            background: `linear-gradient(90deg, ${C.violetHi}, ${C.lav})`,
            boxShadow: `0 0 ${size * 0.4}px ${C.violet}`,
            transform: `rotate(-4deg) scaleX(${strikeT})`,
            transformOrigin: '0 50%',
          }}
        />
      )}
    </div>
  );
}

/* ── Shockwave ring (a drop, a card landing) ──────────────────────────── */
export function Shock({ x, y, at, size = 900, color = C.lav, width = 10, dur = 18 }: { x: number; y: number; at: number; size?: number; color?: string; width?: number; dur?: number }) {
  const f = useT();
  const t = prog(f, at, at + dur);
  if (f < at || t >= 1) return null;
  const r = size * (0.08 + 0.92 * (1 - (1 - t) ** 3));
  return (
    <div
      style={{
        position: 'absolute',
        left: x - r / 2,
        top: y - r / 2,
        width: r,
        height: r,
        borderRadius: '50%',
        border: `${width * (1 - t) + 1}px solid ${color}`,
        boxShadow: `0 0 ${40 * (1 - t)}px ${C.violetHi}, inset 0 0 ${30 * (1 - t)}px ${C.violetHi}`,
        opacity: (1 - t) * 0.9,
      }}
    />
  );
}

/* ── Light rays behind the hero ───────────────────────────────────────── */
export function Rays({ x, y, intensity, spin, tint }: { x: number; y: number; intensity: number; spin: number; tint: string }) {
  const { W, H } = useLayout();
  if (intensity <= 0.01) return null;
  const a = hex(0.22 * intensity);
  const b = hex(0.1 * intensity);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `repeating-conic-gradient(from ${spin.toFixed(2)}deg at ${(x / W) * 100}% ${(y / H) * 100}%, ${tint}00 0deg, ${tint}${a} 5deg, ${tint}${b} 9deg, ${tint}00 15deg, ${tint}00 30deg)`,
        WebkitMaskImage: `radial-gradient(circle at ${(x / W) * 100}% ${(y / H) * 100}%, #000 0%, rgba(0,0,0,0.6) 30%, transparent 70%)`,
        maskImage: `radial-gradient(circle at ${(x / W) * 100}% ${(y / H) * 100}%, #000 0%, rgba(0,0,0,0.6) 30%, transparent 70%)`,
        mixBlendMode: 'screen',
      }}
    />
  );
}

/* ── Bokeh and speed: particles rising through the frame ──────────────── */
export function Particles({ speed, density = 1, tint, streak = 0 }: { speed: number; density?: number; tint: string; streak?: number }) {
  const f = useT();
  const { W, H } = useLayout();
  const parts = useMemo(() => {
    const r = rand(42);
    return Array.from({ length: 46 }, () => ({ x: r(), y: r(), s: 4 + r() * 14, v: 0.4 + r() * 1.2, o: 0.25 + r() * 0.55, warm: r() < 0.3 }));
  }, []);
  // Distance travelled is the integral of speed: keep it smooth when speed changes.
  return (
    <>
      {parts.slice(0, Math.round(parts.length * clamp(density))).map((p, i) => {
        const travel = speed * p.v;
        const y = (((p.y * (H + 200) - travel) % (H + 200)) + H + 200) % (H + 200) - 100;
        const len = p.s + streak * 90 * p.v;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: p.x * W,
              top: y,
              width: p.s * 0.6,
              height: len,
              marginLeft: -p.s * 0.3,
              borderRadius: p.s,
              background: p.warm ? C.lav : tint,
              opacity: p.o * (0.5 + 0.5 * Math.sin(f / 9 + i)),
              boxShadow: `0 0 ${p.s * 1.4}px ${tint}`,
            }}
          />
        );
      })}
    </>
  );
}

/* ── Confetti for the wins, in the brand colours ──────────────────────── */
export function Confetti({ x, y, at, count = 40, spread = 700, seed = 1, dur = 54 }: { x: number; y: number; at: number; count?: number; spread?: number; seed?: number; dur?: number }) {
  const f = useT();
  const parts = useMemo(() => {
    const r = rand(seed);
    const colours = [C.violetHi, C.lav, '#ffffff', C.violet, '#5ce3fb', '#ff4b90', '#d6ff5c'];
    return Array.from({ length: count }, () => ({
      ang: -Math.PI / 2 + (r() - 0.5) * Math.PI * 1.3,
      v: 0.5 + r() * 0.6,
      spin: (r() - 0.5) * 30,
      w: 10 + r() * 12,
      h: 6 + r() * 8,
      c: colours[Math.floor(r() * colours.length)]!,
      delay: r() * 3,
    }));
  }, [count, seed]);
  if (f < at || f > at + dur) return null;
  return (
    <>
      {parts.map((p, i) => {
        const t = Math.max(0, f - at - p.delay) / 30;
        const vx = Math.cos(p.ang) * spread * p.v;
        const vy = Math.sin(p.ang) * spread * p.v * 1.4;
        const px = x + vx * t * (1 - t * 0.35);
        const py = y + vy * t + 900 * t * t;
        const o = 1 - prog(f, at + dur - 16, at + dur);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: px,
              top: py,
              width: p.w,
              height: p.h,
              borderRadius: 2,
              background: p.c,
              opacity: o,
              transform: `rotate(${p.spin * t * 30}deg) scaleX(${Math.cos(t * 12 + i)})`,
            }}
          />
        );
      })}
    </>
  );
}

/* ── A soft flash of light (never a strobe) ───────────────────────────── */
export function Flash({ at, peak = 0.55, rise = 6, fall = 14, color = C.lav }: { at: number; peak?: number; rise?: number; fall?: number; color?: string }) {
  const f = useT();
  if (f < at - rise || f > at + fall) return null;
  const o = f < at ? prog(f, at - rise, at) : 1 - prog(f, at, at + fall);
  return <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 45%, #ffffff, ${color} 45%, ${C.violet} 100%)`, opacity: o * peak, mixBlendMode: 'screen' }} />;
}

/* ── Speed lines for whips ────────────────────────────────────────────── */
export function SpeedLines({ amount, dir = 1, tint = C.lav }: { amount: number; dir?: number; tint?: string }) {
  const f = useT();
  const { W, H } = useLayout();
  const lines = useMemo(() => {
    const r = rand(7);
    return Array.from({ length: 26 }, () => ({ y: r(), len: 0.25 + r() * 0.5, off: r(), w: 2 + r() * 5 }));
  }, []);
  if (amount <= 0.02) return null;
  return (
    <>
      {lines.map((l, i) => {
        const x = ((l.off + f * 0.09 * dir) % 1) * W * 1.6 - W * 0.3;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: dir > 0 ? x : W - x,
              top: l.y * H,
              width: l.len * W,
              height: l.w,
              borderRadius: l.w,
              background: `linear-gradient(90deg, ${tint}00, ${tint}, ${tint}00)`,
              opacity: amount * 0.7,
            }}
          />
        );
      })}
    </>
  );
}

/* ── Count-up number ──────────────────────────────────────────────────── */
export function countUp(f: number, at: number, dur: number, to: number) {
  return Math.round(to * easeInOut(prog(f, at, at + dur)));
}
