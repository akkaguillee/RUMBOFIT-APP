import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { sceneLength, wordAt } from '../design';
import { Rumbi, type RumbiEvent } from '../Rumbi';
import { Backdrop, clamp, LogoLockup, prog, useSpring, Words } from '../ui';

const LEN = sceneLength('end');
const W = (i: number) => wordAt('v8', i, 'end'); // (Rumbo.) Ahora es el momento de encontrar el tuyo.

const RUMBI: RumbiEvent[] = [
  { at: 2, expr: 'happy' },
  { at: 20, look: [0, 0.8] },
  { at: 44, look: [0, 0] },
  { at: 98, tap: true },
  { at: 112, expr: 'proud' },
];

/**
 * End card: a compact, centred brand lockup — Rumbi, the glass medallion with
 * the runner and a short wordmark, then the tagline. Stack centred in SAFE,
 * spacing from the 8-pt scale. The last frames hold still (loop-friendly).
 */
export function End() {
  const frame = useCurrentFrame();
  const rumbi = useSpring(2, { damping: 13, stiffness: 110 });
  const ring = prog(frame, 4, 34);
  const glowIn = 1 - prog(frame, 0, 16); // light carried over from the previous scene
  const breathe = 0.85 + 0.08 * Math.sin(frame / 22);
  return (
    <AbsoluteFill>
      <Backdrop glow={breathe} glowY={0.43} />
      {glowIn > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(60% 45% at 50% 38%, rgba(255,235,235,0.9), rgba(255,90,99,0.45) 45%, rgba(229,57,69,0) 80%)',
            opacity: glowIn,
          }}
        />
      )}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 380, display: 'flex', justifyContent: 'center' }}>
        <div style={{ opacity: clamp(rumbi * 1.5), transform: `translateY(${(1 - rumbi) * -80}px) scale(${0.6 + 0.4 * rumbi})` }}>
          <Rumbi size={180} events={RUMBI} seed={105} />
        </div>
      </div>

      {/* one restrained ring when the lockup lands */}
      {ring > 0 && ring < 1 && (
        <div
          style={{
            position: 'absolute',
            left: 540 - 110 - ring * 260,
            top: 720 - 110 - ring * 260,
            width: 220 + ring * 520,
            height: 220 + ring * 520,
            borderRadius: '50%',
            boxShadow: `inset 0 0 0 ${3 * (1 - ring)}px rgba(255,120,128,${0.7 * (1 - ring)})`,
          }}
        />
      )}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 610, display: 'flex', justifyContent: 'center' }}>
        <LogoLockup size={210} at={0} sweepAt={98} id="end-lockup" />
      </div>

      <div style={{ position: 'absolute', left: 96, right: 96, top: 1090 }}>
        <Words text="Ahora es el momento" frames={[W(1), W(2), W(3), W(4)]} size={68} weight={700} align="center" lineHeight={1.08} />
        <Words text="de encontrar el tuyo." frames={[W(5), W(6), W(7), W(8)]} size={68} weight={700} align="center" accent={[2, 3]} lineHeight={1.08} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 540 - 28,
          top: 1278,
          width: 56,
          height: 3,
          borderRadius: 2,
          background: '#ff4552',
          opacity: interpolate(frame, [W(8) + 6, W(8) + 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}
      />
    </AbsoluteFill>
  );
}
