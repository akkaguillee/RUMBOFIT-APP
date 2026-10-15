import { Activity, ChevronDown, Flame, Info, ShieldAlert, UserRound } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useId, useMemo, useState } from 'react';
import { energyEstimate, keepUnitsTogether, macroSplit, type EnergyEstimate } from '@/domain/body';
import { formatDate } from '@/domain/dates';
import { calculateMacros } from '@/domain/health';
import type { Profile, WeightEntry } from '@/domain/types';
import { formatInt, formatNumber } from '@/domain/units';
import { AnimatedNumber } from '@/ui/AnimatedNumber';
import { ButtonLink } from '@/ui/Button';
import { cx } from '@/ui/cx';
import { GlassCard } from '@/ui/GlassCard';
import { useToday } from '@/ui/useToday';
import { GOALS } from '../shared/labels';
import { MacroSplitView } from './MacroSplit';
import { MissingData } from './MissingData';
import './body.css';

interface Props {
  profile: Profile;
  weights: WeightEntry[];
  className?: string;
  /** Optional protein / fat / carbohydrate split inside "Más detalles". */
  showMacros?: boolean;
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Personalised calorie estimate from the profile and the latest weight:
 * maintenance, an orientative target for the user's goal (never below the
 * basal metabolism, none at all in sensitive situations) and how it was made.
 */
export function CalorieCard({ profile, weights, className, showMacros = true }: Props) {
  const today = useToday();
  const est = useMemo(() => energyEstimate(profile, weights, today), [profile, weights, today]);

  return (
    <GlassCard variant="glow" className={cx('kcal-card', className)} aria-labelledby="kcal-card-title">
      <div className="card__head">
        <h2 id="kcal-card-title" className="card__title">
          <Flame aria-hidden="true" />
          Tus calorías diarias
        </h2>
        <span className="badge">Estimación</span>
      </div>

      {est.status === 'missing' ? (
        <MissingData fields={est.fields} units={profile.units} purpose="estimar tus calorías" />
      ) : (
        <CalorieDetails est={est} profile={profile} showMacros={showMacros} />
      )}
    </GlassCard>
  );
}

type OkEstimate = Extract<EnergyEstimate, { status: 'ok' }>;

