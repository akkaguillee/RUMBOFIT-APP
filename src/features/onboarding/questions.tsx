import { Info, PenLine } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useRef, type ReactNode } from 'react';
import type { FoodHabits, GoalType, MotivationProfile, Wellbeing } from '@/domain/types';
import { NumberField, TextField } from '@/ui/Field';
import { GOALS, usesWeightGoal } from '../shared/labels';
import type { UnitsApi } from '../shared/units';
import { questionVariants } from './motion';
import { ChoiceList, CountPicker, DayPicker, MultiQuestion, Question, SingleQuestion } from './PrefControls';
import {
  ACTIVITY_TYPE_OPTIONS,
  ALLERGEN_OPTIONS,
  BLOCKER_OPTIONS,
  DROP_REASON_OPTIONS,
  EATING_OUT_OPTIONS,
  EXERCISE_OPTIONS,
  EXPERIENCE_OPTIONS,
  FIRST_FOCUS_OPTIONS,
  FOOD_DIFFICULTY_OPTIONS,
  FOOD_IMPROVE_OPTIONS,
  FOOD_PATTERN_OPTIONS,
  FOOD_QUALITY_OPTIONS,
  GOAL_NOTE_MAX,
  HARDEST_OPTIONS,
  JOB_OPTIONS,
  MEAL_SCHEDULE_OPTIONS,
  MINUTES_OPTIONS,
  MOTIVATOR_OPTIONS,
  NOTE_MAX,
  POSTURE_OPTIONS,
  REST_OPTIONS,
  SCHEDULE_OPTIONS,
  SECONDARY_MAX,
  SLEEP_OPTIONS,
  spreadTrainingDays,
  STRESS_OPTIONS,
  STYLE_OPTIONS,
  trainingCountLabel,
  TRAINING_DAYS_MAX,
  WATER_OPTIONS,
  wantsFoodDetails,
  wantsMotivationNote,
  weekdaysText,
  WELLBEING_IMPROVE_OPTIONS,
  type ActivityAnswers,
  type GoalChoice,
  type Option,
  type QuickActivity,
} from './preferences';

/**
 * The personalisation questions. Perfil edits every group in full in its
 * sheets; onboarding asks a short version of the same questions (the groups
 * at the end of this file), so both always use the same wording and controls.
 */

type Patch<T> = (patch: Partial<T>) => void;

/**
 * Height reveal for adaptive questions; clips only while animating so chip
 * shadows and focus rings stay intact. Once open, it scrolls into view if the
 * new questions landed below the fold.
 */
export function Reveal({ show, children }: { show: boolean; children: ReactNode }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          ref={ref}
          // Questions mounted later must not wait for the screen's entrance cascade, which has already run.
          inherit={false}
          onAnimationComplete={(def: { opacity?: number }) => {
            const el = ref.current;
            if (def.opacity !== 1 || !el) return;
            el.style.overflow = 'visible';
            el.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
          }}
          className="q-reveal"
          initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0, overflow: 'hidden' }}
          animate={
            reduce
              ? { opacity: 1 }
              : { opacity: 1, height: 'auto', transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }
          }
          exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, overflow: 'hidden', transition: { duration: 0.18 } }}
        >
          <div className="q-stack">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Objetivos ──────────────────────────────────────────────────────────

export interface GoalAnswers {
  choice: GoalChoice | null;
  note: string;
  secondary: GoalType[];
}

const GOAL_OPTIONS: Option<GoalChoice>[] = [
  ...GOALS.map((g) => ({ value: g.id, label: g.label, description: g.description, icon: g.icon })),
  { value: 'other', label: 'Otro objetivo personal', description: 'Escríbelo con tus palabras.', icon: PenLine },
];

