import { ChevronDown, LineChart, Plus, Scale } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { formatDate } from '@/domain/dates';
import type { Profile, WeightEntry } from '@/domain/types';
import { formatNumber, formatSigned, kgToDisplay } from '@/domain/units';
import {
  assessTrend,
  buildPoints,
  deltaTone,
  goalDirection,
  goalProgressClamped,
  periodChange,
  RANGES,
  rangeStart,
  type RangeId,
} from '@/domain/weight';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { GlassCard } from '@/ui/GlassCard';
import { liftVariants } from '@/ui/motion';
import { ProgressBar } from '@/ui/ProgressBar';
import { Segmented } from '@/ui/Segmented';
import { StatusBadge } from '@/ui/StatusBadge';
import { useToday } from '@/ui/useToday';
import { usesWeightGoal } from '../shared/labels';
import { WeightSheet } from '../shared/sheets/WeightSheet';
import { useUnits } from '../shared/units';
import { WeightChart } from './WeightChart';

const RANGE_KEY = 'rumbo.evolutionRange';

function readRange(): RangeId {
  try {
    const v = localStorage.getItem(RANGE_KEY) as RangeId | null;
    return v && RANGES.some((r) => r.id === v) ? v : '90d';
  } catch {
    return '90d';
  }
}

