import { useRef, type KeyboardEvent } from 'react';
import type { BodyView, MuscleId, MuscleRole } from '@/domain/training/anatomy';
import type { BodyFigure } from '@/domain/types';
import { cx } from '@/ui/cx';
import { bodyGeometry, VIEWBOX } from './geometry';

/** How a region is painted: worked in the session (role) or weekly load level, plus work still to do. */
export interface RegionTone {
  fill: MuscleRole | 'l1' | 'l2' | 'l3' | null;
  pending: MuscleRole | null;
}

interface Props {
  figure: BodyFigure;
  view: BodyView;
  tones: Partial<Record<MuscleId, RegionTone>>;
  selected: MuscleId | null;
  onSelect?: (id: MuscleId) => void;
  /** Accessible name of each region, including its state. */
  describe: (id: MuscleId) => string;
  className?: string;
}

/**
 * One view of the body. Regions are buttons with a roving tab stop: Tab
 * enters the figure once, arrows move between muscles, Enter or Space
 * selects. Viewing never changes any data.
 */
export function BodyMap({ figure, view, tones, selected, onSelect, describe, className }: Props) {
  const g = bodyGeometry(figure, view);
  const refs = useRef<(SVGGElement | null)[]>([]);
  const ids = g.regions.map((r) => r.id);
  const stop = selected && ids.includes(selected) ? selected : ids[0];

  const onKey = (e: KeyboardEvent<SVGGElement>, i: number) => {
    let next = -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (i + 1) % ids.length;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (i - 1 + ids.length) % ids.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = ids.length - 1;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect?.(ids[i]!);
      return;
    } else return;
    e.preventDefault();
    refs.current[next]?.focus();
  };

  return (
    <svg
      className={cx('bm', className)}
      viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
      role="group"
      aria-label={view === 'front' ? 'Vista frontal' : 'Vista posterior'}
      data-figure={figure}
    >
      <path className="bm__sil" d={g.silhouette} />
      {g.inert && <path className="bm__inert" d={g.inert} />}
      {g.lines && <path className="bm__line" d={g.lines} />}
      {g.regions.map((r, i) => {
        const tone = tones[r.id];
        const on = selected === r.id;
        return (
          <g
            key={r.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="bm__m"
            data-muscle={r.id}
            data-fill={tone?.fill ?? 'none'}
            data-pending={tone?.pending ?? undefined}
            data-selected={on || undefined}
            style={{ ['--i' as string]: i }}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? (r.id === stop ? 0 : -1) : undefined}
            aria-label={describe(r.id)}
            aria-pressed={onSelect ? on : undefined}
            onClick={onSelect ? () => onSelect(r.id) : undefined}
            onKeyDown={onSelect ? (e) => onKey(e, i) : undefined}
          >
            <path className="bm__shape" d={r.d} />
            {r.detail && <path className="bm__detail" d={r.detail} />}
          </g>
        );
      })}
    </svg>
  );
}
