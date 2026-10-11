import { motion, useReducedMotion } from 'motion/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { cx } from '@/ui/cx';

export interface Bar {
  key: string;
  label: string;
  /** Full label for tooltips / screen readers. */
  long: string;
  value: number;
  highlight?: boolean;
}

interface Props {
  bars: Bar[];
  color: string;
  goal?: number;
  goalLabel?: string;
  format: (v: number) => string;
  height?: number;
  title: string;
}

const M = { top: 22, bottom: 26, left: 4, right: 4 };

/** Single-series column chart: ≤24px bars, 4px rounded tops, per-bar hover/focus tooltip. */
export function BarChart({ bars, color, goal, goalLabel = 'Objetivo', format, height = 190, title }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e!.contentRect.width)));
    ro.observe(el);
    setWidth(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  const max = Math.max(goal ?? 0, ...bars.map((b) => b.value), 1) * 1.12;
  const innerH = height - M.top - M.bottom;
  const slot = (width - M.left - M.right) / Math.max(bars.length, 1);
  const bw = Math.min(24, slot * 0.62);
  const y = (v: number) => M.top + innerH - (v / max) * innerH;
  const labelEvery = bars.length > 14 ? Math.ceil(bars.length / 7) : 1;
  const a = active !== null ? bars[active] : undefined;

  return (
    <div className="bars" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} aria-hidden="true" className="bars__svg">
          <line x1={0} x2={width} y1={y(0)} y2={y(0)} className="bars__base" />
          {goal !== undefined && (
            <g className="bars__goal">
              <line x1={0} x2={width} y1={y(goal)} y2={y(goal)} />
            </g>
          )}
          {bars.map((b, i) => {
            const x = M.left + slot * i + (slot - bw) / 2;
            const h = Math.max(0, y(0) - y(b.value));
            const r = Math.min(4, h / 2, bw / 2);
            const top = y(b.value);
            const d = h > 0 ? `M${x},${y(0)} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${y(0)} Z` : '';
            const met = goal !== undefined && b.value >= goal;
            return (
              <g key={b.key}>
                {h > 0 && (
                  <motion.path
                    d={d}
                    style={{ fill: color, transformOrigin: `0px ${y(0)}px` }}
                    className={cx('bars__bar', active === i && 'is-active', met && 'is-met')}
                    initial={reduce ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 26, delay: reduce ? 0 : i * 0.03 }}
                  />
                )}
                {i % labelEvery === 0 && (
                  <text x={x + bw / 2} y={height - 8} textAnchor="middle" className={cx('bars__label', b.highlight && 'is-highlight')}>
                    {b.label}
                  </text>
                )}
              </g>
            );
          })}
          {goal !== undefined && (
            <text x={width - 2} y={y(goal) - 6} textAnchor="end" className="bars__goal-label">
              {goalLabel}
            </text>
          )}
        </svg>
      )}
      {/* Hit targets: wider than the bars, focusable for keyboard users. */}
      <div className="bars__hits" role="list" aria-label={title}>
        {bars.map((b, i) => (
          <button
            key={b.key}
            type="button"
            role="listitem"
            className="bars__hit"
            style={{ left: M.left + slot * i, width: slot }}
            aria-label={`${b.long}: ${format(b.value)}`}
            onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(i)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            onClick={() => setActive((cur) => (cur === i ? null : i))}
          />
        ))}
      </div>
      {a && active !== null && (
        <div
          className="bars__tip glass glass--sheet"
          style={{ left: Math.min(Math.max(M.left + slot * active + slot / 2, 70), width - 70), top: Math.max(0, y(a.value) - 58) }}
          role="tooltip"
        >
          <strong>{format(a.value)}</strong>
          <span>{a.long}</span>
        </div>
      )}
    </div>
  );
}
