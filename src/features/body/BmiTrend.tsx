import { curveMonotoneX, line as d3line } from 'd3-shape';
import { ChevronDown, LineChart } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { BMI_REFERENCE, bmiSeries, type BmiPoint } from '@/domain/body';
import { formatDate, keyToTimestamp } from '@/domain/dates';
import { currentAge } from '@/domain/health';
import type { Profile, WeightEntry } from '@/domain/types';
import { formatFixed, formatSigned } from '@/domain/units';
import { cx } from '@/ui/cx';
import { GlassCard } from '@/ui/GlassCard';
import { useToday } from '@/ui/useToday';
import { useUnits } from '../shared/units';
import './body.css';

const M = { top: 12, right: 12, bottom: 28, left: 40 };
const HEIGHT = 188;
const DAY = 86_400_000;
const STEPS = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10];

const shortDate = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const monthYear = new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit' });

interface Props {
  profile: Profile;
  weights: WeightEntry[];
  className?: string;
}

/**
 * BMI over time with the current height, one point per day. Single neutral
 * series like the weight chart; the adult reference interval is a quiet band.
 * Pointer, touch and arrow keys read exact values; a table is always one tap away.
 */
export function BmiTrendCard({ profile, weights, className }: Props) {
  const today = useToday();
  const u = useUnits(profile.units);
  const [table, setTable] = useState(false);
  const series = useMemo(() => bmiSeries(weights.filter((w) => w.date <= today), profile.heightCm), [weights, today, profile.heightCm]);
  const age = currentAge(profile.age, profile.ageRecordedOn, today);
  // Same rule as the BMI card: no adult reference for minors or during pregnancy / breastfeeding.
  const showReference = (age === undefined || age >= 18) && !profile.healthFlags?.includes('pregnancy');
  if (!profile.heightCm) return null;

  return (
    <GlassCard className={cx('bmi-trend', className)} aria-labelledby="bmi-trend-title">
      <div className="card__head bmi-trend__head">
        <h2 id="bmi-trend-title" className="card__title">
          <LineChart aria-hidden="true" />
          Evolución del IMC
        </h2>
        <span className="t-small">Con tu altura actual ({u.height(profile.heightCm)})</span>
      </div>

      {series.length < 2 ? (
        <p className="t-small bmi-trend__empty">
          Cuando tengas registros de peso en al menos dos días distintos, aquí verás cómo cambia tu IMC con el tiempo.
        </p>
      ) : (
        <>
          <BmiChart points={series} showReference={showReference} />
          <button type="button" className="disclosure" aria-expanded={table} aria-controls="bmi-table" onClick={() => setTable((t) => !t)}>
            {table ? 'Ocultar tabla de datos' : 'Ver datos en tabla'}
            <ChevronDown aria-hidden="true" />
          </button>
          {table && (
            <div className="data-table-wrap" id="bmi-table">
              <table className="data-table">
                <caption className="sr-only">IMC por día, calculado con tu altura actual</caption>
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Peso</th>
                    <th scope="col">IMC</th>
                  </tr>
                </thead>
                <tbody>
                  {[...series].reverse().map((p) => (
                    <tr key={p.date}>
                      <td>{formatDate.long(p.date)}</td>
                      <td>{u.weight(p.kg)}</td>
                      <td>{formatFixed(p.bmi, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </GlassCard>
  );
}

function BmiChart({ points, showReference }: { points: BmiPoint[]; showReference: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry!.contentRect.width)));
    ro.observe(el);
    setWidth(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  const innerW = Math.max(10, width - M.left - M.right);
  const innerH = HEIGHT - M.top - M.bottom;

  const geo = useMemo(() => {
    if (width === 0 || points.length < 2) return null;
    const ts = points.map((p) => keyToTimestamp(p.date));
    let x0 = ts[0]!;
    let x1 = ts[ts.length - 1]!;
    if (x1 - x0 < DAY * 4) {
      x0 -= DAY;
      x1 += DAY;
    }
    const values = points.map((p) => p.bmi);
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    const pad = Math.max((hi - lo) * 0.18, 0.4);
    lo -= pad;
    hi += pad;
    const step = STEPS.find((s) => s >= (hi - lo) / 4) ?? 10;
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;
    const ticks: number[] = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(2)));

    const sx = (t: number) => M.left + ((t - x0) / (x1 - x0)) * innerW;
    const sy = (v: number) => M.top + (1 - (v - lo) / (hi - lo)) * innerH;
    const spanDays = (x1 - x0) / DAY;
    const labelCount = Math.max(2, Math.min(5, Math.floor(innerW / 84)));
    const fmt = spanDays > 300 ? monthYear : shortDate;
    const xTicks = Array.from({ length: labelCount }, (_, i) => {
      const t = x0 + ((x1 - x0) * (i + 0.5)) / labelCount;
      return { t, label: fmt.format(new Date(t)).replace('.', '') };
    });

    // Reference band, clipped to the visible range.
    const bandTop = Math.min(hi, BMI_REFERENCE.max);
    const bandBottom = Math.max(lo, BMI_REFERENCE.min);
    const band = showReference && bandTop > bandBottom ? { y: sy(bandTop), h: sy(bandBottom) - sy(bandTop) } : null;

    const path =
      d3line<BmiPoint>()
        .x((_, i) => sx(ts[i]!))
        .y((p) => sy(p.bmi))
        .curve(curveMonotoneX)(points) ?? '';
    return { ts, sx, sy, ticks, xTicks, band, path };
  }, [points, width, innerW, innerH, showReference]);

  const nearest = (clientX: number) => {
    if (!geo || !wrapRef.current) return null;
    const x = clientX - wrapRef.current.getBoundingClientRect().left;
    let best = 0;
    geo.ts.forEach((t, i) => {
      if (Math.abs(geo.sx(t) - x) < Math.abs(geo.sx(geo.ts[best]!) - x)) best = i;
    });
    return best;
  };

  const onPointer = (e: PointerEvent) => {
    const i = nearest(e.clientX);
    if (i !== null) setActive(i);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const last = points.length - 1;
    const cur = active ?? last;
    let next: number;
    if (e.key === 'ArrowLeft') next = Math.max(0, cur - 1);
    else if (e.key === 'ArrowRight') next = Math.min(last, cur + 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else if (e.key === 'Escape') {
      setActive(null);
      return;
    } else return;
    e.preventDefault();
    setActive(next);
  };

  const shown = points[active ?? points.length - 1]!;
  const first = points[0]!;
  const delta = shown.bmi - first.bmi;
  const dense = innerW / points.length < 14;
  const lastPoint = points[points.length - 1]!;
  const summary =
    `Evolución del IMC: ${points.length} días, de ${formatFixed(first.bmi, 1)} el ${formatDate.long(first.date)} ` +
    `a ${formatFixed(lastPoint.bmi, 1)} el ${formatDate.long(lastPoint.date)}. Usa las flechas para recorrer los días.`;

  return (
    <div className="bchart">
      <div className="bchart-legend" aria-hidden="true">
        <span className="bchart-legend__item">
          <span className="bchart-legend__line" />
          IMC (kg/m²)
        </span>
        {geo?.band && (
          <span className="bchart-legend__item">
            <span className="bchart-legend__band" />
            Intervalo de referencia 18,5–24,9
          </span>
        )}
      </div>
      <div className={cx('bchart__readout', active !== null && 'is-active')}>
        <span className="bchart__value t-num">{formatFixed(shown.bmi, 1)}</span>
        <span className="bchart__meta">
          <span className="bchart__date">
            {active === null ? 'Último · ' : ''}
            {formatDate.long(shown.date)}
          </span>
          <span className="t-small t-num">
            {shown === first ? 'Primer registro' : `${formatSigned(delta, 1)} desde el ${formatDate.dayMonth(first.date)}`}
          </span>
        </span>
      </div>
      <div
        ref={wrapRef}
        className="bchart__plot"
        style={{ height: HEIGHT }}
        tabIndex={0}
        role="group"
        aria-roledescription="gráfica"
        aria-label={summary}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        onPointerDown={onPointer}
        onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons) && onPointer(e)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
      >
        {geo && (
          <svg width={width} height={HEIGHT} className="bchart__svg" aria-hidden="true">
            {geo.band && (
              <g className="bchart__band">
                <rect x={M.left} y={geo.band.y} width={innerW} height={geo.band.h} />
                {geo.band.h >= 18 && (
                  <text x={width - M.right - 8} y={geo.band.y + 13} textAnchor="end">
                    Referencia
                  </text>
                )}
              </g>
            )}
            {geo.ticks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={width - M.right} y1={geo.sy(t)} y2={geo.sy(t)} className="bchart__grid" />
                <text x={M.left - 10} y={geo.sy(t)} className="bchart__tick" textAnchor="end" dominantBaseline="middle">
                  {formatFixed(t, t % 1 === 0 ? 0 : 1)}
                </text>
              </g>
            ))}
            {geo.xTicks.map((x) => (
              <text key={x.t} x={geo.sx(x.t)} y={HEIGHT - 8} className="bchart__tick" textAnchor="middle">
                {x.label}
              </text>
            ))}
            <motion.path
              d={geo.path}
              className="bchart__line"
              initial={{ pathLength: reduce ? 1 : 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
            {active !== null && (
              <line x1={geo.sx(geo.ts[active]!)} x2={geo.sx(geo.ts[active]!)} y1={M.top} y2={M.top + innerH} className="bchart__cross" />
            )}
            {points.map((p, i) => {
              const on = i === active;
              const last = i === points.length - 1;
              if (dense && !on && !last) return null;
              return (
                <circle
                  key={p.date}
                  cx={geo.sx(geo.ts[i]!)}
                  cy={geo.sy(p.bmi)}
                  r={on ? 6 : 4.5}
                  className={cx('bchart__dot', last && 'is-last', on && 'is-active')}
                />
              );
            })}
          </svg>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {active !== null ? `${formatDate.full(shown.date)}: IMC ${formatFixed(shown.bmi, 1)}` : ''}
      </p>
    </div>
  );
}