export function EvolutionPanel({ profile, weights }: { profile: Profile; weights: WeightEntry[] }) {
  const today = useToday();
  const u = useUnits(profile.units);
  const [range, setRangeState] = useState<RangeId>(readRange);
  const [showTrend, setShowTrend] = useState(true);
  const [table, setTable] = useState(false);
  const [sheet, setSheet] = useState(false);

  const setRange = (r: RangeId) => {
    setRangeState(r);
    try {
      localStorage.setItem(RANGE_KEY, r);
    } catch {
      /* ignore */
    }
  };

  const start = profile.startWeightKg;
  const goal = usesWeightGoal(profile.goal) ? profile.goalWeightKg : undefined;
  const direction = goalDirection(profile.goal, start, goal);
  const allPoints = useMemo(() => buildPoints(weights, start, goal), [weights, start, goal]);
  const from = rangeStart(range, today);
  const points = useMemo(
    () => allPoints.filter((p) => (from === null || p.entry.date >= from) && p.entry.date <= today),
    [allPoints, from, today],
  );
  const change = periodChange(points.map((p) => p.entry));
  const current = weights[weights.length - 1];
  const trend = assessTrend(weights, direction, today);
  const progress = start !== undefined && goal !== undefined && current ? goalProgressClamped(start, current.kg, goal) : null;
  const rangeLabel = RANGES.find((r) => r.id === range)!.long;

  if (!weights.length) {
    return (
      <GlassCard>
        <EmptyState
          icon={<Scale />}
          title="Aún no hay registros de peso"
          text="Registra tu peso para empezar a ver tu evolución. Con varias mediciones podrás ver una tendencia fiable."
          action={
            <Button icon={<Plus />} onClick={() => setSheet(true)}>
              Registrar peso
            </Button>
          }
        />
        <WeightSheet open={sheet} onClose={() => setSheet(false)} units={profile.units} />
      </GlassCard>
    );
  }

  const totalDelta = current && start !== undefined ? current.kg - start : null;

  return (
    <div className="vstack">
      <motion.div className="stat-tiles rise-group" variants={liftVariants}>
        <div className="glass stat-tile">
          <div className="stat">
            <span className="stat__label">Peso actual</span>
            <span className="stat__value">
              {current ? u.weightValue(current.kg) : '—'}
              <small>{u.w}</small>
            </span>
          </div>
          <p className="t-small stat-tile__foot">{current ? formatDate.relative(current.date, today) : ''}</p>
        </div>
        <div className="glass stat-tile">
          <div className="stat">
            <span className="stat__label">Peso inicial</span>
            <span className="stat__value">
              {start !== undefined ? u.weightValue(start) : '—'}
              <small>{u.w}</small>
            </span>
          </div>
          <p className="t-small stat-tile__foot">Desde {formatDate.dayMonth(profile.startDate)}</p>
        </div>
        <div className="glass stat-tile">
          <div className="stat">
            <span className="stat__label">{totalDelta !== null && totalDelta <= 0 ? 'Peso perdido' : 'Cambio total'}</span>
            <span className="stat__value">
              {totalDelta === null ? '—' : totalDelta <= 0 ? u.weightValue(-totalDelta) : formatSigned(kgToDisplay(totalDelta, profile.units), 1)}
              <small>{u.w}</small>
            </span>
          </div>
          <p className="t-small stat-tile__foot">Respecto al inicio</p>
        </div>
        <div className="glass stat-tile">
          <div className="stat">
            <span className="stat__label">Objetivo</span>
            <span className="stat__value">
              {goal !== undefined ? u.weightValue(goal) : '—'}
              {goal !== undefined && <small>{u.w}</small>}
            </span>
          </div>
          {progress !== null ? (
            <div className="stat-tile__foot">
              <ProgressBar value={progress} label="Avance hacia el objetivo" />
              <p className="t-small t-num" style={{ marginTop: 6 }}>
                {Math.round(progress * 100)} % del camino
              </p>
            </div>
          ) : (
            <p className="t-small stat-tile__foot">{usesWeightGoal(profile.goal) ? 'Defínelo en tu perfil' : 'Tu objetivo no depende del peso'}</p>
          )}
        </div>
      </motion.div>

      <GlassCard variant="strong" aria-labelledby="evo-title">
        <div className="chart-head">
          <h2 id="evo-title" className="card__title">
            <LineChart aria-hidden="true" />
            Evolución del peso
          </h2>
          <Button size="sm" icon={<Plus />} onClick={() => setSheet(true)}>
            Registrar
          </Button>
        </div>
        <Segmented label="Periodo" options={RANGES.map((r) => ({ value: r.id, label: r.label }))} value={range} onChange={setRange} block />

        <div className="chart-sub" style={{ marginTop: 18 }}>
          {change ? (
            <>
              <span className="chart-sub__value">{u.weightDelta(change.delta)}</span>
              <span className="t-small">
                {rangeLabel.toLowerCase()} · de {u.weight(change.from.kg)} a {u.weight(change.to.kg)}
              </span>
              <StatusBadge
                tone={deltaTone(change.delta, direction)}
                label={deltaTone(change.delta, direction) === 'good' ? 'A favor' : deltaTone(change.delta, direction) === 'bad' ? 'En contra' : 'Estable'}
                icon={change.delta < 0 ? 'trend-down' : change.delta > 0 ? 'trend-up' : 'flat'}
              />
            </>
          ) : (
            <span className="t-small">
              {points.length === 1 ? 'Un registro en este periodo. Añade más para ver la variación.' : `Sin registros: ${rangeLabel.toLowerCase()}.`}
            </span>
          )}
        </div>

        {points.length > 0 ? (
          <>
            <div className="legend" aria-label="Leyenda">
              <span className="legend__item">
                <span className="legend__key" aria-hidden="true" />
                Peso registrado
              </span>
              {showTrend && points.length > 2 && (
                <span className="legend__item">
                  <span className="legend__key legend__key--trend" aria-hidden="true" />
                  Tendencia (media móvil, no es una medición)
                </span>
              )}
              {goal !== undefined && (
                <span className="legend__item">
                  <span className="legend__key legend__key--goal" aria-hidden="true" />
                  Objetivo
                </span>
              )}
              <label className="legend__toggle">
                <input type="checkbox" checked={showTrend} onChange={(e) => setShowTrend(e.target.checked)} />
                Tendencia
              </label>
            </div>
            <WeightChart
              points={points}
              range={range}
              rangeStart={from}
              units={profile.units}
              goalKg={goal}
              startKg={start}
              showTrend={showTrend}
            />
          </>
        ) : (
          <div className="callout" style={{ marginTop: 8 }}>
            <p>
              No hay registros en este periodo. Prueba con <button className="link-btn" onClick={() => setRange('all')}>todo el historial</button>.
            </p>
          </div>
        )}

        <div className={`callout callout--stack ${trend.tone === 'bad' ? 'callout--accent' : trend.tone === 'warn' ? 'callout--warn' : ''}`} style={{ marginTop: 16 }}>
          <StatusBadge tone={trend.tone} label={trend.label} icon={trend.reliable ? undefined : 'pending'} />
          <p>
            {trend.detail}
            {trend.reliable && trend.slopeKgWeek !== null && (
              <> Ritmo reciente: {formatSigned(kgToDisplay(trend.slopeKgWeek, profile.units), 2, `${u.w}/semana`)}.</>
            )}{' '}
            Las variaciones diarias suelen deberse al agua y la digestión, no a cambios de grasa corporal.
          </p>
        </div>

        {points.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <button type="button" className="disclosure" aria-expanded={table} aria-controls="evo-table" onClick={() => setTable((t) => !t)}>
              {table ? 'Ocultar tabla de datos' : 'Ver datos en tabla'}
              <ChevronDown aria-hidden="true" />
            </button>
            {table && (
              <div className="data-table-wrap" id="evo-table" style={{ marginTop: 8 }}>
                <table className="data-table">
                  <caption className="sr-only">Registros de peso: {rangeLabel}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">vs. anterior</th>
                      <th scope="col">Peso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...points].reverse().map((p) => (
                      <tr key={p.entry.id}>
                        <td>
                          {formatDate.long(p.entry.date)}
                          {p.entry.time ? ` · ${p.entry.time}` : ''}
                        </td>
                        <td>{p.deltaPrev === null ? '—' : formatSigned(kgToDisplay(p.deltaPrev, profile.units), 1)}</td>
                        <td>
                          {formatNumber(kgToDisplay(p.kg, profile.units), 1)} {u.w}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </GlassCard>

      <WeightSheet open={sheet} onClose={() => setSheet(false)} units={profile.units} lastKg={current?.kg} />
    </div>
  );
}
