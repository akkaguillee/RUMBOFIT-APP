import { ChevronLeft, ChevronRight, Flame, Footprints, Info, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSteps, useWeights } from '@/db/hooks';
import { updateProfile } from '@/db/repos/profile';
import { deleteSteps } from '@/db/repos/tracking';
import { addDays, formatDate, todayKey } from '@/domain/dates';
import { estimateDistanceKm, estimateWalkingKcal } from '@/domain/health';
import { average, currentStreak, lastNDays, longestStreak, percent } from '@/domain/habits';
import type { Profile } from '@/domain/types';
import { formatInt, formatNumber, formatSigned, kmToDisplay, distanceUnit } from '@/domain/units';
import { checkRange, LIMITS } from '@/domain/validation';
import { AnimatedNumber } from '@/ui/AnimatedNumber';
import { Button, IconButton } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { NumberField } from '@/ui/Field';
import { GlassCard } from '@/ui/GlassCard';
import { ProgressRing } from '@/ui/ProgressRing';
import { Segmented } from '@/ui/Segmented';
import { Sheet } from '@/ui/Sheet';
import { StatusBadge } from '@/ui/StatusBadge';
import { toast } from '@/ui/toast';
import { useToday } from '@/ui/useToday';
import { BarChart } from '../shared/BarChart';
import { StepsSheet } from '../shared/sheets/StepsSheet';