/** The main goal (one), with a short text for «Otro objetivo personal». */
export function GoalMainQuestions({ value, onChange }: { value: GoalAnswers; onChange: Patch<GoalAnswers> }) {
  return (
    <>
      <motion.div variants={questionVariants}>
        <ChoiceList
          label="Objetivo principal"
          options={GOAL_OPTIONS}
          value={value.choice}
          onChange={(choice) => onChange({ choice, secondary: value.secondary.filter((g) => g !== choice) })}
          compact
          className="goal-list"
        />
      </motion.div>
      <Reveal show={value.choice === 'other'}>
        <TextField
          label="Tu objetivo"
          value={value.note}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder="Por ejemplo, correr mi primera carrera de 10 km"
          maxLength={GOAL_NOTE_MAX}
          autoComplete="off"
          hint="En pocas palabras. Te acompañaremos con hábitos que te acerquen a él."
        />
      </Reveal>
    </>
  );
}

interface TargetProps {
  goal: GoalType | null;
  target: string;
  onTarget: (v: string) => void;
  u: UnitsApi;
  /** Line under the field: the change from the starting weight, or why it is not valid. */
  targetHint?: string | null;
  /** Under 18: no target weight, only a gentle note. */
  minor: boolean;
  /**
   * Onboarding: asks for the height here too when «Sobre ti» left it empty (or
   * not valid), since a target always needs it to stay above a BMI of 18.5.
   */
  height?: { value: string; onChange: (v: string) => void };
}

/** Target weight (only for weight goals); under 18, a gentle note instead. */
export function TargetQuestions(t: TargetProps) {
  const weightGoal = t.goal !== null && usesWeightGoal(t.goal);
  return (
    <>
      {t.height && (
        <motion.div variants={questionVariants}>
          <NumberField
            label="Altura"
            value={t.height.value}
            onChange={(e) => t.height!.onChange(e.target.value)}
            suffix={t.u.h}
            placeholder="Para tu peso objetivo"
            hint="La necesitamos para comprobar que el objetivo es saludable."
          />
        </motion.div>
      )}
      {weightGoal && !t.minor && (
        <motion.div variants={questionVariants}>
          <NumberField
            label="Peso objetivo"
            value={t.target}
            onChange={(e) => t.onTarget(e.target.value)}
            suffix={t.u.w}
            placeholder="Opcional"
            size="lg"
            hint={t.targetHint ?? 'Elige una meta realista. No prometemos fechas: cada cuerpo tiene su ritmo.'}
          />
        </motion.div>
      )}
      {weightGoal && t.minor && (
        <motion.div variants={questionVariants} className="callout q-note">
          <Info aria-hidden="true" />
          <p>Como eres menor de edad, no fijamos un peso objetivo. Si quieres cambiar tu peso, coméntalo antes con un profesional sanitario.</p>
        </motion.div>
      )}
    </>
  );
}

/** Target weight and secondary goals (Perfil). */
export function GoalDetailQuestions({ value, onChange, ...t }: { value: GoalAnswers; onChange: Patch<GoalAnswers> } & TargetProps) {
  const mainGoal = value.choice === 'other' ? null : value.choice;
  return (
    <>
      <TargetQuestions {...t} />
      <MultiQuestion
        label="¿Quieres trabajar algo más?"
        options={GOAL_OPTIONS.filter((o) => o.value !== 'other' && o.value !== mainGoal).map(({ value: v, label }) => ({ value: v as GoalType, label }))}
        values={value.secondary}
        onChange={(secondary) => onChange({ secondary })}
        max={SECONDARY_MAX}
      />
    </>
  );
}

// ── Actividad cotidiana ────────────────────────────────────────────────

export function ActivityDailyQuestions({ value, onChange }: { value: ActivityAnswers; onChange: Patch<ActivityAnswers> }) {
  return (
    <>
      <SingleQuestion
        label="¿Cómo pasas la mayor parte del día?"
        options={POSTURE_OPTIONS}
        value={value.posture}
        onChange={(posture) => onChange({ posture })}
        layout="tiles"
      />
      <SingleQuestion label="¿Cómo es tu trabajo?" options={JOB_OPTIONS} value={value.job} onChange={(job) => onChange({ job })} />
      <SingleQuestion
        label="¿Haces ejercicio de forma habitual?"
        options={EXERCISE_OPTIONS}
        value={value.exercises === null ? null : value.exercises ? 'yes' : 'no'}
        onChange={(v) => onChange({ exercises: v === 'yes' })}
      />
    </>
  );
}

