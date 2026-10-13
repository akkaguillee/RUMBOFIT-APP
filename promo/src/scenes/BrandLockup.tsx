import { Easing, interpolate, spring, useCurrentFrame } from 'remotion';
import { clamp, easeInOut, prog, RunnerLogo, Wordmark } from '../ui';
import { MEDAL, medalDip } from './IntroRumbi';

/*
 * The logo moment, built from the same pieces as the shared LogoLockup (glass
 * medallion with the runner + compact wordmark) but choreographed for the
 * impact: light rings ripple out of the medallion, a red bloom flashes, the
 * glass gives under Rumbi's landing and a shimmer crosses medallion and letters.
 * Frames are GLOBAL (Brand renders it inside <Sequence from={-150}>).
 */

export const IMPACT = 185;
const WORDMARK_W = 440;
const GAP = 56;

const out = Easing.bezier(0.16, 1, 0.3, 1);

/** Concentric light rings rippling out of the medallion on the impact. */
export function Ripples() {
  const g = useCurrentFrame();
  const rings = [0, 1, 2, 3];
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0, overflow: 'visible', mixBlendMode: 'screen' }}>
      <defs>
        <filter id="ripple-glow" filterUnits="userSpaceOnUse" x="-200" y="-200" width="1480" height="2320">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
      {rings.map((k) => {
        const start = IMPACT + k * 4;
        const p = prog(g, start, start + 36 + k * 4, out);
        if (p <= 0 || p >= 1) return null;
        const r = MEDAL.size * 0.56 + p * (430 + k * 70);
        const a = Math.pow(1 - p, 1.6) * (k === 0 ? 0.95 : 0.7 - k * 0.12);
        const common = { cx: MEDAL.cx, cy: MEDAL.cy, r, fill: 'none' };
        return (
          <g key={k}>
            <circle {...common} stroke="#e53945" strokeWidth={14 * (1 - p) + 2} opacity={a * 0.35} filter="url(#ripple-glow)" />
            <circle {...common} stroke={k === 0 ? '#ffe0e0' : '#ff6a72'} strokeWidth={(k === 0 ? 4 : 2.6) * (1 - p) + 0.8} opacity={a} />
          </g>
        );
      })}
    </svg>
  );
}

/**
 * The line of light returns: drawn out from the centre where the medallion will
 * be, it collapses back into a point on the beat before the impact (anticipation).
 */
export function ChargeLine() {
  const g = useCurrentFrame();
  // Drawn out slowly while Rumbi hovers (the opening line, rhymed), so the breath after the
  // match cut is never an empty frame.
  const grow = prog(g, 150, 177, out);
  const collapse = prog(g, 178, IMPACT, Easing.in(Easing.cubic));
  const half = 330 * grow * (1 - collapse);
  const heat = 0.55 + 0.45 * collapse;
  const point = interpolate(g, [176, IMPACT - 1, IMPACT + 3], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (g < 150 || g > IMPACT + 3) return null;
  const line = (h: number, blur: number, bg: string, a: number) => (
    <div style={{ position: 'absolute', left: MEDAL.cx - half, top: MEDAL.cy - h / 2, width: half * 2, height: h, borderRadius: h, background: bg, filter: blur ? `blur(${blur}px)` : undefined, opacity: a }} />
  );
  return (
    <div style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen' }}>
      {half > 1 && line(22, 12, 'linear-gradient(90deg, transparent, rgba(229,57,69,0.9) 30%, rgba(229,57,69,0.9) 70%, transparent)', 0.5 * heat)}
      {half > 1 && line(6, 2.5, 'linear-gradient(90deg, transparent, #ff4f5a 25%, #ff4f5a 75%, transparent)', heat)}
      {half > 1 && line(2.4, 0, 'linear-gradient(90deg, transparent, #ffe6e6 20%, #ffe6e6 80%, transparent)', 1)}
      <div
        style={{
          position: 'absolute',
          left: MEDAL.cx - 70,
          top: MEDAL.cy - 70,
          width: 140,
          height: 140,
          borderRadius: '50%',
          background: 'radial-gradient(closest-side, #fff, rgba(255,160,160,0.85) 28%, rgba(229,57,69,0.3) 60%, transparent)',
          opacity: point,
          transform: `scale(${0.4 + 0.8 * point})`,
        }}
      />
    </div>
  );
}

/** Red bloom behind the medallion: a flash on the impact that settles into a halo. */
export function Bloom() {
  const g = useCurrentFrame();
  const a = interpolate(g, [IMPACT - 3, IMPACT + 2, IMPACT + 28], [0, 0.9, 0.24], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sc = 0.7 + 0.3 * prog(g, IMPACT - 3, IMPACT + 20);
  if (a <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: MEDAL.cx - 560,
        top: MEDAL.cy - 560,
        width: 1120,
        height: 1120,
        borderRadius: '50%',
        background: 'radial-gradient(closest-side, rgba(255,95,104,0.6), rgba(229,57,69,0.22) 42%, transparent 72%)',
        opacity: a,
        transform: `scale(${sc})`,
        mixBlendMode: 'screen',
      }}
    />
  );
}

