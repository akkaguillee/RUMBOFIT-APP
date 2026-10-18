import type { CSSProperties, ReactNode } from 'react';
import { spring } from 'remotion';
import { fitsKrophed, krophedWidth } from '../../../src/brand/krophed';
import { accentAt, BEAT, column, dashPath, energy, overshoot, places, pulse, screenPoint, SWATCH, w } from './choreo';
import { Confetti, Flash, Rays, Shock, Slam, SpeedLines, Particles } from './fx';
import { CHART, CHIPS, CROP, HOY, onScreen, TAP } from './geo';
import { clamp, Crop, easeInOut, Headline, Logo, Phone, phoneGeom, prog, Ripple, Sparkle, Stage, Trail, useT, windowed } from './kit';
import { C, FONT, FPS, useLayout, type Layout } from './theme';

const v = <T,>(L: Layout, story: T, feed: T): T => (L.format === 'story' ? story : feed);

/** Largest size (px) at which `text` fits `width`, in Krophed when it can be, else Inter Black. */
function fit(text: string, width: number, max: number, sans = false) {
  if (!sans && fitsKrophed(text)) return Math.min(max, width / (krophedWidth(text) + 0.02 * text.length));
  return Math.min(max, width / (0.8 * text.length));
}

/** Centre line of the headline band. */
const headMid = (L: Layout) => L.headY + L.headH / 2;

/* ═══ Background: light that moves with the music ════════════════════════ */
export function Backdrop({ travel }: { travel: number }) {
  const f = useT();
  const L = useLayout();
  const e = energy(f);
  const p = pulse(f);
  const tint = accentAt(f);
  const drop = Math.max(windowed(f, BEAT.drop1, BEAT.drop1 + 40, 1, 36), windowed(f, BEAT.drop2, BEAT.drop2 + 60, 1, 50));
  const whip = Math.max(windowed(f, BEAT.whip1[0], BEAT.whip1[1], 4, 6), windowed(f, BEAT.wipe[0], BEAT.wipe[1], 4, 6), windowed(f, BEAT.dash[0] + 6, BEAT.dash[1], 4, 6));
  const raysY = f < BEAT.drop1 ? v(L, 1250, 1010) : f >= BEAT.drop2 ? v(L, 700, 380) : v(L, 900, 620);
  const spin = f * (0.25 + e * 0.5) + travel * 0.02;
  return (
    <div style={{ position: 'absolute', inset: -80 }}>
      <div style={{ position: 'absolute', inset: 80 }}>
        <Stage glow={0.35 + 0.75 * e + 0.25 * p * e + 0.6 * drop} tint={tint} y={f < BEAT.drop1 ? 0.5 : 0.42} light={windowed(f, BEAT.light + 4, BEAT.dark + 8, 10, 10) * 0.9} />
        <Rays x={540} y={raysY} intensity={0.25 + 0.6 * e + 0.8 * drop + 0.3 * p * e} spin={spin} tint={tint} />
        <Particles speed={travel} density={0.4 + 0.6 * e} tint={tint} streak={whip + prog(f, BEAT.registra, BEAT.flash, (t) => t * t)} />
        <SpeedLines amount={whip} dir={f > BEAT.wipe[0] - 10 && f < BEAT.wipe[1] + 4 ? 1 : -1} />
      </div>
    </div>
  );
}

