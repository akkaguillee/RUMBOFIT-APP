import { AlertTriangle, ChevronRight, Info, Pencil, Plus, Search, Trash2, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useCompletedWorkouts, useExerciseLibrary, useProfile } from '@/db/hooks';
import { deleteExercise } from '@/db/repos/training';
import { formatDate, formatDuration } from '@/domain/dates';
import { figureFor } from '@/domain/training/anatomy';
import { EXERCISE_CATALOG, MEASURE_LABELS, MUSCLE_GROUPS, muscleLabel } from '@/domain/training/catalog';
import { exerciseRecords } from '@/domain/training/stats';
import type { Exercise, MuscleGroup } from '@/domain/types';
import { formatNumber } from '@/domain/units';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { GlassCard } from '@/ui/GlassCard';
import { Sheet } from '@/ui/Sheet';
import { toast } from '@/ui/toast';
import { ExerciseAnatomy } from './bodymap/ExerciseAnatomy';
import { ExerciseFormSheet } from './ExerciseFormSheet';

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function ExercisesPanel() {
  const { list } = useExerciseLibrary();
  const workouts = useCompletedWorkouts();
  const profile = useProfile();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | 'all' | 'custom'>('all');
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [form, setForm] = useState<{ open: boolean; exercise?: Exercise | null }>({ open: false });
  const [toDelete, setToDelete] = useState<Exercise | null>(null);

  const filtered = useMemo(() => {
    const nq = normalize(q.trim());
    return list.filter(
      (e) => (muscle === 'all' || (muscle === 'custom' ? e.custom : e.muscle === muscle)) && (!nq || normalize(e.name).includes(nq)),
    );
  }, [list, q, muscle]);

  const grouped = useMemo(() => {
    const m = new Map<MuscleGroup, Exercise[]>();
    for (const e of filtered) {
      if (!m.has(e.muscle)) m.set(e.muscle, []);
      m.get(e.muscle)!.push(e);
    }
    return MUSCLE_GROUPS.filter((g) => m.has(g.id)).map((g) => [g, m.get(g.id)!] as const);
  }, [filtered]);

  const rec = detail && workouts ? exerciseRecords(workouts, detail.id) : null;

  return (
    <GlassCard aria-labelledby="ex-title">
      <div className="card__head">
        <h2 id="ex-title" className="card__title">
          Catálogo · {EXERCISE_CATALOG.length} ejercicios base
        </h2>
        <Button size="sm" icon={<Plus />} onClick={() => setForm({ open: true, exercise: null })}>
          Nuevo
        </Button>
      </div>
      <div className="vstack" style={{ gap: 12 }}>
        <div className="input-wrap">
          <Search aria-hidden="true" style={{ width: 18, height: 18, marginLeft: 14, color: 'var(--text-3)' }} />
          <input className="input" placeholder="Buscar ejercicio" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar ejercicio" />
        </div>
        <div className="chip-row" role="group" aria-label="Filtrar">
          <button type="button" className="chip" aria-pressed={muscle === 'all'} onClick={() => setMuscle('all')}>
            Todos
          </button>
          <button type="button" className="chip" aria-pressed={muscle === 'custom'} onClick={() => setMuscle('custom')}>
            Personalizados
          </button>
          {MUSCLE_GROUPS.map((m) => (
            <button key={m.id} type="button" className="chip" aria-pressed={muscle === m.id} onClick={() => setMuscle(m.id)}>
              {m.short}
            </button>
          ))}
        </div>
        {grouped.length === 0 && <p className="t-small">No hay ejercicios con este filtro.</p>}
        {grouped.map(([g, items]) => (
          <section key={g.id} aria-label={g.label}>
            <h3 className="t-eyebrow" style={{ margin: '8px 0 4px' }}>
              {g.label}
            </h3>
            <ul>
              {items.map((e) => (
                <li key={e.id}>
                  <button type="button" className="pick-row" onClick={() => setDetail(e)}>
                    <span className="grow">
                      <span className="list-row__title" style={{ display: 'block' }}>
                        {e.name}
                      </span>
                      <span className="list-row__sub">
                        {e.equipment} · {MEASURE_LABELS[e.measure]}
                        {e.custom ? ' · Personalizado' : ''}
                      </span>
                    </span>
                    <ChevronRight aria-hidden="true" style={{ width: 16, color: 'var(--text-3)' }} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="t-small t-muted">El catálogo es un punto de partida, no incluye todos los ejercicios que existen. Añade los tuyos cuando quieras.</p>
      </div>

      <Sheet
        open={detail !== null && !form.open && !toDelete}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ''}
        description={detail ? `${muscleLabel(detail.muscle)} · ${detail.equipment}` : undefined}
        footer={
          detail?.custom ? (
            <>
              <Button variant="secondary" icon={<Trash2 />} onClick={() => setToDelete(detail)}>
                Eliminar
              </Button>
              <Button icon={<Pencil />} onClick={() => setForm({ open: true, exercise: detail })}>
                Editar
              </Button>
            </>
          ) : undefined
        }
      >
        {detail && (
          <div className="vstack">
            <ExerciseAnatomy exercise={detail} figure={figureFor(profile)} />
            {detail.tip && (
              <div className="callout">
                <Info aria-hidden="true" />
                <p>{detail.tip}</p>
              </div>
            )}
            {detail.caution && (
              <div className="callout callout--warn">
                <AlertTriangle aria-hidden="true" />
                <p>{detail.caution}</p>
              </div>
            )}
            <div>
              <h3 className="card__title" style={{ marginBottom: 8 }}>
                <Trophy aria-hidden="true" /> Tus marcas
              </h3>
              {!rec?.sessions ? (
                <p className="t-small">Todavía no has registrado este ejercicio.</p>
              ) : (
                <dl className="formula">
                  <div>
                    <dt>Sesiones registradas</dt>
                    <dd>{rec.sessions}</dd>
                  </div>
                  {rec.maxKg && (
                    <div>
                      <dt>Mayor peso registrado</dt>
                      <dd>
                        {formatNumber(rec.maxKg.value, 2)} kg · {rec.maxKg.detail} · {formatDate.dayMonth(rec.maxKg.date)}
                      </dd>
                    </div>
                  )}
                  {rec.est1RM && (
                    <div>
                      <dt>1RM estimado (Epley, no medido)</dt>
                      <dd>
                        ≈ {formatNumber(rec.est1RM.value, 1)} kg · desde {rec.est1RM.detail}
                      </dd>
                    </div>
                  )}
                  {rec.bestVolume && (
                    <div>
                      <dt>Mayor volumen en una sesión</dt>
                      <dd>{formatNumber(rec.bestVolume.value, 0)} kg</dd>
                    </div>
                  )}
                  {rec.maxReps && detail.measure !== 'weight_reps' && (
                    <div>
                      <dt>Máximo de repeticiones</dt>
                      <dd>{rec.maxReps.value}</dd>
                    </div>
                  )}
                  {rec.maxDuration && (
                    <div>
                      <dt>Mayor duración</dt>
                      <dd>{formatDuration(rec.maxDuration.value)}</dd>
                    </div>
                  )}
                  {rec.maxDistance && (
                    <div>
                      <dt>Mayor distancia</dt>
                      <dd>{formatNumber(rec.maxDistance.value, 2)} km</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
          </div>
        )}
      </Sheet>
      <ExerciseFormSheet
        open={form.open}
        exercise={form.exercise}
        onClose={() => {
          setForm({ open: false });
          setDetail(null);
        }}
      />
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="¿Eliminar este ejercicio?"
        message="Si aparece en entrenamientos anteriores, se ocultará del catálogo pero se conservará en tu historial."
        onConfirm={async () => {
          const r = await deleteExercise(toDelete!.id);
          toast(r === 'archived' ? 'Ejercicio ocultado (se conserva en el historial)' : 'Ejercicio eliminado');
          setDetail(null);
        }}
      />
    </GlassCard>
  );
}
