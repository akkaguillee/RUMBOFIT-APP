import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Rumbi, type RumbiEvent } from '../../Rumbi';
import { easeInOut, LogoLockup, Particles, Words } from '../../ui';
import { C, clamp, Ico, IC, KLine, keys, Phone3D, prog, RED_GRAD, Stage, useSpr } from '../kit';
import { length, sceneWord } from '../timing';

const LEN = length('finale');
const w10 = (i: number) => sceneWord('finale', 'c10', i);
// No(0) se trata de hacerlo todo perfecto.(6) Se(7) trata de seguir(10) avanzando,(11) aprender(12) de cada(14) etapa(15) y no(17) perder de vista tu objetivo.(22)
const w11 = (i: number) => sceneWord('finale', 'c11', i); // Empieza(0) hoy(1) a construir(3) tu mejor(5) versión.(6)
const w12 = (i: number) => sceneWord('finale', 'c12', i); // Rumbo.(0) Tu(1) progreso,(2) tu(3) camino.(4)
const w13 = (i: number) => sceneWord('finale', 'c13', i); // Entra ahora en rumbofit(3) punto netlify(5) punto app,(7) y empieza(9) a escribir el tuyo.(13)

const END = w12(0); // end card
const PUSH = w11(0) - 12; // phone and camera push
const STING = w13(13) + 14;

/** The progress route: not straight, with a dip on «perfecto», then onwards and up. */
const ROUTE = 'M -40 1760 C 120 1700, 180 1560, 300 1580 S 420 1660, 500 1540 S 620 1300, 720 1260 S 860 1120, 900 980 S 980 760, 1120 700';
const CHECKS = [
  { at: w10(6), x: 300, y: 1580 },
  { at: w10(11), x: 500, y: 1540 },
  { at: w10(15), x: 720, y: 1260 },
  { at: w10(22), x: 900, y: 980 },
];

const RUMBI: RumbiEvent[] = [
  { at: 0, expr: 'neutral' },
  { at: 8, look: [-0.6, 0.6] },
  { at: w10(6), expr: 'concerned' },
  { at: w10(10), expr: 'encouraging' },
  { at: w10(11), look: [0.3, 0.2] },
  { at: w10(15), look: [0.6, -0.2] },
  { at: w10(22), expr: 'proud' },
  { at: w10(22), look: [0.7, -0.6] },
  { at: PUSH + 10, look: [0.3, 0.6] },
  { at: END, expr: 'happy' },
  { at: END + 4, tap: true },
  { at: END + 20, look: [0, 0] },
  { at: w13(9), look: [0, 0.8] },
  { at: STING - 2, tap: true },
];

/**
 * 60–84 s · Cierre. Rumbi at the centre while a progress route draws itself
 * (with a dip: not perfect, but forward). The camera pushes in on the phone;
 * then RUMBO, «TU PROGRESO, TU CAMINO», the address and «EMPIEZA AHORA»,
 * held long enough to read.
 */
