import { useReducedMotion } from 'motion/react';
import { useEffect, useId, useImperativeHandle, useRef, useState, type CSSProperties, type Ref, type RefObject } from 'react';
import { cx } from '@/ui/cx';
import type { MascotExpression } from './expression';
import { MascotRig, type RigFrame, type RigRenderer, type TapReaction } from './rig';
import './mascot.css';

export const MASCOT_NAME = 'Rumbi, tu compañero de RUMBO';

/** Lets a parent that owns the pointer (the floating assistant) play Rumbi's reactions. */
export interface MascotHandle {
  press: () => void;
  cancelPress: () => void;
  tap: () => TapReaction | undefined;
  lookAt: (nx: number, ny: number) => void;
}

interface Props {
  expression: MascotExpression;
  /** Rendered size in px (the body is 80 % of it; glow and hops may overflow). */
  size?: number;
  className?: string;
  /** Tap reactions and a gaze that follows the pointer or finger. Renders a button. */
  interactive?: boolean;
  /** Gaze follows the pointer or finger (defaults to `interactive`). */
  follow?: boolean;
  /** Holds the current frame (no breathing, blinks or glances) until unpaused. */
  paused?: boolean;
  /** Accessible name. */
  label?: string;
  onTap?: (reaction: TapReaction) => void;
  handle?: Ref<MascotHandle>;
}

type Part = 'body' | 'shadow' | 'face' | 'left' | 'right' | 'glow' | 'rim' | 'warm' | 'cool' | 'badge' | 'd0' | 'd1' | 'd2';

/** Writes a frame into the SVG (nodes marked with data-part), touching only the attributes that changed. */
function domRenderer(root: Element): RigRenderer {
  const last = new Map<string, string>();
  const nodes = new Map<string, Element | null>();
  const set = (key: Part, attr: string, value: string | number) => {
    if (!nodes.has(key)) nodes.set(key, root.querySelector(`[data-part="${key}"]`));
    const el = nodes.get(key);
    if (!el) return;
    const v = typeof value === 'number' ? value.toFixed(3) : value;
    const id = `${key}.${attr}`;
    if (last.get(id) === v) return;
    last.set(id, v);
    el.setAttribute(attr, v);
  };
  return {
    render(f: RigFrame) {
      set('body', 'transform', f.body);
      set('shadow', 'transform', f.shadow);
      set('shadow', 'opacity', f.shadowOpacity);
      set('face', 'transform', f.face);
      set('face', 'opacity', f.eyeOpacity);
      set('left', 'd', f.left);
      set('right', 'd', f.right);
      set('glow', 'opacity', f.glow);
      set('glow', 'transform', f.glowTransform);
      set('rim', 'opacity', f.rim);
      set('warm', 'opacity', f.warm);
      set('cool', 'opacity', f.cool);
      set('badge', 'opacity', f.badge);
      set('badge', 'transform', f.badgeTransform);
      set('d0', 'opacity', f.dots[0]);
      set('d1', 'opacity', f.dots[1]);
      set('d2', 'opacity', f.dots[2]);
    },
  };
}

/** Each Rumbi on screen gets its own (deterministic) blink and glance rhythm, derived from its React id. */
function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Rumbi, RUMBO's coach: a glossy pearl sphere whose only features are two
 * pill-shaped eyes. It shows its mood through the eyes, a soft tint and small
 * movements: blinks at irregular intervals, breathing, glances, a gaze that
 * follows the pointer, squash and stretch on taps and a flicker when its eyes
 * switch on. Everything is driven by the JavaScript rig in `rig.ts` and only
 * runs while Rumbi is on screen; with reduced motion it holds a still face.
 * The rim light and glow follow the user's accent colour.
 */
