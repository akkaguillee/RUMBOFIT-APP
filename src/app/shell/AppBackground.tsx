import { useEffect, useRef, type RefObject } from 'react';

type RGB = [number, number, number];

interface Ripple {
  x: number;
  y: number;
  start: number;
}

const RIPPLE_LIFE = 1400; // ms
const RIPPLE_SPEED = 0.62; // px per ms
const LENS_RADIUS = 150;

function parseColor(value: string, fallback: RGB): RGB {
  const v = value.trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /rgba?\(([^)]+)\)/.exec(v);
  if (rgb) {
    const [r, g, b] = rgb[1]!.split(/[ ,]+/).map(Number);
    if ([r, g, b].every((c) => Number.isFinite(c))) return [r!, g!, b!];
  }
  return fallback;
}

/**
 * Interactive dot field drawn on a canvas behind the glass. The pointer (or
 * finger) acts as a liquid lens: nearby dots swell, light up in the accent
 * colour and bulge outward, and a soft light follows it with inertia. Taps
 * send a shockwave through the grid. Seen through the frosted cards, the
 * light and waves read as refraction inside the glass.
 *
 * The loop only runs while something is moving; at rest the field is a
 * single static frame, so it costs nothing when the app is idle.
 */
function useInteractiveField(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const root = document.documentElement;
    const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');

    let w = 0;
    let h = 0;
    let dpr = 1;
    let gap = 28;
    let cols = 0;
    let rows = 0;
    let ox = 0;
    let oy = 0;

    let accent: RGB = [139, 92, 246];
    let dark = true;
    let enabled = true;

    // Pointer state: target (raw), smoothed position and lens strength.
    const target = { x: -9999, y: -9999 };
    const pos = { x: -9999, y: -9999 };
    let strength = 0;
    let strengthTarget = 0;
    let lastInput = 0;
    let isTouch = false;
    let vx = 0;
    let vy = 0;
    const ripples: Ripple[] = [];

    let frame = 0;
    let last = 0;

    const readTheme = () => {
      const cs = getComputedStyle(root);
      accent = parseColor(cs.getPropertyValue('--acc'), accent);
      dark = root.dataset.theme !== 'light';
      const wasEnabled = enabled;
      enabled = !reduceMq.matches && !root.classList.contains('lite');
      if (wasEnabled && !enabled) {
        // Effects turned off mid-interaction: stop and leave a clean static field.
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        ripples.length = 0;
        strength = strengthTarget = 0;
      }
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      gap = w < 640 ? 26 : 30;
      cols = Math.ceil(w / gap) + 1;
      rows = Math.ceil(h / gap) + 1;
      ox = (w - (cols - 1) * gap) / 2;
      oy = (h - (rows - 1) * gap) / 2;
    };

    const draw = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const [ar, ag, ab] = accent;

      // Light that follows the pointer (blurred further by the glass above it).
      if (strength > 0.01) {
        const speed = Math.min(Math.hypot(vx, vy) * 18, 90);
        const angle = Math.atan2(vy, vx);
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(angle);
        ctx.scale(1 + speed / 220, 1 - speed / 520); // liquid stretch along the motion
        const r = 230;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, `rgba(${ar},${ag},${ab},${(dark ? 0.26 : 0.2) * strength})`);
        g.addColorStop(0.45, `rgba(${ar},${ag},${ab},${(dark ? 0.1 : 0.07) * strength})`);
        g.addColorStop(1, `rgba(${ar},${ag},${ab},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Live ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        if (now - ripples[i]!.start > RIPPLE_LIFE) ripples.splice(i, 1);
      }

      // At rest the field is a faint texture (it sits behind text); it only shows up around the finger or pointer.
      const baseAlpha = dark ? 0.032 : 0.05;
      const base = dark ? '255,255,255' : '20,18,27';
      ctx.fillStyle = `rgba(${base},${baseAlpha})`;
      ctx.beginPath();
      const lit: [number, number, number, number][] = [];
      const lensR2 = LENS_RADIUS * LENS_RADIUS;

      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          let x = ox + i * gap;
          let y = oy + j * gap;
          let energy = 0;

          if (strength > 0.01) {
            const dx = x - pos.x;
            const dy = y - pos.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < lensR2 * 4) {
              const f = Math.exp(-d2 / lensR2) * strength;
              const d = Math.sqrt(d2) || 1;
              x += (dx / d) * f * 16;
              y += (dy / d) * f * 16;
              energy += f;
            }
          }

          for (const rp of ripples) {
            const age = now - rp.start;
            const radius = age * RIPPLE_SPEED;
            const dx = x - rp.x;
            const dy = y - rp.y;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            const band = (d - radius) / 46;
            if (band > -3 && band < 3) {
              const amp = (1 - age / RIPPLE_LIFE) ** 1.6;
              const f = Math.exp(-band * band) * amp;
              x += (dx / d) * f * 10;
              y += (dy / d) * f * 10;
              energy += f * 0.9;
            }
          }

          if (energy > 0.04) lit.push([x, y, Math.min(energy, 1), 0]);
          else ctx.rect(x - 0.75, y - 0.75, 1.5, 1.5);
        }
      }
      ctx.fill();

      // Energised dots: bigger, brighter, tinted with the accent.
      for (const [x, y, e] of lit) {
        const r = 0.9 + e * 1.7;
        const mix = Math.min(1, e * 1.3);
        const cr = Math.round((dark ? 255 : 20) * (1 - mix) + ar * mix);
        const cg = Math.round((dark ? 255 : 18) * (1 - mix) + ag * mix);
        const cb = Math.round((dark ? 255 : 27) * (1 - mix) + ab * mix);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${baseAlpha + e * 0.7})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = Math.min(64, now - (last || now));
      last = now;
      const follow = 1 - Math.exp(-dt / 70);
      const px = pos.x;
      const py = pos.y;
      if (pos.x < -9000) {
        pos.x = target.x;
        pos.y = target.y;
      } else {
        pos.x += (target.x - pos.x) * follow;
        pos.y += (target.y - pos.y) * follow;
      }
      vx = dt ? (pos.x - px) / dt : 0;
      vy = dt ? (pos.y - py) / dt : 0;

      // Touch lenses fade once the finger lifts; the mouse lens stays while hovering.
      if (isTouch && now - lastInput > 900) strengthTarget = 0;
      strength += (strengthTarget - strength) * (1 - Math.exp(-dt / 160));

      draw(now);

      const moving = Math.abs(target.x - pos.x) > 0.3 || Math.abs(target.y - pos.y) > 0.3;
      const fading = Math.abs(strengthTarget - strength) > 0.005;
      if (moving || fading || ripples.length || (isTouch && strengthTarget > 0)) schedule();
      else last = 0;
    };

    const schedule = () => {
      if (!frame && enabled && !document.hidden) frame = requestAnimationFrame(tick);
    };

    const redrawStatic = () => {
      if (!frame) draw(performance.now());
    };

    const point = (x: number, y: number, touch: boolean) => {
      if (!enabled) return;
      isTouch = touch;
      target.x = x;
      target.y = y;
      strengthTarget = 1;
      lastInput = performance.now();
      schedule();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') point(e.clientX, e.clientY, false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!enabled) return;
      if (ripples.length > 4) ripples.shift();
      ripples.push({ x: e.clientX, y: e.clientY, start: performance.now() });
      point(e.clientX, e.clientY, e.pointerType === 'touch');
    };
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) point(t.clientX, t.clientY, true);
    };
    // Only hover-capable pointers "leave"; touch fires pointerleave right after
    // every tap, and touch lenses already fade on their own timer.
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      strengthTarget = 0;
      schedule();
    };

    readTheme();
    resize();
    redrawStatic();

    const onResize = () => {
      resize();
      redrawStatic();
    };
    const mo = new MutationObserver(() => {
      readTheme();
      redrawStatic();
      schedule();
    });
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-accent', 'class'] });
    const onMotionPref = () => {
      readTheme();
      redrawStatic();
    };
    const onVisibility = () => {
      if (!document.hidden) redrawStatic();
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('touchstart', onTouch, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', onVisibility);
    reduceMq.addEventListener('change', onMotionPref);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      mo.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('touchstart', onTouch);
      window.removeEventListener('touchmove', onTouch);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      reduceMq.removeEventListener('change', onMotionPref);
    };
  }, [canvasRef]);
}

/**
 * Fixed ambient layer: drifting accent aurora, an interactive dot field and
 * fine grain give the glass something alive to refract.
 */
export function AppBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useInteractiveField(canvasRef);
  return (
    <div className="app-bg" aria-hidden="true">
      <div className="app-bg__orb app-bg__orb--1" />
      <div className="app-bg__orb app-bg__orb--2" />
      <div className="app-bg__orb app-bg__orb--3" />
      <div className="app-bg__aurora" />
      <canvas ref={canvasRef} className="app-bg__field" />
      <div className="app-bg__vignette" />
      <div className="app-bg__grain" />
    </div>
  );
}