/* ═══ 1 · Hook ═══════════════════════════════════════════════════════════ */
export function Hook() {
  const f = useT();
  const L = useLayout();
  if (f > BEAT.drop1 + 2) return null;
  const width = L.right - L.left;
  const y = (st: number, fd: number) => v(L, st, fd);
  const W = (i: number) => w('l1', i);
  const gone1 = W(10) - 8;
  const gone2 = BEAT.dash[0] - 2;
  const big = v(L, 156, 116);
  const rumbi = { x: 540, y: y(1250, 1010) };
  return (
    <>
      <Slam text="NO HACE" at={W(0)} out={gone1} size={fit('NO HACE', width, big)} y={y(400, 190)} />
      <Slam text="FALTA" at={W(2)} out={gone1} size={fit('FALTA', width, big)} y={y(555, 305)} />
      <Slam text="CAMBIARLO" at={W(3)} out={gone1} size={fit('CAMBIARLO', width, big)} y={y(710, 420)} strike={W(5) + 2} />
      <Slam text="TODO" at={W(4)} out={gone1} size={fit('TODO', width, big)} y={y(860, 535)} strike={W(5) + 5} />
      <Slam text="DE UN DÍA PARA OTRO." at={W(5)} out={gone1} size={fit('DE UN DÍA PARA OTRO.', width * 0.8, v(L, 56, 42))} y={y(990, 635)} color={C.lavender} echo={false} from={1.5} />
      <Slam text="BASTA" at={W(10)} out={gone2} size={fit('BASTA', width, big)} y={y(400, 190)} />
      <Slam text="CON DAR" at={W(11)} out={gone2} size={fit('CON DAR', width, big)} y={y(555, 305)} />
      <Slam text="EL SIGUIENTE" at={W(13)} out={gone2} size={fit('EL SIGUIENTE', width, big)} y={y(705, 415)} />
      <Slam text="PASO." at={BEAT.step} out={gone2} size={v(L, 250, 180)} y={y(905, 560)} accent={[0]} from={2.6} />
      {f >= BEAT.dash[0] && <Trail d={dashPath(L)} to={prog(f, BEAT.dash[0], BEAT.dash[1], easeInOut)} from={prog(f, BEAT.dash[0] + 10, BEAT.dash[1] + 30, easeInOut)} width={8} />}
      <Slam text="TU CAMINO." at={BEAT.camino} out={BEAT.drop1 - 4} size={fit('TU CAMINO.', width, v(L, 140, 110))} y={y(600, 300)} />
      <Slam text="TU RUMBO." at={BEAT.rumbo} out={BEAT.drop1 - 4} size={fit('TU RUMBO.', width, v(L, 160, 124))} y={y(780, 440)} accent={[1]} from={2.4} />
      <Shock x={rumbi.x} y={rumbi.y} at={BEAT.wake + 2} size={v(L, 700, 560)} width={6} dur={22} />
      <Shock x={540} y={y(780, 440)} at={BEAT.rumbo} size={v(L, 900, 700)} />
    </>
  );
}

/* ═══ 2 · The app, on the drop ═══════════════════════════════════════════ */
export function AppScene() {
  const f = useT();
  const L = useLayout();
  if (f < BEAT.drop1 - 2 || f > BEAT.whip1[1]) return null;
  const width = L.right - L.left;
  const P = places(L);
  const words: [string, number, number][] = [
    ['REGISTRA.', BEAT.regis, BEAT.observa - 3],
    ['OBSERVA.', BEAT.observa, BEAT.sigue - 3],
    ['SIGUE ADELANTE.', BEAT.sigue, BEAT.whip1[0] + 4],
  ];
  return (
    <>
      <Shock x={P.app.x} y={P.app.y} at={BEAT.drop1} size={v(L, 1500, 1100)} width={14} dur={22} />
      <Shock x={P.app.x} y={P.app.y} at={BEAT.drop1 + 4} size={v(L, 1100, 800)} width={6} dur={20} color={C.violetHi} />
      {words.map(([text, at, out], i) => (
        <Slam key={text} text={text} at={at} out={out} size={fit(text, width, v(L, 120, 104))} y={headMid(L)} accent={i === 2 ? [1] : []} />
      ))}
    </>
  );
}

/* ═══ 3 · Evolution ══════════════════════════════════════════════════════ */
/** A real card that slams out of the phone into a column, with a shockwave where it lands. */
function Lift({ crop, at, out, x, y, width, from, tilt = 4 }: { crop: (typeof CROP)[keyof typeof CROP]; at: number; out: number; x: number; y: number; width: number; from: { x: number; y: number }; tilt?: number }) {
  const f = useT();
  if (f < at - 1 || f > out + 14) return null;
  const s = overshoot(prog(f, at, at + 16));
  const leave = prog(f, out, out + 12, (t) => t * t);
  return (
    <>
      <Crop
        src={crop.src}
        crop={crop.r}
        width={width}
        x={from.x + (x - from.x) * s + leave * 700 * Math.sign(x - 540 || 1)}
        y={from.y + (y - from.y) * s}
        scale={0.4 + 0.6 * s}
        rz={tilt * (1 - clamp(s)) * 4 + tilt * 0.4}
        opacity={clamp(prog(f, at, at + 4)) * (1 - leave)}
        glow={0.7}
      />
      <Shock x={x} y={y} at={at + 9} size={width * 1.5} width={6} dur={16} />
    </>
  );
}

