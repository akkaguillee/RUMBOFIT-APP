import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { sceneStart } from '../design';
import { Backdrop, easeInOut, Particles, prog } from '../ui';
import { Bloom, BrandLockup, ChargeLine, Ripples } from './BrandLockup';
import { ActRumbi, backdropAt, cameraLift } from './IntroRumbi';
import { MaskLine } from './IntroType';

/*
 * BRAND (global 150–240). Everything inside runs on GLOBAL frames (nested
 * <Sequence from={-150}>) so the backdrop, particles and Rumbi continue the
 * intro without a seam. "Por eso existe" is written above Rumbi, who hovers
 * where it landed; on "rumbo." (185) Rumbi jumps, the logo slams in under it
 * with light rings and a bloom, and Rumbi lands on the medallion and winks.
 */

const START = sceneStart('brand'); // 150
const END = 240;
const LINE_Y = 490; // centre of "Por eso existe"
const LINE_SIZE = 64;
const AT = (f: number) => f - 3;

function BrandBody() {
  const g = useCurrentFrame();
  const { glow, glowY } = backdropAt(g);
  const cam = cameraLift(g);

  // Exit: lift away into the master light sweep (233–247).
  const exit = prog(g, END - 8, END, easeInOut);
  const exitStyle = { opacity: 1 - exit, transform: `translateY(${-60 * exit}px)`, filter: exit > 0 ? `blur(${exit * 10}px)` : undefined };
  // Gentle settle of the whole lockup group after the impact (mid-layer parallax).
  const settle = -10 * prog(g, 185, 240);

  return (
    <AbsoluteFill>
      <Backdrop glow={glow} glowY={glowY} />
      <AbsoluteFill style={{ transform: `translateY(${cam * 0.45}px)` }}>
        <Particles seed={7} count={22} opacity={0.32} area={{ x: 0, y: 150, w: 1080, h: 1700 }} />
      </AbsoluteFill>
      <AbsoluteFill style={exitStyle}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: LINE_Y - LINE_SIZE / 2 }}>
          <MaskLine
            text="Por eso existe"
            tracking="-0.025em"
            frames={[AT(158), AT(165), AT(172)]}
            size={LINE_SIZE}
            weight={700}
            color="rgba(255,255,255,0.8)"
            align="center"
            lineHeight={1}
          />
        </div>
        <AbsoluteFill style={{ transform: `translateY(${settle}px)` }}>
          <Bloom />
          <ChargeLine />
          <Ripples />
          <BrandLockup />
          <ActRumbi />
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export function Brand() {
  return (
    <AbsoluteFill>
      <Sequence from={-START} layout="none">
        <BrandBody />
      </Sequence>
    </AbsoluteFill>
  );
}
