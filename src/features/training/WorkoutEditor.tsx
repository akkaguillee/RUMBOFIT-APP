import { ArrowDown, ArrowUp, Check, Copy, History, MoreHorizontal, Plus, Timer, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { newSet } from '@/db/repos/training';
import { muscleLabel } from '@/domain/training/catalog';
import { lastPerformance } from '@/domain/training/stats';
import type { Exercise, ExerciseMeasure, SetEntry, Workout, WorkoutExercise } from '@/domain/types';
import { formatNumber, parseDecimal } from '@/domain/units';
import { IconButton } from '@/ui/Button';
import { cx } from '@/ui/cx';
import { spring } from '@/ui/motion';
import { durationToInput, formatSet, parseDuration, REST_OPTIONS } from './format';

type Mutate = (fn: (exs: WorkoutExercise[]) => WorkoutExercise[]) => void;

interface EditorProps {
  exercises: WorkoutExercise[];
  onChange: Mutate;
  resolve: (id: string) => Exercise | undefined;
  history: Workout[];
  excludeId?: number;
  mode: 'live' | 'log';
  onSetDone?: (exercise: WorkoutExercise) => void;
}

export function WorkoutEditor({ exercises, onChange, resolve, history, excludeId, mode, onSetDone }: EditorProps) {
  const current = mode === 'live' ? exercises.find((ex) => ex.sets.some((s) => !s.done))?.uid : undefined;
  return (
    <div className="vstack">
      <AnimatePresence initial={false}>
        {exercises.map((ex, i) => (
          <motion.div
            key={ex.uid}
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.2 } }}
            transition={spring.soft}
          >
            <ExerciseCard
              ex={ex}
              index={i}
              count={exercises.length}
              exercise={resolve(ex.exerciseId)}
              previous={lastPerformance(history, ex.exerciseId, excludeId)}
              onChange={onChange}
              mode={mode}
              current={current === ex.uid}
              onSetDone={onSetDone}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

interface CardProps {
  ex: WorkoutExercise;
  index: number;
  count: number;
  exercise?: Exercise;
  previous: SetEntry[] | null;
  onChange: Mutate;
  mode: 'live' | 'log';
  current: boolean;
  onSetDone?: (exercise: WorkoutExercise) => void;
}

function ExerciseCard({ ex, index, count, exercise, previous, onChange, mode, current, onSetDone }: CardProps) {
  const [editing, setEditing] = useState(false);
  const measure: ExerciseMeasure = exercise?.measure ?? 'weight_reps';
  const done = ex.sets.filter((s) => s.done).length;

  const update = (fn: (e: WorkoutExercise) => WorkoutExercise) => onChange((exs) => exs.map((e) => (e.uid === ex.uid ? fn(e) : e)));
  const move = (delta: number) =>
    onChange((exs) => {
      const arr = [...exs];
      const [item] = arr.splice(index, 1);
      arr.splice(index + delta, 0, item!);
      return arr;
    });

  const usePrevious = () =>
    previous &&
    update((e) => ({
      ...e,
      sets: previous.map((p, i) => ({
        ...(e.sets[i] ?? newSet()),
        kg: p.kg,
        reps: p.reps,
        durationSec: p.durationSec,
        distanceKm: p.distanceKm,
        done: e.sets[i]?.done ?? false,
      })),
    }));

  return (
    <section className={cx('ex-card glass', current && 'is-current')} aria-label={exercise?.name ?? 'Ejercicio'}>
      <header className="ex-card__head">
        <div className="grow">
          {current && <span className="ex-card__now">Ejercicio actual</span>}
          <h3 className="ex-card__name">{exercise?.name ?? 'Ejercicio eliminado'}</h3>
          <p className="ex-card__meta">
            {exercise ? muscleLabel(exercise.muscle) : ''} · {done}/{ex.sets.length} series
            {mode === 'live' && (
              <>
                {' · '}
                <Timer aria-hidden="true" style={{ width: 12, height: 12, display: 'inline', verticalAlign: '-1px' }} /> {ex.restSec} s
              </>
            )}
          </p>
        </div>
        <IconButton label={editing ? 'Terminar edición' : 'Editar ejercicio'} size="sm" tone={editing ? 'accent' : 'default'} onClick={() => setEditing((v) => !v)} aria-pressed={editing}>
          {editing ? <Check /> : <MoreHorizontal />}
        </IconButton>
      </header>

      {editing && (
        <div className="ex-card__tools">
          <IconButton label="Subir ejercicio" size="sm" onClick={() => move(-1)} disabled={index === 0}>
            <ArrowUp />
          </IconButton>
          <IconButton label="Bajar ejercicio" size="sm" onClick={() => move(1)} disabled={index === count - 1}>
            <ArrowDown />
          </IconButton>
          <label className="ex-card__rest">
            <span className="sr-only">Descanso entre series</span>
            <Timer aria-hidden="true" />
            <select value={ex.restSec} onChange={(e) => update((x) => ({ ...x, restSec: Number(e.target.value) }))} aria-label="Descanso entre series">
              {REST_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min`}
                </option>
              ))}
            </select>
          </label>
          <IconButton label="Quitar ejercicio" size="sm" onClick={() => onChange((exs) => exs.filter((e) => e.uid !== ex.uid))} style={{ marginLeft: 'auto' }}>
            <Trash2 />
          </IconButton>
        </div>
      )}

      {previous && (
        <div className="ex-card__prev">
          <History aria-hidden="true" />
          <span className="grow truncate">Última vez: {previous.map((s) => formatSet(s, measure)).join(' · ')}</span>
          <button type="button" className="link-btn" onClick={usePrevious}>
            <Copy aria-hidden="true" /> Usar
          </button>
        </div>
      )}

      <div className={cx('set-table', `set-table--${measure}`, mode === 'log' && 'set-table--log')} role="table" aria-label={`Series de ${exercise?.name ?? 'ejercicio'}`}>
        <div className="set-row set-row--head" role="row">
          <span role="columnheader">Serie</span>
          {measure === 'weight_reps' && (
            <>
              <span role="columnheader">kg</span>
              <span role="columnheader">Reps</span>
            </>
          )}
          {measure === 'reps' && <span role="columnheader">Reps</span>}
          {measure === 'time' && <span role="columnheader">Tiempo (m:ss)</span>}
          {measure === 'distance_time' && (
            <>
              <span role="columnheader">km</span>
              <span role="columnheader">Tiempo</span>
            </>
          )}
          <span role="columnheader" className="sr-only">
            {editing ? 'Acciones' : mode === 'live' ? 'Completada' : ''}
          </span>
        </div>
        <AnimatePresence initial={false}>
          {ex.sets.map((s, si) => (
            <SetRow
              key={s.uid}
              set={s}
              index={si}
              total={ex.sets.length}
              measure={measure}
              mode={mode}
              editing={editing}
              placeholder={previous?.[si] ?? previous?.[previous.length - 1]}
              onCommit={(patch) => update((e) => ({ ...e, sets: e.sets.map((x) => (x.uid === s.uid ? { ...x, ...patch } : x)) }))}
              onToggleDone={(patch) => {
                const willBeDone = !s.done;
                update((e) => ({
                  ...e,
                  sets: e.sets.map((x) => (x.uid === s.uid ? { ...x, ...patch, done: willBeDone, completedAt: willBeDone ? Date.now() : undefined } : x)),
                }));
                if (willBeDone) onSetDone?.(ex);
              }}
              onMove={(delta) =>
                update((e) => {
                  const arr = [...e.sets];
                  const [it] = arr.splice(si, 1);
                  arr.splice(si + delta, 0, it!);
                  return { ...e, sets: arr };
                })
              }
              onRemove={() => update((e) => ({ ...e, sets: e.sets.filter((x) => x.uid !== s.uid) }))}
            />
          ))}
        </AnimatePresence>
      </div>
      <button
        type="button"
        className="ex-card__add"
        onClick={() =>
          update((e) => {
            const last = e.sets[e.sets.length - 1];
            return { ...e, sets: [...e.sets, newSet({ kg: last?.kg, reps: last?.reps, durationSec: last?.durationSec, distanceKm: last?.distanceKm })] };
          })
        }
      >
        <Plus aria-hidden="true" /> Añadir serie
      </button>
    </section>
  );
}

interface RowProps {
  set: SetEntry;
  index: number;
  total: number;
  measure: ExerciseMeasure;
  mode: 'live' | 'log';
  editing: boolean;
  placeholder?: SetEntry;
  onCommit: (patch: Partial<SetEntry>) => void;
  onToggleDone: (patch: Partial<SetEntry>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}

const numStr = (n?: number) => (n === undefined ? '' : formatNumber(n, 2).replace(/\./g, ''));

function SetRow({ set, index, total, measure, mode, editing, placeholder, onCommit, onToggleDone, onMove, onRemove }: RowProps) {
  const [kg, setKg] = useState(numStr(set.kg));
  const [reps, setReps] = useState(set.reps === undefined ? '' : String(set.reps));
  const [dur, setDur] = useState(durationToInput(set.durationSec));
  const [km, setKm] = useState(numStr(set.distanceKm));
  const [err, setErr] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Sync from storage when the set changes elsewhere (e.g. "Usar anterior"),
  // unless the user is editing this row. After a local commit we wait until
  // storage reflects it, so a stale snapshot never wipes what was just typed.
  const keyOf = (v: Partial<SetEntry>) => `${v.kg}|${v.reps}|${v.durationSec}|${v.distanceKm}`;
  const storedKey = keyOf(set);
  const [syncedKey, setSyncedKey] = useState(storedKey);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  if (pendingKey !== null) {
    if (storedKey === pendingKey) {
      setPendingKey(null);
      setSyncedKey(storedKey);
    }
  } else if (syncedKey !== storedKey && !dirty) {
    setSyncedKey(storedKey);
    setKg(numStr(set.kg));
    setReps(set.reps === undefined ? '' : String(set.reps));
    setDur(durationToInput(set.durationSec));
    setKm(numStr(set.distanceKm));
  }

  const parse = (): Partial<SetEntry> | null => {
    const k = kg ? parseDecimal(kg) : undefined;
    const r = reps ? Number(reps) : undefined;
    const d = dur ? parseDuration(dur) : undefined;
    const dist = km ? parseDecimal(km) : undefined;
    if (k === null || d === null || dist === null) return null;
    if ((k ?? 0) < 0 || (k ?? 0) > 1000 || (r ?? 0) > 1000 || (dist ?? 0) > 1000) return null;
    return { kg: k, reps: r, durationSec: d, distanceKm: dist };
  };

  const commit = () => {
    if (!dirty) return;
    const p = parse();
    if (!p) {
      setErr(true);
      return;
    }
    setErr(false);
    setDirty(false);
    if (keyOf(p) !== storedKey) setPendingKey(keyOf(p));
    onCommit(p);
  };

  const change = (setter: (v: string) => void) => (v: string) => {
    setDirty(true);
    setErr(false);
    setter(v);
  };

  const toggle = () => {
    const p = parse();
    if (!p) {
      setErr(true);
      return;
    }
    // Fill empty fields with the previous session's values when completing a set.
    const filled = {
      kg: p.kg ?? (measure === 'weight_reps' ? placeholder?.kg : undefined),
      reps: p.reps ?? (measure === 'weight_reps' || measure === 'reps' ? placeholder?.reps : undefined),
      durationSec: p.durationSec ?? (measure === 'time' || measure === 'distance_time' ? placeholder?.durationSec : undefined),
      distanceKm: p.distanceKm ?? (measure === 'distance_time' ? placeholder?.distanceKm : undefined),
    };
    const ok =
      measure === 'weight_reps' || measure === 'reps' ? (filled.reps ?? 0) > 0 : measure === 'time' ? (filled.durationSec ?? 0) > 0 : (filled.durationSec ?? 0) > 0 || (filled.distanceKm ?? 0) > 0;
    if (!set.done && !ok) {
      setErr(true);
      return;
    }
    setDirty(false);
    if (keyOf(filled) !== storedKey) setPendingKey(keyOf(filled));
    onToggleDone(filled);
  };

  const inputProps = (label: string) => ({
    className: cx('set-input', err && 'is-error'),
    onBlur: commit,
    'aria-label': `${label}, serie ${index + 1}`,
    'aria-invalid': err || undefined,
    onKeyDown: (e: React.KeyboardEvent) => e.key === 'Enter' && (e.target as HTMLInputElement).blur(),
  });

  return (
    <motion.div
      role="row"
      className={cx('set-row', set.done && mode === 'live' && 'is-done')}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
    >
      <span role="cell" className="set-row__n">
        {index + 1}
      </span>
      {measure === 'weight_reps' && (
        <>
          <span role="cell">
            <input inputMode="decimal" value={kg} placeholder={placeholder?.kg !== undefined ? numStr(placeholder.kg) : '0'} onChange={(e) => change(setKg)(e.target.value)} {...inputProps('Peso en kg')} />
          </span>
          <span role="cell">
            <input inputMode="numeric" value={reps} placeholder={placeholder?.reps !== undefined ? String(placeholder.reps) : '0'} onChange={(e) => change(setReps)(e.target.value.replace(/\D/g, ''))} {...inputProps('Repeticiones')} />
          </span>
        </>
      )}
      {measure === 'reps' && (
        <span role="cell">
          <input inputMode="numeric" value={reps} placeholder={placeholder?.reps !== undefined ? String(placeholder.reps) : '0'} onChange={(e) => change(setReps)(e.target.value.replace(/\D/g, ''))} {...inputProps('Repeticiones')} />
        </span>
      )}
      {measure === 'time' && (
        <span role="cell">
          <input inputMode="numeric" value={dur} placeholder={placeholder?.durationSec ? durationToInput(placeholder.durationSec) : '0:00'} onChange={(e) => change(setDur)(e.target.value)} {...inputProps('Tiempo')} />
        </span>
      )}
      {measure === 'distance_time' && (
        <>
          <span role="cell">
            <input inputMode="decimal" value={km} placeholder={placeholder?.distanceKm !== undefined ? numStr(placeholder.distanceKm) : '0'} onChange={(e) => change(setKm)(e.target.value)} {...inputProps('Distancia en km')} />
          </span>
          <span role="cell">
            <input inputMode="numeric" value={dur} placeholder={placeholder?.durationSec ? durationToInput(placeholder.durationSec) : '0:00'} onChange={(e) => change(setDur)(e.target.value)} {...inputProps('Tiempo')} />
          </span>
        </>
      )}
      <span role="cell" className="set-row__end">
        {editing ? (
          <span className="set-row__tools">
            <button type="button" className="set-tool" aria-label={`Subir serie ${index + 1}`} onClick={() => onMove(-1)} disabled={index === 0}>
              <ArrowUp />
            </button>
            <button type="button" className="set-tool" aria-label={`Bajar serie ${index + 1}`} onClick={() => onMove(1)} disabled={index === total - 1}>
              <ArrowDown />
            </button>
            <button type="button" className="set-tool set-tool--danger" aria-label={`Eliminar serie ${index + 1}`} onClick={onRemove}>
              <X />
            </button>
          </span>
        ) : mode === 'live' ? (
          <motion.button
            type="button"
            className="set-check"
            aria-pressed={set.done}
            aria-label={set.done ? `Desmarcar serie ${index + 1}` : `Completar serie ${index + 1}`}
            onClick={toggle}
            whileTap={{ scale: 0.85 }}
          >
            <AnimatePresence initial={false}>
              {set.done && (
                <motion.span key="c" initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={spring.bouncy} style={{ display: 'grid' }}>
                  <Check strokeWidth={3} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        ) : null}
      </span>
    </motion.div>
  );
}