export function Evolution() {
  const f = useT();
  const L = useLayout();
  if (f < BEAT.whip1[0] || f > BEAT.whip2[1]) return null;
  const width = L.right - L.left;
  const P = places(L);
  const col = column(L, 'right');
  const from = { x: P.evo.x, y: P.evo.y };
  const size = fit('TU EVOLUCIÓN,', width, v(L, 92, 70), true);
  return (
    <>
      <Slam text="TU EVOLUCIÓN," at={w('l3', 2)} out={BEAT.whip2[0] - 4} size={size} y={headMid(L) - size * 0.55} sans />
      <Slam text="PASO A PASO." at={w('l3', 2) + 8} out={BEAT.whip2[0] - 2} size={size} y={headMid(L) + size * 0.55} accent={[0, 1, 2]} sans />
      <Lift crop={CROP.imc} at={BEAT.imc} out={BEAT.markers[0] - 14} x={col.x} y={v(L, 760, 480)} width={col.w} from={from} />
      <Lift crop={CROP.kcal} at={BEAT.kcal} out={BEAT.markers[0] - 10} x={col.x} y={v(L, 1020, 700)} width={col.w} from={from} tilt={-4} />
      <Confetti x={P.evo.x + v(L, 60, 40)} y={v(L, 900, 600)} at={BEAT.markers[1] - 6} count={36} spread={600} seed={11} />
    </>
  );
}

/* ═══ 4 · Training ═══════════════════════════════════════════════════════ */
export function Training() {
  const f = useT();
  const L = useLayout();
  if (f < BEAT.whip2[0] || f > BEAT.wipe[1] + 4) return null;
  const width = L.right - L.left;
  const P = places(L);
  const col = column(L, 'left');
  const from = { x: P.train.x, y: P.train.y };
  const set = screenPoint(BEAT.setDone, L, TAP.set1.x, TAP.set1.y);
  const tokens: [string, number, number][] = [
    ['RUTINAS', BEAT.rutinas, BEAT.setDone - 2],
    ['SERIES', BEAT.setDone, BEAT.marcas - 2],
    ['MARCAS', BEAT.marcas, BEAT.history[0] - 2],
  ];
  const all = 'RUTINAS · SERIES · MARCAS';
  return (
    <>
      <Slam text="ENTRENAMIENTOS" at={w('l4', 2)} out={BEAT.rutinas - 3} size={fit('ENTRENAMIENTOS', width, 100)} y={headMid(L)} />
      {tokens.map(([t, at, out], i) => (
        <Slam key={t} text={t} at={at} out={out} size={fit(t, width, v(L, 140, 116))} y={headMid(L)} accent={i === 2 ? [0] : []} />
      ))}
      <Slam text={all} at={BEAT.history[0]} out={BEAT.wipe[0]} size={fit(all, width, 60)} y={headMid(L)} echo={false} from={1.4} />
      <Confetti x={set.x} y={set.y} at={BEAT.setDone + 1} count={34} spread={520} seed={3} dur={44} />
      <Lift crop={CROP.records} at={BEAT.marcas} out={BEAT.history[0] + 10} x={col.x} y={v(L, 780, 500)} width={col.w} from={from} tilt={-4} />
      <Lift crop={CROP.stats} at={BEAT.stats} out={BEAT.wipe[0] - 6} x={col.x} y={v(L, 820, 520)} width={col.w} from={from} tilt={4} />
      <Confetti x={col.x} y={v(L, 1150, 840)} at={BEAT.proud} count={44} spread={760} seed={5} />
      <Wipe />
    </>
  );
}

