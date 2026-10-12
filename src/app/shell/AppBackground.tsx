import { useEffect, useRef, type RefObject } from 'react';

const FAR_PARALLAX = 0.035;
const NEAR_PARALLAX = 0.08;
const MAX_SHIFT = 140; // px: deep pages never drag the light out of view

interface Layers {
  far: RefObject<HTMLDivElement | null>;
  near: RefObject<HTMLDivElement | null>;
  light: RefObject<HTMLDivElement | null>;
}

/**
 * Depth and ambient light. While scrolling, the two light layers move at
 * different (very small) rates, which gives the background depth without
 * drawing attention. With a mouse, a faint light follows the pointer with
 * inertia. Everything is a transform on a few elements; the frame loop only
 * runs while something is actually moving and stops for reduced motion and
 * low-power mode.
 */
function useAmbientMotion({ far, near, light }: Layers) {
  useEffect(() => {
    const root = document.documentElement;
    const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fineMq = window.matchMedia('(hover: hover) and (pointer: fine)');
    let enabled = false;

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 3, a: 0 };
    const cur = { ...target };
    let frame = 0;
    let last = 0;

    const applyScroll = () => {
      const y = enabled ? Math.min(window.scrollY, MAX_SHIFT / FAR_PARALLAX) : 0;
      if (far.current) far.current.style.transform = `translate3d(0, ${(-y * FAR_PARALLAX).toFixed(1)}px, 0)`;
      if (near.current) near.current.style.transform = `translate3d(0, ${(-Math.min(y * NEAR_PARALLAX, MAX_SHIFT)).toFixed(1)}px, 0)`;
    };

    const applyLight = () => {
      const el = light.current;
      if (!el) return;
      el.style.transform = `translate3d(${cur.x.toFixed(1)}px, ${cur.y.toFixed(1)}px, 0)`;
      el.style.opacity = cur.a.toFixed(3);
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = Math.min(64, now - (last || now));
      last = now;
      const k = 1 - Math.exp(-dt / 220); // slow, liquid follow
      cur.x += (target.x - cur.x) * k;
      cur.y += (target.y - cur.y) * k;
      cur.a += (target.a - cur.a) * (1 - Math.exp(-dt / 400));
      applyLight();
      const moving = Math.abs(target.x - cur.x) > 0.4 || Math.abs(target.y - cur.y) > 0.4 || Math.abs(target.a - cur.a) > 0.004;
      if (moving) schedule();
      else last = 0;
    };

    const schedule = () => {
      if (!frame && !document.hidden) frame = requestAnimationFrame(tick);
    };

    let scrollFrame = 0;
    const onScroll = () => {
      if (!enabled || scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        applyScroll();
      });
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!enabled || !fineMq.matches || e.pointerType !== 'mouse') return;
      target.x = e.clientX;
      target.y = e.clientY;
      target.a = 1;
      schedule();
    };
    const onLeave = () => {
      target.a = 0;
      schedule();
    };

    const refresh = () => {
      enabled = !reduceMq.matches && !root.classList.contains('lite');
      if (!enabled) {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        cur.a = target.a = 0;
        applyLight();
      }
      applyScroll();
    };

    refresh();
    const mo = new MutationObserver(refresh);
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    root.addEventListener('pointerleave', onLeave);
    reduceMq.addEventListener('change', refresh);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
      mo.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerleave', onLeave);
      reduceMq.removeEventListener('change', refresh);
    };
  }, [far, near, light]);
}

/**
 * Fixed ambient layer behind the glass: a deep base gradient, soft pools of
 * accent light drifting very slowly, a faint light from above and fine grain
 * (which also prevents banding in the gradients). It supports the content and
 * never competes with it: no particles, no hard edges.
 */
export function AppBackground() {
  const far = useRef<HTMLDivElement>(null);
  const near = useRef<HTMLDivElement>(null);
  const light = useRef<HTMLDivElement>(null);
  useAmbientMotion({ far, near, light });
  return (
    <div className="app-bg" aria-hidden="true">
      <div ref={far} className="app-bg__layer">
        <div className="app-bg__orb app-bg__orb--1" />
        <div className="app-bg__orb app-bg__orb--2" />
      </div>
      <div ref={near} className="app-bg__layer">
        <div className="app-bg__orb app-bg__orb--3" />
      </div>
      <div className="app-bg__sky" />
      <div ref={light} className="app-bg__light" />
      <div className="app-bg__vignette" />
      <div className="app-bg__grain" />
    </div>
  );
}
