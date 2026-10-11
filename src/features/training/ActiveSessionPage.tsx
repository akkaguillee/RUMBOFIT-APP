import { Check, Clock, Dumbbell, Flag, Layers, Pause, Play, Plus, SkipForward, Trash2, Trophy } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveWorkout, useCompletedWorkouts, useExerciseLibrary } from '@/db/hooks';
import {
  clearRest,
  discardWorkout,
  exerciseEntry,
  finishWorkout,
  mutateExercises,
  pauseWorkout,
  resumeWorkout,
  startRest,
  templateFromWorkout,
  updateWorkout,
} from '@/db/repos/training';
import { formatDuration, formatMinutes } from '@/domain/dates';
import { completedSets, personalBestsIn, totalSets, workoutElapsedSec, workoutVolume, type PersonalBest } from '@/domain/training/stats';
import type { Workout } from '@/domain/types';
import { formatInt, formatNumber } from '@/domain/units';
import { Button, ButtonLink, IconButton } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { EmptyState } from '@/ui/EmptyState';
import { TextAreaField, TextField } from '@/ui/Field';
import { Loader } from '@/ui/Loader';
import { Page } from '@/ui/Page';
import { ProgressBar } from '@/ui/ProgressBar';
import { ProgressRing } from '@/ui/ProgressRing';
import { Sheet } from '@/ui/Sheet';
import { toast, toastError } from '@/ui/toast';
import { useNow } from '@/ui/useNow';
import { ExercisePicker } from './ExercisePicker';
import { WorkoutEditor } from './WorkoutEditor';
import './training.css';

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.22].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    /* audio not available */
  }
}