/** A violet band that sweeps across the frame: the cut into habits happens behind it. */
function Wipe() {
  const f = useT();
  const L = useLayout();
  const [a, b] = BEAT.wipe;
  if (f < a || f > b) return null;
  const t = prog(f, a, b, easeInOut);
  const x = -L.W * 1.6 + t * L.W * 3.2;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: -L.H * 0.25,
        width: L.W * 1.4,
        height: L.H * 1.5,
        transform: 'skewX(-18deg)',
        background: `linear-gradient(90deg, ${C.violet}00, ${C.violetLo} 18%, ${C.violet} 40%, ${C.lav} 52%, ${C.violet} 64%, ${C.violetLo} 82%, ${C.violet}00)`,
        boxShadow: `0 0 120px ${C.violetHi}`,
      }}
    />
  );
}

/* ═══ 5 · Habits (music, type and the real screen) ═══════════════════════ */
function Glass({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 3h14l-1.6 16.2a2 2 0 0 1-2 1.8H8.6a2 2 0 0 1-2-1.8Z" fill={`${C.water}33`} stroke="#8fb8ff" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M6.2 10.5c2-.9 3.9-.9 5.8 0s3.8.9 5.8 0l-.9 8.6a1.4 1.4 0 0 1-1.4 1.3H8.5a1.4 1.4 0 0 1-1.4-1.3Z" fill={C.water} />
    </svg>
  );
}

function Footprint({ size, flip }: { size: number; flip?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.steps} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ transform: flip ? 'scaleX(-1)' : undefined }}>
      <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z" fill={`${C.steps}55`} />
      <path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z" fill={`${C.steps}55`} />
    </svg>
  );
}

export function Habits() {
  const f = useT();
  const L = useLayout();
  if (f < BEAT.wipe[0] || f > 1210) return null;
  const width = L.right - L.left;
  const water = screenPoint(f, L, HOY.water.x, HOY.water.y);
  const steps = screenPoint(f, L, HOY.steps.x, HOY.steps.y);
  const glassSize = v(L, 110, 84);
  const stepSize = v(L, 70, 56);
  const P = places(L);
  return (
    <>
      <Slam text="AGUA" at={BEAT.agua} out={BEAT.pasos - 3} size={v(L, 170, 128)} y={headMid(L)} />
      <Slam text="PASOS" at={BEAT.pasos} out={BEAT.racha - 3} size={v(L, 170, 128)} y={headMid(L)} />
      <Slam text="RACHA" at={BEAT.racha} out={BEAT.constancia - 3} size={v(L, 170, 128)} y={headMid(L)} accent={[0]} />
      <Slam text="LA CONSTANCIA" at={BEAT.constancia} out={1196} size={fit('LA CONSTANCIA', width, v(L, 92, 68), true)} y={headMid(L) - v(L, 48, 36)} sans />
      <Slam text="TAMBIÉN SUMA." at={BEAT.constancia + 8} out={1198} size={fit('LA CONSTANCIA', width, v(L, 92, 68), true)} y={headMid(L) + v(L, 52, 40)} accent={[1]} sans />
      {/* Glasses drop into the water card, one per beat. */}
      {[0, 1, 2].map((i) => {
        const at = BEAT.agua + 4 + i * 7.5;
        if (f < at || f > at + 18) return null;
        const t = prog(f, at, at + 12, (x) => x * x);
        const x = water.x + (i - 1) * v(L, 70, 54);
        const y0 = v(L, 470, 220);
        return (
          <div key={i} style={{ position: 'absolute', left: x - glassSize / 2, top: y0 + (water.y - y0) * t - glassSize / 2, transform: `rotate(${(i - 1) * 14 * (1 - t)}deg) scale(${1 - 0.4 * t})`, opacity: 1 - prog(f, at + 12, at + 18), filter: 'drop-shadow(0 12px 18px rgba(0,0,0,0.6))' }}>
            <Glass size={glassSize} />
          </div>
        );
      })}
      {[0, 1, 2].map((i) => (
        <Ripple key={i} x={water.x + (i - 1) * v(L, 70, 54)} y={water.y} at={BEAT.agua + 16 + i * 7.5} size={v(L, 120, 90)} color="#8fb8ff" />
      ))}
      {/* «+ 250»: the amount flies up from the button. */}
      {f >= BEAT.tap250 && f < BEAT.tap250 + 30 && (
        <div
          style={{
            position: 'absolute',
            left: water.x,
            top: water.y - v(L, 120, 90) - prog(f, BEAT.tap250, BEAT.tap250 + 30) * 80,
            transform: `translateX(-50%) scale(${overshoot(prog(f, BEAT.tap250, BEAT.tap250 + 10))})`,
            opacity: 1 - prog(f, BEAT.tap250 + 20, BEAT.tap250 + 30),
            fontFamily: FONT.sans,
            fontWeight: 900,
            fontSize: v(L, 64, 50),
            color: '#8fb8ff',
            textShadow: `0 0 30px ${C.water}`,
            whiteSpace: 'nowrap',
          }}
        >
          + 250 ml
        </div>
      )}
      {/* Steps walk into the steps card on the eighths. */}
      {Array.from({ length: 8 }, (_, i) => {
        const at = BEAT.pasos + 4 + i * 3.75;
        if (f < at || f > at + 22) return null;
        const t = (i + 0.5) / 8;
        const x = v(L, 120, 110) + (steps.x - v(L, 120, 110)) * t;
        const y = v(L, 520, 270) + (steps.y - v(L, 520, 270)) * t + (i % 2 ? 26 : -26);
        const s = overshoot(prog(f, at, at + 6));
        return (
          <div key={i} style={{ position: 'absolute', left: x - stepSize / 2, top: y - stepSize / 2, transform: `rotate(${110}deg) scale(${s})`, opacity: 1 - prog(f, at + 12, at + 22) }}>
            <Footprint size={stepSize} flip={i % 2 === 1} />
          </div>
        );
      })}
      <Ripple x={steps.x} y={steps.y} at={BEAT.pasos + 34} size={v(L, 150, 110)} color={C.steps} />
      {/* The streak card comes forward. */}
      <Lift crop={CROP.streak} at={BEAT.racha} out={BEAT.constancia - 6} x={540} y={v(L, 760, 470)} width={v(L, 640, 470)} from={{ x: P.habits.x, y: P.habits.y - 200 }} tilt={-2} />
      <Sparkle x={540 - v(L, 210, 155)} y={v(L, 700, 425)} at={BEAT.racha + 10} radius={v(L, 180, 140)} count={16} seed={21} />
      <Confetti x={540} y={v(L, 700, 430)} at={BEAT.racha + 8} count={40} spread={700} seed={9} />
    </>
  );
}

