import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

interface Props {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}

/** Counts smoothly to the new value whenever it changes. */
export function AnimatedNumber({ value, format = (n) => String(Math.round(n)), duration = 0.9, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef<number | null>(null);
  const reduce = useReducedMotion();
  const formatRef = useRef(format);
  useEffect(() => {
    formatRef.current = format;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = from.current ?? (reduce ? value : 0);
    from.current = value;
    if (reduce || start === value) {
      el.textContent = formatRef.current(value);
      return;
    }
    const controls = animate(start, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = formatRef.current(v);
      },
    });
    return () => controls.stop();
  }, [value, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
