import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Flame, Footprints, Info, Pencil, Plus, Route, Trash2, Trophy } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';
import { useSteps, useWeights } from '@/db/hooks';
import { updateProfile } from '@/db/repos/profile';
import { addSteps, deleteSteps } from '@/db/repos/tracking';
import { addDays, formatDate, todayKey } from '@/domain/dates';
import { estimateDistanceKm, estimateWalkingKcal } from '@/domain/health';
import { average, currentStreak, lastNDays, longestStreak, percent } from '@/domain/habits';
import type { Profile } from '@/domain/types';
import { distanceUnit, formatInt, formatNumber, kmToDisplay } from '@/domain/units';
import { checkRange, LIMITS } from '@/domain/validation';
import { AnimatedNumber } from '@/ui/AnimatedNumber';
import { Button, IconButton } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { NumberField } from '@/ui/Field';
import { GlassCard } from '@/ui/GlassCard';
import { Segmented } from '@/ui/Segmented';
import { Sheet } from '@/ui/Sheet';
import { StatusBadge } from '@/ui/StatusBadge';
import { toast, toastError } from '@/ui/toast';
import { useToday } from '@/ui/useToday';
import { BarChart } from '../shared/BarChart';
import { StepsSheet } from '../shared/sheets/StepsSheet';
import { StepsTrack } from './StepsTrack';

/** Typical walking cadence used for "≈ minutes" estimates (steps per minute). */
const CADENCE = 100;
const QUICK_ADD = [500, 1000, 2500, 5000] as const;

const minutesFor = (steps: number) => Math.max(1, Math.round(steps / CADENCE));