/* ═══ 6 · Your style: the five colours on the beat, the theme ════════════ */
export function StyleBack() {
  const f = useT();
  const L = useLayout();
  const [a, b] = BEAT.fan;
  if (f < a - 2 || f > b + 16) return null;
  const P = places(L).style;
  const fan: [string, number, number][] = [
    ['inicio-naranja', -1, 0],
    ['inicio-fucsia', 1, 4],
    ['inicio-volt', -2, 8],
  ];
  return (
    <>
      {fan.map(([src, side, delay]) => {
        const s = spring({ frame: f - a - delay, fps: FPS, config: { damping: 14, stiffness: 160 } });
        const back = prog(f, b - 6, b + 10, easeInOut);
        const t = s * (1 - back);
        return (
          <Phone
            key={src}
            width={P.w * 0.8}
            x={P.x + side * v(L, 230, 190) * t}
            y={P.y + Math.abs(side) * 40 * t}
            rz={side * 10 * t}
            ry={side * -14 * t}
            opacity={clamp(t * 2)}
            glow={0.6}
            glowColor={SWATCH[src.slice(7)] ?? C.violet}
            layers={[{ src }]}
          />
        );
      })}
    </>
  );
}

export function Style() {
  const f = useT();
  const L = useLayout();
  if (f < 1186 || f > 1384) return null;
  const width = L.right - L.left;
  const sub = v(L, 488, 262);
  return (
    <>
      <Slam text="A TU ESTILO." at={BEAT.estilo} out={1370} size={fit('A TU ESTILO.', width, v(L, 120, 100))} y={headMid(L)} accent={[2]} />
      <Slam text="TUS COLORES" at={BEAT.colours[0]!} out={BEAT.light - 3} size={v(L, 52, 40)} y={sub} color={accentAt(f)} echo={false} from={1.6} />
      <Slam text="TU TEMA" at={BEAT.light} out={1370} size={v(L, 52, 40)} y={sub} echo={false} from={1.6} />
      {BEAT.colours.map((at, i) => (
        <Shock key={i} x={places(L).style.x} y={places(L).style.y} at={at} size={v(L, 900, 700)} width={5} dur={14} color={accentAt(at + 8)} />
      ))}
    </>
  );
}

