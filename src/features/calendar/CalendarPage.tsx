import { Check, ChevronLeft, ChevronRight, StickyNote, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useDaySummaries, useProfile } from '@/db/hooks';
import { addDays, addMonths, diffDays, formatDate, monthGrid, monthKey, startOfWeek, weekDays, WEEKDAY_SHORT } from '@/domain/dates';
import { formatInt, formatSigned, kgToDisplay } from '@/domain/units';
import { Button, IconButton } from '@/ui/Button';
import { GlassCard } from '@/ui/GlassCard';
import { Loader } from '@/ui/Loader';
import { Page, PageHead } from '@/ui/Page';
import { Sheet } from '@/ui/Sheet';
import { useMediaQuery } from '@/ui/useMediaQuery';
import { useToday } from '@/ui/useToday';
import { useUnits } from '../shared/units';
import { DayDetail } from './DayDetail';
import './calendar.css';

export default function CalendarPage() {
  const profile = useProfile();
  const summaries = useDaySummaries();
  const today = useToday();
  const [cursor, setCursor] = useState(today);
  const [selected, setSelected] = useState(today);
  const [dir, setDir] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const wide = useMediaQuery('(min-width: 1100px)');
  const gridRef = useRef<HTMLDivElement>(null);
  const u = useUnits(profile?.units);

  const days = useMemo(() => monthGrid(cursor), [cursor]);
  const month = monthKey(cursor);

  const lastRecord = useMemo(() => {
    if (!summaries) return null;
    return [...summaries.values()].filter((s) => s.hasData && s.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  }, [summaries, today]);

  const week = useMemo(() => {
    if (!summaries) return null;
    const ds = weekDays(selected);
    const rows = ds.map((d) => summaries.get(d));
    const active = rows.filter((r) => r?.hasData).length;
    const waterDays = rows.filter((r) => r && r.waterMl > 0);
    const waterAvg = waterDays.length ? waterDays.reduce((a, r) => a + r!.waterMl, 0) / waterDays.length : 0;
    const stepsTotal = rows.reduce((a, r) => a + (r?.steps ?? 0), 0);
    const workouts = rows.reduce((a, r) => a + (r?.workouts.length ?? 0), 0);
    const weights = rows.filter((r) => r?.weightKg !== undefined).map((r) => r!.weightKg!);
    const wDelta = weights.length >= 2 ? weights[weights.length - 1]! - weights[0]! : null;
    return { start: ds[0]!, end: ds[6]!, active, waterAvg, waterDays: waterDays.length, stepsTotal, workouts, wDelta };
  }, [summaries, selected]);

  if (!profile || !summaries) return <Loader />;

  const goMonth = (delta: number) => {
    setDir(delta);
    setCursor((c) => addMonths(c, delta));
  };

  const select = (d: string) => {
    setSelected(d);
    if (monthKey(d) !== month) {
      setDir(d > cursor ? 1 : -1);
      setCursor(d);
    }
    if (!wide) setSheetOpen(true);
  };

  // Arrow-key navigation across the grid (roving focus).
  const onKey = (e: KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in moves) {
      e.preventDefault();
      const next = addDays(selected, moves[e.key]!);
      setSelected(next);
      if (monthKey(next) !== month) {
        setDir(next > cursor ? 1 : -1);
        setCursor(next);
      }
      requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus());
    }
  };

  const detail = <DayDetail date={selected} summary={summaries.get(selected)} profile={profile} />;

  return (
    <Page>
      <PageHead
        eyebrow="Calendario"
        title="Tu historial"
        subtitle={
          lastRecord
            ? `Último registro: ${formatDate.relative(lastRecord.date, today).toLowerCase()}${diffDays(lastRecord.date, today) > 1 ? ` (${formatDate.long(lastRecord.date)})` : ''}.`
            : 'Todavía no hay registros. Pulsa un día para empezar.'
        }
      />
      <div className="cal-layout">
        <div className="vstack">
          <GlassCard variant="strong" aria-labelledby="cal-title">
            <div className="cal-head">
              <h2 id="cal-title" className="cal-head__title" aria-live="polite">
                {formatDate.monthYear(cursor)}
              </h2>
              {month !== monthKey(today) && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setDir(today > cursor ? 1 : -1);
                    setCursor(today);
                    setSelected(today);
                  }}
                >
                  Hoy
                </Button>
              )}
              <IconButton label="Mes anterior" size="sm" onClick={() => goMonth(-1)}>
                <ChevronLeft />
              </IconButton>
              <IconButton label="Mes siguiente" size="sm" onClick={() => goMonth(1)}>
                <ChevronRight />
              </IconButton>
            </div>
            <div className="cal-weekdays" aria-hidden="true">
              {WEEKDAY_SHORT.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="cal-grid-wrap">
              <AnimatePresence mode="popLayout" custom={dir} initial={false}>
                <motion.div
                  key={month}
                  ref={gridRef}
                  className="cal-grid"
                  role="group"
                  aria-label={`Días de ${formatDate.monthYear(cursor)}. Usa las flechas para moverte.`}
                  custom={dir}
                  initial={{ opacity: 0, x: dir * 28 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: dir * -28 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 34 }}
                  onKeyDown={onKey}
                >
                  {days.map((d) => {
                    const s = summaries.get(d);
                    const outside = monthKey(d) !== month;
                    const future = d > today;
                    const allMet = !!s && s.goalsTracked > 0 && s.goalsMet === s.goalsTracked;
                    const label = [
                      formatDate.full(d),
                      s?.weightCount ? 'peso registrado' : '',
                      s?.waterMl ? `${u.volume(s.waterMl)} de agua` : '',
                      s?.steps ? `${formatInt(s.steps)} pasos` : '',
                      s?.workouts.length ? `${s.workouts.length} entrenamiento${s.workouts.length > 1 ? 's' : ''}` : '',
                      allMet ? 'objetivos cumplidos' : '',
                      s?.note ? 'con nota' : '',
                      s?.unlocked.length ? 'hito desbloqueado' : '',
                      !s?.hasData && !future ? 'sin registros' : '',
                    ]
                      .filter(Boolean)
                      .join(', ');
                    return (
                      <button
                        key={d}
                        type="button"
                        data-date={d}
                        className="cal-day"
                        data-outside={outside}
                        data-future={future}
                        data-today={d === today}
                        data-has-data={!!s?.hasData}
                        aria-pressed={d === selected}
                        aria-label={label}
                        tabIndex={d === selected ? 0 : -1}
                        onClick={() => select(d)}
                      >
                        {Number(d.slice(8))}
                        <span className="cal-dots" aria-hidden="true">
                          {!!s?.weightCount && <i className="cal-dot--weight" />}
                          {!!s?.waterMl && <i className="cal-dot--water" />}
                          {!!s?.steps && <i className="cal-dot--steps" />}
                          {!!s?.workouts.length && <i className="cal-dot--workout" />}
                        </span>
                        {allMet && (
                          <span className="cal-mark cal-mark--goals" aria-hidden="true">
                            <Check strokeWidth={3.5} />
                          </span>
                        )}
                        {!!s?.unlocked.length && (
                          <span className="cal-mark cal-mark--ms" aria-hidden="true">
                            <Sparkles />
                          </span>
                        )}
                        {s?.note && (
                          <span className="cal-mark cal-mark--note" aria-hidden="true">
                            <StickyNote />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="cal-legend" aria-label="Leyenda">
              <span>
                <i className="cal-dot--weight" /> Peso
              </span>
              <span>
                <i className="cal-dot--water" /> Agua
              </span>
              <span>
                <i className="cal-dot--steps" /> Pasos
              </span>
              <span>
                <i className="cal-dot--workout" /> Entreno
              </span>
              <span>
                <i style={{ background: 'var(--good)' }} /> Objetivos de hábitos cumplidos
              </span>
              <span>
                <Sparkles aria-hidden="true" style={{ width: 12, height: 12, color: 'var(--accent)' }} /> Hito
              </span>
              <span>
                <StickyNote aria-hidden="true" style={{ width: 12, height: 12, color: 'var(--text-3)' }} /> Nota
              </span>
            </div>
            <p className="t-small t-muted" style={{ marginTop: 10 }}>
              Un día sin registros no es un día fallido: simplemente no hay datos.
            </p>
          </GlassCard>

          {week && (
            <GlassCard aria-labelledby="week-title">
              <h2 id="week-title" className="card__title" style={{ marginBottom: 14 }}>
                Semana del {formatDate.dayMonth(startOfWeek(selected))} al {formatDate.dayMonth(week.end)}
              </h2>
              <div className="week-summary">
                <div className="stat">
                  <span className="stat__label">Días con registros</span>
                  <span className="stat__value">
                    {week.active}
                    <small>/ 7</small>
                  </span>
                </div>
                <div className="stat">
                  <span className="stat__label">Agua media</span>
                  <span className="stat__value">{week.waterDays ? u.volume(Math.round(week.waterAvg)) : '—'}</span>
                </div>
                <div className="stat">
                  <span className="stat__label">Pasos totales</span>
                  <span className="stat__value">{formatInt(week.stepsTotal)}</span>
                </div>
                <div className="stat">
                  <span className="stat__label">Entrenamientos</span>
                  <span className="stat__value">{week.workouts}</span>
                </div>
              </div>
              {week.wDelta !== null && (
                <p className="t-small" style={{ marginTop: 12 }}>
                  Variación de peso en la semana: {formatSigned(kgToDisplay(week.wDelta, profile.units), 1, u.w)}
                </p>
              )}
            </GlassCard>
          )}
        </div>

        {wide && (
          <div className="cal-layout__side">
            <GlassCard aria-label="Detalle del día">{detail}</GlassCard>
          </div>
        )}
      </div>
      {!wide && (
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Detalle del día">
          {detail}
        </Sheet>
      )}
    </Page>
  );
}
