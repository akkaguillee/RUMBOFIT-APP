import { ChevronRight, Flame, Gauge, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';
import { useProfile, useWeights } from '@/db/hooks';
import { bmiSnapshot, energyEstimate, missingText } from '@/domain/body';
import { formatFixed, formatInt } from '@/domain/units';
import { AnimatedNumber } from '@/ui/AnimatedNumber';
import { cx } from '@/ui/cx';
import { GlassLinkCard } from '@/ui/GlassCard';
import { liftVariants } from '@/ui/motion';
import { StatusBadge } from '@/ui/StatusBadge';
import { useToday } from '@/ui/useToday';
import { goalLabel } from '../shared/labels';
import { BmiScale } from './BmiScale';
import './body.css';

interface MiniProps {
  className?: string;
  /** Participates in the parent page cascade (off inside BodySnapshotCard). */
  rise?: boolean;
}

function useBodyData() {
  const profile = useProfile();
  const weights = useWeights();
  const today = useToday();
  return { profile, weights, today };
}

/** Dashboard BMI: value, category (icon + text) and a thin scale. Links to Progresos › IMC. */
export function BmiMiniCard({ className, rise = true }: MiniProps) {
  const { profile, weights, today } = useBodyData();
  const snap = useMemo(() => (profile && weights ? bmiSnapshot(profile, weights, today) : null), [profile, weights, today]);
  if (!snap || !profile) return null;

  return (
    <GlassLinkCard to="/progresos?tab=imc" className={cx('body-mini', className)} rise={rise} padded={false}>
      <span className="body-mini__head">
        <span className="body-mini__name">
          <Gauge aria-hidden="true" />
          IMC
        </span>
        <ChevronRight aria-hidden="true" className="body-mini__chev" />
      </span>
      {snap.status === 'ok' ? (
        <>
          <span className="body-mini__value">
            <AnimatedNumber value={snap.bmi} format={(n) => formatFixed(n, 1)} className="t-num" />
            <small>kg/m²</small>
          </span>
          <span className="body-mini__foot">
            {snap.band ? (
              <StatusBadge tone={snap.band.tone} label={snap.band.short} icon={snap.band.id === 'normal' ? 'check' : 'alert'} />
            ) : (
              <span className="body-mini__sub">
                {snap.noBandReason === 'pregnancy' ? 'Sin categorías durante el embarazo o la lactancia' : 'Se valora con percentiles por edad'}
              </span>
            )}
            {snap.band && snap.position !== null && <BmiScale compact position={snap.position} active={snap.band.id} />}
          </span>
        </>
      ) : (
        <span className="body-mini__ask">
          Añade {missingText(snap.fields)} para calcularlo
          <span className="body-mini__cta">Completar</span>
        </span>
      )}
    </GlassLinkCard>
  );
}

/** Dashboard calories: orientative target (or maintenance) and the goal. Links to Progresos › Calorías. */
export function CalorieMiniCard({ className, rise = true }: MiniProps) {
  const { profile, weights, today } = useBodyData();
  const est = useMemo(() => (profile && weights ? energyEstimate(profile, weights, today) : null), [profile, weights, today]);
  if (!est || !profile) return null;
  const hasTarget = est.status === 'ok' && est.target !== null && est.target.id !== 'maintain';

  return (
    <GlassLinkCard to="/progresos?tab=calorias" className={cx('body-mini', className)} rise={rise} padded={false}>
      <span className="body-mini__head">
        <span className="body-mini__name">
          <Flame aria-hidden="true" />
          Calorías
        </span>
        <ChevronRight aria-hidden="true" className="body-mini__chev" />
      </span>
      {est.status === 'ok' ? (
        <>
          <span className="body-mini__value">
            <AnimatedNumber value={hasTarget ? est.target!.kcal : est.maintenance} format={formatInt} className="t-num" />
            <small>kcal</small>
          </span>
          <span className="body-mini__foot">
            <span className="body-mini__label">{hasTarget ? 'Objetivo orientativo' : 'Mantenimiento'}</span>
            {est.restricted ? (
              <span className="body-mini__sub">
                <ShieldAlert aria-hidden="true" />
                Consulta tu objetivo con un profesional
              </span>
            ) : (
              <span className="body-mini__sub">{goalLabel(est.goal)}</span>
            )}
          </span>
        </>
      ) : (
        <span className="body-mini__ask">
          Añade {missingText(est.fields)} para estimarlas
          <span className="body-mini__cta">Completar</span>
        </span>
      )}
    </GlassLinkCard>
  );
}

/** Both mini cards side by side under a section header, ready for the dashboard grid. */
export function BodySnapshotCard({ className }: { className?: string }) {
  return (
    <motion.section className={cx('body-snap rise-group', className)} variants={liftVariants} aria-labelledby="body-snap-title">
      <div className="section-head">
        <h2 id="body-snap-title">Tu cuerpo</h2>
        <span className="t-small">Estimaciones orientativas</span>
      </div>
      <div className="body-snap__grid">
        <BmiMiniCard rise={false} />
        <CalorieMiniCard rise={false} />
      </div>
    </motion.section>
  );
}