/** Glass medallion + runner, then the compact wordmark below it. */
export function BrandLockup() {
  const g = useCurrentFrame();
  const size = MEDAL.size;
  const pop = spring({ frame: g - IMPACT, fps: 30, config: { damping: 14, stiffness: 170, mass: 0.8 } });
  const flash = interpolate(g, [IMPACT, IMPACT + 1, IMPACT + 12], [0, 0.55, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const shine = prog(g, 203, 229, easeInOut);
  const dip = medalDip(g);
  const wmH = (WORDMARK_W * 353) / 2372;
  if (g < IMPACT - 1) return null;
  return (
    <>
      {/* medallion */}
      <div
        style={{
          position: 'absolute',
          left: MEDAL.cx - size / 2,
          top: MEDAL.cy - size / 2 + dip,
          width: size,
          height: size,
          borderRadius: size * 0.3,
          transform: `scale(${0.55 + 0.45 * pop})`,
          opacity: clamp(pop * 1.6),
          filter: `blur(${(1 - clamp(pop)) * 10}px)`,
          background: 'linear-gradient(160deg, rgba(255,255,255,0.17), rgba(255,255,255,0.03) 60%), rgba(16,8,12,0.5)',
          boxShadow:
            'inset 0 2px 0 rgba(255,255,255,0.45), inset 0 0 0 1.5px rgba(255,255,255,0.14), 0 40px 90px -30px rgba(0,0,0,0.9), 0 0 120px -20px rgba(229,57,69,0.6)',
          backdropFilter: 'blur(24px) saturate(170%)',
          WebkitBackdropFilter: 'blur(24px) saturate(170%)',
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
        }}
      >
        <div style={{ marginLeft: -size * 0.02, marginTop: size * 0.02, lineHeight: 0 }}>
          <RunnerLogo size={size * 0.6} frame={g} at={IMPACT + 1} />
        </div>
        {flash > 0 && <div style={{ position: 'absolute', inset: 0, background: '#ffd2d2', opacity: flash }} />}
        {shine > 0 && shine < 1 && (
          <div
            style={{
              position: 'absolute',
              top: -size,
              bottom: -size,
              left: -size + shine * size * 3,
              width: size * 0.5,
              transform: 'rotate(22deg)',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.32), transparent)',
            }}
          />
        )}
      </div>
      {/* wordmark */}
      <div style={{ position: 'absolute', left: MEDAL.cx - WORDMARK_W / 2, top: MEDAL.cy + size / 2 + GAP, width: WORDMARK_W, height: wmH }}>
        <Wordmark width={WORDMARK_W} frame={g} at={IMPACT + 5} sweepAt={207} id="brand-wm" />
      </div>
    </>
  );
}