export function Mascot({ expression, size = 72, className, interactive = false, follow = interactive, paused = false, label = MASCOT_NAME, onTap, handle }: Props) {
  const uid = useId().replace(/:/g, '');
  const reduce = !!useReducedMotion();
  const root = useRef<HTMLElement>(null);
  const rig = useRef<MascotRig | null>(null);
  const onScreen = useRef(false);
  const pausedRef = useRef(paused);
  useImperativeHandle(
    handle,
    () => ({
      press: () => rig.current?.press(),
      cancelPress: () => rig.current?.cancelPress(),
      tap: () => rig.current?.tap(),
      lookAt: (nx, ny) => rig.current?.lookAt(nx, ny),
    }),
    [],
  );
  // First paint: the frame the rig starts from (eyes still off until Rumbi is seen).
  const [first] = useState(() => new MascotRig(expression, { reduced: reduce, wake: !reduce }).frame());
  const seed = seedOf(uid);
  const latest = useRef({ expression, reduce, onTap });
  useEffect(() => {
    latest.current = { expression, reduce, onTap };
  });

  // The rig lives as long as the component; it pauses itself off screen and in hidden tabs.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const r = new MascotRig(latest.current.expression, { reduced: latest.current.reduce, wake: !latest.current.reduce, seed });
    rig.current = r;
    r.attach(domRenderer(el));
    r.setPageVisible(!document.hidden);
    const onVisibility = () => r.setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    let io: IntersectionObserver | null = null;
    const show = (visible: boolean) => {
      onScreen.current = visible;
      r.setVisible(visible && !pausedRef.current);
    };
    if (typeof IntersectionObserver === 'undefined') show(true);
    else {
      io = new IntersectionObserver(([entry]) => show(!!entry?.isIntersecting), { rootMargin: '24px' });
      io.observe(el);
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      io?.disconnect();
      r.destroy();
      rig.current = null;
    };
  }, [seed]);

  useEffect(() => rig.current?.setExpression(expression), [expression]);
  useEffect(() => rig.current?.setReduced(reduce), [reduce]);
  useEffect(() => {
    pausedRef.current = paused;
    rig.current?.setVisible(onScreen.current && !paused);
  }, [paused]);

  // The gaze follows the pointer (or a finger on the screen) while Rumbi is running.
  useEffect(() => {
    if (!follow || reduce) return;
    const onMove = (e: PointerEvent) => {
      const r = rig.current;
      const el = root.current;
      if (!r?.running || !el) return;
      const box = el.getBoundingClientRect();
      const dx = e.clientX - (box.left + box.width / 2);
      const dy = e.clientY - (box.top + box.height / 2);
      r.lookAt(Math.tanh(dx / 160), Math.tanh(dy / 140));
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
    };
  }, [follow, reduce]);

  const svg = (
    <svg className="mascot__svg" viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" focusable="false">
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

      <ellipse
        data-part="shadow"
        cx="50"
        cy="94"
        rx="24"
        ry="3.8"
        fill={`url(#${uid}-shadow)`}
        transform={first.shadow}
        opacity={first.shadowOpacity}
      />
      <g data-part="body" transform={first.body}>
        <circle
          data-part="glow"
          cx="50"
          cy="50"
          r="50"
          fill={`url(#${uid}-glow)`}
          opacity={first.glow}
          transform={first.glowTransform}
        />
        <circle cx="50" cy="50" r="40" fill={`url(#${uid}-body)`} />
        <circle data-part="cool" cx="50" cy="50" r="40" fill={`url(#${uid}-cool)`} opacity={first.cool} />
        <circle data-part="warm" cx="50" cy="50" r="40" fill={`url(#${uid}-warm)`} opacity={first.warm} />
        <circle data-part="rim" cx="50" cy="50" r="40" fill={`url(#${uid}-rim)`} opacity={first.rim} />
        <ellipse cx="36" cy="26" rx="14" ry="8" transform="rotate(-32 36 26)" fill={`url(#${uid}-spec)`} />
        <circle className="mascot__edge" cx="50" cy="50" r="39.6" />
        <g data-part="face" transform={first.face} opacity={first.eyeOpacity} className="mascot__eyes">
          <path data-part="left" d={first.left} />
          <path data-part="right" d={first.right} />
        </g>
        <g data-part="badge" opacity={first.badge} transform={first.badgeTransform} className="mascot__badge">
          <rect x="10" y="13" width="22" height="12" rx="6" />
          <circle data-part="d0" cx="15.6" cy="19" r="1.6" opacity={first.dots[0]} />
          <circle data-part="d1" cx="21" cy="19" r="1.6" opacity={first.dots[1]} />
          <circle data-part="d2" cx="26.4" cy="19" r="1.6" opacity={first.dots[2]} />
        </g>
      </g>
    </svg>
  );

  if (!interactive) {
    return (
      <span ref={root as RefObject<HTMLSpanElement>} className={cx('mascot', className)} role="img" aria-label={label} style={{ '--mascot-size': `${size}px` } as CSSProperties}>
        {svg}
      </span>
    );
  }

  return (
    <button
      ref={root as RefObject<HTMLButtonElement>}
      type="button"
      className={cx('mascot mascot--interactive', className)}
      aria-label={label}
      style={{ '--mascot-size': `${size}px` } as CSSProperties}
      onPointerDown={() => rig.current?.press()}
      onPointerCancel={() => rig.current?.cancelPress()}
      onPointerLeave={() => rig.current?.cancelPress()}
      onClick={() => {
        const reaction = rig.current?.tap();
        if (reaction) latest.current.onTap?.(reaction);
      }}
    >
      {svg}
    </button>
  );
}

export default Mascot;