function CalorieDetails({ est, profile, showMacros }: { est: OkEstimate; profile: Profile; showMacros: boolean }) {
  const today = useToday();
  const reduce = useReducedMotion();
  const detailsId = useId();
  const [open, setOpen] = useState(false);
  const goal = GOALS.find((g) => g.id === profile.goal);
  const GoalIcon = goal?.icon;
  const hasTarget = est.target !== null && est.target.id !== 'maintain';
  const main = hasTarget ? est.target!.kcal : est.maintenance;
  // Split saved in «Ajustar el cálculo» (1,6 g/kg and 30 % by default).
  const split = macroSplit(profile);
  const macros = calculateMacros(main, est.kg, split.proteinPerKg, split.fatPct);
  const equation =
    `Metabolismo basal ${formatInt(est.bmr)} kilocalorías por factor de actividad ${formatNumber(est.activity.factor, 3)}, ` +
    `unas ${formatInt(est.maintenance)} kilocalorías de mantenimiento`;

  return (
    <>
      <div className="kcal-hero">
        <span className="kcal-hero__label">{hasTarget ? 'Objetivo orientativo' : 'Mantenimiento estimado'}</span>
        <p className="kcal-hero__value">
          <AnimatedNumber value={main} format={formatInt} className="kcal-hero__num t-num" />
          <span className="kcal-hero__unit">kcal/día</span>
        </p>
        <p className="kcal-hero__text">
          {hasTarget
            ? keepUnitsTogether(`${est.target!.label}: ${lowerFirst(est.target!.description)}`)
            : est.restricted
              ? 'Lo que gastas en un día habitual, aproximadamente. En tu caso no calculamos objetivos de pérdida ni de ganancia.'
              : 'Energía estimada para mantener tu peso actual, un buen punto de partida para tu objetivo.'}
        </p>
      </div>

      {goal && GoalIcon && (
        <p className="kcal-goal">
          <span className="kcal-goal__label">Tu objetivo</span>
          {/* Muted when restricted: the goal is shown, but no target is built on it. */}
          <span className={cx('kcal-goal__chip', est.restricted && 'kcal-goal__chip--muted')}>
            <GoalIcon aria-hidden="true" />
            {goal.label}
          </span>
        </p>
      )}

      {est.restricted && (
        <div className="callout callout--warn kcal-callout" role="note">
          <ShieldAlert aria-hidden="true" />
          <div className="vstack" style={{ gap: 6 }}>
            {est.restrictions.map((r) => (
              <p key={r}>{r}</p>
            ))}
          </div>
        </div>
      )}

      <section className="kcal-how" aria-labelledby="kcal-how-title">
        <h3 id="kcal-how-title" className="kcal-how__title">
          Cómo lo calculamos
        </h3>
        <div className="kcal-eq" role="img" aria-label={equation}>
          <span className="kcal-eq__term">
            <b className="t-num">{formatInt(est.bmr)}</b>
            <small>Basal</small>
          </span>
          <span className="kcal-eq__op" aria-hidden="true">
            ×
          </span>
          <span className="kcal-eq__term">
            <b className="t-num">{formatNumber(est.activity.factor, 3)}</b>
            <small>Actividad</small>
          </span>
          <span className="kcal-eq__op" aria-hidden="true">
            ≈
          </span>
          <span className="kcal-eq__term kcal-eq__term--result">
            <b className="t-num">{formatInt(est.maintenance)}</b>
            <small>Mantenimiento</small>
          </span>
        </div>
        <dl className="kcal-how__list">
          <div>
            <dt>Basal</dt>
            <dd>Ecuación de Mifflin-St Jeor con tu peso, altura, edad y sexo.</dd>
          </div>
          <div>
            <dt>Actividad</dt>
            <dd>
              {est.activity.label}
              {est.activity.source === 'daily-life' ? ': ' : est.activity.source === 'manual' ? ' (elegido en tu perfil): ' : ' (nivel de tu perfil): '}
              {lowerFirst(est.activity.summary)}
              {est.activity.source === 'daily-life' && '.'}
            </dd>
          </div>
          {hasTarget && (
            <div>
              <dt>Objetivo</dt>
              <dd>Un ajuste moderado sobre el mantenimiento, nunca por debajo de tu metabolismo basal.</dd>
            </div>
          )}
        </dl>
      </section>

      <p className="body-note">
        <Info aria-hidden="true" />
        <span>{est.guidance}</span>
      </p>

      <button type="button" className="disclosure kcal-more" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen((o) => !o)}>
        {open ? 'Menos detalles' : showMacros && !est.restricted ? 'Más detalles y macronutrientes' : 'Más detalles'}
        <ChevronDown aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={detailsId}
            className="kcal-details"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <ul className="kcal-notes">
              {est.notes.map((n) => (
                <li key={n}>{keepUnitsTogether(n)}</li>
              ))}
              <li>RUMBO no registra lo que comes: son estimaciones de gasto, no de ingesta.</li>
            </ul>
            {showMacros && !est.restricted && (
              <div className="kcal-macros">
                <h3 className="kcal-how__title">Reparto orientativo</h3>
                <MacroSplitView macros={macros} />
                <p className="field__hint">
                  Con {formatNumber(split.proteinPerKg, 1)} g de proteína por kg y un {split.fatPct} % de grasas. Es opcional y no hace falta
                  contarlo al detalle.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="kcal-foot">
        <p className="t-small t-muted">{est.basedOn === today ? 'Actualizado hoy' : `Actualizado el ${formatDate.long(est.basedOn)}`}</p>
        <div className="kcal-foot__links">
          <ButtonLink to="/perfil#personal" variant="secondary" size="sm" icon={<UserRound aria-hidden="true" />}>
            Tus datos
          </ButtonLink>
          <ButtonLink to="/perfil#preferencias" variant="secondary" size="sm" icon={<Activity aria-hidden="true" />}>
            Tu día a día
          </ButtonLink>
        </div>
      </div>
    </>
  );
}
