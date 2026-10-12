import { AlertTriangle, Check, Droplets, Flag, Gauge, Moon, PenLine, Scale, type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { ACTIVITY_LEVELS } from '@/domain/health';
import type { ActivityLevel, FoodHabits, GoalType, MotivationProfile, Wellbeing } from '@/domain/types';
import { formatInt } from '@/domain/units';
import { cx } from '@/ui/cx';
import { GOALS } from '../shared/labels';
import type { UnitsApi } from '../shared/units';
import { questionVariants } from './motion';
import { habitsToImprove, labelOf, mainDifficulties, SLEEP_OPTIONS, supportFor, trainingDaysText } from './preferences';

/** Everything the summary shows, exactly as it will be saved. Weights in kg. */
export interface SummaryData {
  name: string;
  goal: GoalType;
  goalLabel: string;
  /** «Otro objetivo personal». */
  custom: boolean;
  currentKg: number | null;
  /** Only when it predates today. */
  initialKg: number | null;
  heightCm: number | null;
  /** The goal asks for a target weight (never for minors). */
  weightGoal: boolean;
  targetKg: number | null;
  refKg: number | null;
  /** Estimated from the activity answers, or the default one when they were skipped. */
  level: ActivityLevel;
  /** Null when the activity questions were skipped. */
  trainingDays: number | null;
  waterMl: number;
  stepsGoal: number;
  food?: FoodHabits;
  motivation?: MotivationProfile;
  wellbeing?: Wellbeing;
}

interface Props {
  data: SummaryData;
  u: UnitsApi;
  consent: boolean;
  onConsent: (v: boolean) => void;
  /** Tried to finish without accepting. */
  invalid: boolean;
  temporary: boolean;
}

export function OnboardingSummary({ data, u, consent, onConsent, invalid, temporary }: Props) {
  const GoalIcon = data.custom ? PenLine : (GOALS.find((g) => g.id === data.goal)?.icon ?? Flag);
  const difficulties = mainDifficulties(data.motivation, data.food);
  const habits = habitsToImprove(data.food, data.wellbeing, data.trainingDays);
  const support = supportFor(data.motivation);
  const sleep = data.wellbeing?.sleepHours && data.wellbeing.sleepHours !== 'skip' ? data.wellbeing.sleepHours : null;

  return (
    <>
      <motion.div variants={questionVariants} className="sum-goal">
        <span className="sum-goal__icon" aria-hidden="true">
          <GoalIcon />
        </span>
        <div className="sum-goal__text">
          <p className="sum-goal__label">Tu objetivo</p>
          <p className="sum-goal__value">{data.goalLabel}</p>
        </div>
      </motion.div>

      <motion.dl variants={questionVariants} className="sum-tiles">
        <Tile
          icon={Scale}
          label="Punto de partida"
          value={data.currentKg !== null ? u.weight(data.currentKg) : 'Sin indicar'}
          sub={data.initialKg !== null ? `Empezaste con ${u.weight(data.initialKg)}` : data.heightCm !== null ? u.height(data.heightCm) : 'Puedes añadirlo luego'}
          muted={data.currentKg === null}
        />
        {data.weightGoal ? (
          <Tile
            icon={Flag}
            label="Peso objetivo"
            value={data.targetKg !== null ? u.weight(data.targetKg) : 'Sin indicar'}
            sub={data.targetKg !== null && data.refKg !== null ? `${u.weightDelta(data.targetKg - data.refKg)} desde el inicio` : 'Sin fechas ni prisas'}
            muted={data.targetKg === null}
          />
        ) : (
          <Tile
            icon={Moon}
            label="Descanso"
            value={sleep ? labelOf(SLEEP_OPTIONS, sleep) : 'Sin indicar'}
            sub={sleep ? 'Sueño habitual' : 'Puedes añadirlo luego'}
            muted={!sleep}
          />
        )}
        <Tile
          icon={Gauge}
          label="Nivel de actividad"
          value={ACTIVITY_LEVELS[data.level].label}
          sub={data.trainingDays !== null ? trainingDaysText(data.trainingDays) : 'Valor inicial, ajustable'}
        />
        <Tile icon={Droplets} label="Agua y pasos" value={u.volume(data.waterMl)} sub={`${formatInt(data.stepsGoal)} pasos al día`} />
      </motion.dl>

      <motion.dl variants={questionVariants} className="sum-list">
        <Row label="Principales dificultades">{difficulties.length ? <Tags items={difficulties} /> : <Empty />}</Row>
        <Row label="Hábitos a mejorar">{habits.length ? <Tags items={habits} /> : <Empty />}</Row>
        <Row label="Acompañamiento">
          <span className="sum-support">
            <strong>{support.title}.</strong> {support.text}
          </span>
        </Row>
      </motion.dl>

      {temporary && (
        <motion.p variants={questionVariants} className="callout callout--warn">
          <AlertTriangle aria-hidden="true" />
          <span>Modo temporal: en este navegador no se puede guardar nada, así que tus respuestas se perderán al cerrar.</span>
        </motion.p>
      )}

      <motion.label variants={questionVariants} className={cx('consent', consent && 'is-on', invalid && 'is-invalid')}>
        <span className="consent__control">
          <input type="checkbox" className="consent__input" checked={consent} onChange={(e) => onConsent(e.target.checked)} aria-invalid={invalid || undefined} />
          <span className="consent__box" aria-hidden="true">
            <Check />
          </span>
        </span>
        <span className="consent__text">Entiendo que estos datos se guardan solo en este dispositivo y puedo editarlos o borrarlos en Perfil</span>
      </motion.label>
    </>
  );
}

function Tile({ icon: Icon, label, value, sub, muted }: { icon: LucideIcon; label: string; value: string; sub: string; muted?: boolean }) {
  return (
    <div className={cx('sum-tile', muted && 'sum-tile--muted')}>
      <dt className="sum-tile__label">
        <Icon aria-hidden="true" />
        {label}
      </dt>
      <dd className="sum-tile__value">
        <span className="t-num">{value}</span>
        <span className="sum-tile__sub">{sub}</span>
      </dd>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="sum-list__row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Tags({ items }: { items: string[] }) {
  return (
    <span className="sum-tags">
      {items.map((item) => (
        <span key={item} className="sum-tag">
          {item}
        </span>
      ))}
    </span>
  );
}

const Empty = () => <span className="sum-empty">Sin indicar · puedes completarlo en Perfil</span>;
