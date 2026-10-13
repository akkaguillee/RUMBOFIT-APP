import { Easing, interpolate, spring, useCurrentFrame } from 'remotion';
import { clamp, drawn, prog } from '../ui';
import { RUMBI_A } from './IntroRumbi';

/*
 * The opening signature: one thin line of red light is drawn across the black
 * frame, bends (constant-length arc whose curvature grows) into a smile, then
 * closes into a ring exactly where Rumbi's body will be. The ring condenses into
 * a sphere of light and hands over to the real Rumbi.
 */

const R = RUMBI_A.size * 0.4; // Rumbi's body radius (viewBox r 40 of 100)
const CX = RUMBI_A.cx;
const CY = RUMBI_A.cy;
const BASE_Y = CY + R; // the line lies where the sphere will touch the ground
const N = 180;

export const DRAW = { from: 0, to: 23 } as const;
export const BEND = { from: 19, to: 45 } as const;

const drawEase = Easing.bezier(0.35, 0.05, 0.25, 1);
const bendEase = Easing.bezier(0.62, 0, 0.32, 1);

/** Points of an arc of length S bent by half-angle phi (0 = straight, π = full circle), midpoint at the base. */
function arc(phi: number, S: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const s = -S / 2 + (S * i) / N;
    if (phi < 1e-4) {
      pts.push([CX + s, BASE_Y]);
    } else {
      const r = S / (2 * phi);
      const a = phi * ((2 * s) / S);
      pts.push([CX + r * Math.sin(a), BASE_Y - r * (1 - Math.cos(a))]);
    }
  }
  return pts;
}

const toD = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');

function Layer({ d, width, color, blur, opacity, draw }: { d: string; width: number; color: string; blur: number; opacity: number; draw: number }) {
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0, overflow: 'visible', filter: blur ? `blur(${blur}px)` : undefined, opacity }}>
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" {...drawn(draw)} />
    </svg>
  );
}

export function LightLine() {
  const g = useCurrentFrame();
  const draw = prog(g, DRAW.from, DRAW.to, drawEase);
  const bend = prog(g, BEND.from, BEND.to, bendEase);
  const closed = g >= BEND.to;

  // After closing, the ring "condenses": a quick inhale, then settles at Rumbi's size.
  const pulse = spring({ frame: g - BEND.to, fps: 30, config: { damping: 9, stiffness: 220, mass: 0.6 } });
  const ringR = closed ? R * (1 - 0.07 * Math.sin(Math.PI * clamp(pulse))) : R;

  const S = interpolate(bend, [0, 1], [1130, 2 * Math.PI * R]);
  const pts = arc(Math.PI * bend, S);
  const d = closed
    ? `M ${CX} ${CY - ringR} a ${ringR} ${ringR} 0 1 1 0 ${2 * ringR} a ${ringR} ${ringR} 0 1 1 0 ${-2 * ringR}`
    : toD(pts);

  // Handover to Rumbi: the ring and the sphere of light fade as the real body appears.
  const fadeOut = 1 - prog(g, 50, 63);
  if (fadeOut <= 0) return null;

  // Brightness swells as it closes.
  const heat = interpolate(g, [DRAW.from, BEND.to - 6, BEND.to, BEND.to + 6], [0.75, 0.85, 1.25, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const core = closed ? 3.2 : 2.6;

  // Leading spark while drawing.
  const head = pts[Math.round(draw * N)]!;
  const spark = draw > 0 && draw < 1 ? Math.sin(Math.PI * Math.min(1, draw * 1.15)) : 0;

  // Junction flash where the two ends meet.
  const flash = interpolate(g, [BEND.to - 2, BEND.to, BEND.to + 9], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // The sphere of light filling the ring.
  const fill = prog(g, BEND.to, BEND.to + 9);

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fadeOut, mixBlendMode: 'screen' }}>
      {/* sphere fill */}
      {fill > 0 && (
        <div
          style={{
            position: 'absolute',
            left: CX - ringR,
            top: CY - ringR,
            width: ringR * 2,
            height: ringR * 2,
            borderRadius: '50%',
            transform: `scale(${0.35 + 0.65 * fill})`,
            opacity: fill,
            background:
              'radial-gradient(circle at 38% 32%, rgba(255,255,255,0.95) 0%, rgba(255,226,226,0.85) 28%, rgba(255,138,143,0.55) 62%, rgba(229,57,69,0.15) 100%)',
            filter: `blur(${(1 - fill) * 14 + 2}px)`,
          }}
        />
      )}
      <Layer d={d} width={26} color="#e53945" blur={16} opacity={0.55 * heat} draw={closed ? 1 : draw} />
      <Layer d={d} width={8} color="#ff4f5a" blur={3.5} opacity={0.95 * Math.min(1, heat)} draw={closed ? 1 : draw} />
      <Layer d={d} width={core} color="#ffe6e6" blur={0} opacity={1} draw={closed ? 1 : draw} />
      {spark > 0 && (
        <>
          <div
            style={{
              position: 'absolute',
              left: head[0] - 160,
              top: head[1] - 3,
              width: 320,
              height: 6,
              borderRadius: 6,
              background: 'linear-gradient(90deg, transparent, rgba(255,200,200,0.9) 50%, transparent)',
              filter: 'blur(2px)',
              opacity: spark,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: head[0] - 34,
              top: head[1] - 34,
              width: 68,
              height: 68,
              borderRadius: '50%',
              background: 'radial-gradient(closest-side, #fff 0%, rgba(255,170,170,0.9) 25%, rgba(229,57,69,0.4) 55%, transparent)',
              opacity: spark,
            }}
          />
        </>
      )}
      {flash > 0 && (
        <div style={{ position: 'absolute', left: CX, top: CY - R, width: 0, height: 0 }}>
          <div
            style={{
              position: 'absolute',
              left: -60,
              top: -60,
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: 'radial-gradient(closest-side, #fff, rgba(255,150,150,0.8) 30%, rgba(229,57,69,0.25) 60%, transparent)',
              opacity: flash,
              transform: `scale(${0.6 + 0.8 * flash})`,
            }}
          />
          <div style={{ position: 'absolute', left: -240 * flash, top: -2, width: 480 * flash, height: 4, background: 'linear-gradient(90deg, transparent, #ffdede, transparent)', opacity: flash }} />
          <div style={{ position: 'absolute', top: -110 * flash, left: -1.5, height: 220 * flash, width: 3, background: 'linear-gradient(180deg, transparent, #ffdede, transparent)', opacity: flash * 0.7 }} />
        </div>
      )}
    </div>
  );
}

/** Large soft bloom behind the sphere when it is born. */
export function SphereBloom() {
  const g = useCurrentFrame();
  const a = interpolate(g, [BEND.to - 4, BEND.to + 2, BEND.to + 30], [0, 1, 0.18], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fade = 1 - prog(g, 120, 140);
  if (a * fade <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: CX - 520,
        top: CY - 520,
        width: 1040,
        height: 1040,
        borderRadius: '50%',
        background: 'radial-gradient(closest-side, rgba(255,90,99,0.55), rgba(229,57,69,0.18) 50%, transparent)',
        opacity: a * fade,
        mixBlendMode: 'screen',
      }}
    />
  );
}