export default function ActiveSessionPage() {
  const active = useActiveWorkout();
  const history = useCompletedWorkouts();
  const { resolve } = useExerciseLibrary();
  const navigate = useNavigate();
  const [picker, setPicker] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [summary, setSummary] = useState<{ workout: Workout; prs: PersonalBest[] } | null>(null);
  const now = useNow(1000, !!active);

  // Rest timer end: alert once, then clear (works after reopening the app too).
  const alerted = useRef<number | null>(null);
  const restLeft = active?.restEndsAt ? Math.ceil((active.restEndsAt - now) / 1000) : null;
  useEffect(() => {
    if (!active?.id || !active.restEndsAt || restLeft === null || restLeft > 0) return;
    if (alerted.current === active.restEndsAt) return;
    alerted.current = active.restEndsAt;
    navigator.vibrate?.([180, 90, 180]);
    if (document.visibilityState === 'visible') beep();
    toast('Descanso terminado. ¡A por la siguiente serie!', { tone: 'info' });
    void clearRest(active.id);
  }, [restLeft, active]);

  const stats = useMemo(() => {
    if (!active) return null;
    return { done: completedSets(active), total: totalSets(active), volume: workoutVolume(active, resolve) };
  }, [active, resolve]);

  if (active === undefined || history === undefined) return <Loader />;

  if (summary) return <SessionSummary summary={summary} onDone={() => navigate('/entreno?tab=historial')} />;

  if (active === null || !stats) {
    return (
      <Page>
        <EmptyState
          icon={<Dumbbell />}
          title="No hay ningún entrenamiento en curso"
          text="Empieza una sesión desde tu plan, una plantilla o un entrenamiento libre."
          action={<ButtonLink to="/entreno">Ir a entrenamiento</ButtonLink>}
        />
      </Page>
    );
  }

  const id = active.id!;
  const elapsed = workoutElapsedSec(active, now);
  const paused = !active.runningSince;

  return (
    <Page>
      <motion.div className="session-bar glass glass--nav" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <div className="grow" style={{ minWidth: 0 }}>
          <input
            className="input"
            style={{ height: 30, padding: 0, fontWeight: 700, fontSize: 'var(--text-md)' }}
            defaultValue={active.name}
            aria-label="Nombre del entrenamiento"
            maxLength={60}
            onBlur={(e) => e.target.value.trim() && e.target.value !== active.name && void updateWorkout(id, { name: e.target.value.trim() })}
          />
          <div className="hstack" style={{ gap: 8 }}>
            <span className="session-bar__time" aria-label={`Tiempo de entrenamiento ${formatDuration(elapsed)}`}>
              {formatDuration(elapsed)}
            </span>
            <span className="session-bar__state">{paused ? 'En pausa' : `${stats.done}/${stats.total} series`}</span>
          </div>
        </div>
        <IconButton label={paused ? 'Reanudar cronómetro' : 'Pausar cronómetro'} onClick={() => void (paused ? resumeWorkout(active) : pauseWorkout(active))}>
          {paused ? <Play /> : <Pause />}
        </IconButton>
        <Button size="sm" icon={<Flag />} onClick={() => setFinishOpen(true)}>
          Finalizar
        </Button>
      </motion.div>

      <div style={{ marginBottom: 16 }}>
        <ProgressBar value={stats.total ? stats.done / stats.total : 0} tone="good" label="Progreso de la sesión" />
      </div>

      {active.exercises.length === 0 ? (
        <div className="glass card">
          <EmptyState
            icon={<Dumbbell />}
            title="Añade tu primer ejercicio"
            text="Busca en el catálogo por grupo muscular o crea uno personalizado."
            action={
              <Button icon={<Plus />} onClick={() => setPicker(true)}>
                Añadir ejercicio
              </Button>
            }
          />
        </div>
      ) : (
        <WorkoutEditor
          exercises={active.exercises}
          onChange={(fn) => void mutateExercises(id, fn)}
          resolve={resolve}
          history={history}
          excludeId={id}
          mode="live"
          onSetDone={(ex) => ex.restSec > 0 && void startRest(id, ex.restSec)}
        />
      )}

      {active.exercises.length > 0 && (
        <Button variant="secondary" block icon={<Plus />} onClick={() => setPicker(true)} style={{ marginTop: 16 }}>
          Añadir ejercicio
        </Button>
      )}
      <Button variant="ghost" block icon={<Trash2 />} onClick={() => setDiscardOpen(true)} style={{ marginTop: 8, color: 'var(--bad-text)' }}>
        Descartar entrenamiento
      </Button>
      {/* Room for the floating rest timer so it never covers the last button. */}
      {restLeft !== null && restLeft > 0 && <div aria-hidden="true" style={{ height: 92 }} />}

      <AnimatePresence>
        {restLeft !== null && restLeft > 0 && active.restTotalSec && (
          <motion.div
            className="rest glass glass--sheet"
            role="timer"
            aria-live="off"
            aria-label={`Descanso: ${restLeft} segundos`}
            style={{ x: '-50%' }}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <ProgressRing value={restLeft / active.restTotalSec} size={44} stroke={5} tone="accent" label="Descanso restante" />
            <div className="grow">
              <div className="t-eyebrow">Descanso</div>
              <div className="rest__time">{formatDuration(restLeft)}</div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void updateWorkout(id, { restEndsAt: active.restEndsAt! + 15000, restTotalSec: active.restTotalSec! + 15 })}>
              +15 s
            </Button>
            <IconButton label="Saltar descanso" onClick={() => void clearRest(id)}>
              <SkipForward />
            </IconButton>
          </motion.div>
        )}
      </AnimatePresence>

      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        initialMuscles={active.muscleGroups}
        onPick={(ids) => void mutateExercises(id, (exs) => [...exs, ...ids.map((x) => exerciseEntry(x, [{}, {}, {}]))])}
      />
      <FinishSheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        workout={active}
        elapsed={elapsed}
        stats={stats}
        onFinished={(w) => {
          setFinishOpen(false);
          setSummary({ workout: w, prs: personalBestsIn(w, history, resolve) });
        }}
      />
      <ConfirmDialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="¿Descartar este entrenamiento?"
        message="Se perderán las series registradas en esta sesión. Esta acción no se puede deshacer."
        confirmLabel="Descartar"
        onConfirm={async () => {
          await discardWorkout(id);
          toast('Entrenamiento descartado', { tone: 'info' });
          navigate('/entreno');
        }}
      />
    </Page>
  );
}

interface FinishProps {
  open: boolean;
  onClose: () => void;
  workout: Workout;
  elapsed: number;
  stats: { done: number; total: number; volume: number };
  onFinished: (w: Workout) => void;
}

function FinishSheet({ open, onClose, workout, elapsed, stats, onFinished }: FinishProps) {
  const [rpe, setRpe] = useState<number | undefined>();
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const incomplete = stats.total - stats.done;

  const finish = async () => {
    setBusy(true);
    try {
      const w = await finishWorkout(workout.id!, { rpe, notes });
      onFinished(w);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Finalizar entrenamiento"
      locked={busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Seguir entrenando
          </Button>
          <Button onClick={finish} loading={busy} disabled={stats.done === 0} icon={<Check />}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="vstack">
        <div className="grid-3">
          <div className="stat">
            <span className="stat__label">Duración</span>
            <span className="stat__value">{formatDuration(elapsed)}</span>
          </div>
          <div className="stat">
            <span className="stat__label">Series</span>
            <span className="stat__value">{stats.done}</span>
          </div>
          <div className="stat">
            <span className="stat__label">Volumen</span>
            <span className="stat__value">
              {formatInt(stats.volume)}
              <small>kg</small>
            </span>
          </div>
        </div>
        {stats.done === 0 ? (
          <p className="callout callout--warn">Completa al menos una serie para poder guardar el entrenamiento.</p>
        ) : (
          incomplete > 0 && (
            <p className="callout callout--warn">
              {incomplete === 1 ? 'Hay 1 serie sin completar: no se guardará.' : `Hay ${incomplete} series sin completar: no se guardarán.`}
            </p>
          )
        )}
        <div className="field">
          <span className="field__label" id="rpe-label">
            Esfuerzo percibido (RPE, opcional)
          </span>
          <div className="rpe-row" role="radiogroup" aria-labelledby="rpe-label">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rpe === n} className="chip" onClick={() => setRpe(rpe === n ? undefined : n)}>
                {n}
              </button>
            ))}
          </div>
          <span className="field__hint">1 = muy suave · 10 = esfuerzo máximo</span>
        </div>
        <TextAreaField label="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={500} placeholder="Sensaciones, molestias, qué ajustar la próxima vez…" />
      </div>
    </Sheet>
  );
}