export function ActivityTrainingQuestions({ value, onChange }: { value: ActivityAnswers; onChange: Patch<ActivityAnswers> }) {
  const n = value.days.length;
  return (
    <>
      <Question
        label="¿Qué días sueles entrenar?"
        aside={n === 0 ? 'Ningún día' : `${n} ${n === 1 ? 'día' : 'días'} por semana`}
        hint="Te proponemos un plan semanal con estos días. Descansar también forma parte del progreso."
      >
        {({ labelId }) => <DayPicker days={value.days} onChange={(days) => onChange({ days })} labelledBy={labelId} />}
      </Question>
      <MultiQuestion label="¿Qué tipo de actividad haces?" options={ACTIVITY_TYPE_OPTIONS} values={value.types} onChange={(types) => onChange({ types })} />
      <SingleQuestion
        label="¿Qué experiencia tienes?"
        options={EXPERIENCE_OPTIONS.map(({ value: v, label }) => ({ value: v, label }))}
        value={value.experience}
        onChange={(experience) => onChange({ experience })}
        hint={EXPERIENCE_OPTIONS.find((o) => o.value === value.experience)?.description ?? 'Así ajustamos series, cargas y descansos a tu nivel.'}
      />
    </>
  );
}

// ── Alimentación y hábitos ─────────────────────────────────────────────

/** Whether they want to improve, how they eat and how much water they drink. */
export function FoodBasicQuestions({ value, onChange, waterHint }: { value: FoodHabits; onChange: Patch<FoodHabits>; waterHint: string }) {
  return (
    <>
      <SingleQuestion
        label="¿Te gustaría mejorar tu alimentación?"
        options={FOOD_IMPROVE_OPTIONS}
        value={value.improve}
        onChange={(improve) => onChange({ improve })}
      />
      <Reveal show={value.improve !== 'no'}>
        <SingleQuestion
          label="¿Cómo describirías tus hábitos?"
          options={FOOD_QUALITY_OPTIONS}
          value={value.quality}
          onChange={(quality) => onChange({ quality })}
        />
        <SingleQuestion
          label="¿Sigues algún patrón de alimentación?"
          options={FOOD_PATTERN_OPTIONS}
          value={value.pattern}
          onChange={(pattern) => onChange({ pattern })}
        />
      </Reveal>
      <SingleQuestion label="¿Cuánta agua bebes al día?" options={WATER_OPTIONS} value={value.water} onChange={(water) => onChange({ water })} hint={waterHint} />
    </>
  );
}

/** Only asked when they want to work on how they eat. */
export function FoodDetailQuestions({ value, onChange }: { value: FoodHabits; onChange: Patch<FoodHabits> }) {
  return (
    <>
      <MultiQuestion
        label="¿Alguna alergia, intolerancia o preferencia importante?"
        hint="Solo para tenerla en cuenta en tus consejos. Si tienes una alergia diagnosticada, sigue las indicaciones de tu profesional sanitario."
        options={ALLERGEN_OPTIONS}
        values={value.restrictions}
        onChange={(restrictions) => onChange({ restrictions })}
      />
      <MultiQuestion
        label="¿Qué te resulta más difícil?"
        options={FOOD_DIFFICULTY_OPTIONS}
        values={value.difficulties}
        onChange={(difficulties) => onChange({ difficulties })}
      />
      <SingleQuestion
        label="¿Con qué frecuencia comes fuera de casa?"
        options={EATING_OUT_OPTIONS}
        value={value.eatingOut}
        onChange={(eatingOut) => onChange({ eatingOut })}
      />
      <SingleQuestion
        label="¿Cómo son tus horarios de comida?"
        options={MEAL_SCHEDULE_OPTIONS}
        value={value.schedule}
        onChange={(schedule) => onChange({ schedule })}
      />
    </>
  );
}

