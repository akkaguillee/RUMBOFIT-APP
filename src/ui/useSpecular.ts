import { useEffect, type RefObject } from 'react';

const finePointer = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

/**
 * Moves the glass specular highlight with the pointer by updating two CSS
 * custom properties (--mx / --my). Throttled to one update per frame and
 * disabled on touch devices.
 */
export function useSpecular(ref: RefObject<HTMLElement | null>, enabled = true): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || !finePointer) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      frame = 0;
      el.style.setProperty('--mx', `${x}px`);
      el.style.setProperty('--my', `${y}px`);
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      x = e.clientX - r.left;
      y = e.clientY - r.top;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      el.style.removeProperty('--mx');
      el.style.removeProperty('--my');
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref, enabled]);
}
