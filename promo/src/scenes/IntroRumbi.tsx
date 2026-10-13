import { Easing, interpolate, spring, useCurrentFrame } from 'remotion';
import { Rumbi, type RumbiEvent } from '../Rumbi';
import { clamp, prog } from '../ui';

/*
 * The Rumbi of the first act (Intro + Brand) is ONE continuous character: both
 * scenes render the same deterministic rig with the same seed, delay and events
 * (all in GLOBAL frames), so its face, blinks and breathing carry across the
 * match cut at frame 150 without a single jump.
 *
 * Every component here reads useCurrentFrame() as a GLOBAL frame: Intro starts
 * at 0, and Brand wraps its content in <Sequence from={-150}>.
 */

/** Global frame at which the rig starts (eyes switch on ~7–14 frames later). */
export const RUMBI_DELAY = 42;
const SEED = 23;

/** Intro: Rumbi in the lower half, condensed from the ring of light. */
export const RUMBI_A = { cx: 540, cy: 1190, size: 420 } as const;
/** Brand: medallion of the lockup and the spot on top of it where Rumbi lands. */
export const MEDAL = { cx: 540, cy: 880, size: 220 } as const;
export const RUMBI_B = { cx: 540, cy: MEDAL.cy - MEDAL.size / 2 - 60, size: 150 } as const;

/** Rumbi's take-off at the end of the intro, and the jump onto the medallion. */
export const LAUNCH = 134;
export const JUMP = { up: 182, land: 194, height: 72 } as const;

/** Acting, in global frames (converted to the rig's own clock below). */
const ACTING: RumbiEvent[] = [
  // Intro: wakes up ~49–56, reads the headline, worries at "difícil", encourages, cheers.
  { at: 59, look: [-0.9, -0.95] },
  { at: 70, expr: 'concerned' },
  { at: 73, look: [-0.85, -0.85] },
  { at: 86, look: [-0.95, -0.7] },
  { at: 92, look: [-0.15, -0.75] },
  { at: 100, look: [0.6, -0.7] },
  { at: 108, look: [0, 0.05] },
  { at: 111, expr: 'encouraging' },
  { at: 125, expr: 'happy' },
  { at: 130, press: true },
  { at: 135, tap: true }, // 1st tap → squint (happy), the launch
  { at: 141, look: [0, -0.7] },
  // Brand: hovers and reads "Por eso existe", watches the line charge below, leaps as the
  // logo bursts in under it, lands on the medallion and winks at the camera.
  { at: 157, look: [0, -0.95] },
  { at: 164, look: [-0.4, -0.85] },
  { at: 170, look: [0.3, -0.85] },
  { at: 175, look: [0, 0.9] },
  { at: 174, press: true },
  { at: 178, tap: true }, // 2nd tap → hop (surprised, then happy); the rig lifts off at ~182
  { at: 188, expr: 'happy' },
  { at: 194, press: true }, // landing squash
  { at: 198, tap: true }, // 3rd tap → wink to camera
  { at: 196, look: [0, 0.12] },
  { at: 222, look: [0.25, -0.15] },
];

export const RUMBI_EVENTS: RumbiEvent[] = ACTING.map((e) => ({ ...e, at: e.at - RUMBI_DELAY })).sort((a, b) => a.at - b.at);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Where Rumbi is and how big, at any global frame of the first act. */
export function rumbiPlacement(g: number) {
  // Launch: a springy rise and shrink from the intro spot to the hover spot above the logo.
  const s = spring({ frame: g - LAUNCH, fps: 30, config: { damping: 15, stiffness: 105, mass: 0.85 } });
  // Body acting in the intro: a small flinch back on "difícil", a lift forward on "encouraging".
  const act = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.45, 0, 0.25, 1) } as const;
  const actY = interpolate(g, [69, 80, 108, 119, 126, 134], [0, 10, 10, -12, -12, 0], act);
  const actS = interpolate(g, [69, 80, 108, 119, 126, 134], [1, 0.965, 0.965, 1.03, 1.03, 1], act);
  let cy = lerp(RUMBI_A.cy + actY, RUMBI_B.cy, s);
  const size = lerp(RUMBI_A.size * actS, RUMBI_B.size, s);
  // Speed (px / frame) for the light trail.
  const s1 = spring({ frame: g - 1 - LAUNCH, fps: 30, config: { damping: 15, stiffness: 105, mass: 0.85 } });
  const speed = (RUMBI_A.cy - RUMBI_B.cy) * (s - s1);

  // Hover: a slow float that dies down before the jump.
  const hover = prog(g, 152, 166) * (1 - prog(g, 172, JUMP.up));
  cy += hover * 6 * Math.sin(((g - 152) / 30) * Math.PI);

  // Jump onto the medallion: a true parabola (ease-out up, ease-in down).
  const u = clamp((g - JUMP.up) / (JUMP.land - JUMP.up));
  if (u > 0 && u < 1) cy -= JUMP.height * 4 * u * (1 - u);

  // The medallion gives a little under Rumbi's landing.
  cy += medalDip(g);
  return { cx: RUMBI_A.cx, cy, size, speed };
}

/** Vertical give of the medallion when Rumbi lands on it (px). */
export function medalDip(g: number) {
  return interpolate(g, [JUMP.land, JUMP.land + 3, JUMP.land + 13], [0, 7, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}

/** Background light for the whole act: dark open, bloom when the ring closes, lift with Rumbi, flash on the logo. */
export function backdropAt(g: number) {
  const glow = interpolate(g, [0, 24, 44, 50, 80, 150, 182, 188, 215], [0.06, 0.22, 0.3, 0.85, 0.6, 0.6, 0.55, 0.95, 0.62], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const glowY = interpolate(g, [0, LAUNCH, LAUNCH + 22], [0.66, 0.66, 0.47], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return { glow, glowY };
}

/** Camera tilt: the far layers drift up as Rumbi rises (parallax). */
export function cameraLift(g: number) {
  return -170 * spring({ frame: g - LAUNCH - 2, fps: 30, config: { damping: 20, stiffness: 70, mass: 1 } });
}

/** The act's Rumbi, positioned by global frame, with a soft comet of light while it flies. */
export function ActRumbi({ opacity = 1 }: { opacity?: number }) {
  const g = useCurrentFrame();
  const { cx, cy, size, speed } = rumbiPlacement(g);
  const trail = clamp(speed / 40);
  return (
    <>
      {trail > 0.01 && (
        <div
          style={{
            position: 'absolute',
            left: cx - size * 0.32,
            top: cy,
            width: size * 0.64,
            height: size * 0.3 + speed * 4,
            borderRadius: size,
            background: 'linear-gradient(180deg, rgba(255,120,128,0.5), rgba(229,57,69,0.12) 50%, transparent)',
            filter: `blur(${size * 0.1}px)`,
            opacity: trail * opacity * 0.7,
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          left: cx - size / 2,
          top: cy - size / 2,
          width: size,
          height: size,
          opacity,
          lineHeight: 0,
        }}
      >
        <Rumbi size={size} events={RUMBI_EVENTS} delay={RUMBI_DELAY} seed={SEED} />
      </div>
    </>
  );
}
