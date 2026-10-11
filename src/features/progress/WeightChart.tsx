import { curveMonotoneX, line as d3line, area as d3area } from 'd3-shape';
import { X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { formatDate, keyToTimestamp, todayKey, type DateKey } from '@/domain/dates';
import type { Units } from '@/domain/types';
import { formatNumber, formatSigned, kgToDisplay, weightUnit } from '@/domain/units';
import type { RangeId, WeightPoint } from '@/domain/weight';
import { cx } from '@/ui/cx';

interface Props {
  points: WeightPoint[];
  range: RangeId;
  rangeStart: DateKey | null;
  units: Units;
  goalKg?: number;
  startKg?: number;
  showTrend: boolean;
}

const M = { top: 20, right: 14, bottom: 30, left: 46 };

function niceStep(span: number, target = 4): number {
  const raw = span / target;
  const steps = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50];
  return steps.find((s) => s >= raw) ?? 50;
}

const dayMs = 86_400_000;

function axisLabel(t: number, range: RangeId, spanDays: number): string {
  const d = new Date(t);
  if (range === '7d') return new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(d).replace('.', '');
  if (spanDays <= 120) return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(d).replace('.', '');
  return new Intl.DateTimeFormat('es-ES', { month: 'short', year: spanDays > 400 ? '2-digit' : undefined }).format(d).replace('.', '');
}

/**
 * Interactive weight chart. Every tooltip corresponds to a real stored record;
 * the smoothed trend is drawn separately and never presented as a measurement.
 */
