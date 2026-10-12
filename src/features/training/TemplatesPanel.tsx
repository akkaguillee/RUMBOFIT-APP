import { ArrowDown, ArrowUp, ClipboardList, Pencil, Play, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExerciseLibrary, useTemplates } from '@/db/hooks';
import { deleteTemplate, saveTemplate, startFromTemplate } from '@/db/repos/training';
import { MUSCLE_GROUPS, muscleShort } from '@/domain/training/catalog';
import type { MuscleGroup, TemplateExercise, WorkoutTemplate } from '@/domain/types';
import { formatNumber, parseDecimal } from '@/domain/units';
import { Button, IconButton } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { EmptyState } from '@/ui/EmptyState';
import { TextField } from '@/ui/Field';
import { GlassCard } from '@/ui/GlassCard';
import { Sheet } from '@/ui/Sheet';
import { toast, toastError } from '@/ui/toast';
import { ExercisePicker } from './ExercisePicker';
import { REST_OPTIONS } from './format';

export function TemplatesPanel() {
  const templates = useTemplates();
  const { resolve } = useExerciseLibrary();
  const navigate = useNavigate();
  const [editor, setEditor] = useState<{ open: boolean; template?: WorkoutTemplate | null }>({ open: false });
  const [toDelete, setToDelete] = useState<WorkoutTemplate | null>(null);

  if (!templates) return null;

  return (
    <div className="vstack">
      <div className="hstack" style={{ justifyContent: 'space-between' }}>
        <p className="t-small" style={{ flex: 1, minWidth: 0 }}>
          Rutinas reutilizables con series, repeticiones y descansos de partida.
        </p>
        <Button size="sm" icon={<Plus />} onClick={() => setEditor({ open: true, template: null })}>
          Nueva plantilla
        </Button>
      </div>
      {!templates.length ? (
        <div className="glass card">
          <EmptyState
            icon={<ClipboardList />}
            title="Sin plantillas todavía"
            text="Crea tu primera rutina o guarda un entrenamiento terminado como plantilla."
            action={
              <Button icon={<Plus />} onClick={() => setEditor({ open: true, template: null })}>
                Crear plantilla
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid-auto">
          {templates.map((t) => (
            <GlassCard key={t.id} rise={false}>
              <div className="workout-card">
                <span className="list-row__title">{t.name}</span>
                <span className="t-small">
                  {t.exercises.length} ejercicios · {t.exercises.reduce((a, e) => a + e.sets, 0)} series
                </span>
                {t.muscleGroups.length > 0 && (
                  <div className="chip-row chip-row--wrap" style={{ gap: 6 }}>
                    {t.muscleGroups.map((m) => (
                      <span key={m} className="badge">
                        {muscleShort(m)}
                      </span>
                    ))}
                  </div>
                )}
                <ul className="t-small" style={{ margin: '4px 0 8px' }}>
                  {t.exercises.slice(0, 4).map((e, i) => (
                    <li key={i} className="truncate">
                      {e.sets} × {resolve(e.exerciseId)?.name ?? 'Ejercicio'}
                    </li>
                  ))}
                  {t.exercises.length > 4 && <li className="t-muted">y {t.exercises.length - 4} más</li>}
                </ul>
                <div className="hstack" style={{ gap: 8 }}>
                  <Button
                    size="sm"
                    icon={<Play />}
                    className="grow"
                    onClick={async () => {
                      try {
                        await startFromTemplate(t);
                        navigate('/entreno/sesion');
                      } catch (e) {
                        toastError(e);
                      }
                    }}
                  >
                    Empezar
                  </Button>
                  <IconButton label={`Editar ${t.name}`} size="sm" onClick={() => setEditor({ open: true, template: t })}>
                    <Pencil />
                  </IconButton>
                  <IconButton label={`Eliminar ${t.name}`} size="sm" onClick={() => setToDelete(t)}>
                    <Trash2 />
                  </IconButton>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
      <TemplateEditor open={editor.open} template={editor.template} onClose={() => setEditor({ open: false })} />
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="¿Eliminar plantilla?"
        message="Los entrenamientos ya realizados con ella se conservan en tu historial."
        onConfirm={async () => {
          await deleteTemplate(toDelete!.id!);
          toast('Plantilla eliminada');
        }}
      />
    </div>
  );
}

function TemplateEditor({ open, template, onClose }: { open: boolean; template?: WorkoutTemplate | null; onClose: () => void }) {
  const { resolve } = useExerciseLibrary();
  const [name, setName] = useState('');
  const [muscles, setMuscles] = useState<MuscleGroup[]>([]);
  const [items, setItems] = useState<TemplateExercise[]>([]);
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [prevOpen, setPrevOpen] = useState(false);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setName(template?.name ?? '');
      setMuscles(template?.muscleGroups ?? []);
      setItems(template?.exercises ?? []);
      setError(null);
    }
  }

  const patch = (i: number, p: Partial<TemplateExercise>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const move = (i: number, d: number) =>
    setItems((xs) => {
      const a = [...xs];
      const [it] = a.splice(i, 1);
      a.splice(i + d, 0, it!);
      return a;
    });

  const save = async () => {
    setBusy(true);
    try {
      await saveTemplate({ name, muscleGroups: muscles, exercises: items }, template?.id);
      toast(template ? 'Plantilla actualizada' : 'Plantilla creada');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
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
        title={template ? 'Editar plantilla' : 'Nueva plantilla'}
        locked={busy}
        footer={
          <Button block onClick={save} loading={busy}>
            Guardar plantilla
          </Button>
        }
      >
        <div className="vstack">
          <TextField label="Nombre" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Por ejemplo, Pierna A" data-autofocus />
          <div className="field">
            <span className="field__label">Grupos musculares</span>
            <div className="chip-row chip-row--wrap" role="group" aria-label="Grupos musculares">
              {MUSCLE_GROUPS.map((m) => {
                const on = muscles.includes(m.id);
                return (
                  <button key={m.id} type="button" className="chip" aria-pressed={on} onClick={() => setMuscles(on ? muscles.filter((x) => x !== m.id) : [...muscles, m.id])}>
                    {m.short}
                  </button>
                );
              })}
            </div>
          </div>
          <ul className="vstack" style={{ gap: 10 }}>
            {items.map((it, i) => {
              const ex = resolve(it.exerciseId);
              const weighted = ex?.measure === 'weight_reps';
              const repsBased = ex?.measure === 'weight_reps' || ex?.measure === 'reps';
              return (
                <li key={`${it.exerciseId}-${i}`} className="glass card card--tight" style={{ borderRadius: 18 }}>
                  <div className="hstack" style={{ marginBottom: 10 }}>
                    <span className="grow list-row__title truncate">{ex?.name ?? 'Ejercicio'}</span>
                    <IconButton label="Subir" size="sm" tone="plain" onClick={() => move(i, -1)} disabled={i === 0}>
                      <ArrowUp />
                    </IconButton>
                    <IconButton label="Bajar" size="sm" tone="plain" onClick={() => move(i, 1)} disabled={i === items.length - 1}>
                      <ArrowDown />
                    </IconButton>
                    <IconButton label="Quitar" size="sm" tone="plain" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}>
                      <X />
                    </IconButton>
                  </div>
                  <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8 }}>
                    <TextField label="Series" inputMode="numeric" value={String(it.sets)} onChange={(e) => patch(i, { sets: Math.max(1, Math.min(20, Number(e.target.value.replace(/\D/g, '')) || 1)) })} />
                    {repsBased && <TextField label="Reps" inputMode="numeric" value={it.reps === undefined ? '' : String(it.reps)} onChange={(e) => patch(i, { reps: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : undefined })} />}
                    {weighted && (
                      <TextField
                        label="kg"
                        inputMode="decimal"
                        defaultValue={it.kg === undefined ? '' : formatNumber(it.kg, 2)}
                        onBlur={(e) => {
                          const v = parseDecimal(e.target.value);
                          patch(i, { kg: v === null ? undefined : v });
                        }}
                      />
                    )}
                    <label className="field">
                      <span className="field__label">Descanso</span>
                      <span className="input-wrap">
                        <select className="input" value={it.restSec} onChange={(e) => patch(i, { restSec: Number(e.target.value) })}>
                          {REST_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s} s
                            </option>
                          ))}
                        </select>
                      </span>
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
          <Button variant="secondary" icon={<Plus />} onClick={() => setPicker(true)}>
            Añadir ejercicios
          </Button>
          {error && (
            <p className="field__error" role="alert">
              {error}
            </p>
          )}
        </div>
      </Sheet>
      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        initialMuscles={muscles}
        onPick={(ids) => setItems((xs) => [...xs, ...ids.map((id) => ({ exerciseId: id, sets: 3, reps: resolve(id)?.measure === 'weight_reps' || resolve(id)?.measure === 'reps' ? 10 : undefined, restSec: 90 }))])}
      />
    </>
  );
}