function SessionSummary({ summary, onDone }: { summary: { workout: Workout; prs: PersonalBest[] }; onDone: () => void }) {
  const { resolve } = useExerciseLibrary();
  const { workout, prs } = summary;
  const [tplName, setTplName] = useState(workout.name);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <Page>
      <motion.div className="glass glass--glow card" style={{ maxWidth: 560, margin: '0 auto' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="summary-hero">
          <motion.div className="summary-hero__icon" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.1 }}>
            <Check strokeWidth={3} />
          </motion.div>
          <p className="t-eyebrow">Entrenamiento completado</p>
          <h1 className="t-title" style={{ marginTop: 4 }}>
            {workout.name}
          </h1>
          <p className="t-body" style={{ marginTop: 6 }}>
            Hoy también cuenta. Buen trabajo.
          </p>
        </div>
        <div className="grid-3" style={{ margin: '20px 0' }}>
          <div className="stat" style={{ alignItems: 'center' }}>
            <Clock aria-hidden="true" style={{ width: 18, color: 'var(--text-3)' }} />
            <span className="stat__value">{formatMinutes(workout.durationSec)}</span>
            <span className="stat__label">Duración</span>
          </div>
          <div className="stat" style={{ alignItems: 'center' }}>
            <Layers aria-hidden="true" style={{ width: 18, color: 'var(--text-3)' }} />
            <span className="stat__value">{completedSets(workout)}</span>
            <span className="stat__label">Series</span>
          </div>
          <div className="stat" style={{ alignItems: 'center' }}>
            <Dumbbell aria-hidden="true" style={{ width: 18, color: 'var(--text-3)' }} />
            <span className="stat__value">{formatInt(workoutVolume(workout, resolve))}</span>
            <span className="stat__label">kg de volumen</span>
          </div>
        </div>
        {prs.length > 0 && (
          <div className="callout callout--accent" style={{ marginBottom: 16 }}>
            <Trophy aria-hidden="true" />
            <div>
              <strong>{prs.length === 1 ? 'Nueva marca personal' : `${prs.length} nuevas marcas personales`}</strong>
              <ul style={{ marginTop: 4 }}>
                {prs.map((p) => (
                  <li key={p.exerciseId + p.kind}>
                    {resolve(p.exerciseId)?.name}: {p.kind === 'weight' ? `${formatNumber(p.value, 2)} kg (antes ${formatNumber(p.previous, 2)} kg)` : p.kind === 'reps' ? `${p.value} reps (antes ${p.previous})` : p.kind === 'duration' ? `${formatDuration(p.value)} (antes ${formatDuration(p.previous)})` : `${formatNumber(p.value, 2)} km (antes ${formatNumber(p.previous, 2)} km)`}
                  </li>
                ))}
              </ul>
              <p className="t-small" style={{ marginTop: 6 }}>
                Progresa siempre con buena técnica: la marca vale más cuando es segura.
              </p>
            </div>
          </div>
        )}
        {!workout.templateId && !saved && (
          <div className="hstack" style={{ alignItems: 'flex-end', marginBottom: 12 }}>
            <TextField label="Guardar como plantilla" value={tplName} onChange={(e) => setTplName(e.target.value)} fieldClassName="grow" maxLength={60} />
            <Button
              variant="secondary"
              loading={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await templateFromWorkout(workout, tplName || workout.name);
                  setSaved(true);
                  toast('Plantilla guardada');
                } catch (e) {
                  toastError(e);
                } finally {
                  setSaving(false);
                }
              }}
            >
              Guardar
            </Button>
          </div>
        )}
        <Button block size="lg" onClick={onDone}>
          Listo
        </Button>
      </motion.div>
    </Page>
  );
}
