import { useRef, type KeyboardEvent } from 'react';
import { updateProfile } from '@/db/repos/profile';
import { figureFor } from '@/domain/training/anatomy';
import type { BodyFigure, Profile } from '@/domain/types';
import { toastError } from '@/ui/toast';
import { bodyGeometry, VIEWBOX } from './geometry';
import './bodymap.css';

type Choice = 'auto' | BodyFigure;

const OPTIONS: { value: Choice; label: string }[] = [
  { value: 'auto', label: 'Automática' },
  { value: 'male', label: 'Masculina' },
  { value: 'female', label: 'Femenina' },
  { value: 'neutral', label: 'Neutra' },
];

const FIGURE_NAME: Record<BodyFigure, string> = { male: 'masculina', female: 'femenina', neutral: 'neutra' };

/** Perfil › figure of the muscle map. «Automática» follows the sex given in the personal data. */
export function FigurePicker({ profile }: { profile: Profile }) {
  const value: Choice = profile.bodyFigure ?? 'auto';
  const auto = figureFor({ sex: profile.sex });
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const choose = (v: Choice) => {
    if (v === value) return;
    updateProfile({ bodyFigure: v === 'auto' ? undefined : v }).catch(toastError);
  };

  const onKey = (e: KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + OPTIONS.length) % OPTIONS.length;
    refs.current[next]?.focus();
    choose(OPTIONS[next]!.value);
  };

  return (
    <div className="field">
      <span className="field__label" id="figure-label">
        Figura del mapa muscular
      </span>
      <div className="figure-pick bm-preview" role="radiogroup" aria-labelledby="figure-label">
        {OPTIONS.map((o, i) => {
          const on = value === o.value;
          const fig = o.value === 'auto' ? auto : o.value;
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              className="figure-pick__opt"
              onClick={() => choose(o.value)}
              onKeyDown={(e) => onKey(e, i)}
            >
              <svg className="figure-pick__fig" viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`} aria-hidden="true">
                <path d={bodyGeometry(fig, 'front').silhouette} />
              </svg>
              <span>{o.label}</span>
            </button>
          );
        })}
      </div>
      <span className="field__hint">
        «Automática» sigue el sexo de tus datos personales (ahora, figura {FIGURE_NAME[auto]}). Solo cambia el dibujo: los datos y los cálculos son los mismos.
      </span>
    </div>
  );
}
