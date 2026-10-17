import { useMemo } from 'react';
import { useCurrentFrame } from 'remotion';
import type { MascotExpression } from '../../src/features/mascot/expression';
import { MascotRig, type RigFrame } from '../../src/features/mascot/rig';
import '../../src/features/mascot/mascot.css';

/**
 * The official Rumbi, rendered frame by frame. It uses the app's own rig
 * (src/features/mascot/rig.ts): the rig is deterministic, so every video
 * frame re-simulates it from the start of the sequence at a fixed step and
 * scripted events (expression changes, glances, taps) land on exact frames.
 */
export type RumbiEvent =
  | { at: number; expr: MascotExpression }
  | { at: number; look: [number, number] }
  | { at: number; tap: true }
  | { at: number; press: true };

const STEPS_PER_FRAME = 2;

function simulate(expression: MascotExpression, events: RumbiEvent[], frame: number, fps: number, seed: number): RigFrame {
  const rig = new MascotRig(expression, { wake: true, seed });
  // Mark Rumbi as "seen" without starting its own requestAnimationFrame loop.
  rig.setPageVisible(false);
  rig.setVisible(true);
  const dt = 1 / fps / STEPS_PER_FRAME;
  for (let f = 0; f <= frame; f++) {
    for (const e of events) {
      if (e.at !== f) continue;
      if ('expr' in e) rig.setExpression(e.expr);
      else if ('look' in e) rig.lookAt(e.look[0], e.look[1]);
      else if ('tap' in e) rig.tap();
      else if ('press' in e) rig.press();
    }
    if (f < frame) for (let s = 0; s < STEPS_PER_FRAME; s++) rig.step(dt);
  }
  return rig.frame();
}

interface Props {
  size: number;
  expression?: MascotExpression;
  events?: RumbiEvent[];
  seed?: number;
  /** Frames to wait before the rig starts (it stays asleep until then). */
  delay?: number;
  accent?: string;
  /** Light-theme shading (the values of mascot.css under :root[data-theme='light']). */
  light?: boolean;
}

const LIGHT_VARS = {
  '--mascot-mid': '#e9e7f0',
  '--mascot-lo': '#c3bfd0',
  '--mascot-edge': '#a19bb3',
  '--mascot-ink': '#15121a',
  '--mascot-rim-mid': '0.3',
  '--mascot-rim-edge': '0.85',
  '--mascot-glow-a': '0.34',
  '--mascot-glow-b': '0.14',
  '--mascot-shadow': '#2a1d52',
  '--mascot-shadow-a': '0.32',
};

export function Rumbi({ size, expression = 'neutral', events = [], seed = 11, delay = 0, accent = '#e53945', light = false }: Props) {
  const frame = Math.max(0, useCurrentFrame() - delay);
  const f = useMemo(() => simulate(expression, events, frame, 30, seed), [expression, events, frame, seed]);
  const uid = `r${seed}`;
  return (
    <span
      className="mascot"
      style={{ ['--acc' as string]: accent, ['--surface-solid' as string]: light ? '#ffffff' : '#13141b', ['--mascot-size' as string]: `${size}px`, width: size, height: size, ...(light ? LIGHT_VARS : {}) }}
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
