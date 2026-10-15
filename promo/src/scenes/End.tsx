import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { sceneLength, wordAt } from '../design';
import { Rumbi, type RumbiEvent } from '../Rumbi';
import { Backdrop, clamp, LogoLockup, Phone, prog, useSpring, Words } from '../ui';

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
 * the runner and a short wordmark, the tagline — and the real app on a phone
 * rising from the bottom edge. Spacing from the 8-pt scale. The last frames
 * hold still (loop-friendly).
 */
export function End() {
  const frame = useCurrentFrame();
  const rumbi = useSpring(2, { damping: 13, stiffness: 110 });
  const ring = prog(frame, 4, 34);
  const glowIn = 1 - prog(frame, 0, 16); // light carried over from the previous scene
  const breathe = 0.85 + 0.08 * Math.sin(frame / 22);
  // The phone rises once the lockup has landed and settles well before the last frame.
  const phone = useSpring(26, { damping: 19, stiffness: 80 });
  const drift = -14 * prog(frame, 40, LEN);
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
      <div style={{ position: 'absolute', left: 0, right: 0, top: 262, display: 'flex', justifyContent: 'center' }}>
        <div style={{ opacity: clamp(rumbi * 1.5), transform: `translateY(${(1 - rumbi) * -80}px) scale(${0.6 + 0.4 * rumbi})` }}>
          <Rumbi size={150} events={RUMBI} seed={105} />
        </div>
      </div>

      {/* one restrained ring when the lockup lands */}
      {ring > 0 && ring < 1 && (
        <div
          style={{
            position: 'absolute',
            left: 540 - 110 - ring * 260,
            top: 535 - 110 - ring * 260,
            width: 220 + ring * 520,
            height: 220 + ring * 520,
            borderRadius: '50%',
            boxShadow: `inset 0 0 0 ${3 * (1 - ring)}px rgba(255,120,128,${0.7 * (1 - ring)})`,
          }}
        />
      )}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 450, display: 'flex', justifyContent: 'center' }}>
        <LogoLockup size={170} at={0} sweepAt={98} id="end-lockup" />
      </div>

      <div style={{ position: 'absolute', left: 96, right: 96, top: 790 }}>
        <Words text="Ahora es el momento" frames={[W(1), W(2), W(3), W(4)]} size={62} weight={700} align="center" lineHeight={1.08} />
        <Words text="de encontrar el tuyo." frames={[W(5), W(6), W(7), W(8)]} size={62} weight={700} align="center" accent={[2, 3]} lineHeight={1.08} />
      </div>

      {/* The real app (dark theme screenshot) on a phone, cropped by the bottom edge. */}
      <div
        style={{
          position: 'absolute',
          left: 540 - 240,
          top: 1040,
          width: 480,
          height: 893,
          perspective: 1600,
          opacity: clamp(phone * 1.6),
          transform: `translateY(${(1 - phone) * 720 + drift}px)`,
        }}
      >
        <Phone
          width={480}
          ratio={1.86}
          fitWidth
          screens={[{ src: 'dash-top', opacity: 1 }]}
          style={{ left: 0, top: 0, transform: `rotateX(${(1 - phone) * 22}deg)`, transformOrigin: '50% 0%' }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 540 - 28,
          top: 950,
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