/* ═══ 7 · Privacy, only what the code proves ═════════════════════════════ */
export function Privacy() {
  const f = useT();
  const L = useLayout();
  if (f < 1370 || f > BEAT.build + 4) return null;
  const P = places(L).privacy;
  const k = phoneGeom(P.w).k;
  const orbit = [
    { x: P.x - v(L, 330, 330), y: P.y - v(L, 260, 200) },
    { x: P.x + v(L, 330, 330), y: P.y - v(L, 330, 250) },
    { x: P.x - v(L, 320, 320), y: P.y + v(L, 230, 160) },
    { x: P.x + v(L, 320, 330), y: P.y + v(L, 150, 120) },
  ];
  const chipSize = v(L, 112, 92);
  return (
    <>
      {CHIPS.map((c, i) => {
        const at = BEAT.privacy + 6 + i * 8;
        if (f < at) return null;
        const s = spring({ frame: f - at, fps: FPS, config: { damping: 16, stiffness: 140 } });
        const home = onScreen(P, c.x + c.w / 2, c.y + c.h / 2);
        const go = BEAT.chipsHome[0] + i * 5;
        const t = prog(f, go, go + 16, easeInOut);
        const drift = Math.sin((f + i * 20) / 18) * 12 * (1 - t);
        const o = orbit[i]!;
        const width = chipSize + (c.w * k - chipSize) * t;
        return (
          <Crop
            key={i}
            src="inicio-violeta"
            crop={c}
            width={width}
            x={o.x + (home.x - o.x) * t}
            y={o.y + (home.y - o.y) * t + drift}
            radius={14}
            scale={s}
            opacity={clamp(s * 1.5) * (1 - prog(f, go + 14, go + 20))}
            glow={0.6 * (1 - t)}
          />
        );
      })}
      <Head style={{ justifyContent: 'flex-start', paddingTop: v(L, 6, 0) }}>
        <Headline text="Tus registros se guardan en este dispositivo." upper={false} at={BEAT.privacy + 12} size={v(L, 56, 46)} accent={[5, 6]} stagger={2} out={BEAT.build - 12} style={{ maxWidth: v(L, 780, 840), rowGap: 0 }} />
        <div
          style={{
            marginTop: v(L, 20, 10),
            maxWidth: v(L, 760, 820),
            textAlign: 'center',
            fontFamily: FONT.sans,
            fontSize: v(L, 30, 26),
            lineHeight: 1.32,
            fontWeight: 500,
            color: C.text2,
            opacity: prog(f, BEAT.privacy + 40, BEAT.privacy + 52) * (1 - prog(f, BEAT.build - 12, BEAT.build - 2)),
            textWrap: 'balance',
          }}
        >
          El escáner de comidas, opcional, se conecta a internet para identificar alimentos.
        </div>
      </Head>
    </>
  );
}

