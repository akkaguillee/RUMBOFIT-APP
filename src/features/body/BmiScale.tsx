import { useEffect, useState, type CSSProperties } from 'react';
import { BMI_BANDS, type BmiBandId } from '@/domain/body';
import { cx } from '@/ui/cx';

interface Props {
  /** Marker position on the scale (0–1), from bmiScalePosition. */
  position: number;
  active: BmiBandId;
  /** Thin bar without the legend (dashboard). */
  compact?: boolean;
}

/**
 * Adult BMI scale: four equal-width bands with their names and ranges, and a
 * marker that glides to the user's position. The band is always named in
 * text (the list marks the current one), never by colour alone.
 */
export function BmiScale({ position, active, compact }: Props) {
  // The marker starts at 0 and glides to its place once mounted (and to each new value later).
  // It moves with a transform measured in container units, so nothing reflows; reduced motion drops the glide in CSS.
  const [placed, setPlaced] = useState(false);
  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setPlaced(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);
  const pos = placed ? Math.min(1, Math.max(0, position)) : 0;
  return (
    <div className={cx('bmi-gauge', compact && 'bmi-gauge--compact')}>
      <div className="bmi-gauge__track" aria-hidden="true">
        <div className="bmi-gauge__bar">
          {BMI_BANDS.map((b) => (
            <span key={b.id} className={cx('bmi-gauge__seg', `is-${b.tone}`, b.id === active && 'is-active')} />
          ))}
        </div>
        <span className={cx('bmi-gauge__marker', placed && 'is-placed')} style={{ '--pos': pos.toFixed(4) } as CSSProperties} />
      </div>
      {!compact && (
        <ol className="bmi-gauge__legend" aria-label="Categorías del IMC para personas adultas">
          {BMI_BANDS.map((b) => (
            <li key={b.id} className={cx(b.id === active && 'is-active')} aria-current={b.id === active ? 'true' : undefined}>
              <span className="bmi-gauge__name">
                <span className="bmi-gauge__full">{b.label}</span>
                <span className="bmi-gauge__short" aria-hidden="true">
                  {b.short}
                </span>
              </span>
              <span className="bmi-gauge__range t-num">{b.range}</span>
              {b.id === active && <span className="sr-only">: aquí está tu IMC</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