export function StepsPanel({ profile }: { profile: Profile }) {
  const today = useToday();
  const steps = useSteps();
  const weights = useWeights();
  const [date, setDate] = useState(today);
  const [span, setSpan] = useState<'7' | '30'>('7');
  const [sheet, setSheet] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const [goalErr, setGoalErr] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);

  const byDay = useMemo(() => new Map((steps ?? []).map((s) => [s.date, s])), [steps]);
  const goal = profile.stepsGoal;
  const entry = byDay.get(date);
  const value = entry?.steps ?? 0;
  const latestKg = weights?.[weights.length - 1]?.kg;
  const estKm = estimateDistanceKm(value, profile.heightCm, profile.sex);
  const km = entry?.distanceKm ?? estKm;
  const kcal = estimateWalkingKcal(km, latestKg);
  const yesterday = byDay.get(addDays(date, -1))?.steps;
  const prev7 = lastNDays(addDays(date, -1), 7)
    .map((d) => byDay.get(d)?.steps)
    .filter((v): v is number => v !== undefined && v > 0);
  const avg7 = prev7.length ? average(prev7) : null;
  const goalDays = (steps ?? []).filter((s) => s.steps >= goal).map((s) => s.date).sort();
  const streak = currentStreak(today, (d) => (byDay.get(d)?.steps ?? 0) >= goal);
  const best = longestStreak(goalDays);

  const n = Number(span);
  const bars = lastNDays(date, n).map((d) => ({
    key: d,
    label: n === 7 ? formatDate.weekdayShort(d).slice(0, 2) : String(Number(d.slice(8))),
    long: formatDate.full(d),
    value: byDay.get(d)?.steps ?? 0,
    highlight: d === date,
  }));
  const history = [...(steps ?? [])].filter((s) => s.steps > 0).reverse().slice(0, 14);

  const saveGoal = async () => {
    const v = Number(goalDraft.replace(/\D/g, ''));
    const err = checkRange(v, LIMITS.stepsGoal);
    if (err) {
      setGoalErr(err);
      return;
    }
    await updateProfile({ stepsGoal: v });
    toast('Objetivo de pasos actualizado');
    setGoalOpen(false);
  };

  const du = distanceUnit(profile.units);

  return (
    <div className="split">
      <div className="vstack">
        <GlassCard variant="glow" aria-labelledby="steps-title">
          <h2 id="steps-title" className="sr-only">
            Pasos
          </h2>
          <div className="day-nav">
            <IconButton label="Día anterior" size="sm" onClick={() => setDate((d) => addDays(d, -1))}>
              <ChevronLeft />
            </IconButton>
            <span className="day-nav__label" aria-live="polite">
              {formatDate.relative(date, today)} · {formatDate.dayMonth(date)}
            </span>
            <IconButton label="Día siguiente" size="sm" onClick={() => setDate((d) => addDays(d, 1))} disabled={date >= todayKey()}>
              <ChevronRight />
            </IconButton>
          </div>
          <div className="habit-hero">
            <ProgressRing value={value / goal} size={220} stroke={16} tone="steps" label="Pasos respecto al objetivo">
              <div>
                <Footprints aria-hidden="true" style={{ width: 22, height: 22, color: 'var(--series-steps)', margin: '0 auto 4px' }} />
                <div className="vessel__value">
                  <AnimatedNumber value={value} format={(v) => formatInt(v)} />
                </div>
                <div className="t-small">de {formatInt(goal)} pasos</div>
              </div>
            </ProgressRing>
            {value >= goal ? <StatusBadge tone="good" label="Objetivo cumplido" /> : <p className="t-body">{percent(value, goal)} % del objetivo</p>}
            <div className="habit-meta">
              <div className="stat">
                <span className="stat__label">Distancia{entry?.distanceKm === undefined ? ' (estimada)' : ''}</span>
                <span className="stat__value">{km !== null ? `${formatNumber(kmToDisplay(km, profile.units), 2)}` : '—'}<small>{du}</small></span>
              </div>
              <div className="stat">
                <span className="stat__label">Energía (estimada)</span>
                <span className="stat__value">{kcal !== null ? formatInt(kcal) : '—'}<small>kcal</small></span>
              </div>
              <div className="stat">
                <span className="stat__label">Racha objetivo</span>
                <span className="stat__value">
                  {streak}
                  <small>días</small>
                </span>
              </div>
            </div>
            <Button icon={<Plus />} onClick={() => setSheet(true)} block>
              Registrar pasos
            </Button>
          </div>
        </GlassCard>

        <GlassCard aria-labelledby="steps-compare">
          <h3 id="steps-compare" className="card__title" style={{ marginBottom: 14 }}>
            Comparativa
          </h3>
          <div className="compare">
            <div className="stat">
              <span className="stat__label">vs. día anterior</span>
              <span className="stat__value">{yesterday !== undefined ? formatSigned(value - yesterday, 0) : '—'}</span>
            </div>
            <div className="stat">
              <span className="stat__label">vs. media 7 días</span>
              <span className="stat__value">{avg7 !== null ? formatSigned(value - avg7, 0) : '—'}</span>
            </div>
            <div className="stat">
              <span className="stat__label">Días con objetivo</span>
              <span className="stat__value">{goalDays.length}</span>
            </div>
            <div className="stat">
              <span className="stat__label">Mejor racha</span>
              <span className="stat__value">
                {best}
                <small>días</small>
              </span>
            </div>
          </div>
          {(!profile.heightCm || !latestKg) && (
            <p className="t-small" style={{ marginTop: 12 }}>
              Añade tu altura y tu peso para estimar la distancia y la energía.
            </p>
          )}
        </GlassCard>
      </div>

      <div className="vstack">
        <GlassCard aria-labelledby="steps-chart">
          <div className="card__head">
            <h3 id="steps-chart" className="card__title">
              <Flame aria-hidden="true" /> Actividad
            </h3>
            <Segmented
              label="Periodo"
              options={[
                { value: '7', label: '7 días' },
                { value: '30', label: '30 días' },
              ]}
              value={span}
              onChange={setSpan}
            />
          </div>
          <BarChart key={span} bars={bars} color="var(--series-steps)" goal={goal} format={(v) => `${formatInt(v)} pasos`} title="Pasos por día" />
        </GlassCard>

        <GlassCard aria-labelledby="steps-hist">
          <div className="card__head">
            <h3 id="steps-hist" className="card__title">
              Historial
            </h3>
            <Button
              variant="secondary"
              size="sm"
              icon={<Pencil />}
              onClick={() => {
                setGoalDraft(String(goal));
                setGoalErr(null);
                setGoalOpen(true);
              }}
            >
              Objetivo: {formatInt(goal)}
            </Button>
          </div>
          {!history.length ? (
            <p className="t-small">Aún no hay pasos registrados.</p>
          ) : (
            <ul className="list">
              {history.map((s) => (
                <li key={s.date} className="list-row">
                  <div className="list-row__main">
                    <div className="list-row__title t-num">{formatInt(s.steps)} pasos</div>
                    <div className="list-row__sub">
                      {formatDate.full(s.date)}
                      {s.distanceKm !== undefined ? ` · ${formatNumber(kmToDisplay(s.distanceKm, profile.units), 2)} ${du}` : ''}
                    </div>
                  </div>
                  {s.steps >= goal && <StatusBadge tone="good" label="Objetivo" />}
                  <IconButton label={`Eliminar pasos del ${formatDate.long(s.date)}`} size="sm" tone="plain" onClick={() => setToDelete(s.date)}>
                    <Trash2 />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
          <div className="callout" style={{ marginTop: 14 }}>
            <Info aria-hidden="true" />
            <p>
              Registro manual. La sincronización con Apple Salud, Health Connect o relojes no está disponible en la versión web; la app está preparada
              para incorporarla en el futuro.
            </p>
          </div>
        </GlassCard>
      </div>

      <StepsSheet open={sheet} onClose={() => setSheet(false)} date={date} />
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="¿Eliminar los pasos de este día?"
        message="Se eliminará el total de pasos del día y se recalcularán tus rachas e hitos."
        onConfirm={async () => {
          await deleteSteps(toDelete!);
          toast('Pasos eliminados');
        }}
      />
      <Sheet
        open={goalOpen}
        onClose={() => setGoalOpen(false)}
        title="Objetivo de pasos"
        footer={
          <Button block onClick={saveGoal}>
            Guardar objetivo
          </Button>
        }
      >
        <NumberField
          label="Pasos al día"
          value={goalDraft}
          onChange={(e) => {
            setGoalDraft(e.target.value.replace(/\D/g, ''));
            setGoalErr(null);
          }}
          decimals={false}
          suffix="pasos"
          size="lg"
          error={goalErr}
          hint="Elige una meta que puedas mantener. Los días anteriores conservan el objetivo que tenían."
          data-autofocus
        />
      </Sheet>
    </div>
  );
}
