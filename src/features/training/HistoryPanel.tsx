import { Clock, Copy, Dumbbell, History, Layers, Pencil, Play, Trash2, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCompletedWorkouts, useExerciseLibrary } from '@/db/hooks';
import { deleteWorkout, editCompletedWorkout, repeatWorkout, templateFromWorkout } from '@/db/repos/training';
import { formatDate, formatMinutes, startOfWeek, todayKey } from '@/domain/dates';
import { figureFor, sessionMuscles } from '@/domain/training/anatomy';
import { muscleShort } from '@/domain/training/catalog';
import { completedSets, personalBestsIn, workoutVolume } from '@/domain/training/stats';
import type { BodyFigure, Profile, Workout } from '@/domain/types';
import { formatInt } from '@/domain/units';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { EmptyState } from '@/ui/EmptyState';
import { TextAreaField, TextField } from '@/ui/Field';
import { GlassButtonCard } from '@/ui/GlassCard';
import { Sheet } from '@/ui/Sheet';
import { toast, toastError } from '@/ui/toast';
import { MuscleMap } from './bodymap/MuscleMap';
import { formatSet } from './format';

export function HistoryPanel({ profile }: { profile: Profile }) {
  const workouts = useCompletedWorkouts();
  const { resolve } = useExerciseLibrary();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('w') ? Number(params.get('w')) : null;
  const selected = workouts?.find((w) => w.id === selectedId) ?? null;

  const groups = useMemo(() => {
    const m = new Map<string, Workout[]>();
    for (const w of workouts ?? []) {
      const k = startOfWeek(w.date);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(w);
    }
    return [...m.entries()];
  }, [workouts]);

  const open = (w: Workout | null) => {
    const next = new URLSearchParams(params);
    if (w) next.set('w', String(w.id));
    else next.delete('w');
    setParams(next, { replace: true });
  };

  if (!workouts) return null;
  if (!workouts.length) {
    return (
      <div className="glass card">
        <EmptyState icon={<History />} title="Aún no hay entrenamientos" text="Cuando completes tu primera sesión aparecerá aquí, con sus series, duración y volumen." />
      </div>
    );
  }

  return (
    <div className="vstack-lg">
      {groups.map(([week, list]) => (
        <section key={week} aria-label={`Semana del ${formatDate.long(week)}`}>
          <div className="section-head">
            <h2>Semana del {formatDate.dayMonth(week)}</h2>
            <span className="t-small">
              {list.length} {list.length === 1 ? 'sesión' : 'sesiones'} · {formatMinutes(list.reduce((a, w) => a + w.durationSec, 0))}
            </span>
          </div>
          <div className="grid-auto">
            {list.map((w) => (
              <GlassButtonCard key={w.id} onClick={() => open(w)} rise={false} aria-label={`${w.name}, ${formatDate.long(w.date)}. Ver detalle`}>
                <div className="workout-card">
                  <span className="t-eyebrow">{formatDate.relative(w.date, todayKey())}</span>
                  <span className="list-row__title">{w.name}</span>
                  <div className="workout-card__stats">
                    <span>
                      <Clock aria-hidden="true" />
                      {formatMinutes(w.durationSec)}
                    </span>
                    <span>
                      <Layers aria-hidden="true" />
                      {completedSets(w)} series
                    </span>
                    {workoutVolume(w, resolve) > 0 && (
                      <span>
                        <Dumbbell aria-hidden="true" />
                        {formatInt(workoutVolume(w, resolve))} kg
                      </span>
                    )}
                  </div>
                  {w.muscleGroups.length > 0 && (
                    <div className="chip-row chip-row--wrap" style={{ gap: 6 }}>
                      {w.muscleGroups.slice(0, 5).map((m) => (
                        <span key={m} className="badge">
                          {muscleShort(m)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </GlassButtonCard>
            ))}
          </div>
        </section>
      ))}
      <WorkoutDetailSheet workout={selected} history={workouts} figure={figureFor(profile)} onClose={() => open(null)} />
    </div>
  );
}

function WorkoutDetailSheet({ workout, history, figure, onClose }: { workout: Workout | null; history: Workout[]; figure: BodyFigure; onClose: () => void }) {
  const { resolve, list } = useExerciseLibrary();
  const muscles = useMemo(() => (workout ? sessionMuscles(workout.exercises, resolve) : null), [workout, resolve]);
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', date: '', notes: '' });

  const prs = workout ? personalBestsIn(workout, history, resolve) : [];
  const prIds = new Set(prs.map((p) => p.exerciseId));

  return (
    <>
      <Sheet
        open={workout !== null && !confirm}
        onClose={() => {
          setEditing(false);
          onClose();
        }}
        wide
        title={workout?.name ?? ''}
        description={workout ? `${formatDate.full(workout.date)}${workout.time ? ` · ${workout.time}` : ''}` : undefined}
        footer={
          workout &&
          (editing ? (
            <>
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  try {
                    await editCompletedWorkout(workout.id!, { name: form.name, date: form.date, notes: form.notes || undefined, rpe: workout.rpe });
                    setEditing(false);
                    toast('Entrenamiento actualizado');
                  } catch (e) {
                    toastError(e);
                  }
                }}
              >
                Guardar
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                icon={<Copy />}
                onClick={async () => {
                  try {
                    await templateFromWorkout(workout, workout.name);
                    toast('Guardado como plantilla');
                  } catch (e) {
                    toastError(e);
                  }
                }}
              >
                Plantilla
              </Button>
              <Button
                icon={<Play />}
                onClick={async () => {
                  try {
                    await repeatWorkout(workout);
                    navigate('/entreno/sesion');
                  } catch (e) {
                    toastError(e);
                  }
                }}
              >
                Repetir
              </Button>
            </>
          ))
        }
      >
        {workout &&
          (editing ? (
            <div className="vstack">
              <TextField label="Nombre" value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <TextField label="Fecha" type="date" value={form.date} max={todayKey()} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <TextAreaField label="Notas" value={form.notes} rows={3} maxLength={500} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          ) : (
            <div className="vstack">
              <div className="grid-3">
                <div className="stat">
                  <span className="stat__label">Duración</span>
                  <span className="stat__value">{formatMinutes(workout.durationSec)}</span>
                </div>
                <div className="stat">
                  <span className="stat__label">Series</span>
                  <span className="stat__value">{completedSets(workout)}</span>
                </div>
                <div className="stat">
                  <span className="stat__label">Volumen</span>
                  <span className="stat__value">
                    {formatInt(workoutVolume(workout, resolve))}
                    <small>kg</small>
                  </span>
                </div>
              </div>
              {workout.rpe && <p className="t-small">Esfuerzo percibido: {workout.rpe}/10</p>}
              {workout.notes && <p className="callout">“{workout.notes}”</p>}
              {muscles && (
                <section className="history-map" aria-labelledby="history-map-title">
                  <h3 id="history-map-title" className="today__label">
                    Músculos trabajados
                  </h3>
                  <MuscleMap
                    key={workout.id}
                    figure={figure}
                    data={{ mode: 'session', session: muscles, scope: 'esta sesión' }}
                    library={list}
                    empty={<p>Esta sesión no tiene ejercicios que marquen músculos (cardio, movilidad o recuperación).</p>}
                  />
                </section>
              )}
              <ul className="list">
                {workout.exercises.map((ex) => {
                  const e = resolve(ex.exerciseId);
                  return (
                    <li key={ex.uid} className="list-row" style={{ alignItems: 'flex-start' }}>
                      <div className="list-row__main">
                        <div className="list-row__title">
                          {e?.name ?? 'Ejercicio eliminado'}{' '}
                          {prIds.has(ex.exerciseId) && (
                            <span className="badge badge--accent" style={{ height: 22, marginLeft: 4 }}>
                              <Trophy aria-hidden="true" /> Marca personal
                            </span>
                          )}
                        </div>
                        <ol className="t-small" style={{ marginTop: 4 }}>
                          {ex.sets.map((s, i) => (
                            <li key={s.uid}>
                              Serie {i + 1}: {formatSet(s, e?.measure ?? 'weight_reps')}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="hstack" style={{ justifyContent: 'space-between' }}>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Pencil />}
                  onClick={() => {
                    setForm({ name: workout.name, date: workout.date, notes: workout.notes ?? '' });
                    setEditing(true);
                  }}
                >
                  Editar datos
                </Button>
                <Button variant="ghost" size="sm" icon={<Trash2 />} onClick={() => setConfirm(true)} style={{ color: 'var(--bad-text)' }}>
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
      </Sheet>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="¿Eliminar este entrenamiento?"
        message="Se eliminará del historial, las estadísticas y el calendario. Los hitos se recalcularán."
        onConfirm={async () => {
          await deleteWorkout(workout!.id!);
          toast('Entrenamiento eliminado');
          onClose();
        }}
      />
    </>
  );
}