/** Signed whole number with thousands separators (formatSigned skips them below 10.000). */
const signedInt = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${formatInt(Math.abs(v))}`;

function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function StepsPanel({ profile }: { profile: Profile }) {
  const today = useToday();
  const reduce = useReducedMotion();
  const steps = useSteps();
  const weights = useWeights();
  const [date, setDate] = useState(today);
  const [span, setSpan] = useState<'7' | '30'>('7');
  const [sheet, setSheet] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const [goalErr, setGoalErr] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [floats, setFloats] = useState<{ id: number; n: number }[]>([]);
  const [burst, setBurst] = useState(0);

  const byDay = useMemo(() => new Map((steps ?? []).map((s) => [s.date, s])), [steps]);
  const goal = profile.stepsGoal;
  const entry = byDay.get(date);
  const value = entry?.steps ?? 0;

  // Reaching the goal through a new entry (quick add or the sheet) fires the burst.
  const [seen, setSeen] = useState({ date, value, ready: steps !== undefined });
  if (steps !== undefined && (seen.date !== date || seen.value !== value || !seen.ready)) {
    if (seen.ready && seen.date === date && seen.value < goal && value >= goal) setBurst((b) => b + 1);
    setSeen({ date, value, ready: true });
  }

  const latestKg = weights?.[weights.length - 1]?.kg;
  const estKm = estimateDistanceKm(value, profile.heightCm, profile.sex);
  const km = entry?.distanceKm ?? estKm;
  const kcal = estimateWalkingKcal(km, latestKg);
  const du = distanceUnit(profile.units);
  const remaining = Math.max(0, goal - value);
  const remainingKm = estimateDistanceKm(remaining, profile.heightCm, profile.sex);

  const yesterday = byDay.get(addDays(date, -1))?.steps;
  const prev7 = lastNDays(addDays(date, -1), 7)
    .map((d) => byDay.get(d)?.steps)
    .filter((v): v is number => v !== undefined && v > 0);
  const avg7 = prev7.length ? average(prev7) : null;
  const goalDays = (steps ?? []).filter((s) => s.steps >= goal).map((s) => s.date).sort();
  const streak = currentStreak(today, (d) => (byDay.get(d)?.steps ?? 0) >= goal);
  const best = longestStreak(goalDays);

  const week = lastNDays(date, 7).map((d) => byDay.get(d)?.steps ?? 0);
  const weekTotal = week.reduce((a, b) => a + b, 0);
  const weekActive = week.filter((v) => v > 0);
  const weekAvg = weekActive.length ? average(weekActive) : 0;
  const weekGoalDays = week.filter((v) => v >= goal).length;

  const n = Number(span);
  const bars = lastNDays(date, n).map((d) => ({
    key: d,
    label: n === 7 ? formatDate.weekdayShort(d).slice(0, 2) : String(Number(d.slice(8))),
    long: formatDate.full(d),
    value: byDay.get(d)?.steps ?? 0,
    highlight: d === date,
  }));
  const history = [...(steps ?? [])].filter((s) => s.steps > 0).reverse().slice(0, 14);

  const quickAdd = async (amount: number) => {
    const total = value + amount;
    const err = checkRange(total, LIMITS.steps);
    if (err) {
      toast(err);
      return;
    }
    try {
      await addSteps(date, amount);
      setFloats((f) => [...f.slice(-3), { id: Date.now() + amount, n: amount }]);
    } catch (e) {
      toastError(e);
    }
  };

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

  const dayLabel = date === today ? 'hoy' : `el ${formatDate.dayMonth(date)}`;

  return (
    <div className="split">
      <div className="vstack">
        <GlassCard variant="glow" sheen aria-labelledby="steps-title" className="steps-hero">
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

          <StepsTrack progress={value / goal} burst={burst} label="Pasos respecto al objetivo">
            <span className={`steps-feet${value > 0 && !reduce ? ' is-walking' : ''}`} aria-hidden="true">
              <Footprints />
            </span>
            <span className="steps-count">
              <AnimatedNumber value={value} format={(v) => formatInt(v)} />
              <AnimatePresence>
                {floats.map((f) => (
                  <motion.span
                    key={f.id}
                    className="steps-float"
                    initial={{ opacity: 0, y: 6, scale: 0.8 }}
                    animate={{ opacity: [0, 1, 1, 0], y: -34, scale: 1 }}
                    transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                    onAnimationComplete={() => setFloats((all) => all.filter((x) => x.id !== f.id))}
                    aria-hidden="true"
                  >
                    +{formatInt(f.n)}
                  </motion.span>
                ))}
              </AnimatePresence>
            </span>
            <span className="steps-of">de {formatInt(goal)} pasos</span>
            <span className="steps-pct t-num">{percent(value, goal)} %</span>
          </StepsTrack>

          <div className="steps-status" aria-live="polite">
            {value >= goal ? (
              <>
                <StatusBadge tone="good" label="Objetivo cumplido" />
                {value > goal && <span className="t-small">{signedInt(value - goal)} pasos extra</span>}
              </>
            ) : (
              <p className="steps-remaining">
                <span>
                  Te faltan <strong className="t-num">{formatInt(remaining)}</strong> pasos
                </span>
                <span className="steps-remaining__hint">
                  ≈ {formatMinutes(minutesFor(remaining))} caminando
                  {remainingKm !== null ? ` · ${formatNumber(kmToDisplay(remainingKm, profile.units), 1)} ${du}` : ''}
                </span>
              </p>
            )}
          </div>

          <div className="steps-quick" role="group" aria-label={`Sumar pasos ${dayLabel}`}>
            {QUICK_ADD.map((q) => (
              <button key={q} type="button" className="chip steps-quick__btn" onClick={() => quickAdd(q)} aria-label={`Sumar ${formatInt(q)} pasos ${dayLabel}`}>
                <Plus aria-hidden="true" />
                {formatInt(q)}
              </button>
            ))}
          </div>

          <div className="steps-metrics">
            <div className="steps-metric">
              <span className="steps-metric__icon" aria-hidden="true">
                <Route />
              </span>
              <span className="stat__value">
                {km !== null ? formatNumber(kmToDisplay(km, profile.units), 2) : '—'}
                <small>{du}</small>
              </span>
              <span className="stat__label">Distancia{entry?.distanceKm === undefined ? ' (est.)' : ''}</span>
            </div>
            <div className="steps-metric">
              <span className="steps-metric__icon" aria-hidden="true">
                <Flame />
              </span>
              <span className="stat__value">
                {kcal !== null ? formatInt(kcal) : '—'}
                <small>kcal</small>
              </span>
              <span className="stat__label">Energía (est.)</span>
            </div>
            <div className="steps-metric">
              <span className="steps-metric__icon" aria-hidden="true">
                <Clock3 />
              </span>
              <span className="stat__value">{value > 0 ? formatMinutes(minutesFor(value)) : '—'}</span>
              <span className="stat__label">Tiempo activo (est.)</span>
            </div>
          </div>

          <Button icon={<Plus />} onClick={() => setSheet(true)} block>
            Registrar pasos
          </Button>
          {(!profile.heightCm || !latestKg) && (
            <p className="t-small steps-note">Añade tu altura y tu peso en el perfil para estimar la distancia y la energía.</p>
          )}
        </GlassCard>

        <GlassCard aria-labelledby="steps-week">
          <div className="card__head">
            <h3 id="steps-week" className="card__title">
              <CalendarDays aria-hidden="true" /> Últimos 7 días
            </h3>
            <span className="t-small t-num">
              {weekGoalDays}/7 con objetivo
            </span>
          </div>
          <div className="week-dots" aria-hidden="true">
            {lastNDays(date, 7).map((d, i) => {
              const v = week[i] ?? 0;
              const p = Math.min(1, v / goal);
              return (
                <div key={d} className="week-dot" data-met={v >= goal}>
                  <svg viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" className="week-dot__track" />
                    <motion.circle
                      cx="18"
                      cy="18"
                      r="14"
                      className="week-dot__fill"
                      initial={{ pathLength: reduce ? p : 0 }}
                      animate={{ pathLength: p || 0.0001, opacity: p ? 1 : 0 }}
                      transition={{ duration: reduce ? 0 : 0.9, delay: reduce ? 0 : 0.15 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </svg>
                  <span>{formatDate.weekdayShort(d).slice(0, 2)}</span>
                </div>
              );
            })}
          </div>
          <div className="compare">
            <div className="stat">
              <span className="stat__label">Total</span>
              <span className="stat__value">{formatInt(weekTotal)}</span>
            </div>
            <div className="stat">
              <span className="stat__label">Media diaria</span>
              <span className="stat__value">{weekAvg ? formatInt(weekAvg) : '—'}</span>
            </div>
            <div className="stat">
              <span className="stat__label">vs. día anterior</span>
              <span className="stat__value">{yesterday !== undefined ? signedInt(value - yesterday) : '—'}</span>
            </div>
            <div className="stat">
              <span className="stat__label">vs. media 7 días</span>
              <span className="stat__value">{avg7 !== null ? signedInt(Math.round(value - avg7)) : '—'}</span>
            </div>
          </div>
          <div className="streak-row">
            <span className="streak-row__item">
              <Flame aria-hidden="true" /> Racha actual <strong className="t-num">{streak}</strong> {streak === 1 ? 'día' : 'días'}
            </span>
            <span className="streak-row__item">
              <Trophy aria-hidden="true" /> Mejor racha <strong className="t-num">{best}</strong> {best === 1 ? 'día' : 'días'}
            </span>
            <span className="streak-row__item">
              <Footprints aria-hidden="true" /> Días con objetivo <strong className="t-num">{goalDays.length}</strong>
            </span>
          </div>
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
            <p className="t-small">Aún no hay pasos registrados. Usa los botones rápidos o «Registrar pasos» para empezar.</p>
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
              Registro manual: copia el total de tu móvil o reloj, o suma pasos tras un paseo. Las estimaciones usan tu altura, tu peso y un ritmo de
              {` ${CADENCE}`} pasos por minuto. La sincronización con Apple Salud, Health Connect o relojes no está disponible en la versión web.
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
