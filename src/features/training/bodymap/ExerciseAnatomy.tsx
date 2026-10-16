import { exerciseMuscles, muscleName, type AnatomyExercise, type MuscleId } from '@/domain/training/anatomy';
import { muscleLabel } from '@/domain/training/catalog';
import type { BodyFigure } from '@/domain/types';
import { BodyMap, type RegionTone } from './BodyMap';
import './bodymap.css';

/** The muscles an exercise trains, drawn with the same figure and colours as the session map. */
export function ExerciseAnatomy({ exercise, figure }: { exercise: AnatomyExercise; figure: BodyFigure }) {
  const m = exerciseMuscles(exercise);
  if (m.source === 'none') {
    return (
      <p className="t-small t-muted">
        {m.reason === 'conditioning'
          ? `${muscleLabel(exercise.muscle)}: no marca músculos concretos en el mapa.`
          : 'Ejercicio de cuerpo completo sin detalle de músculos.'}
      </p>
    );
  }
  const tones: Partial<Record<MuscleId, RegionTone>> = {};
  for (const id of m.primary) tones[id] = { fill: 'primary', pending: null };
  for (const id of m.secondary) tones[id] = { fill: 'secondary', pending: null };
  const describe = (id: MuscleId) => `${muscleName(id)}: ${m.primary.includes(id) ? 'principal' : m.secondary.includes(id) ? 'secundario' : 'no interviene'}`;
  return (
    <div className="ex-anatomy mmap">
      <div className="ex-anatomy__figs" aria-hidden="true">
        <BodyMap figure={figure} view="front" tones={tones} selected={null} describe={describe} />
        <BodyMap figure={figure} view="back" tones={tones} selected={null} describe={describe} />
      </div>
      <dl className="ex-anatomy__list">
        <div>
          <dt>
            <span className="mmap__key" data-fill="primary" aria-hidden="true" /> Principales
          </dt>
          <dd>{m.primary.map(muscleName).join(', ')}</dd>
        </div>
        {m.secondary.length > 0 && (
          <div>
            <dt>
              <span className="mmap__key" data-fill="secondary" aria-hidden="true" /> Secundarios
            </dt>
            <dd>{m.secondary.map(muscleName).join(', ')}</dd>
          </div>
        )}
        {m.source === 'group' && <p className="mmap__fine">Ejercicio personalizado: se marca el grupo muscular completo que elegiste.</p>}
      </dl>
    </div>
  );
}
