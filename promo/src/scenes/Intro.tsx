import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { SAFE } from '../design';
import { Backdrop, Particles, prog } from '../ui';
import { LightLine, SphereBloom } from './IntroLight';
import { ActRumbi, backdropAt, cameraLift } from './IntroRumbi';
import { MaskLine } from './IntroType';

/*
 * INTRO (global 0–150, so local frame = global frame).
 * A line of red light is drawn across the black, bends into a ring and condenses
 * into Rumbi, who wakes up and reacts to the headline. At the end the text lifts
 * out through its masks while Rumbi leaps up and shrinks to the spot above the
 * logo where the Brand scene picks it up (match cut at 150).
 */

const SIZE = 112;
const LH = 1.0;
const TOP = 286; // cap height of the first line lands on y ≈ 300
const PAIR_GAP = 40;

/** Voice word frames (v1), anticipated 3 frames so the rise lands on the syllable. */
const AT = (f: number) => f - 3;

const LINES = [
  { text: 'Empezar', frames: [AT(18)], top: TOP, out: 118 },
  { text: 'es fácil.', frames: [AT(35), AT(40)], top: TOP + SIZE * LH, out: 120 },
  { text: 'Lo difícil', frames: [AT(65), AT(69)], top: TOP + 2 * SIZE * LH + PAIR_GAP, out: 122 },
  { text: 'es mantenerlo.', frames: [AT(84), AT(88)], top: TOP + 3 * SIZE * LH + PAIR_GAP, out: 124, accent: [1] },
];

export function Intro() {
  const g = useCurrentFrame();
  const { glow, glowY } = backdropAt(g);
  const cam = cameraLift(g);

  // The first pair steps back when the second arrives (hierarchy, not a cut).
  const dim = interpolate(g, [62, 76], [1, 0.35], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // Foreground type drifts very slowly (parallax against the static light).
  const drift = -0.12 * g;

  return (
    <AbsoluteFill>
      <Backdrop glow={glow} glowY={glowY} />
      <AbsoluteFill style={{ transform: `translateY(${cam * 0.45}px)` }}>
        <Particles seed={7} count={22} opacity={0.32 * prog(g, 48, 80)} area={{ x: 0, y: 150, w: 1080, h: 1700 }} />
      </AbsoluteFill>
      <SphereBloom />

      {/* headline */}
      <AbsoluteFill style={{ transform: `translateY(${drift}px)` }}>
        {LINES.map((l, i) => (
          <div key={l.text} style={{ position: 'absolute', left: SAFE.left, right: SAFE.left, top: l.top, opacity: i < 2 ? dim : 1 }}>
            <MaskLine text={l.text} frames={l.frames} size={SIZE} lineHeight={LH} accent={l.accent} out={l.out} />
          </div>
        ))}
      </AbsoluteFill>

      <ActRumbi opacity={prog(g, 46, 55)} />
      <LightLine />
    </AbsoluteFill>
  );
}
