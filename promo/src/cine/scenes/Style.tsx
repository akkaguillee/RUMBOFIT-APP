import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Rumbi, type RumbiEvent } from '../../Rumbi';
import { easeInOut, Particles } from '../../ui';
import { clamp, KLine, keys, onPhone, Phone3D, phonePoint, prog, Stage, useSpr, type Layer } from '../kit';
import { length, sceneWord } from '../timing';

const LEN = length('style');
const w8 = (i: number) => sceneWord('style', 'c8', i);
// Personaliza(0) la experiencia a tu manera.(5) Elige(6) el tema(8) que prefieras(10) y haz que Rumbo(14) encaje(15) contigo.(16)

const PW = 540;
const CX = 540;
const CY = 1150;
/** Top-bar buttons of the real app, in pt of the capture (390 wide). */
const MOON = { x: 300, y: 32 };
const PALETTE = { x: 248, y: 32 };

/** Every change is the app's own circular reveal from the button that was tapped. */
const CHANGES: { at: number; src: string; from: { x: number; y: number }; light?: boolean }[] = [
  { at: 72, src: 'inicio-claro', from: MOON, light: true },
  { at: 116, src: 'inicio-claro-volt', from: PALETTE, light: true },
  { at: 132, src: 'inicio-claro-cian', from: PALETTE, light: true },
  { at: 148, src: 'inicio-claro-violeta', from: PALETTE, light: true },
  { at: 164, src: 'inicio-claro-naranja', from: PALETTE, light: true },
  { at: 180, src: 'inicio-claro-fucsia', from: PALETTE, light: true },
  { at: 196, src: 'inicio-claro', from: PALETTE, light: true },
  { at: 214, src: 'inicio-rojo', from: MOON },
];
const TAPS = [70, 112, 212];

const RUMBI: RumbiEvent[] = [
  { at: 0, expr: 'happy' },
  { at: 10, look: [-0.6, 0.3] },
  { at: 56, look: [-0.8, 0.6] },
  { at: TAPS[0]!, tap: true },
  { at: TAPS[0]! + 6, expr: 'surprised' },
  { at: TAPS[0]! + 20, expr: 'happy' },
  { at: TAPS[1]!, tap: true },
  { at: TAPS[1]! + 8, look: [-0.9, 0.8] },
  { at: 150, expr: 'proud' },
  { at: TAPS[2]!, tap: true },
  { at: TAPS[2]! + 12, look: [0, 0] },
];

/**
 * 42–50 s · A tu estilo. Rumbi taps the theme button: dark → light with the
 * app's circular reveal. Then the colour button: the six real accents, one
 * after another, back to RUMBO red and the dark theme.
 */
export function Style() {
  const frame = useCurrentFrame();
  const phone = useSpr(0, { damping: 20, stiffness: 70 });
  const out = prog(frame, LEN - 12, LEN, easeInOut);
  const moon = onPhone(PW, CX, CY, MOON.x, MOON.y);
  const palette = onPhone(PW, CX, CY, PALETTE.x, PALETTE.y);

  const layers: Layer[] = [{ src: 'inicio-rojo' }];
  for (const c of CHANGES) {
    if (frame < c.at) break;
    const p = phonePoint(PW, c.from.x, c.from.y);
    const r = 1400 * prog(frame, c.at, c.at + 16, easeInOut);
    layers.push({ src: c.src, light: c.light, clip: `circle(${r}px at ${p.x}px ${p.y}px)` });
  }

  // Rumbi hops from button to button.
  const rx = keys(frame, [
    [0, 900],
    [52, 900],
    [66, moon.x + 70],
    [84, moon.x + 120],
    [100, palette.x + 40],
    [124, palette.x + 60],
    [150, 905],
    [198, 905],
    [208, moon.x + 70],
    [226, 900],
  ]);
  const ry = keys(frame, [
    [0, 470],
    [52, 470],
    [66, moon.y - 80],
    [84, moon.y - 110],
    [100, palette.y - 80],
    [124, palette.y - 110],
    [150, 470],
    [198, 470],
    [208, moon.y - 80],
    [226, 470],
  ]);
  const ripples = TAPS.map((t, i) => {
    const p = prog(frame, t, t + 18);
    const at = i === 1 ? palette : moon;
    return p > 0 && p < 1 ? (
      <div
        key={t}
        style={{
          position: 'absolute',
          left: at.x - 20 - 50 * p,
          top: at.y - 20 - 50 * p,
          width: 40 + 100 * p,
          height: 40 + 100 * p,
          borderRadius: '50%',
          boxShadow: `inset 0 0 0 ${4 * (1 - p)}px rgba(255,255,255,${0.9 * (1 - p)})`,
        }}
      />
    ) : null;
  });

  return (
    <AbsoluteFill>
      <Stage glow={0.55 + 0.15 * prog(frame, 72, 90)} y={0.6} rays={0.4} />
      <Particles seed={31} count={18} opacity={0.3} />
      <AbsoluteFill style={{ opacity: 1 - out }}>
        <div style={{ position: 'absolute', left: 96, right: 96, top: 262 }}>
          <KLine text="TU APP." frames={[w8(0), w8(0) + 5]} size={78} align="left" />
          <KLine text="TU ESTILO." frames={[w8(6), w8(6) + 5]} size={78} align="left" />
          <KLine text="TU RUMBO." frames={[w8(14), w8(14) + 5]} size={78} accent={[1]} align="left" />
        </div>
        <Phone3D
          width={PW}
          layers={layers}
          x={CX}
          y={CY + (1 - phone) * 900}
          rx={(1 - phone) * 30 + 3}
          ry={Math.sin(frame / 60) * 3}
          scale={0.92 + 0.08 * phone}
          glow={0.5}
        />
        {ripples}
        <div style={{ position: 'absolute', left: rx - 65, top: ry - 65, opacity: clamp(prog(frame, 8, 26)), transform: `translateY(${Math.sin(frame / 18) * 5}px)` }}>
          <Rumbi size={130} events={RUMBI} seed={205} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