export function Finale() {
  const frame = useCurrentFrame();
  const route = keys(frame, [
    [w10(0), 0],
    [w10(6), 0.2],
    [w10(11), 0.38],
    [w10(15), 0.6],
    [w10(22), 0.84],
    [w10(22) + 20, 0.9],
  ]);
  const routeOut = prog(frame, PUSH, PUSH + 24, easeInOut);
  const phone = useSpr(PUSH, { damping: 22, stiffness: 55, mass: 1.1 });
  const phoneOut = prog(frame, END - 6, END + 16, easeInOut);
  const push = keys(frame, [
    [PUSH, 1],
    [END - 4, 1.14],
  ]);
  const flash = prog(frame, END - 2, END + 2) * (1 - prog(frame, END + 2, END + 22));
  const endCard = prog(frame, END, END + 12);
  const url = prog(frame, w13(3) - 4, w13(7) + 4);
  const button = useSpr(w13(9) - 6, { damping: 13, stiffness: 120 });
  const sting = prog(frame, STING, STING + 26);
  const shine = ((frame - w13(9)) % 46) / 46;

  // Rumbi: centre during the route, aside during the push, back to the centre for the end card.
  const rx = keys(frame, [
    [0, 540],
    [PUSH, 540],
    [PUSH + 24, 820],
    [END, 820],
    [END + 14, 540],
  ]);
  const ry = keys(frame, [
    [0, 1120],
    [PUSH, 1120],
    [PUSH + 24, 640],
    [END, 640],
    [END + 14, 1030],
  ]);
  const rs = keys(frame, [
    [0, 250],
    [PUSH, 250],
    [PUSH + 24, 150],
    [END, 150],
    [END + 14, 190],
  ]);

  return (
    <AbsoluteFill>
      <Stage glow={0.55 + 0.3 * endCard} y={0.5} rays={0.5 + 0.5 * endCard} />
      <Particles seed={51} count={26} opacity={0.35} />
      {flash > 0 && <AbsoluteFill style={{ background: `radial-gradient(70% 45% at 50% 40%, rgba(255,235,235,${0.75 * flash}), rgba(229,57,69,${0.4 * flash}) 50%, transparent 82%)` }} />}

      {/* Part A · the route */}
      <AbsoluteFill style={{ opacity: 1 - routeOut }}>
        <svg style={{ position: 'absolute', inset: 0 }} width={1080} height={1920}>
          <defs>
            <linearGradient id="route-grad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#c81d35" />
              <stop offset="0.6" stopColor="#ff5a63" />
              <stop offset="1" stopColor={C.progress} />
            </linearGradient>
            <filter id="route-glow">
              <feGaussianBlur stdDeviation="10" />
            </filter>
          </defs>
          <path d={ROUTE} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} strokeDasharray="6 16" />
          <path d={ROUTE} fill="none" stroke="url(#route-grad)" strokeWidth={18} filter="url(#route-glow)" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - route} opacity={0.7} />
          <path d={ROUTE} fill="none" stroke="url(#route-grad)" strokeWidth={8} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - route} />
          {CHECKS.map((c, i) => {
            const on = prog(frame, c.at, c.at + 10);
            const last = i === CHECKS.length - 1;
            return (
              <g key={i} opacity={on}>
                <circle cx={c.x} cy={c.y} r={last ? 18 : 12} fill={last ? C.progress : '#fff'} />
                <circle cx={c.x} cy={c.y} r={(last ? 30 : 22) + 30 * prog(frame, c.at, c.at + 22)} fill="none" stroke={last ? C.progress : '#ff5a63'} strokeWidth={3} opacity={1 - prog(frame, c.at, c.at + 22)} />
              </g>
            );
          })}
        </svg>
        <div style={{ position: 'absolute', left: 96, right: 96, top: 270 }}>
          {[
            { lines: [{ t: 'No se trata de hacerlo', f: [w10(0), w10(1), w10(2), w10(3), w10(4)] }, { t: 'todo perfecto.', f: [w10(5), w10(6)], a: [1] }], from: w10(0), to: w10(7) },
            { lines: [{ t: 'Se trata de seguir avanzando,', f: [w10(7), w10(8), w10(9), w10(10), w10(11)], a: [4] }, { t: 'aprender de cada etapa', f: [w10(12), w10(13), w10(14), w10(15)] }], from: w10(7), to: w10(16) },
            { lines: [{ t: 'y no perder de vista', f: [w10(16), w10(17), w10(18), w10(19), w10(20)] }, { t: 'tu objetivo.', f: [w10(21), w10(22)], a: [1] }], from: w10(16), to: PUSH + 6 },
          ].map((g) => {
            const vis = prog(frame, g.from - 2, g.from + 6) * (1 - prog(frame, g.to - 8, g.to, easeInOut));
            if (vis <= 0) return null;
            return (
              <div key={g.from} style={{ position: 'absolute', left: 0, right: 0, opacity: vis }}>
                {g.lines.map((l) => (
                  <Words key={l.t} text={l.t} frames={l.f} size={66} weight={800} accent={l.a ?? []} />
                ))}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* Part B · the camera pushes in on the phone */}
      <AbsoluteFill style={{ opacity: 1 - phoneOut, transform: `scale(${push})` }}>
        <div style={{ position: 'absolute', left: 96, right: 96, top: 270 }}>
          <KLine text="EMPIEZA HOY" frames={[w11(0), w11(1)]} size={84} align="left" out={END - 14} />
          <div style={{ marginTop: 12 }}>
            <Words text="a construir tu mejor versión." frames={[w11(2), w11(3), w11(4), w11(5), w11(6)]} size={54} weight={700} accent={[3, 4]} out={END - 12} />
          </div>
        </div>
        <Phone3D
          width={520}
          layers={[{ src: 'inicio-rojo' }]}
          x={540}
          y={1200 + (1 - phone) * 1100}
          rx={(1 - phone) * 30 + 4}
          ry={Math.sin(frame / 50) * 4 - 6 * (1 - phone)}
          glow={0.6}
          opacity={clamp(phone * 2)}
        />
      </AbsoluteFill>

      {/* Part C · end card */}
      <AbsoluteFill style={{ opacity: endCard }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 268, display: 'flex', justifyContent: 'center' }}>
          <LogoLockup size={150} at={END} sweepAt={END + 30} id="cine-end" />
        </div>
        <div style={{ position: 'absolute', left: 96, right: 96, top: 640 }}>
          <KLine text="TU PROGRESO," frames={[w12(1), w12(2)]} size={70} />
          <KLine text="TU CAMINO." frames={[w12(3), w12(4)]} size={70} accent={[1]} />
        </div>

        {/* progress ring around Rumbi */}
        <svg style={{ position: 'absolute', left: 540 - 150, top: 1030 - 150 }} width={300} height={300}>
          <circle cx={150} cy={150} r={130} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={10} />
          <circle
            cx={150}
            cy={150}
            r={130}
            fill="none"
            stroke="url(#ring-grad)"
            strokeWidth={10}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - prog(frame, END + 6, END + 60, easeInOut)}
            transform="rotate(-90 150 150)"
          />
          <defs>
            <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ff5a63" />
              <stop offset="1" stopColor={C.progress} />
            </linearGradient>
          </defs>
        </svg>

        <div style={{ position: 'absolute', left: 0, right: 0, top: 1238, textAlign: 'center', opacity: url, transform: `translateY(${(1 - url) * 24}px)` }}>
          <span style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
            rumbofit<span style={{ color: C.redHi }}>.</span>netlify<span style={{ color: C.redHi }}>.</span>app
          </span>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 540 - 300,
            top: 1330,
            width: 600,
            height: 124,
            borderRadius: 999,
            background: RED_GRAD,
            boxShadow: `0 30px 70px -24px rgba(229,57,69,0.85), inset 0 2px 0 rgba(255,255,255,0.4), 0 0 ${40 + 60 * sting}px ${-10 + 10 * sting}px rgba(255,90,99,${0.5 * (1 - sting)})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 22,
            overflow: 'hidden',
            opacity: clamp(button * 1.4),
            transform: `scale(${(0.8 + 0.2 * button) * (1 + 0.025 * Math.sin(frame / 9) * clamp(button))})`,
          }}
        >
          <span style={{ fontFamily: 'Krophed, Inter, sans-serif', fontSize: 40, letterSpacing: '0.04em', color: '#fff' }}>EMPIEZA AHORA</span>
          <Ico d={IC.arrow} size={40} color="#fff" stroke={3} />
          {frame > w13(9) && (
            <div style={{ position: 'absolute', top: -40, bottom: -40, width: 120, left: -160 + shine * 900, transform: 'skewX(-20deg)', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)' }} />
          )}
        </div>
        {sting > 0 && sting < 1 && (
          <div
            style={{
              position: 'absolute',
              left: 540 - 320 - 200 * sting,
              top: 1392 - 80 - 120 * sting,
              width: 640 + 400 * sting,
              height: 160 + 240 * sting,
              borderRadius: 999,
              boxShadow: `inset 0 0 0 ${4 * (1 - sting)}px rgba(255,190,190,${0.8 * (1 - sting)})`,
            }}
          />
        )}
      </AbsoluteFill>

      <div style={{ position: 'absolute', left: rx - rs / 2, top: ry - rs / 2, transform: `translateY(${Math.sin(frame / 22) * 7}px)` }}>
        <Rumbi size={rs} events={RUMBI} seed={207} />
      </div>
    </AbsoluteFill>
  );
}

export const _len = LEN;
