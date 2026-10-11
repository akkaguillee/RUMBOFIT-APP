import { Check, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useExerciseLibrary } from '@/db/hooks';
import { MUSCLE_GROUPS, muscleLabel } from '@/domain/training/catalog';
import type { MuscleGroup } from '@/domain/types';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';
import { ExerciseFormSheet } from './ExerciseFormSheet';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (ids: string[]) => void;
  initialMuscles?: MuscleGroup[];
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function ExercisePicker({ open, onClose, onPick, initialMuscles }: Props) {
  const { list } = useExerciseLibrary();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all');
  const [picked, setPicked] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const nq = normalize(q.trim());
    return list.filter((e) => (muscle === 'all' || e.muscle === muscle || e.secondary?.includes(muscle)) && (!nq || normalize(e.name).includes(nq)));
  }, [list, q, muscle]);

  const preferred = initialMuscles?.length ? MUSCLE_GROUPS.filter((m) => initialMuscles.includes(m.id)) : [];

  const close = () => {
    setPicked([]);
    setQ('');
    onClose();
  };

  return (
    <>
      <Sheet
        open={open && !creating}
        onClose={close}
        title="Añadir ejercicios"
        wide
        footer={
          <>
            <Button variant="secondary" icon={<Plus />} onClick={() => setCreating(true)}>
              Crear
            </Button>
            <Button
              disabled={!picked.length}
              onClick={() => {
                onPick(picked);
                close();
              }}
            >
              Añadir {picked.length ? `(${picked.length})` : ''}
            </Button>
          </>
        }
      >
        <div className="vstack" style={{ gap: 12 }}>
          <div className="input-wrap">
            <Search aria-hidden="true" style={{ width: 18, height: 18, marginLeft: 14, color: 'var(--text-3)' }} />
            <input className="input" placeholder="Buscar ejercicio" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar ejercicio" data-autofocus />
          </div>
          <div className="chip-row" role="group" aria-label="Filtrar por grupo muscular">
            <button type="button" className="chip" aria-pressed={muscle === 'all'} onClick={() => setMuscle('all')}>
              Todos
            </button>
            {[...preferred, ...MUSCLE_GROUPS.filter((m) => !preferred.includes(m))].map((m) => (
              <button key={m.id} type="button" className="chip" aria-pressed={muscle === m.id} onClick={() => setMuscle(m.id)}>
                {m.short}
              </button>
            ))}
          </div>
          <ul className="pick-list" aria-label="Ejercicios">
            {filtered.map((e) => {
              const on = picked.includes(e.id);
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    className="pick-row"
                    aria-pressed={on}
                    onClick={() => setPicked((p) => (on ? p.filter((x) => x !== e.id) : [...p, e.id]))}
                  >
                    <span className="grow">
                      <span className="list-row__title" style={{ display: 'block' }}>
                        {e.name}
                      </span>
                      <span className="list-row__sub">
                        {muscleLabel(e.muscle)} · {e.equipment}
                        {e.custom ? ' · Personalizado' : ''}
                      </span>
                    </span>
                    <span className="choice__check" aria-hidden="true">
                      <Check />
                    </span>
                  </button>
                </li>
              );
            })}
            {!filtered.length && <li className="t-small" style={{ padding: 16 }}>No hay ejercicios con ese filtro. Puedes crear uno personalizado.</li>}
          </ul>
        </div>
      </Sheet>
      <ExerciseFormSheet
        open={creating}
        onClose={() => setCreating(false)}
        defaultMuscle={muscle === 'all' ? undefined : muscle}
        onCreated={(id) => setPicked((p) => [...p, id])}
      />
    </>
  );
}