export function WeightChart({ points, range, rangeStart, units, goalKg, startKg, showTrend }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);
  const [tipSize, setTipSize] = useState({ w: 220, h: 140 });
  const reduce = useReducedMotion();
  const gradId = useId();
  const unit = weightUnit(units);
  const conv = useCallback((kg: number) => kgToDisplay(kg, units), [units]);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry!.contentRect.width)));
    ro.observe(el);
    setWidth(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  // Selection belongs to a dataset; reset it when the range changes.
  const [prevPoints, setPrevPoints] = useState(points);
  if (prevPoints !== points) {
    setPrevPoints(points);
    setActive(null);
    setPinned(false);
  }

  const narrow = width > 0 && width < 520;
  const height = narrow ? 250 : 300;
  const innerW = Math.max(10, width - M.left - M.right);
  const innerH = height - M.top - M.bottom;

  const geo = useMemo(() => {
    if (!points.length || width === 0) return null;
    const today = todayKey();
    const lastT = points[points.length - 1]!.t;
    const firstT = points[0]!.t;
    let x0 = rangeStart ? keyToTimestamp(rangeStart) - dayMs / 2 : firstT;
    let x1 = rangeStart ? Math.max(keyToTimestamp(today) + dayMs / 2, lastT) : lastT;
    if (x1 - x0 < dayMs * 2) {
      x0 -= dayMs * 2;
      x1 += dayMs * 2;
    }
    const values = points.flatMap((p) => (showTrend ? [conv(p.kg), conv(p.trend)] : [conv(p.kg)]));
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    const span0 = Math.max(hi - lo, 1);
    const goal = goalKg !== undefined ? conv(goalKg) : undefined;
    // Include the goal line when it is reasonably close to the data.
    const goalInView = goal !== undefined && (goal >= lo - span0 * 1.5 && goal <= hi + span0 * 1.5);
    if (goalInView && goal !== undefined) {
      lo = Math.min(lo, goal);
      hi = Math.max(hi, goal);
    }
    const pad = Math.max((hi - lo) * 0.12, 0.6);
    lo -= pad;
    hi += pad;
    const step = niceStep(hi - lo);
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;
    const ticks: number[] = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(2)));

    const sx = (t: number) => M.left + ((t - x0) / (x1 - x0)) * innerW;
    const sy = (v: number) => M.top + (1 - (v - lo) / (hi - lo)) * innerH;

    const spanDays = (x1 - x0) / dayMs;
    const labelCount = Math.max(2, Math.min(6, Math.floor(innerW / 76)));
    const xTicks = Array.from({ length: labelCount }, (_, i) => x0 + ((x1 - x0) * (i + 0.5)) / labelCount);

    const line = d3line<WeightPoint>()
      .x((p) => sx(p.t))
      .y((p) => sy(conv(p.kg)))
      .curve(curveMonotoneX);
    const trend = d3line<WeightPoint>()
      .x((p) => sx(p.t))
      .y((p) => sy(conv(p.trend)))
      .curve(curveMonotoneX);
    const area = d3area<WeightPoint>()
      .x((p) => sx(p.t))
      .y0(M.top + innerH)
      .y1((p) => sy(conv(p.kg)))
      .curve(curveMonotoneX);

    return {
      sx,
      sy,
      ticks,
      xTicks,
      spanDays,
      linePath: line(points) ?? '',
      trendPath: trend(points) ?? '',
      areaPath: area(points) ?? '',
      goal,
      goalInView,
      goalAbove: goal !== undefined && !goalInView ? goal > hi : false,
    };
  }, [points, width, rangeStart, showTrend, goalKg, conv, innerW, innerH]);

  // Nearest record by x; records sharing (almost) the same x — e.g. several
  // in one day — are told apart by vertical distance to the pointer.
  const nearest = useCallback(
    (clientX: number, clientY?: number) => {
      if (!geo || !wrapRef.current) return null;
      const r = wrapRef.current.getBoundingClientRect();
      const x = clientX - r.left;
      const y = clientY === undefined ? null : clientY - r.top;
      let best = 0;
      let bestDx = Infinity;
      let bestDy = Infinity;
      points.forEach((p, i) => {
        const dx = Math.abs(geo.sx(p.t) - x);
        const dy = y === null ? 0 : Math.abs(geo.sy(conv(p.kg)) - y);
        if (dx < bestDx - 3 || (Math.abs(dx - bestDx) <= 3 && dy < bestDy)) {
          bestDx = dx;
          bestDy = dy;
          best = i;
        }
      });
      return best;
    },
    [geo, points, conv],
  );

  // Mouse: hover follows the cursor. Touch/pen: a tap pins the tooltip and
  // dragging scrubs through the records until the user taps elsewhere.
  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' && !pinned) return;
    const i = nearest(e.clientX, e.clientY);
    if (i !== null) setActive(i);
  };

  const onPointerDown = (e: PointerEvent) => {
    const i = nearest(e.clientX, e.clientY);
    if (i === null) return;
    setActive(i);
    if (e.pointerType !== 'mouse') setPinned(true);
  };

  // Tap/click outside clears a pinned tooltip.
  useEffect(() => {
    if (!pinned) return;
    const onDoc = (e: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setPinned(false);
        setActive(null);
      }
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [pinned]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (!points.length) return;
    const last = points.length - 1;
    let next = active ?? last;
    if (e.key === 'ArrowLeft') next = Math.max(0, (active ?? last + 1) - 1);
    else if (e.key === 'ArrowRight') next = Math.min(last, (active ?? -1) + 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else if (e.key === 'Escape') {
      setActive(null);
      setPinned(false);
      return;
    } else return;
    e.preventDefault();
    setActive(next);
    setPinned(true);
  };

  useLayoutEffect(() => {
    if (tipRef.current) {
      const r = tipRef.current.getBoundingClientRect();
      setTipSize((s) => (Math.abs(s.w - r.width) > 1 || Math.abs(s.h - r.height) > 1 ? { w: r.width, h: r.height } : s));
    }
  }, [active]);

  const p = active !== null ? points[active] : undefined;
  // Placement: above the point if it fits, otherwise below, otherwise beside it.
  let tip: { left: number; top: number; below: boolean } | null = null;
  if (p && geo) {
    const px = geo.sx(p.t);
    const py = geo.sy(conv(p.kg));
    const gap = 14;
    const clampX = (x: number) => Math.min(Math.max(x, 0), width - tipSize.w);
    if (py - tipSize.h - gap >= 0) {
      tip = { left: clampX(px - tipSize.w / 2), top: py - tipSize.h - gap, below: false };
    } else if (py + gap + tipSize.h <= height - M.bottom) {
      tip = { left: clampX(px - tipSize.w / 2), top: py + gap, below: true };
    } else if (px + gap + tipSize.w <= width || px - gap - tipSize.w >= 0) {
      const right = px + gap + tipSize.w <= width;
      tip = {
        left: right ? px + gap : px - gap - tipSize.w,
        top: Math.min(Math.max(py - tipSize.h / 2, 0), Math.max(0, height - M.bottom - tipSize.h)),
        below: false,
      };
    } else {
      // Narrow screens: use the band of the plot opposite to the point; the
      // crosshair keeps the link with the selected record.
      const upper = py < (height - M.bottom) / 2;
      tip = { left: clampX(px - tipSize.w / 2), top: upper ? Math.max(0, height - M.bottom - tipSize.h) : 0, below: upper };
    }
  }

  // Show every marker only when there is room for them (≥ 14 px apart on average).
  const dense = points.length > 1 && innerW / points.length < 14;
  const announce = p
    ? `${formatDate.full(p.entry.date)}${p.entry.time ? `, ${p.entry.time}` : ''}: ${formatNumber(conv(p.kg), 1)} ${unit}` +
      (p.deltaPrev !== null ? `, ${formatSigned(conv(p.deltaPrev), 1, unit)} respecto al registro anterior` : '')
    : '';

  const close = () => {
    setPinned(false);
    setActive(null);
  };

  const details = p ? (
    <>
      <div className="wchart__tip-head">
        <span className="wchart__tip-date">
          {formatDate.full(p.entry.date)}
          {p.entry.time ? ` · ${p.entry.time}` : ''}
        </span>
        {pinned && (
          <button type="button" className="wchart__tip-close" aria-label="Cerrar detalle" onPointerDown={(e) => e.stopPropagation()} onClick={close}>
            <X />
          </button>
        )}
      </div>
      <div className="wchart__tip-body">
        <div className="wchart__tip-value">
          {formatNumber(conv(p.kg), 1)}
          <small>{unit}</small>
        </div>
        <dl className="wchart__tip-rows">
          <div>
            <dt>vs. anterior</dt>
            <dd>{p.deltaPrev === null ? 'Primer registro' : formatSigned(conv(p.deltaPrev), 1, unit)}</dd>
          </div>
          {startKg !== undefined && p.deltaStart !== null && (
            <div>
              <dt>vs. inicial</dt>
              <dd>{formatSigned(conv(p.kg - startKg), 1, unit)}</dd>
            </div>
          )}
          {p.progress !== null && (
            <div>
              <dt>Progreso</dt>
              <dd>{Math.round(Math.max(0, p.progress) * 100)} % del objetivo</dd>
            </div>
          )}
        </dl>
      </div>
      {p.entry.note && <p className="wchart__tip-note">“{p.entry.note}”</p>}
    </>
  ) : null;

  return (
    <div className="wchart" ref={rootRef}>
      <div
        ref={wrapRef}
        className={cx('wchart__plot', pinned && 'is-pinned')}
        style={{ height }}
        tabIndex={0}
        role="group"
        aria-roledescription="gráfica"
        aria-label={`Evolución del peso: ${points.length} registros. Usa las flechas izquierda y derecha para recorrerlos.`}
        onKeyDown={onKeyDown}
        onFocus={() => active === null && points.length && setActive(points.length - 1)}
        onBlur={() => !pinned && setActive(null)}
        onPointerMove={onPointerMove}
        onPointerLeave={(e) => e.pointerType === 'mouse' && !pinned && setActive(null)}
        onPointerDown={onPointerDown}
      >
        {geo && (
          <svg width={width} height={height} className="wchart__svg" aria-hidden="true">
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: 'var(--accent)', stopOpacity: 0.22 }} />
                <stop offset="100%" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            {geo.ticks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={width - M.right} y1={geo.sy(t)} y2={geo.sy(t)} className="wchart__grid" />
                <text x={M.left - 10} y={geo.sy(t)} className="wchart__tick" textAnchor="end" dominantBaseline="middle">
                  {formatNumber(t, 1)}
                </text>
              </g>
            ))}
            {geo.xTicks.map((t) => (
              <text key={t} x={geo.sx(t)} y={height - 8} className="wchart__tick" textAnchor="middle">
                {axisLabel(t, range, geo.spanDays)}
              </text>
            ))}

            {geo.goal !== undefined && geo.goalInView && (
              <g className="wchart__goal">
                <line x1={M.left} x2={width - M.right} y1={geo.sy(geo.goal)} y2={geo.sy(geo.goal)} />
                <rect x={width - M.right - 76} y={geo.sy(geo.goal) - 11} width={76} height={22} rx={11} />
                <text x={width - M.right - 38} y={geo.sy(geo.goal) + 1} textAnchor="middle" dominantBaseline="middle">
                  Objetivo
                </text>
              </g>
            )}

            <motion.path
              key={`a-${range}`}
              d={geo.areaPath}
              fill={`url(#${gradId})`}
              initial={{ opacity: reduce ? 1 : 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            />
            {showTrend && points.length > 2 && (
              <motion.path
                key={`t-${range}`}
                d={geo.trendPath}
                className="wchart__trend"
                initial={{ pathLength: reduce ? 1 : 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
              />
            )}
            <motion.path
              key={`l-${range}`}
              d={geo.linePath}
              className="wchart__line"
              initial={{ pathLength: reduce ? 1 : 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            />

            {p && <line x1={geo.sx(p.t)} x2={geo.sx(p.t)} y1={M.top} y2={M.top + innerH} className="wchart__cross" />}

            {points.map((pt, i) => {
              const isActive = i === active;
              const isLast = i === points.length - 1;
              if (dense && !isActive && !isLast) return null;
              return (
                <motion.circle
                  key={pt.entry.id ?? `${pt.entry.date}-${i}`}
                  cx={geo.sx(pt.t)}
                  cy={geo.sy(conv(pt.kg))}
                  r={isActive ? 6.5 : 4.5}
                  className={cx('wchart__dot', isActive && 'is-active', isLast && 'is-last')}
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: reduce ? 0 : 0.5 + Math.min(i, 30) * 0.015 }}
                />
              );
            })}
          </svg>
        )}

        {geo && geo.goal !== undefined && !geo.goalInView && (
          <span className={cx('wchart__goal-flag', geo.goalAbove ? 'is-top' : 'is-bottom')}>
            Objetivo {formatNumber(geo.goal, 1)} {unit} {geo.goalAbove ? '↑' : '↓'}
          </span>
        )}

        {p && tip && !narrow && (
          <div
            ref={tipRef}
            className={cx('wchart__tip glass glass--sheet', tip.below && 'is-below')}
            style={{ left: tip.left, top: tip.top }}
            role="tooltip"
            data-testid="chart-detail"
          >
            {details}
          </div>
        )}
      </div>
      {narrow ? (
        <div
          className={cx('wchart__readout', p && 'is-active')}
          data-testid={p ? 'chart-detail' : undefined}
          role={p ? 'group' : undefined}
          aria-label={p ? 'Detalle del registro seleccionado' : undefined}
        >
          {details ?? <p className="t-small t-muted">Toca un punto de la gráfica para ver el registro exacto. Desliza para recorrer los registros.</p>}
        </div>
      ) : (
        <p className="t-small t-muted" style={{ marginTop: 8 }}>
          Pasa el cursor sobre la gráfica para ver el registro exacto. Con el teclado, usa las flechas.
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
