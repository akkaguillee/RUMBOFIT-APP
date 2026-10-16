import { Activity, CalendarCheck, CalendarPlus, Check, ClipboardList, History, Moon, Play, Plus, Sparkles } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExerciseLibrary } from '@/db/hooks';
import { startFromTemplate, startWorkout } from '@/db/repos/training';
import { formatDate, formatMinutes, type DateKey } from '@/domain/dates';
import { figureFor, muscleName, plannedSession, sessionGroups, sessionMuscles, type SessionExercise, type SessionExerciseInput } from '@/domain/training/anatomy';
import { muscleLabel, muscleShort } from '@/domain/training/catalog';
import type { PlanDay, Profile, Workout, WorkoutTemplate } from '@/domain/types';
import { Button } from '@/ui/Button';
import { GlassCard } from '@/ui/GlassCard';
import { MuscleMap } from './bodymap/MuscleMap';

type Today =
  | { kind: 'active'; workout: Workout }
  | { kind: 'done'; workout: Workout }
  | { kind: 'planned'; day: PlanDay; template?: WorkoutTemplate }
  | { kind: 'rest'; day: PlanDay }
  | { kind: 'free' };

interface Props {
  profile: Profile;
  today: DateKey;
  active: Workout | null;
  history: Workout[] | undefined;
  todayPlan?: PlanDay;
  todayTemplate?: WorkoutTemplate;
  hasTemplates: boolean;
  onStart: (start: () => Promise<number>) => void;
  onPickTemplate: () => void;
  onLogPast: () => void;
}

const NONE: SessionExerciseInput[] = [];

function todayState({ active, history, todayPlan, todayTemplate, today }: Pick<Props, 'active' | 'history' | 'todayPlan' | 'todayTemplate' | 'today'>): Today {
  if (active) return { kind: 'active', workout: active };
  // History is newest first: the latest session finished today.
  const done = history?.find((w) => w.date === today);
  if (done) return { kind: 'done', workout: done };
  if (todayPlan && !todayPlan.rest) return { kind: 'planned', day: todayPlan, template: todayTemplate };
  if (todayPlan?.rest) return { kind: 'rest', day: todayPlan };
  return { kind: 'free' };
}

const STATUS: Record<Today['kind'], { label: string; icon: ReactNode; cls: string }> = {
  active: { label: 'En curso', icon: <span className="today__live" aria-hidden="true" />, cls: 'badge badge--accent' },
  done: { label: 'Completada', icon: <Check aria-hidden="true" />, cls: 'badge badge--good' },
  planned: { label: 'Planificada', icon: <CalendarCheck aria-hidden="true" />, cls: 'badge' },
  rest: { label: 'Descanso', icon: <Moon aria-hidden="true" />, cls: 'badge' },
  free: { label: 'Sin plan', icon: <Sparkles aria-hidden="true" />, cls: 'badge' },
};

/** Primary muscles of an exercise in words, or why it has none. */
function exerciseMusclesText(e: SessionExercise, resolveGroup: (id: string) => string | undefined): string {
  const m = e.muscles;
  if (m.primary.length) {
    const main = m.primary.map(muscleName).join(', ');
    return m.secondary.length ? `${main} · +${m.secondary.length} sec.` : main;
  }
  if (m.secondary.length) return m.secondary.map(muscleName).join(', ');
  if (m.reason === 'unknown') return 'Sin datos musculares';
  return resolveGroup(e.exerciseId) ?? 'Sin músculos en el mapa';
}