/** Both food groups, for the edit sheet: the details appear only when they make sense. */
export function FoodQuestions(props: { value: FoodHabits; onChange: Patch<FoodHabits>; waterHint: string }) {
  return (
    <>
      <FoodBasicQuestions {...props} />
      <Reveal show={wantsFoodDetails(props.value)}>
        <FoodDetailQuestions value={props.value} onChange={props.onChange} />
      </Reveal>
    </>
  );
}

// ── Obstáculos y motivación ────────────────────────────────────────────

export function MotivationBlockerQuestions({ value, onChange }: { value: MotivationProfile; onChange: Patch<MotivationProfile> }) {
  return (
    <>
      <MultiQuestion
        label="¿Qué te ha impedido conseguirlo antes?"
        options={BLOCKER_OPTIONS}
        values={value.blockers}
        onChange={(blockers) => onChange({ blockers })}
      />
      <SingleQuestion label="¿Qué te cuesta más?" options={HARDEST_OPTIONS} value={value.hardest} onChange={(hardest) => onChange({ hardest })} />
      <MultiQuestion
        label="¿Qué suele hacer que lo dejes?"
        options={DROP_REASON_OPTIONS}
        values={value.dropReasons}
        onChange={(dropReasons) => onChange({ dropReasons })}
      />
      <Reveal show={wantsMotivationNote(value)}>
        <TextField
          label="Cuéntanos qué más"
          value={value.note ?? ''}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder="Por ejemplo, trabajo a turnos"
          maxLength={NOTE_MAX}
          autoComplete="off"
          hint="Opcional, en pocas palabras."
        />
      </Reveal>
    </>
  );
}

export function MotivationDriverQuestions({ value, onChange }: { value: MotivationProfile; onChange: Patch<MotivationProfile> }) {
  return (
    <>
      <MultiQuestion label="¿Qué te motiva?" options={MOTIVATOR_OPTIONS} values={value.motivators} onChange={(motivators) => onChange({ motivators })} />
      <SingleQuestion label="¿Cómo prefieres avanzar?" options={STYLE_OPTIONS} value={value.style} onChange={(style) => onChange({ style })} layout="cards" />
      <MinutesQuestion value={value} onChange={onChange} />
      <SingleQuestion
        label="¿Qué quieres mejorar primero?"
        options={FIRST_FOCUS_OPTIONS}
        value={value.firstFocus}
        onChange={(firstFocus) => onChange({ firstFocus })}
      />
    </>
  );
}

// ── Sueño y bienestar ──────────────────────────────────────────────────

export function WellbeingQuestions({ value, onChange }: { value: Wellbeing; onChange: Patch<Wellbeing> }) {
  return (
    <>
      <SingleQuestion
        label="¿Cuántas horas duermes normalmente?"
        options={SLEEP_OPTIONS}
        value={value.sleepHours}
        onChange={(sleepHours) => onChange({ sleepHours })}
      />
      <SingleQuestion label="¿Cómo sueles descansar?" options={REST_OPTIONS} value={value.rest} onChange={(rest) => onChange({ rest })} />
      <SingleQuestion label="¿Cómo es tu nivel de estrés?" options={STRESS_OPTIONS} value={value.stress} onChange={(stress) => onChange({ stress })} />
      <SingleQuestion
        label="¿Tienes horarios regulares?"
        options={SCHEDULE_OPTIONS}
        value={value.regularSchedule}
        onChange={(regularSchedule) => onChange({ regularSchedule })}
      />
      <MultiQuestion
        label="¿Qué hábitos te gustaría mejorar?"
        options={WELLBEING_IMPROVE_OPTIONS}
        values={value.improve}
        onChange={(improve) => onChange({ improve })}
      />
    </>
  );
}

// ── Onboarding: the essentials ─────────────────────────────────────────

