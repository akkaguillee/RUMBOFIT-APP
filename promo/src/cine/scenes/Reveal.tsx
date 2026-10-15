import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Rumbi, type RumbiEvent } from '../../Rumbi';
import { easeInOut, Particles, RunnerLogo, Wordmark, Words } from '../../ui';
import { C, clamp, keys, onPhone, Phone3D, prog, Stage, useSpr } from '../kit';
import { length, sceneWord } from '../timing';

const LEN = length('reveal');
const w3 = (i: number) => sceneWord('reveal', 'c3', i); // Necesitas conocer tu progreso, entender tu evolución y tener claro hacia dónde vas.
const w4 = (i: number) => sceneWord('reveal', 'c4', i); // Para eso existe Rumbo.
const BRAND = w4(3);
const POINT = 150;

const RUMBI: RumbiEvent[] = [
  { at: 0, expr: 'surprised' },
  { at: 8, look: [0.9, 0.3] },
  { at: 30, expr: 'happy' },
  { at: 70, look: [0.2, -0.6] },
  { at: 120, look: [0.9, 0.2] },
  { at: POINT - 4, expr: 'encouraging' },
  { at: POINT, tap: true },
  { at: POINT + 30, look: [0.1, -0.9] },
  { at: BRAND - 6, expr: 'proud' },
  { at: BRAND + 30, look: [0, 0] },
];

/**
 * 9–18 s · Presentación. Rumbi travels to the side and the phone rises in 3D
 * with the real dashboard; Rumbi points at it (a dotted arc lands on the
 * screen). «Para eso existe RUMBO»: the logo resolves above the phone.
 */
export function Reveal() {
  const frame = useCurrentFrame();
  const phone = useSpr(8, { damping: 20, stiffness: 55, mass: 1.1 });
  const logo = useSpr(BRAND - 4, { damping: 16, stiffness: 120 });
  const flash = 1 - prog(frame, 0, 18);
  const lines = 1 - prog(frame, w4(0) - 14, w4(0) - 2, easeInOut);

  // Rumbi: from where the hook left it (centre) to the left of the phone, then a hop towards the screen.
  const rx = keys(frame, [
    [0, 540],
    [44, 230],
    [POINT - 12, 230],
    [POINT, 300],
    [POINT + 24, 250],
  ]);
  const ry = keys(frame, [
    [0, 1010],
    [44, 1180],
    [POINT - 12, 1180],
    [POINT, 1130],
    [POINT + 24, 1190],
  ]);
  const rs = keys(frame, [
    [0, 320],
    [44, 190],
  ]);

  const PW = 560;
  const px = 640 + (1 - phone) * 60;
  const py = 1150 + (1 - phone) * 1300;
  const { x: tx, y: ty } = onPhone(PW, px, py, 130, 330); // on the weight gauge
  const arc = prog(frame, POINT, POINT + 26);
  const arcFade = 1 - prog(frame, POINT + 50, POINT + 70);
  const ax = rx + 70;
  const ay = ry - 40;
  const cx = (ax + tx) / 2;
  const cy = Math.min(ay, ty) - 220;
  const dots = Array.from({ length: 20 }, (_, i) => {
    const t = i / 19;
    return { t, x: (1 - t) ** 2 * ax + 2 * (1 - t) * t * cx + t * t * tx, y: (1 - t) ** 2 * ay + 2 * (1 - t) * t * cy + t * t * ty };
  });

  return (
    <AbsoluteFill>
      <Stage glow={0.75 + 0.25 * flash} y={0.55} rays={0.7} />
      <Particles seed={8} count={22} opacity={0.4} />
      {flash > 0 && <AbsoluteFill style={{ background: `radial-gradient(70% 50% at 50% 52%, rgba(255,220,220,${0.55 * flash}), rgba(229,57,69,${0.3 * flash}) 50%, transparent 80%)` }} />}

      {/* kinetic lines, synced to the voice */}
      <div style={{ position: 'absolute', left: 96, right: 96, top: 270, opacity: lines }}>
        {[
          { text: 'Conocer tu progreso.', f: [w3(1), w3(2), w3(3)], accent: [2] },
          { text: 'Entender tu evolución.', f: [w3(4), w3(5), w3(6)], accent: [2] },
          { text: 'Tener claro hacia dónde vas.', f: [w3(8), w3(9), w3(10), w3(11), w3(12)], accent: [3, 4] },
        ].map((l, i, all) => {
          const next = all[i + 1];
          const dim = next ? prog(frame, next.f[0]!, next.f[0]! + 10) : 0;
          return (
            <div key={l.text} style={{ opacity: 1 - 0.55 * dim, marginBottom: 6 }}>
              <Words text={l.text} frames={l.f} size={66} weight={800} accent={l.accent} />
            </div>
          );
        })}
      </div>

      {/* logo: «Para eso existe RUMBO» */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 300,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 26,
          opacity: clamp(logo * 1.5),
          transform: `translateY(${(1 - logo) * 40}px) scale(${0.9 + 0.1 * logo})`,
        }}
      >
        <RunnerLogo size={170} frame={frame} at={BRAND - 4} />
        <Wordmark width={440} frame={frame} at={BRAND} sweepAt={BRAND + 14} id="cine-reveal-wm" />
      </div>

      <Phone3D
        width={PW}
        layers={[{ src: 'inicio-top' }]}
        x={px}
        y={py}
        rx={interpolate(phone, [0, 1], [38, 6]) + Math.sin(frame / 45) * 1.5}
        ry={interpolate(phone, [0, 1], [-28, -14]) + Math.sin(frame / 60) * 2}
        rz={interpolate(phone, [0, 1], [6, 2])}
        scale={0.86 + 0.14 * phone + 0.04 * clamp(logo)}
        glow={0.45 + 0.4 * clamp(logo)}
      />

      {/* Rumbi points: a dotted arc lands on the screen */}
      {arc > 0 && arcFade > 0 && (
        <svg style={{ position: 'absolute', inset: 0 }} width={1080} height={1920}>
          {dots
            .filter((d) => d.t <= arc)
            .map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r={i === 19 ? 9 : 5} fill="#fff" opacity={arcFade * (0.4 + 0.6 * d.t)} />
            ))}
          <circle cx={tx} cy={ty} r={14 + 40 * prog(frame, POINT + 22, POINT + 46)} fill="none" stroke={C.redHi} strokeWidth={4} opacity={arcFade * (1 - prog(frame, POINT + 22, POINT + 46)) * (arc >= 1 ? 1 : 0)} />
        </svg>
      )}

      <div style={{ position: 'absolute', left: rx - rs / 2, top: ry - rs / 2, transform: `translateY(${Math.sin(frame / 22) * 7}px)` }}>
        <Rumbi size={rs} events={RUMBI} seed={202} />
      </div>
    </AbsoluteFill>
  );
}
