import type { MascotExpression } from '../../../src/features/mascot/expression';
import { MascotRig, type RigFrame } from '../../../src/features/mascot/rig';
import '../../../src/features/mascot/mascot.css';

/**
 * Rumbi, the app's mascot, exactly as the app draws it (same SVG as
 * src/features/mascot/Mascot.tsx) and moved by the app's own rig. The rig is
 * deterministic: every video frame steps it at a fixed rate from the moment
 * Rumbi wakes, and scripted events (faces, glances, presses, taps) land on
 * exact frames. Consecutive frames reuse the previous state, so a render
 * never re-simulates from the start.
 */
export type RumbiEvent =
  | { at: number; expr: MascotExpression }
  | { at: number; look: [number, number] }
  | { at: number; tap: true }
  | { at: number; press: true }
  | { at: number; release: true };

const STEPS_PER_FRAME = 2;
const FPS = 30;

interface Sim {
  key: string;
  frame: number;
  rig: MascotRig;
}
const cache = new Map<string, Sim>();

function fresh(expression: MascotExpression, seed: number) {
  const rig = new MascotRig(expression, { wake: true, seed });
  // Mark Rumbi as seen without starting its own requestAnimationFrame loop.
  rig.setPageVisible(false);
  rig.setVisible(true);
  return rig;
}

function apply(rig: MascotRig, events: RumbiEvent[], f: number) {
  for (const e of events) {
    if (e.at !== f) continue;
    if ('expr' in e) rig.setExpression(e.expr);
    else if ('look' in e) rig.lookAt(e.look[0], e.look[1]);
    else if ('tap' in e) rig.tap();
    else if ('press' in e) rig.press();
    else if ('release' in e) rig.cancelPress();
  }
}

/** Rig frame at `frame` frames after waking (a negative frame means still asleep). */
export function simulate(id: string, expression: MascotExpression, events: RumbiEvent[], frame: number, seed: number): RigFrame {
  if (frame < 0) return fresh(expression, seed).frame();
  const key = `${id}:${expression}:${seed}:${events.length}`;
  let sim = cache.get(id);
  if (!sim || sim.key !== key || sim.frame > frame) {
    sim = { key, frame: 0, rig: fresh(expression, seed) };
    apply(sim.rig, events, 0);
    cache.set(id, sim);
  }
  const dt = 1 / FPS / STEPS_PER_FRAME;
  while (sim.frame < frame) {
    for (let s = 0; s < STEPS_PER_FRAME; s++) sim.rig.step(dt);
    sim.frame++;
    apply(sim.rig, events, sim.frame);
  }
  return sim.rig.frame();
}

export function RumbiSvg({ f, size, accent, uid }: { f: RigFrame; size: number; accent: string; uid: string }) {
  return (
    <span
      className="mascot"
      style={{
        ['--acc' as string]: accent,
        ['--accent' as string]: accent,
        ['--on-accent' as string]: '#fff',
        ['--surface-solid' as string]: '#16141f',
        ['--mascot-size' as string]: `${size}px`,
        width: size,
        height: size,
        display: 'block',
      }}
    >
      <svg className="mascot__svg" viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <radialGradient id={`${uid}-body`} cx="0.36" cy="0.3" r="0.78">
            <stop offset="0" style={{ stopColor: 'var(--mascot-hi)' }} />
            <stop offset="0.5" style={{ stopColor: 'var(--mascot-mid)' }} />
            <stop offset="0.86" style={{ stopColor: 'var(--mascot-lo)' }} />
            <stop offset="1" style={{ stopColor: 'var(--mascot-edge)' }} />
          </radialGradient>
          <radialGradient id={`${uid}-rim`} cx="0.5" cy="0.2" r="0.84">
            <stop offset="0.66" style={{ stopColor: 'var(--mascot-rim)', stopOpacity: 0 }} />
            <stop offset="0.9" style={{ stopColor: 'var(--mascot-rim)', stopOpacity: 'var(--mascot-rim-mid)' }} />
            <stop offset="1" style={{ stopColor: 'var(--mascot-rim)', stopOpacity: 'var(--mascot-rim-edge)' }} />
          </radialGradient>
          <radialGradient id={`${uid}-warm`} cx="0.5" cy="0.92" r="0.9">
            <stop offset="0" style={{ stopColor: 'var(--mascot-warm)', stopOpacity: 0.9 }} />
            <stop offset="1" style={{ stopColor: 'var(--mascot-warm)', stopOpacity: 0 }} />
          </radialGradient>
          <radialGradient id={`${uid}-cool`} cx="0.5" cy="1" r="0.75">
            <stop offset="0" style={{ stopColor: 'var(--mascot-cool)', stopOpacity: 0.95 }} />
            <stop offset="1" style={{ stopColor: 'var(--mascot-cool)', stopOpacity: 0 }} />
          </radialGradient>
          <radialGradient id={`${uid}-glow`}>
            <stop offset="0.7" style={{ stopColor: 'var(--mascot-glow)', stopOpacity: 'var(--mascot-glow-a)' }} />
            <stop offset="0.84" style={{ stopColor: 'var(--mascot-glow)', stopOpacity: 'var(--mascot-glow-b)' }} />
            <stop offset="1" style={{ stopColor: 'var(--mascot-glow)', stopOpacity: 0 }} />
          </radialGradient>
          <radialGradient id={`${uid}-spec`}>
            <stop offset="0" style={{ stopColor: '#fff', stopOpacity: 0.95 }} />
            <stop offset="1" style={{ stopColor: '#fff', stopOpacity: 0 }} />
          </radialGradient>
          <radialGradient id={`${uid}-shadow`}>
            <stop offset="0" style={{ stopColor: 'var(--mascot-shadow)', stopOpacity: 'var(--mascot-shadow-a)' }} />
            <stop offset="1" style={{ stopColor: 'var(--mascot-shadow)', stopOpacity: 0 }} />
          </radialGradient>
        </defs>
        <ellipse cx="50" cy="94" rx="24" ry="3.8" fill={`url(#${uid}-shadow)`} transform={f.shadow} opacity={f.shadowOpacity} />
        <g transform={f.body}>
          <circle cx="50" cy="50" r="50" fill={`url(#${uid}-glow)`} opacity={f.glow} transform={f.glowTransform} />
          <circle cx="50" cy="50" r="40" fill={`url(#${uid}-body)`} />
          <circle cx="50" cy="50" r="40" fill={`url(#${uid}-cool)`} opacity={f.cool} />
          <circle cx="50" cy="50" r="40" fill={`url(#${uid}-warm)`} opacity={f.warm} />
          <circle cx="50" cy="50" r="40" fill={`url(#${uid}-rim)`} opacity={f.rim} />
          <ellipse cx="36" cy="26" rx="14" ry="8" transform="rotate(-32 36 26)" fill={`url(#${uid}-spec)`} />
          <circle className="mascot__edge" cx="50" cy="50" r="39.6" />
          <g transform={f.face} opacity={f.eyeOpacity} className="mascot__eyes">
            <path d={f.left} />
            <path d={f.right} />
          </g>
          <g opacity={f.badge} transform={f.badgeTransform} className="mascot__badge">
            <rect x="10" y="13" width="22" height="12" rx="6" />
            <circle cx="15.6" cy="19" r="1.6" opacity={f.dots[0]} />
            <circle cx="21" cy="19" r="1.6" opacity={f.dots[1]} />
            <circle cx="26.4" cy="19" r="1.6" opacity={f.dots[2]} />
          </g>
        </g>
      </svg>
    </span>
  );
}
