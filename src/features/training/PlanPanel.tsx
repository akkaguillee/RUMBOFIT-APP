import { CalendarPlus, ChevronRight, ClipboardList, Dumbbell, History, Moon, Play, Plus, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveWorkout, useCompletedWorkouts, useExerciseLibrary, usePlan, useTemplates } from '@/db/hooks';
import { exerciseEntry, logPastWorkout, savePlan, startFromTemplate, startWorkout } from '@/db/repos/training';
import { formatDate, formatMinutes, todayKey, weekdayIndex, WEEKDAY_LABELS } from '@/domain/dates';
import { MUSCLE_GROUPS, muscleShort } from '@/domain/training/catalog';
import type { MuscleGroup, PlanDay, Profile, WorkoutExercise } from '@/domain/types';
import { Button } from '@/ui/Button';
import { GlassCard } from '@/ui/GlassCard';
import { SelectField, TextField } from '@/ui/Field';
import { Sheet } from '@/ui/Sheet';
import { Switch } from '@/ui/Switch';
import { toast, toastError } from '@/ui/toast';
import { useToday } from '@/ui/useToday';
import { ExercisePicker } from './ExercisePicker';
import { parseDuration } from './format';
import { WorkoutEditor } from './WorkoutEditor';

/** Example split used only as an editable suggestion, never imposed. */
const SUGGESTED: { label: string; muscles: MuscleGroup[] }[] = [
  { label: 'Pecho y tríceps', muscles: ['chest', 'triceps'] },
  { label: 'Espalda y bíceps', muscles: ['back', 'biceps'] },
  { label: 'Piernas', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
  { label: 'Hombros y core', muscles: ['shoulders', 'core'] },
  { label: 'Torso', muscles: ['chest', 'back', 'shoulders'] },
  { label: 'Cardio', muscles: ['cardio'] },
  { label: 'Movilidad', muscles: ['mobility'] },
];

function suggestPlan(trainingDays: number[]): PlanDay[] {
  let n = 0;
  return Array.from({ length: 7 }, (_, wd) => {
    if (!trainingDays.includes(wd)) return { weekday: wd, label: 'Descanso', muscleGroups: [], rest: true };
    const s = SUGGESTED[n++ % SUGGESTED.length]!;
    return { weekday: wd, label: s.label, muscleGroups: s.muscles, rest: false };
  });
}

export function PlanPanel({ profile }: { profile: Profile }) {
  const plan = usePlan();
  const templates = useTemplates();
  const active = useActiveWorkout();
  const history = useCompletedWorkouts();
  const today = useToday();
  const navigate = useNavigate();
  const [editDay, setEditDay] = useState<PlanDay | null>(null);
  const [draft, setDraft] = useState<PlanDay[] | null>(null);
  const [tplPicker, setTplPicker] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);

  if (!plan || !templates || active === undefined) return null;
  const hasPlan = plan.length > 0;
  const shown = draft ?? (hasPlan ? plan : null);
  const wd = weekdayIndex(today);
  const todayPlan = shown?.find((p) => p.weekday === wd);
  const todayTemplate = todayPlan?.templateId !== undefined ? templates.find((t) => t.id === todayPlan.templateId) : undefined;
  const lastWorkout = history?.[0];

  const go = async (fn: () => Promise<number>) => {
    try {
      await fn();
      navigate('/entreno/sesion');
    } catch (e) {
      toastError(e);
    }
  };

  const saveDay = async (day: PlanDay) => {
    const base = shown ?? [];
    const next = Array.from({ length: 7 }, (_, i) => base.find((p) => p.weekday === i) ?? { weekday: i, label: '', muscleGroups: [], rest: true });
    next[day.weekday] = day;
    try {
      await savePlan(next);
      setDraft(null);
      toast('Plan actualizado');
    } catch (e) {
      toastError(e);
    }
  };

  return (
    <div className="split">
      <div className="vstack">
        <GlassCard variant="glow" sheen aria-labelledby="today-train">
          <div className="today-train">
            <div>
              <p className="t-eyebrow">Hoy · {formatDate.header(today)}</p>
              <h2 id="today-train" className="t-title" style={{ fontSize: 'var(--text-2xl)', marginTop: 4 }}>
                {active ? 'Tienes una sesión en curso' : todayPlan && !todayPlan.rest ? todayPlan.label || 'Día de entrenamiento' : todayPlan?.rest ? 'Día de descanso' : 'Entrena a tu ritmo'}
              </h2>
              {!active && todayPlan && !todayPlan.rest && todayPlan.muscleGroups.length > 0 && (
                <p className="t-small" style={{ marginTop: 4 }}>
                  {todayPlan.muscleGroups.map(muscleShort).join(' · ')}
                </p>
              )}
              {!active && todayPlan?.rest && <p className="t-small" style={{ marginTop: 4 }}>Recuperar también forma parte del progreso. Si te apetece, una sesión suave de movilidad.</p>}
            </div>
            {active ? (
              <Button size="lg" block icon={<Play />} onClick={() => navigate('/entreno/sesion')}>
                Continuar «{active.name}»
              </Button>
            ) : (
              <div className="start-grid">
                {todayTemplate ? (
                  <Button size="lg" icon={<Play />} onClick={() => go(() => startFromTemplate(todayTemplate))}>
                    Empezar {todayTemplate.name}
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    icon={<Play />}
                    onClick={() =>
                      go(() =>
                        startWorkout({
                          name: todayPlan && !todayPlan.rest && todayPlan.label ? todayPlan.label : 'Entrenamiento libre',
                          muscleGroups: todayPlan && !todayPlan.rest ? todayPlan.muscleGroups : [],
                        }),
                      )
                    }
                  >
                    {todayPlan && !todayPlan.rest ? 'Empezar sesión' : 'Entrenamiento libre'}
                  </Button>
                )}
                <Button size="lg" variant="secondary" icon={<ClipboardList />} onClick={() => setTplPicker(true)} disabled={!templates.length}>
                  Desde plantilla
                </Button>
              </div>
            )}
            <div className="hstack wrap" style={{ gap: 8 }}>
              {lastWorkout && !active && (
                <Button variant="ghost" size="sm" icon={<History />} onClick={() => navigate(`/entreno?tab=historial&w=${lastWorkout.id}`)}>
                  Último: {lastWorkout.name} · {formatDate.relative(lastWorkout.date, today)}
                </Button>
              )}
              <Button variant="ghost" size="sm" icon={<CalendarPlus />} onClick={() => setPastOpen(true)}>
                Registrar sesión pasada
              </Button>
            </div>
          </div>
        </GlassCard>
      </div>

      <GlassCard aria-labelledby="plan-title">
        <div className="card__head">
          <h2 id="plan-title" className="card__title">
            <Dumbbell aria-hidden="true" /> Plan semanal
          </h2>
          {draft && (
            <Button
              size="sm"
              onClick={async () => {
                await savePlan(draft);
                setDraft(null);
                toast('Plan guardado');
              }}
            >
              Guardar plan
            </Button>
          )}
        </div>
        {!shown ? (
          <div className="vstack" style={{ gap: 12 }}>
            <p className="t-small">
              Organiza tu semana. Te proponemos una distribución según los días que indicaste ({profile.trainingDays.length || 0} por semana); es solo un
              ejemplo editable.
            </p>
            <Button icon={<Wand2 />} onClick={() => setDraft(suggestPlan(profile.trainingDays))}>
              Ver sugerencia
            </Button>
            <Button variant="secondary" icon={<Plus />} onClick={() => setEditDay({ weekday: wd, label: '', muscleGroups: [], rest: false })}>
              Empezar desde cero
            </Button>
          </div>
        ) : (
          <>
            {draft && <p className="callout callout--accent" style={{ marginBottom: 12 }}>Sugerencia sin guardar. Toca un día para ajustarlo y guarda el plan cuando te convenza.</p>}
            <ul className="plan-week">
              {Array.from({ length: 7 }, (_, i) => shown.find((p) => p.weekday === i) ?? { weekday: i, label: '', muscleGroups: [], rest: true }).map((d) => {
                const tpl = d.templateId !== undefined ? templates.find((t) => t.id === d.templateId) : undefined;
                return (
                  <li key={d.weekday}>
                    <button
                      type="button"
                      className="plan-day"
                      data-today={d.weekday === wd}
                      data-rest={d.rest}
                      onClick={() => setEditDay(d)}
                      aria-label={`${WEEKDAY_LABELS[d.weekday]}: ${d.rest ? 'descanso' : d.label || 'entrenamiento'}. Editar`}
                    >
                      <span className="plan-day__wd">{d.rest ? <Moon aria-hidden="true" style={{ width: 18 }} /> : WEEKDAY_LABELS[d.weekday]!.slice(0, 1)}</span>
                      <span className="grow">
                        <span className="list-row__title" style={{ display: 'block' }}>
                          {WEEKDAY_LABELS[d.weekday]}
                          {d.weekday === wd ? ' · hoy' : ''}
                        </span>
                        <span className="list-row__sub truncate" style={{ display: 'block' }}>
                          {d.rest ? 'Descanso o recuperación' : [d.label, tpl ? `Plantilla: ${tpl.name}` : ''].filter(Boolean).join(' · ') || d.muscleGroups.map(muscleShort).join(' · ') || 'Entrenamiento'}
                        </span>
                      </span>
                      <ChevronRight aria-hidden="true" style={{ width: 18, color: 'var(--text-3)' }} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </GlassCard>

      <PlanDaySheet
        day={editDay}
        templates={templates.map((t) => ({ id: t.id!, name: t.name }))}
        onClose={() => setEditDay(null)}
        onSave={async (d) => {
          if (draft) {
            setDraft(draft.map((x) => (x.weekday === d.weekday ? d : x)));
          } else {
            await saveDay(d);
          }
          setEditDay(null);
        }}
      />

      <Sheet open={tplPicker} onClose={() => setTplPicker(false)} title="Empezar desde plantilla">
        <ul className="list">
          {templates.map((t) => (
            <li key={t.id}>
              <button type="button" className="pick-row" onClick={() => go(() => startFromTemplate(t))}>
                <span className="grow">
                  <span className="list-row__title" style={{ display: 'block' }}>
                    {t.name}
                  </span>
                  <span className="list-row__sub">
                    {t.exercises.length} ejercicios · {t.muscleGroups.map(muscleShort).join(' · ')}
                  </span>
                </span>
                <Play aria-hidden="true" style={{ width: 18, color: 'var(--accent-text)' }} />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <PastWorkoutSheet open={pastOpen} onClose={() => setPastOpen(false)} />
    </div>
  );
}

function PlanDaySheet({
  day,
  templates,
  onClose,
  onSave,
}: {
  day: PlanDay | null;
  templates: { id: number; name: string }[];
  onClose: () => void;
  onSave: (d: PlanDay) => Promise<void> | void;
}) {
  const [d, setD] = useState<PlanDay | null>(day);
  const [prev, setPrev] = useState(day);
  if (prev !== day) {
    setPrev(day);
    setD(day);
  }
  return (
    <Sheet
      open={day !== null}
      onClose={onClose}
      title={day ? WEEKDAY_LABELS[day.weekday]! : ''}
      footer={
        <Button block onClick={() => d && void onSave({ ...d, label: d.label.trim() })}>
          Guardar día
        </Button>
      }
    >
      {d && (
        <div className="vstack">
          <div className="hstack" style={{ justifyContent: 'space-between' }}>
            <span>
              <span className="list-row__title" style={{ display: 'block' }}>
                Día de descanso
              </span>
              <span className="list-row__sub">Sin entrenamiento planificado</span>
            </span>
            <Switch checked={d.rest} onChange={(v) => setD({ ...d, rest: v })} label="Día de descanso" />
          </div>
          {!d.rest && (
            <>
              <TextField label="Nombre del día" value={d.label} maxLength={40} placeholder="Por ejemplo, Pierna o Torso" onChange={(e) => setD({ ...d, label: e.target.value })} />
              <div className="field">
                <span className="field__label">Grupos musculares</span>
                <div className="chip-row chip-row--wrap" role="group" aria-label="Grupos musculares">
                  {MUSCLE_GROUPS.map((m) => {
                    const on = d.muscleGroups.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className="chip"
                        aria-pressed={on}
                        onClick={() => setD({ ...d, muscleGroups: on ? d.muscleGroups.filter((x) => x !== m.id) : [...d.muscleGroups, m.id] })}
                      >
                        {m.short}
                      </button>
                    );
                  })}
                </div>
              </div>
              <SelectField
                label="Plantilla (opcional)"
                value={d.templateId === undefined ? '' : String(d.templateId)}
                onChange={(e) => setD({ ...d, templateId: e.target.value ? Number(e.target.value) : undefined })}
                options={[{ value: '', label: 'Sin plantilla' }, ...templates.map((t) => ({ value: String(t.id), label: t.name }))]}
              />
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

function PastWorkoutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { resolve } = useExerciseLibrary();
  const history = useCompletedWorkouts();
  const [name, setName] = useState('Entrenamiento');
  const [date, setDate] = useState(todayKey());
  const [duration, setDuration] = useState('45');
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName('Entrenamiento');
    setDate(todayKey());
    setDuration('45');
    setExercises([]);
    setError(null);
  };

  const save = async () => {
    const sec = parseDuration(duration);
    if (!sec) {
      setError('Indica la duración en minutos (por ejemplo, 45) o en formato h:mm:ss.');
      return;
    }
    const cleaned = exercises
      .map((ex) => ({ ...ex, sets: ex.sets.filter((s) => (s.reps ?? 0) > 0 || (s.durationSec ?? 0) > 0 || (s.distanceKm ?? 0) > 0) }))
      .filter((ex) => ex.sets.length);
    if (!cleaned.length) {
      setError('Añade al menos un ejercicio con una serie completa.');
      return;
    }
    setBusy(true);
    try {
      await logPastWorkout({ name, date, durationSec: sec, exercises: cleaned });
      toast('Sesión registrada');
      reset();
      onClose();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet
        open={open && !picker}
        onClose={onClose}
        wide
        title="Registrar sesión pasada"
        description="Para entrenamientos que hiciste sin la app. Solo se guardan las series con datos."
        locked={busy}
        footer={
          <Button block onClick={save} loading={busy}>
            Guardar sesión
          </Button>
        }
      >
        <div className="vstack">
          <TextField label="Nombre" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          <div className="grid-2">
            <TextField label="Fecha" type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value || todayKey())} />
            <TextField label="Duración (min)" value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="numeric" />
          </div>
          {exercises.length > 0 && (
            <WorkoutEditor exercises={exercises} onChange={(fn) => setExercises((xs) => fn(structuredClone(xs)))} resolve={resolve} history={history ?? []} mode="log" />
          )}
          <Button variant="secondary" icon={<Plus />} onClick={() => setPicker(true)}>
            Añadir ejercicio
          </Button>
          {error && (
            <p className="field__error" role="alert">
              {error}
            </p>
          )}
          {duration && parseDuration(duration) ? <p className="t-small t-muted">Duración: {formatMinutes(parseDuration(duration)!)}</p> : null}
        </div>
      </Sheet>
      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={(ids) => setExercises((xs) => [...xs, ...ids.map((x) => exerciseEntry(x, [{}, {}, {}]))])} />
    </>
  );
}
