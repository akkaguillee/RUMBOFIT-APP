import { Gauge, Info } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BMI_DISCLAIMER, bmiSnapshot } from '@/domain/body';
import { formatDate } from '@/domain/dates';
import type { Profile, WeightEntry } from '@/domain/types';
import { formatFixed } from '@/domain/units';
import { AnimatedNumber } from '@/ui/AnimatedNumber';
import { cx } from '@/ui/cx';
import { GlassCard } from '@/ui/GlassCard';
import { StatusBadge } from '@/ui/StatusBadge';
import { useToday } from '@/ui/useToday';
import { useUnits } from '../shared/units';
import { BmiScale } from './BmiScale';
import { MissingData } from './MissingData';
import './body.css';

/** "Peso de hoy", "Peso de hace 3 días", "Peso del 2 oct". */
function weighedText(date: string, today: string): string {
  const rel = formatDate.relative(date, today);
  return /^\d/.test(rel) ? `Peso del ${rel}` : `Peso de ${rel.toLowerCase()}`;
}

interface Props {
  profile: Profile;
  weights: WeightEntry[];
  className?: string;
}

/**
 * Automatic BMI: profile height + latest weight, recalculated live whenever
 * either changes. Minors, and anyone who flagged pregnancy or breastfeeding,
 * see their value without adult categories.
 */
export function BmiCard({ profile, weights, className }: Props) {
  const today = useToday();
  const u = useUnits(profile.units);
  const snap = useMemo(() => bmiSnapshot(profile, weights, today), [profile, weights, today]);

  return (
    <GlassCard variant="strong" className={cx('bmi-card', className)} aria-labelledby="bmi-card-title">
      <div className="card__head">
        <h2 id="bmi-card-title" className="card__title">
          <Gauge aria-hidden="true" />
          Tu índice de masa corporal
        </h2>
      </div>

      {snap.status === 'missing' ? (
        <MissingData fields={snap.fields} units={profile.units} purpose="calcular tu IMC" />
      ) : (
        <>
          <div className="body-hero">
            <p className="body-hero__value">
              <AnimatedNumber value={snap.bmi} format={(n) => formatFixed(n, 1)} className="body-hero__num t-num" />
              <span className="body-hero__unit">kg/m²</span>
            </p>
            {snap.band && <StatusBadge tone={snap.band.tone} label={snap.band.label} icon={snap.band.id === 'normal' ? 'check' : 'alert'} />}
          </div>
          <p className="sr-only" aria-live="polite">
            IMC {formatFixed(snap.bmi, 1)}
            {snap.band ? `, ${snap.band.label.toLowerCase()}` : ''}
          </p>
          {snap.band ? (
            <p className="body-hero__text">{snap.interpretation}</p>
          ) : (
            <div className="callout body-callout" role="note">
              <Info aria-hidden="true" />
              <p>{snap.interpretation}</p>
            </div>
          )}

          {snap.band && snap.position !== null && <BmiScale position={snap.position} active={snap.band.id} />}

          <dl className={cx('body-facts', !snap.reference && 'body-facts--single')}>
            <div className="body-fact">
              <dt>Calculado con</dt>
              <dd className="body-fact__value t-num">
                <span className="body-fact__part">{u.weight(snap.kg)}</span> · <span className="body-fact__part">{u.height(snap.heightCm)}</span>
              </dd>
              <dd className="body-fact__sub">{weighedText(snap.weighedOn, today)}</dd>
            </div>
            {snap.reference && (
              <div className="body-fact">
                <dt>Peso de referencia</dt>
                <dd className="body-fact__value t-num">
                  <span className="body-fact__part">
                    {u.weightValue(snap.reference.minKg)}–{u.weightValue(snap.reference.maxKg)} {u.w}
                  </span>
                </dd>
                <dd className="body-fact__sub">IMC 18,5–24,9 con tu altura</dd>
              </div>
            )}
          </dl>

          {snap.notes.map((note) => (
            <p key={note} className="body-note">
              <Info aria-hidden="true" />
              <span>
                {note}
                {snap.ageGroup === 'unknown' && (
                  <>
                    {' '}
                    <Link to="/perfil#personal" className="body-note__link">
                      Añadir mi edad
                    </Link>
                  </>
                )}
              </span>
            </p>
          ))}
          <p className="body-note">
            <Info aria-hidden="true" />
            <span>{BMI_DISCLAIMER}</span>
          </p>
        </>
      )}
    </GlassCard>
  );
}
