import { PencilLine, Search, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { UsdaFood } from '@/domain/nutrition/usda';
import type { Nutrients } from '@/domain/types';
import { formatInt, formatNumber } from '@/domain/units';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/Field';
import { Sheet } from '@/ui/Sheet';
import { FoodApiError, searchFoods, type FoodSearchResult } from './api';
import { dataTypeLabel } from './draft';

interface Props {
  open: boolean;
  initial?: string;
  onClose: () => void;
  onPick: (food: UsdaFood, name: string) => void;
  /** Typical values estimated by the AI (when the database has little or nothing). */
  onEstimate: (per100: Nutrients, name: string) => void;
  onManual: (name: string) => void;
}

type SearchState = { kind: 'idle' } | { kind: 'loading' } | ({ kind: 'done' } & FoodSearchResult) | { kind: 'error'; error: FoodApiError };

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase('es') + s.slice(1);

/** Search in USDA FoodData Central (Spanish names are translated on the server). */
export function FoodSearchSheet({ open, initial, onClose, onPick, onEstimate, onManual }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="Buscar alimento" description="Valores por 100 g de USDA FoodData Central, o una estimación de IA marcada como tal." initialFocus="input">
      <SearchBody initial={initial} onPick={onPick} onEstimate={onEstimate} onManual={onManual} />
    </Sheet>
  );
}

function SearchBody({ initial, onPick, onEstimate, onManual }: Omit<Props, 'open' | 'onClose'>) {
  const [query, setQuery] = useState(initial ?? '');
  const [state, setState] = useState<SearchState>({ kind: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const q = query.trim();

  useEffect(() => {
    if (q.length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setState({ kind: 'loading' });
      searchFoods(q)
        .then((result) => !cancelled && setState({ kind: 'done', ...result }))
        .catch((e: unknown) => !cancelled && setState({ kind: 'error', error: e instanceof FoodApiError ? e : new FoodApiError('upstream', 'No se ha podido buscar.') }));
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q, attempt]);

  const shown: SearchState = q.length < 2 ? { kind: 'idle' } : state;
  const name = capitalize(q);

  return (
    <div className="food-search">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setAttempt((a) => a + 1);
        }}
      >
        <TextField
          label="Alimento"
          hideLabel
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ej.: garbanzos cocidos"
          maxLength={80}
          enterKeyHint="search"
          autoComplete="off"
        />
      </form>
      <div aria-live="polite" className="food-search__results">
        {shown.kind === 'idle' && <p className="t-small">Escribe al menos 2 letras. Cuanto más concreto, mejor: «pechuga de pollo a la plancha», «arroz integral cocido»…</p>}
        {shown.kind === 'loading' && (
          <ul className="food-search__list" aria-label="Buscando">
            {[0, 1, 2].map((i) => (
              <li key={i} className="food-search__skeleton" />
            ))}
          </ul>
        )}
        {shown.kind === 'error' && (
          <div className="food-search__msg" role="alert">
            <p>{shown.error.message}</p>
            <div className="hstack">
              <Button size="sm" variant="secondary" onClick={() => setAttempt((a) => a + 1)}>
                Reintentar
              </Button>
              <Button size="sm" variant="ghost" icon={<PencilLine />} onClick={() => onManual(name)}>
                Introducir valores
              </Button>
            </div>
          </div>
        )}
        {shown.kind === 'done' && shown.estimate?.per100 && (
          <button type="button" className="alt alt--estimate" onClick={() => onEstimate(shown.estimate!.per100!, capitalize(shown.estimate!.name) || name)}>
            <span className="alt__name">
              <Sparkles aria-hidden="true" /> {capitalize(shown.estimate.name)} · valores típicos
            </span>
            <span className="alt__meta t-num">
              {formatInt(shown.estimate.per100.kcal)} kcal · P {formatNumber(shown.estimate.per100.protein, 1)} · H {formatNumber(shown.estimate.per100.carbs, 1)} · G{' '}
              {formatNumber(shown.estimate.per100.fat, 1)} por 100 g · estimación de IA
            </span>
          </button>
        )}
        {shown.kind === 'done' &&
          (shown.foods.length === 0 ? (
            shown.estimate ? null : (
            <div className="food-search__msg">
              <p>Sin resultados para «{q}». Prueba con otras palabras o introduce los valores de la etiqueta.</p>
              <Button size="sm" variant="secondary" icon={<PencilLine />} onClick={() => onManual(name)}>
                Introducir valores
              </Button>
            </div>
            )
          ) : (
            <ul className="food-search__list">
              {shown.foods.map((f) => (
                <li key={f.fdcId}>
                  <button type="button" className="alt" onClick={() => onPick(f, name)}>
                    <span className="alt__name">{f.description}</span>
                    <span className="alt__meta t-num">
                      {formatInt(f.per100.kcal)} kcal · P {formatNumber(f.per100.protein, 1)} · H {formatNumber(f.per100.carbs, 1)} · G{' '}
                      {formatNumber(f.per100.fat, 1)} por 100 g · {dataTypeLabel(f.dataType)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ))}
      </div>
      {shown.kind === 'done' && (shown.foods.length > 0 || shown.estimate) && (
        <button type="button" className="link-btn food-search__manual" onClick={() => onManual(name)}>
          <Search aria-hidden="true" /> ¿No está? Introduce los valores de la etiqueta
        </button>
      )}
    </div>
  );
}