/** How you spend the day, how many days you train (0–7) and, if you do, your experience. */
export function QuickActivityQuestions({ value, onChange }: { value: QuickActivity; onChange: Patch<QuickActivity> }) {
  const days = value.days;
  return (
    <>
      <SingleQuestion
        label="¿Cómo pasas la mayor parte del día?"
        options={POSTURE_OPTIONS}
        value={value.posture}
        onChange={(posture) => onChange({ posture })}
        layout="tiles"
      />
      <Question
        label="¿Cuántos días entrenas a la semana?"
        hint={
          days === null
            ? 'Cuenta cualquier entreno: gimnasio, correr, deporte o clases.'
            : days === 0
              ? 'Sin problema: moverte en tu día a día también cuenta.'
              : days === TRAINING_DAYS_MAX
                ? 'Te proponemos todos los días, alternando intensidades: descansar también forma parte del progreso.'
                : `Te proponemos ${weekdaysText(spreadTrainingDays(days))}. Podrás cambiar los días en Perfil.`
        }
      >
        {({ labelId, hintId }) => (
          <CountPicker
            value={days}
            onChange={(n) => onChange({ days: n })}
            max={TRAINING_DAYS_MAX}
            labelOf={trainingCountLabel}
            labelledBy={labelId}
            describedBy={hintId}
          />
        )}
      </Question>
      <Reveal show={days !== null && days > 0}>
        <SingleQuestion
          label="¿Qué experiencia tienes?"
          options={EXPERIENCE_OPTIONS.map(({ value: v, label }) => ({ value: v, label }))}
          value={value.experience}
          onChange={(experience) => onChange({ experience })}
          hint={EXPERIENCE_OPTIONS.find((o) => o.value === value.experience)?.description ?? 'Así ajustamos series, cargas y descansos a tu nivel.'}
        />
      </Reveal>
    </>
  );
}

interface HabitsProps {
  food: FoodHabits;
  wellbeing: Wellbeing;
  onFood: Patch<FoodHabits>;
  onWellbeing: Patch<Wellbeing>;
  waterHint: string;
}

/** Food (and what costs most, only for those who want to improve it), water and sleep. */
export function HabitsQuestions({ food, wellbeing, onFood, onWellbeing, waterHint }: HabitsProps) {
  return (
    <>
      <SingleQuestion
        label="¿Te gustaría mejorar tu alimentación?"
        options={FOOD_IMPROVE_OPTIONS}
        value={food.improve}
        onChange={(improve) => onFood({ improve })}
      />
      <Reveal show={wantsFoodDetails(food)}>
        <MultiQuestion
          label="¿Qué te cuesta más?"
          options={FOOD_DIFFICULTY_OPTIONS}
          values={food.difficulties}
          onChange={(difficulties) => onFood({ difficulties })}
        />
      </Reveal>
      <SingleQuestion label="¿Cuánta agua bebes al día?" options={WATER_OPTIONS} value={food.water} onChange={(water) => onFood({ water })} hint={waterHint} />
      <SingleQuestion
        label="¿Cuántas horas duermes normalmente?"
        options={SLEEP_OPTIONS}
        value={wellbeing.sleepHours}
        onChange={(sleepHours) => onWellbeing({ sleepHours })}
      />
    </>
  );
}

/** What stopped them before and the time they can give each day. */
export function MotivationQuickQuestions({ value, onChange }: { value: MotivationProfile; onChange: Patch<MotivationProfile> }) {
  return (
    <>
      <MultiQuestion
        label="¿Qué te ha frenado otras veces?"
        options={BLOCKER_OPTIONS}
        values={value.blockers}
        onChange={(blockers) => onChange({ blockers })}
      />
      <MinutesQuestion value={value} onChange={onChange} />
    </>
  );
}

function MinutesQuestion({ value, onChange }: { value: MotivationProfile; onChange: Patch<MotivationProfile> }) {
  return (
    <SingleQuestion
      label="¿Cuánto tiempo puedes dedicarte al día?"
      options={MINUTES_OPTIONS}
      value={value.dailyMinutes === undefined ? null : (String(value.dailyMinutes) as (typeof MINUTES_OPTIONS)[number]['value'])}
      onChange={(v) => onChange({ dailyMinutes: Number(v) as NonNullable<MotivationProfile['dailyMinutes']> })}
    />
  );
}