/** The headline band at the top of the frame. */
function Head({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const L = useLayout();
  return (
    <div style={{ position: 'absolute', left: L.left, width: L.right - L.left, top: L.headY, height: L.headH, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', ...style }}>
      {children}
    </div>
  );
}

/* ═══ 8 · Build ══════════════════════════════════════════════════════════ */
export function Build() {
  const f = useT();
  const L = useLayout();
  if (f < BEAT.build - 2 || f > BEAT.drop2 + 2) return null;
  const width = L.right - L.left;
  const words: [string, number, number][] = [
    ['ENTRENA.', BEAT.entrena, BEAT.registra - 3],
    ['REGISTRA.', BEAT.registra, BEAT.celebra - 3],
    ['CELEBRA.', BEAT.celebra, BEAT.flash - 4],
  ];
  return (
    <>
      {words.map(([text, at, out], i) => (
        <Slam key={text} text={text} at={at} out={out} size={fit(text, width, v(L, 140, 116))} y={headMid(L)} accent={i === 2 ? [0] : []} />
      ))}
    </>
  );
}

/* ═══ 9 · Close and call to action ═══════════════════════════════════════ */
export function Close() {
  const f = useT();
  const L = useLayout();
  if (f < BEAT.drop2 - 1) return null;
  const logoY = v(L, 700, 380);
  const tagY = v(L, 962, 590);
  const ctaY = v(L, 1082, 690);
  const logo = overshoot(prog(f, BEAT.drop2, BEAT.drop2 + 18));
  const cta = spring({ frame: f - BEAT.cta, fps: FPS, config: { damping: 12, stiffness: 180 } });
  const shine = ((f - BEAT.cta - 20) % 75) / 75;
  const tag = prog(f, BEAT.tagline - 2, BEAT.tagline + 8);
  return (
    <>
      <Shock x={540} y={logoY} at={BEAT.drop2} size={v(L, 1700, 1300)} width={16} dur={24} />
      <Shock x={540} y={logoY} at={BEAT.drop2 + 5} size={v(L, 1200, 900)} width={6} dur={22} color={C.violetHi} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: logoY, display: 'flex', justifyContent: 'center', transform: `translateY(-50%) scale(${1.7 - 0.7 * logo})`, filter: `blur(${(1 - prog(f, BEAT.drop2, BEAT.drop2 + 6)) * 10}px)` }}>
        <Logo width={v(L, 540, 450)} at={BEAT.drop2 - 6} />
      </div>
      <Confetti x={540} y={logoY} at={BEAT.drop2 + 2} count={70} spread={900} seed={13} dur={70} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: tagY,
          textAlign: 'center',
          fontFamily: FONT.sans,
          fontWeight: 800,
          fontSize: v(L, 38, 32),
          textTransform: 'uppercase',
          color: C.lavender,
          letterSpacing: `${0.32 + 0.9 * (1 - tag)}em`,
          opacity: tag,
          transform: `translateY(-50%) scale(${1 + 0.4 * (1 - tag)})`,
          paddingLeft: '0.32em',
          textShadow: `0 0 30px ${C.violet}`,
        }}
      >
        Cada pequeño paso cuenta
      </div>
      {f >= BEAT.cta - 1 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: ctaY, display: 'flex', justifyContent: 'center', transform: 'translateY(-50%)' }}>
          <div
            style={{
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: v(L, '28px 62px', '22px 50px'),
              borderRadius: 999,
              background: `linear-gradient(135deg, ${C.violetHi}, ${C.violetLo})`,
              boxShadow: `0 24px 70px -14px ${C.violet}, 0 0 ${40 + 30 * pulse(f)}px ${C.violet}aa, inset 0 1.5px 0 rgba(255,255,255,0.35)`,
              color: '#fff',
              fontFamily: FONT.sans,
              fontWeight: 800,
              fontSize: v(L, 50, 42),
              letterSpacing: '-0.02em',
              transform: `scale(${(0.6 + 0.4 * cta) * (1 + 0.03 * pulse(f))})`,
              opacity: clamp(cta * 1.6),
            }}
          >
            Empieza hoy
            <svg width={v(L, 42, 36)} height={v(L, 42, 36)} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
            {f > BEAT.cta + 20 && <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${-40 + shine * 180}%`, width: '35%', background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.45), transparent)', transform: 'skewX(-20deg)' }} />}
          </div>
        </div>
      )}
    </>
  );
}

/** Overlays above everything: the flashes into the drops. */
export function Flashes() {
  return (
    <>
      <Flash at={BEAT.drop1} peak={0.42} rise={5} fall={12} />
      <Flash at={BEAT.drop2} peak={0.52} rise={8} fall={16} />
    </>
  );
}

/* ═══ Inside the screen: chart drawing, taps, the save glow ══════════════ */
export function ScreenOverlay({ width }: { width: number }) {
  const f = useT();
  const g = phoneGeom(width);
  const k = g.k;
  const pt = (x: number, y: number) => ({ x: x * k, y: (47 + y) * k });
  const items: ReactNode[] = [];

  // Evolution: the real chart is uncovered left to right, then every weigh-in lights up on the sixteenths.
  if (f >= BEAT.whip1[1] - 10 && f < BEAT.whip2[0] + 12) {
    const p = prog(f, BEAT.chart[0], BEAT.chart[1], easeInOut);
    const { plot, markers } = CHART;
    const sweep = plot.x + plot.w * p;
    const a = pt(sweep, plot.y - 4);
    const b = pt(plot.x + plot.w + 4, plot.y + plot.h + 4);
    const n = markers.length;
    const span = BEAT.markers[1] - BEAT.markers[0];
    items.push(
      <div key="chart" style={{ position: 'absolute', inset: 0 }}>
        {p < 1 && <div style={{ position: 'absolute', left: a.x - 10 * k, top: a.y, width: b.x - a.x + 10 * k, height: b.y - a.y, background: `linear-gradient(90deg, ${CHART.card}00 0, ${CHART.card} ${10 * k}px)` }} />}
        {p > 0 && p < 1 && <div style={{ position: 'absolute', left: a.x - 1.5 * k, top: a.y, width: 3 * k, height: b.y - a.y, background: `linear-gradient(180deg, transparent, ${C.lav}, transparent)`, boxShadow: `0 0 ${14 * k}px ${C.violetHi}` }} />}
        {markers.map(([mx, my], i) => {
          const at = BEAT.markers[0] + (i * span) / n;
          const t = prog(f, at, at + 12);
          if (t <= 0 || t >= 1) return null;
          const c = pt(mx, my);
          return (
            <div key={i}>
              <div style={{ position: 'absolute', left: c.x - 16 * k, top: c.y - 16 * k, width: 32 * k, height: 32 * k, borderRadius: '50%', border: `${2.4 * k}px solid ${C.lav}`, boxShadow: `0 0 ${14 * k}px ${C.violetHi}`, opacity: (1 - t) * 0.95, transform: `scale(${0.25 + t * 1.2})` }} />
              <div style={{ position: 'absolute', left: c.x - 6 * k, top: c.y - 6 * k, width: 12 * k, height: 12 * k, borderRadius: '50%', background: '#fff', boxShadow: `0 0 ${18 * k}px ${C.lav}`, opacity: 1 - t }} />
            </div>
          );
        })}
      </div>,
    );
  }

  // Training: the first set is completed.
  if (f >= BEAT.setDone - 2 && f < BEAT.setDone + 44) {
    const c = pt(TAP.set1.x, TAP.set1.y);
    items.push(<Ripple key="set" x={c.x} y={c.y} at={BEAT.setDone} size={80 * k} color={C.good} />);
    items.push(<Sparkle key="setsp" x={c.x} y={c.y} at={BEAT.setDone + 1} radius={70 * k} count={12} seed={3} />);
  }

  // Habits: «+ 250».
  if (f >= BEAT.tap250 - 2 && f < BEAT.tap250 + 44) {
    const c = pt(TAP.add250.x, TAP.add250.y);
    const r = pt(HOY.water.x, HOY.water.y);
    items.push(
      <div key="water" style={{ position: 'absolute', inset: 0 }}>
        <Ripple x={c.x} y={c.y} at={BEAT.tap250} size={70 * k} />
        <Sparkle x={r.x} y={r.y} at={BEAT.tap250 + 2} radius={60 * k} count={12} seed={7} />
      </div>,
    );
  }

  // Style: the taps on the real controls.
  const taps: [number, { x: number; y: number }][] = [
    [BEAT.colours[0]! - 2, TAP.accent],
    [BEAT.light - 2, TAP.theme],
    [BEAT.dark - 2, TAP.theme],
  ];
  for (const [at, t] of taps) {
    if (f >= at && f < at + 18) {
      const c = pt(t.x, t.y);
      items.push(<Ripple key={`tap${at}`} x={c.x} y={c.y} at={at} size={60 * k} color={at === BEAT.light - 2 ? '#14121b' : '#fff'} />);
    }
  }

  // Privacy: a warm glow along the screen edge when the records settle in.
  if (f >= BEAT.saved - 4 && f < BEAT.saved + 80) {
    const t = windowed(f, BEAT.saved, BEAT.saved + 70, 10, 40);
    items.push(<div key="saved" style={{ position: 'absolute', inset: 0, borderRadius: g.innerRadius, boxShadow: `inset 0 0 ${40 * k}px ${12 * k}px ${C.violetHi}${Math.round(t * 0.6 * 255).toString(16).padStart(2, '0')}` }} />);
  }

  return <>{items}</>;
}

