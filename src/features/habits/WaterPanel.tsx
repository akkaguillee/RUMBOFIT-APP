import { ChevronLeft, ChevronRight, Droplets, GlassWater, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useWaterDay, useWaterRange } from '@/db/hooks';
import { updateProfile } from '@/db/repos/profile';
import { addWater, deleteWater } from '@/db/repos/tracking';
import { addDays, formatDate, todayKey } from '@/domain/dates';
import { lastNDays, percent, WATER_PRESETS_ML } from '@/domain/habits';
import type { Profile, WaterEntry } from '@/domain/types';
import { checkRange, LIMITS } from '@/domain/validation';
import { Button, IconButton } from '@/ui/Button';
import { cheer } from '@/ui/cheer';
import { GlassCard } from '@/ui/GlassCard';
import { NumberField } from '@/ui/Field';
import { Sheet } from '@/ui/Sheet';
import { StatusBadge } from '@/ui/StatusBadge';
import { toast, toastError } from '@/ui/toast';
import { useToday } from '@/ui/useToday';
import { BarChart } from '../shared/BarChart';
import { WaterSheet } from '../shared/sheets/WaterSheet';
import { useUnits } from '../shared/units';
import { WaterVessel } from './WaterVessel';

export function WaterPanel({ profile }: { profile: Profile }) {
  const today = useToday();
  const u = useUnits(profile.units);
  const [date, setDate] = useState(today);
  const entries = useWaterDay(date);
  const week = lastNDays(date, 7);
  const weekEntries = useWaterRange(week[0]!, week[6]!);
  const [custom, setCustom] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const [goalErr, setGoalErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const total = (entries ?? []).reduce((a, e) => a + e.ml, 0);
  const goal = profile.waterGoalMl;
  const remaining = Math.max(0, goal - total);

  const bars = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const e of weekEntries ?? []) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.ml);
    return week.map((d) => ({ key: d, label: formatDate.weekdayShort(d).slice(0, 2), long: formatDate.full(d), value: byDay.get(d) ?? 0, highlight: d === date }));
  }, [weekEntries, week, date]);
  const tracked = bars.filter((b) => b.value > 0);
  const avg = tracked.length ? tracked.reduce((a, b) => a + b.value, 0) / tracked.length : 0;
  const metDays = bars.filter((b) => b.value >= goal).length;

  const quick = async (ml: number) => {
    setBusy(true);
    try {
      await addWater(date, ml);
      toast(`+${u.volume(ml)} de agua`);
      cheer();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (e: WaterEntry) => {
    await deleteWater(e.id!);
    toast(`${u.volume(e.ml)} eliminados`, {
      tone: 'info',
      action: { label: 'Deshacer', onClick: () => void addWater(e.date, e.ml, e.time) },
    });
  };

  const saveGoal = async () => {
    const ml = u.parseVolume(goalDraft);
    const err = checkRange(ml, LIMITS.waterGoalMl);
    if (err) {
      setGoalErr(err);
      return;
    }
    await updateProfile({ waterGoalMl: ml! });
    toast('Objetivo de agua actualizado');
    setGoalOpen(false);
  };

  return (
    <div className="split">
      <div className="vstack">
        <GlassCard variant="glow" aria-labelledby="water-title">
          <h2 id="water-title" className="sr-only">
            Agua
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
            <WaterVessel value={total / goal} label="Agua consumida respecto al objetivo">
              <span className="vessel__value">{u.volume(total)}</span>
              <span className="t-small">de {u.volume(goal)}</span>
            </WaterVessel>
            {total >= goal ? (
              <StatusBadge tone="good" label="Objetivo cumplido" />
            ) : (
              <p className="t-body">
                Te quedan <strong style={{ color: 'var(--text)' }}>{u.volume(remaining)}</strong> · {percent(total, goal)} %
              </p>
            )}
            <div className="preset-row" role="group" aria-label="Añadir agua">
              {WATER_PRESETS_ML.map((ml) => (
                <button key={ml} type="button" className="preset" onClick={() => quick(ml)} disabled={busy}>
                  <GlassWater aria-hidden="true" />
                  <span className="preset__value">{u.volume(ml)}</span>
                </button>
              ))}
              <button type="button" className="preset" onClick={() => setCustom(true)} aria-label="Cantidad personalizada">
                <Plus aria-hidden="true" />
                <span className="preset__value">Otra</span>
              </button>
            </div>
          </div>
        </GlassCard>

        <GlassCard aria-labelledby="water-log">
          <div className="card__head">
            <h3 id="water-log" className="card__title">
              <Droplets aria-hidden="true" /> Registro del día
            </h3>
          </div>
          {!entries?.length ? (
            <p className="t-small">Sin registros este día. Usa los botones de arriba para añadir agua.</p>
          ) : (
            <ul className="water-log">
              {entries.map((e) => (
                <li key={e.id}>
                  <span className="icon-tile icon-tile--water">
                    <GlassWater aria-hidden="true" />
                  </span>
                  <span className="grow">
                    <strong>{u.volume(e.ml)}</strong>
                    <span className="t-small"> · {e.time}</span>
                  </span>
                  <IconButton label={`Eliminar ${u.volume(e.ml)} de las ${e.time}`} size="sm" tone="plain" onClick={() => remove(e)}>
                    <Trash2 />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      <div className="vstack">
        <GlassCard aria-labelledby="water-week">
          <div className="card__head">
            <h3 id="water-week" className="card__title">
              Últimos 7 días
            </h3>
            <span className="t-small">{metDays}/7 con objetivo cumplido</span>
          </div>
          <BarChart bars={bars} color="var(--series-water)" goal={goal} format={(v) => u.volume(v)} title="Agua por día" />
          <div className="compare" style={{ marginTop: 16, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <div className="stat">
              <span className="stat__label">Media (días con registro)</span>
              <span className="stat__value">{tracked.length ? u.volume(Math.round(avg)) : '—'}</span>
            </div>
            <div className="stat">
              <span className="stat__label">Total semanal</span>
              <span className="stat__value">{u.volume(bars.reduce((a, b) => a + b.value, 0))}</span>
            </div>
          </div>
        </GlassCard>

        <GlassCard aria-labelledby="water-goal">
          <div className="card__head">
            <h3 id="water-goal" className="card__title">
              Objetivo diario
            </h3>
            <Button
              variant="secondary"
              size="sm"
              icon={<Pencil />}
              onClick={() => {
                setGoalDraft(u.volumeToInput(goal));
                setGoalErr(null);
                setGoalOpen(true);
              }}
            >
              Editar
            </Button>
          </div>
          <p className="stat__value">{u.volume(goal)}</p>
          <p className="t-small" style={{ marginTop: 8 }}>
            Es un valor orientativo. Las necesidades de agua dependen del clima, tu actividad, tu alimentación y tu salud; ajústalo a tu caso. El
            contador empieza de cero cada día y tu historial se conserva.
          </p>
        </GlassCard>
      </div>

      <WaterSheet open={custom} onClose={() => setCustom(false)} units={profile.units} date={date} />
      <Sheet
        open={goalOpen}
        onClose={() => setGoalOpen(false)}
        title="Objetivo de agua"
        footer={
          <Button block onClick={saveGoal}>
            Guardar objetivo
          </Button>
        }
      >
        <NumberField
          label="Objetivo diario"
          value={goalDraft}
          onChange={(e) => {
            setGoalDraft(e.target.value);
            setGoalErr(null);
          }}
          suffix={u.v}
          size="lg"
          error={goalErr}
          hint="Los días anteriores conservan el objetivo que tenían entonces."
          data-autofocus
        />
      </Sheet>
    </div>
  );
}
