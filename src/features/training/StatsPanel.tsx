import { BarChart3, Clock, Dumbbell, Layers, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useCompletedWorkouts, useExerciseLibrary } from '@/db/hooks';
import { formatDate, formatMinutes, monthKey } from '@/domain/dates';
import { muscleLabel } from '@/domain/training/catalog';
import { exerciseRecords, muscleDistribution, weeklyWorkoutCounts, workoutVolume } from '@/domain/training/stats';
import { formatInt, formatNumber } from '@/domain/units';
import { EmptyState } from '@/ui/EmptyState';
import { SelectField } from '@/ui/Field';
import { GlassCard } from '@/ui/GlassCard';
import { useToday } from '@/ui/useToday';
import { BarChart } from '../shared/BarChart';

export function StatsPanel() {
  const workouts = useCompletedWorkouts();
  const { resolve } = useExerciseLibrary();
  const today = useToday();
  const [exId, setExId] = useState<string>('');

  const data = useMemo(() => {
    if (!workouts) return null;
    const weeks = weeklyWorkoutCounts(workouts, 8, today);
    const dist = muscleDistribution(workouts, resolve);
    const usedIds = [...new Set(workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId)))];
    const weighted = usedIds.filter((id) => resolve(id)?.measure === 'weight_reps');
    const records = weighted
      .map((id) => ({ id, rec: exerciseRecords(workouts, id) }))
      .filter((r) => r.rec.maxKg)
      .sort((a, b) => b.rec.sessions - a.rec.sessions)
      .slice(0, 8);
    return {
      weeks,
      dist,
      weighted,
      records,
      thisMonth: workouts.filter((w) => monthKey(w.date) === monthKey(today)).length,
      totalSec: workouts.reduce((a, w) => a + w.durationSec, 0),
      volume: workouts.reduce((a, w) => a + workoutVolume(w, resolve), 0),
    };
  }, [workouts, resolve, today]);

  if (!workouts || !data) return null;
  if (!workouts.length) {
    return (
      <div className="glass card">
        <EmptyState icon={<BarChart3 />} title="Sin estadísticas todavía" text="Completa entrenamientos para ver tu frecuencia, volumen, grupos trabajados y marcas personales." />
      </div>
    );
  }

  const selected = exId || data.weighted[0] || '';
  const progression = workouts
    .filter((w) => w.exercises.some((e) => e.exerciseId === selected))
    .sort((a, b) => a.startedAt - b.startedAt)
    .slice(-12)
    .map((w) => {
      const sets = w.exercises.filter((e) => e.exerciseId === selected).flatMap((e) => e.sets.filter((s) => s.done && s.reps));
      return { key: String(w.id), label: formatDate.dayMonth(w.date), long: `${formatDate.long(w.date)} · ${w.name}`, value: Math.max(0, ...sets.map((s) => s.kg ?? 0)) };
    });
  const maxSets = Math.max(1, ...data.dist.map((d) => d.sets));

  return (
    <div className="vstack">
      <div className="stat-tiles">
        <div className="glass stat-tile">
          <div className="stat">
            <span className="stat__label">
              <Dumbbell aria-hidden="true" style={{ width: 13, display: 'inline', verticalAlign: '-2px' }} /> Sesiones
            </span>
            <span className="stat__value">{workouts.length}</span>
          </div>
          <p className="t-small stat-tile__foot">{data.thisMonth} este mes</p>
        </div>
        <div className="glass stat-tile">
          <div className="stat">
            <span className="stat__label">
              <Clock aria-hidden="true" style={{ width: 13, display: 'inline', verticalAlign: '-2px' }} /> Tiempo total
            </span>
            <span className="stat__value">{formatMinutes(data.totalSec)}</span>
          </div>
          <p className="t-small stat-tile__foot">Media {formatMinutes(data.totalSec / workouts.length)}</p>
        </div>
        <div className="glass stat-tile">
          <div className="stat">
            <span className="stat__label">
              <Layers aria-hidden="true" style={{ width: 13, display: 'inline', verticalAlign: '-2px' }} /> Volumen total
            </span>
            <span className="stat__value">
              {formatInt(data.volume)}
              <small>kg</small>
            </span>
          </div>
          <p className="t-small stat-tile__foot">Peso × repeticiones</p>
        </div>
        <div className="glass stat-tile">
          <div className="stat">
            <span className="stat__label">Últimas 8 semanas</span>
            <span className="stat__value">{formatNumber(data.weeks.reduce((a, w) => a + w.count, 0) / 8, 1)}</span>
          </div>
          <p className="t-small stat-tile__foot">sesiones por semana</p>
        </div>
      </div>

      <div className="split">
        <GlassCard aria-labelledby="st-weeks">
          <h3 id="st-weeks" className="card__title" style={{ marginBottom: 12 }}>
            Entrenamientos por semana
          </h3>
          <BarChart
            bars={data.weeks.map((w) => ({ key: w.week, label: formatDate.dayMonth(w.week), long: `Semana del ${formatDate.long(w.week)} · ${formatMinutes(w.durationSec)}`, value: w.count }))}
            color="var(--series-weight)"
            format={(v) => `${v} ${v === 1 ? 'sesión' : 'sesiones'}`}
            title="Entrenamientos por semana"
          />
        </GlassCard>
        <GlassCard aria-labelledby="st-muscles">
          <h3 id="st-muscles" className="card__title" style={{ marginBottom: 12 }}>
            Series por grupo muscular
          </h3>
          <ul className="muscle-bars">
            {data.dist.slice(0, 9).map((d) => (
              <li key={d.muscle} className="muscle-bar">
                <span className="truncate">{muscleLabel(d.muscle)}</span>
                <span className="muscle-bar__track" aria-hidden="true">
                  <span className="muscle-bar__fill" style={{ width: `${(d.sets / maxSets) * 100}%`, display: 'block' }} />
                </span>
                <span className="t-num" style={{ textAlign: 'right', fontWeight: 600 }}>
                  {d.sets}
                </span>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>

      {data.weighted.length > 0 && (
        <GlassCard aria-labelledby="st-prog">
          <div className="card__head" style={{ flexWrap: 'wrap' }}>
            <h3 id="st-prog" className="card__title">
              Evolución de carga
            </h3>
            <SelectField
              label="Ejercicio"
              hideLabel
              value={selected}
              onChange={(e) => setExId(e.target.value)}
              options={data.weighted.map((id) => ({ value: id, label: resolve(id)?.name ?? id }))}
              fieldClassName="grow"
            />
          </div>
          <BarChart key={selected} bars={progression} color="var(--series-weight)" format={(v) => `${formatNumber(v, 2)} kg`} title="Peso máximo por sesión" />
          <p className="t-small t-muted" style={{ marginTop: 8 }}>
            Peso máximo levantado en cada sesión (últimas 12). Sube cargas solo si mantienes la técnica.
          </p>
        </GlassCard>
      )}

      {data.records.length > 0 && (
        <GlassCard aria-labelledby="st-prs">
          <h3 id="st-prs" className="card__title" style={{ marginBottom: 8 }}>
            <Trophy aria-hidden="true" /> Marcas personales
          </h3>
          <div className="data-table-wrap" style={{ maxHeight: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Ejercicio</th>
                  <th scope="col">Registrado</th>
                  <th scope="col">1RM estimado</th>
                </tr>
              </thead>
              <tbody>
                {data.records.map(({ id, rec }) => (
                  <tr key={id}>
                    <td>{resolve(id)?.name}</td>
                    <td>
                      {formatNumber(rec.maxKg!.value, 2)} kg × {rec.maxKg!.detail?.replace(' reps', '')}
                    </td>
                    <td>{rec.est1RM ? `≈ ${formatNumber(rec.est1RM.value, 1)} kg` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="t-small t-muted" style={{ marginTop: 8 }}>
            «Registrado» es lo que levantaste de verdad; el 1RM es una estimación (fórmula de Epley) y no se ha medido.
          </p>
        </GlassCard>
      )}
    </div>
  );
}