export function TodaySession({ profile, today, active, history, todayPlan, todayTemplate, hasTemplates, onStart, onPickTemplate, onLogPast }: Props) {
  const navigate = useNavigate();
  const { resolve, list } = useExerciseLibrary();
  const state = todayState({ active, history, todayPlan, todayTemplate, today });
  // The session in progress, else the one finished today, else today's template as planned work.
  const workout = active ?? (history?.find((w) => w.date === today) || undefined);
  const template = !workout && todayPlan && !todayPlan.rest ? todayTemplate : undefined;

  const session = useMemo(() => {
    const input = workout ? workout.exercises : template ? plannedSession(template.exercises) : NONE;
    return sessionMuscles(input, resolve);
  }, [workout, template, resolve]);

  const groups = sessionGroups(session);
  const plannedGroups = state.kind === 'planned' ? state.day.muscleGroups : [];
  const lastWorkout = history?.[0];
  const status = STATUS[state.kind];

  const title =
    state.kind === 'active' || state.kind === 'done'
      ? state.workout.name
      : state.kind === 'planned'
        ? state.template?.name || state.day.label || 'Día de entrenamiento'
        : state.kind === 'rest'
          ? 'Día de descanso'
          : 'Entrena a tu ritmo';

  const meta =
    state.kind === 'active'
      ? `${session.doneSets}/${session.totalSets} series · ${session.exercises.length} ${session.exercises.length === 1 ? 'ejercicio' : 'ejercicios'}`
      : state.kind === 'done'
        ? `${formatMinutes(state.workout.durationSec)} · ${session.doneSets} series`
        : template
          ? `${session.exercises.length} ${session.exercises.length === 1 ? 'ejercicio' : 'ejercicios'} · ${session.totalSets} series previstas`
          : null;

  const scope = state.kind === 'done' ? 'la sesión de hoy' : state.kind === 'planned' ? 'la sesión planificada' : 'esta sesión';

  const empty =
    state.kind === 'active' ? (
      <p>Añade ejercicios a la sesión y verás aquí los músculos que trabajas.</p>
    ) : state.kind === 'planned' ? (
      <p>
        Hoy aún no tiene ejercicios. Empieza la sesión y añádelos, o elige una plantilla: el mapa se marcará con ellos.
        {plannedGroups.length > 0 && ` Previsto: ${plannedGroups.map(muscleShort).join(', ')}.`}
      </p>
    ) : state.kind === 'rest' ? (
      <p>Hoy toca recuperar. Si te apetece, una sesión suave de movilidad.</p>
    ) : (
      <p>Empieza una sesión o elige una plantilla y aquí verás los músculos que trabajas.</p>
    );

  const startToday = () =>
    onStart(() =>
      startWorkout({
        name: todayPlan && !todayPlan.rest && todayPlan.label ? todayPlan.label : 'Entrenamiento libre',
        muscleGroups: todayPlan && !todayPlan.rest ? todayPlan.muscleGroups : [],
      }),
    );

  let cta: ReactNode;
  if (state.kind === 'active') {
    cta = (
      <Button size="lg" block icon={<Play />} onClick={() => navigate('/entreno/sesion')}>
        Continuar sesión
      </Button>
    );
  } else if (state.kind === 'done') {
    cta = (
      <div className="start-grid">
        <Button size="lg" icon={<History />} onClick={() => navigate(`/entreno?tab=historial&w=${state.workout.id}`)}>
          Ver la sesión
        </Button>
        <Button size="lg" variant="secondary" icon={<Plus />} onClick={() => onStart(() => startWorkout({ name: 'Entrenamiento libre' }))}>
          Nueva sesión
        </Button>
      </div>
    );
  } else {
    cta = (
      <div className="start-grid">
        {template ? (
          <Button size="lg" icon={<Play />} onClick={() => onStart(() => startFromTemplate(template))}>
            Empezar {template.name}
          </Button>
        ) : (
          <Button size="lg" icon={<Play />} onClick={startToday}>
            {state.kind === 'planned' ? 'Empezar sesión' : 'Entrenamiento libre'}
          </Button>
        )}
        <Button size="lg" variant="secondary" icon={<ClipboardList />} onClick={onPickTemplate} disabled={!hasTemplates}>
          Desde plantilla
        </Button>
      </div>
    );
  }

  const groupOf = (id: string) => {
    const ex = resolve(id);
    return ex ? muscleLabel(ex.muscle) : undefined;
  };

  return (
    <GlassCard variant="glow" sheen aria-labelledby="today-train" className="today">
      <div className="today__head">
        <div className="today__top">
          <p className="t-eyebrow">Hoy · {formatDate.header(today)}</p>
          <span className={status.cls}>
            {status.icon}
            {status.label}
          </span>
        </div>
        <h2 id="today-train" className="today__title">
          {title}
        </h2>
        {groups.length > 0 ? (
          <p className="today__groups">{groups.map(muscleShort).join(' · ')}</p>
        ) : plannedGroups.length > 0 ? (
          <p className="today__groups today__groups--planned">Previsto: {plannedGroups.map(muscleShort).join(' · ')}</p>
        ) : null}
        {meta && <p className="today__meta">{meta}</p>}
      </div>

      <MuscleMap figure={figureFor(profile)} data={{ mode: 'session', session, scope }} library={list} empty={empty} />

      <div className="today__cta">{cta}</div>

      {session.exercises.length > 0 && (
        <section className="today__list" aria-labelledby="today-ex">
          <h3 id="today-ex" className="today__label">
            Ejercicios
          </h3>
          <ul className="today__ex">
            {session.exercises.map((e, i) => (
              <li key={`${e.exerciseId}-${i}`} data-status={state.kind === 'planned' ? 'planned' : e.status}>
                <span className="today__ex-main">
                  <span className="today__ex-name">{e.name}</span>
                  <span className="today__ex-mus">{exerciseMusclesText(e, groupOf)}</span>
                </span>
                <ExerciseState e={e} planned={state.kind === 'planned'} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="today__links">
        {lastWorkout && state.kind !== 'done' && (
          <Button variant="ghost" size="sm" icon={<History />} onClick={() => navigate(`/entreno?tab=historial&w=${lastWorkout.id}`)}>
            Último: {lastWorkout.name} · {formatDate.relative(lastWorkout.date, today)}
          </Button>
        )}
        <Button variant="ghost" size="sm" icon={<Activity />} onClick={() => navigate('/entreno?tab=stats')}>
          Tu semana muscular
        </Button>
        <Button variant="ghost" size="sm" icon={<CalendarPlus />} onClick={onLogPast}>
          Registrar sesión pasada
        </Button>
      </div>
    </GlassCard>
  );
}

function ExerciseState({ e, planned }: { e: SessionExercise; planned: boolean }) {
  if (planned) return <span className="badge">{e.total} {e.total === 1 ? 'serie' : 'series'}</span>;
  if (e.status === 'done')
    return (
      <span className="badge badge--good">
        <Check aria-hidden="true" />
        Hecho
      </span>
    );
  if (e.status === 'partial') return <span className="badge badge--accent">{`${e.done}/${e.total} series`}</span>;
  return <span className="badge">Pendiente</span>;
}
