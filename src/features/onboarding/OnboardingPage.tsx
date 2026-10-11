import { ArrowLeft, ArrowRight, Check, Droplets, Dumbbell, Info, ShieldCheck, TrendingUp } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState, type ReactNode } from 'react';
import { RunnerMark, Wordmark } from '@/brand/Logo';
import { storageMode } from '@/db/backend';
import { createProfile } from '@/db/repos/profile';
import { addDays, todayKey, WEEKDAY_LABELS, WEEKDAY_SHORT, formatDate } from '@/domain/dates';
import { ACTIVITY_LEVELS, calculateBmi, suggestWaterGoal, weightForBmi } from '@/domain/health';
import type { ActivityLevel, GoalType, Sex, Units } from '@/domain/types';
import { formatInt } from '@/domain/units';
import { checkRange, LIMITS } from '@/domain/validation';
import { Button, IconButton } from '@/ui/Button';
import { NumberField, TextField } from '@/ui/Field';
import { ProgressBar } from '@/ui/ProgressBar';
import { Segmented } from '@/ui/Segmented';
import { toastError } from '@/ui/toast';
import { GOALS, SEX_OPTIONS, usesWeightGoal } from '../shared/labels';
import { unitsApi } from '../shared/units';
import './onboarding.css';

interface Draft {
  name: string;
  goal: GoalType | null;
  age: string;
  sex: Sex;
  units: Units;
  height: string;
  current: string;
  initial: string;
  startDate: string;
  target: string;
  activity: ActivityLevel;
  trainingDays: number[];
  water: string;
  steps: string;
}

type StepId = 'welcome' | 'name' | 'goal' | 'about' | 'body' | 'weight' | 'target' | 'activity' | 'training' | 'habits' | 'summary';

const STEPS: StepId[] = ['welcome', 'name', 'goal', 'about', 'body', 'weight', 'target', 'activity', 'training', 'habits', 'summary'];

const WELCOME_FEATURES = [
  { icon: TrendingUp, title: 'Tu evolución', desc: 'Peso, IMC y calorías, con gráficas claras.', tone: 'accent' },
  { icon: Droplets, title: 'Hábitos diarios', desc: 'Agua y pasos con metas a tu medida.', tone: 'water' },
  { icon: Dumbbell, title: 'Entrenamiento', desc: 'Rutinas, series, descansos y marcas.', tone: 'steps' },
] as const;

const stepVariants = {
  initial: (dir: number) => ({ opacity: 0, x: dir * 36, filter: 'blur(0px)' }),
  enter: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 320, damping: 32, staggerChildren: 0.05, delayChildren: 0.05 } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -24, transition: { duration: 0.16 } }),
} as const;

const itemVariants = {
  initial: { opacity: 0, y: 14 },
  enter: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 340, damping: 30 } },
} as const;

function Why({ children }: { children: ReactNode }) {
  return (
    <motion.div className="callout" variants={itemVariants}>
      <Info aria-hidden="true" />
      <p>
        <strong>¿Por qué lo pedimos? </strong>
        {children}
      </p>
    </motion.div>
  );
}

export default function OnboardingPage() {
  const today = todayKey();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [d, setD] = useState<Draft>({
    name: '',
    goal: null,
    age: '',
    sex: 'unspecified',
    units: 'metric',
    height: '',
    current: '',
    initial: '',
    startDate: today,
    target: '',
    activity: 'light',
    trainingDays: [0, 2, 4],
    water: '',
    steps: '8000',
  });
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setError(null);
    setD((prev) => ({ ...prev, [k]: v }));
  };

  const u = useMemo(() => unitsApi(d.units), [d.units]);
  const step = STEPS[index] as StepId;
  const heightCm = d.height ? u.parseHeight(d.height) : null;
  const currentKg = d.current ? u.parseWeight(d.current) : null;
  const initialKg = d.initial ? u.parseWeight(d.initial) : null;
  const targetKg = d.target ? u.parseWeight(d.target) : null;
  const refKg = initialKg ?? currentKg;
  const suggestedWater = suggestWaterGoal(currentKg ?? undefined);

  /** Returns an error message for the current step, or null when it can continue. */
  const validate = (): string | null => {
    switch (step) {
      case 'name':
        if (!d.name.trim()) return 'Escribe un nombre o alias para continuar.';
        if (d.name.trim().length > 40) return 'El nombre no puede superar 40 caracteres.';
        return null;
      case 'goal':
        return d.goal ? null : 'Elige el objetivo que mejor te describa.';
      case 'about':
        if (d.age && checkRange(Number(d.age), LIMITS.age)) return checkRange(Number(d.age), LIMITS.age);
        return null;
      case 'body':
        if (d.height && checkRange(heightCm, LIMITS.heightCm)) return checkRange(heightCm, LIMITS.heightCm);
        return null;
      case 'weight':
        if (d.current && checkRange(currentKg, LIMITS.weightKg)) return checkRange(currentKg, LIMITS.weightKg);
        if (d.initial && checkRange(initialKg, LIMITS.weightKg)) return checkRange(initialKg, LIMITS.weightKg);
        if (d.initial && !d.current) return 'Indica también tu peso actual.';
        if (d.startDate > today) return 'La fecha de inicio no puede estar en el futuro.';
        return null;
      case 'target': {
        if (!d.target) return null;
        if (checkRange(targetKg, LIMITS.weightKg)) return checkRange(targetKg, LIMITS.weightKg);
        if (refKg !== null && targetKg !== null) {
          if (d.goal === 'lose' && targetKg >= refKg) return 'Para perder peso, el objetivo debe ser menor que tu peso de partida.';
          if (d.goal === 'gain' && targetKg <= refKg) return 'Para ganar peso, el objetivo debe ser mayor que tu peso de partida.';
        }
        if (heightCm && targetKg !== null && calculateBmi(targetKg, heightCm) < 18.5) {
          return `Por tu salud, RUMBO no permite objetivos por debajo de un IMC de 18,5 (${u.weight(weightForBmi(18.5, heightCm))} para tu altura).`;
        }
        return null;
      }
      case 'habits': {
        const ml = d.water ? u.parseVolume(d.water) : suggestedWater;
        const e1 = checkRange(ml, LIMITS.waterGoalMl);
        if (e1) return e1;
        return checkRange(Number(d.steps.replace(/\./g, '')), LIMITS.stepsGoal);
      }
      default:
        return null;
    }
  };

  const go = (delta: number) => {
    if (delta > 0) {
      const err = validate();
      if (err) {
        setError(err);
        return;
      }
    }
    setError(null);
    setDir(delta);
    setIndex((i) => Math.max(0, Math.min(STEPS.length - 1, i + delta)));
  };

  const finish = async () => {
    if (!d.goal) return;
    setSaving(true);
    try {
      await createProfile({
        name: d.name,
        age: d.age ? Number(d.age) : undefined,
        sex: d.sex,
        heightCm: heightCm ?? undefined,
        goal: d.goal,
        currentWeightKg: currentKg ?? undefined,
        startWeightKg: initialKg ?? undefined,
        goalWeightKg: targetKg ?? undefined,
        activityLevel: d.activity,
        units: d.units,
        startDate: d.startDate,
        trainingDays: d.trainingDays,
        waterGoalMl: d.water ? (u.parseVolume(d.water) ?? suggestedWater) : suggestedWater,
        stepsGoal: Number(d.steps.replace(/\./g, '')) || 8000,
      });
    } catch (e) {
      toastError(e);
      setSaving(false);
    }
  };

  const optional = ['about', 'body', 'weight', 'target', 'training'].includes(step);
  const progress = index / (STEPS.length - 1);

  return (
    <main id="main" tabIndex={-1} className="onb" style={{ outline: 'none' }}>
      <div className="onb__panel glass glass--sheet">
        {step !== 'welcome' && (
          <div className="onb__top">
            <IconButton label="Paso anterior" size="sm" onClick={() => go(-1)} disabled={saving}>
              <ArrowLeft />
            </IconButton>
            <ProgressBar value={progress} label="Progreso de la configuración" className="grow" />
            <span className="t-small t-num onb__count" aria-live="polite">
              {index}/{STEPS.length - 1}
            </span>
          </div>
        )}

        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.section
            key={step}
            className="onb__step"
            custom={dir}
            variants={stepVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            aria-labelledby={`onb-${step}`}
          >
            {step === 'welcome' && (
              <div className="onb__welcome">
                <motion.div variants={itemVariants} className="onb__brand" style={{ color: 'var(--brand-ink)' }}>
                  <span className="onb__medal" aria-hidden="true">
                    <span className="onb__medal-ring" />
                    <span className="onb__medal-core">
                      <RunnerMark size={34} />
                    </span>
                  </span>
                  <Wordmark height={14} title="RUMBO" />
                </motion.div>
                <motion.h1 id="onb-welcome" variants={itemVariants} className="onb__headline">
                  Vamos a preparar tu RUMBO
                </motion.h1>
                <motion.p variants={itemVariants} className="onb__lead">
                  Unas preguntas rápidas para personalizar tu seguimiento. Solo el nombre y tu objetivo son imprescindibles.
                </motion.p>
                <motion.ul variants={itemVariants} className="onb__features" aria-label="Qué podrás hacer">
                  {WELCOME_FEATURES.map((f, i) => (
                    <motion.li
                      key={f.title}
                      className="onb__feature"
                      initial={{ opacity: 0, x: -14 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.32 + i * 0.09, type: 'spring', stiffness: 300, damping: 28 }}
                    >
                      <span className={`onb__feature-icon onb__feature-icon--${f.tone}`} aria-hidden="true">
                        <f.icon />
                      </span>
                      <span className="onb__feature-text">
                        <span className="onb__feature-title">{f.title}</span>
                        <span className="onb__feature-desc">{f.desc}</span>
                      </span>
                    </motion.li>
                  ))}
                </motion.ul>
                <motion.p variants={itemVariants} className="onb__privacy">
                  <ShieldCheck aria-hidden="true" />
                  {storageMode() === 'memory'
                    ? 'Modo temporal: este navegador no permite guardar datos, así que nada se conservará al cerrar.'
                    : 'Tus datos se guardan solo en este dispositivo y no se envían a ningún servidor.'}
                </motion.p>
              </div>
            )}

            {step === 'name' && (
              <>
                <StepTitle id="onb-name" eyebrow="Empecemos" title="¿Cómo quieres que te llamemos?" />
                <motion.div variants={itemVariants}>
                  <TextField
                    label="Nombre o alias"
                    value={d.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder="Por ejemplo, Guille"
                    autoComplete="nickname"
                    maxLength={40}
                    size="lg"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && go(1)}
                  />
                </motion.div>
              </>
            )}

            {step === 'goal' && (
              <>
                <StepTitle id="onb-goal" eyebrow="Tu objetivo" title="¿Qué quieres conseguir?" subtitle="Puedes cambiarlo más adelante desde tu perfil." />
                <motion.div variants={itemVariants} className="choice-grid" role="radiogroup" aria-label="Objetivo principal">
                  {GOALS.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      role="radio"
                      aria-checked={d.goal === g.id}
                      className="choice"
                      onClick={() => set('goal', g.id)}
                    >
                      <span className="choice__icon">
                        <g.icon aria-hidden="true" />
                      </span>
                      <span className="choice__text">
                        <span className="choice__label">{g.label}</span>
                        <span className="choice__desc">{g.description}</span>
                      </span>
                      <span className="choice__check" aria-hidden="true">
                        <Check />
                      </span>
                    </button>
                  ))}
                </motion.div>
              </>
            )}

            {step === 'about' && (
              <>
                <StepTitle id="onb-about" eyebrow="Sobre ti" title="Edad y sexo biológico" />
                <motion.div variants={itemVariants}>
                  <NumberField
                    label="Edad"
                    value={d.age}
                    onChange={(e) => set('age', e.target.value.replace(/\D/g, ''))}
                    suffix="años"
                    decimals={false}
                    placeholder="Opcional"
                  />
                </motion.div>
                <motion.div variants={itemVariants} className="field">
                  <span className="field__label" id="sex-label">
                    Sexo biológico
                  </span>
                  <Segmented label="Sexo biológico" options={SEX_OPTIONS} value={d.sex} onChange={(v) => set('sex', v)} block />
                </motion.div>
                <Why>
                  La ecuación de Mifflin-St Jeor, que usamos para estimar tu metabolismo, depende de la edad y del sexo biológico. Si prefieres no
                  indicarlo, usaremos un valor intermedio y la estimación será algo menos precisa.
                </Why>
              </>
            )}

            {step === 'body' && (
              <>
                <StepTitle id="onb-body" eyebrow="Medidas" title="¿Cuánto mides?" />
                <motion.div variants={itemVariants} className="field">
                  <span className="field__label">Unidades</span>
                  <Segmented
                    label="Sistema de unidades"
                    options={[
                      { value: 'metric', label: 'Métrico (kg, cm)' },
                      { value: 'imperial', label: 'Imperial (lb, in)' },
                    ]}
                    value={d.units}
                    onChange={(v) => {
                      const conv = unitsApi(v);
                      setD((p) => ({
                        ...p,
                        units: v,
                        height: heightCm ? conv.heightToInput(heightCm) : '',
                        current: currentKg ? conv.weightToInput(currentKg) : '',
                        initial: initialKg ? conv.weightToInput(initialKg) : '',
                        target: targetKg ? conv.weightToInput(targetKg) : '',
                        water: '',
                      }));
                    }}
                    block
                  />
                </motion.div>
                <motion.div variants={itemVariants}>
                  <NumberField label="Altura" value={d.height} onChange={(e) => set('height', e.target.value)} suffix={u.h} placeholder="Opcional" size="lg" />
                </motion.div>
                <Why>Necesitamos la altura para calcular tu IMC y estimar tus calorías diarias y la distancia de tus pasos.</Why>
              </>
            )}

            {step === 'weight' && (
              <>
                <StepTitle id="onb-weight" eyebrow="Punto de partida" title="Tu peso" />
                <motion.div variants={itemVariants}>
                  <NumberField label="Peso actual" value={d.current} onChange={(e) => set('current', e.target.value)} suffix={u.w} placeholder="Opcional" size="lg" />
                </motion.div>
                <motion.div variants={itemVariants} className="grid-2">
                  <NumberField
                    label="Peso inicial"
                    hint="Si empezaste antes de hoy"
                    value={d.initial}
                    onChange={(e) => set('initial', e.target.value)}
                    suffix={u.w}
                    placeholder="Opcional"
                  />
                  <TextField
                    label="Fecha de inicio"
                    type="date"
                    value={d.startDate}
                    max={today}
                    min={addDays(today, -3650)}
                    onChange={(e) => set('startDate', e.target.value || today)}
                  />
                </motion.div>
                <Why>Tu peso inicial y el actual nos permiten mostrarte cuánto has avanzado. Ambos se guardan como registros reales en tu historial.</Why>
              </>
            )}

            {step === 'target' && (
              <>
                <StepTitle
                  id="onb-target"
                  eyebrow="Meta"
                  title={usesWeightGoal(d.goal ?? 'habits') ? 'Tu peso objetivo' : '¿Tienes un peso de referencia?'}
                  subtitle={usesWeightGoal(d.goal ?? 'habits') ? 'Elige una meta realista. Podrás ajustarla cuando quieras.' : 'Es opcional: tu objetivo no depende del peso.'}
                />
                <motion.div variants={itemVariants}>
                  <NumberField label="Peso objetivo" value={d.target} onChange={(e) => set('target', e.target.value)} suffix={u.w} placeholder="Opcional" size="lg" />
                </motion.div>
                {refKg !== null && targetKg !== null && !validate() && (
                  <motion.p variants={itemVariants} className="t-small">
                    {targetKg < refKg ? 'Perder' : 'Ganar'} {u.weight(Math.abs(refKg - targetKg))} desde tu punto de partida.
                  </motion.p>
                )}
                <Why>
                  Con un objetivo podemos mostrarte el porcentaje de avance. No prometemos fechas: cada cuerpo tiene su ritmo, y un cambio gradual es más
                  sostenible.
                </Why>
              </>
            )}

            {step === 'activity' && (
              <>
                <StepTitle id="onb-activity" eyebrow="Actividad" title="¿Cómo de activo es tu día a día?" subtitle="Incluye tu trabajo y tu entrenamiento habitual." />
                <motion.div variants={itemVariants} className="choice-list" role="radiogroup" aria-label="Nivel de actividad">
                  {(Object.keys(ACTIVITY_LEVELS) as ActivityLevel[]).map((k) => (
                    <button key={k} type="button" role="radio" aria-checked={d.activity === k} className="choice choice--row" onClick={() => set('activity', k)}>
                      <span className="choice__text">
                        <span className="choice__label">{ACTIVITY_LEVELS[k].label}</span>
                        <span className="choice__desc">{ACTIVITY_LEVELS[k].description}</span>
                      </span>
                      <span className="choice__check" aria-hidden="true">
                        <Check />
                      </span>
                    </button>
                  ))}
                </motion.div>
              </>
            )}

            {step === 'training' && (
              <>
                <StepTitle id="onb-training" eyebrow="Entrenamiento" title="¿Qué días sueles poder entrenar?" subtitle="Lo usaremos para sugerirte un plan semanal editable." />
                <motion.div variants={itemVariants} className="day-picker" role="group" aria-label="Días disponibles">
                  {WEEKDAY_SHORT.map((label, i) => {
                    const on = d.trainingDays.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        className="day-picker__day"
                        aria-pressed={on}
                        aria-label={WEEKDAY_LABELS[i]}
                        onClick={() => set('trainingDays', on ? d.trainingDays.filter((x) => x !== i) : [...d.trainingDays, i])}
                      >
                        {label}
                      </button>
                    );
                  })}
                </motion.div>
                <motion.p variants={itemVariants} className="t-small">
                  {d.trainingDays.length === 0
                    ? 'Sin días seleccionados: también puedes entrenar cuando te apetezca.'
                    : `${d.trainingDays.length} ${d.trainingDays.length === 1 ? 'día' : 'días'} por semana. Descansar también forma parte del progreso.`}
                </motion.p>
              </>
            )}

            {step === 'habits' && (
              <>
                <StepTitle id="onb-habits" eyebrow="Hábitos diarios" title="Agua y pasos" subtitle="Valores de partida que podrás ajustar en cualquier momento." />
                <motion.div variants={itemVariants}>
                  <NumberField
                    label="Objetivo diario de agua"
                    value={d.water}
                    placeholder={u.volumeToInput(suggestedWater)}
                    onChange={(e) => set('water', e.target.value)}
                    suffix={u.v}
                    hint={`Sugerencia orientativa: ${u.volume(suggestedWater)}${currentKg ? ' según tu peso' : ''}. Las necesidades varían con el clima, la actividad y la salud.`}
                  />
                </motion.div>
                <motion.div variants={itemVariants}>
                  <NumberField
                    label="Objetivo diario de pasos"
                    value={d.steps}
                    onChange={(e) => set('steps', e.target.value.replace(/[^\d]/g, ''))}
                    decimals={false}
                    suffix="pasos"
                  />
                </motion.div>
              </>
            )}

            {step === 'summary' && (
              <>
                <StepTitle id="onb-summary" eyebrow="Todo listo" title={`Encantados, ${d.name.trim()}`} subtitle="Este es tu punto de partida." />
                <motion.dl variants={itemVariants} className="summary-list">
                  <SummaryRow label="Objetivo" value={GOALS.find((g) => g.id === d.goal)?.label ?? '—'} />
                  <SummaryRow label="Peso actual" value={currentKg ? u.weight(currentKg) : 'Sin indicar'} />
                  {usesWeightGoal(d.goal ?? 'habits') && <SummaryRow label="Peso objetivo" value={targetKg ? u.weight(targetKg) : 'Sin indicar'} />}
                  <SummaryRow label="Altura" value={heightCm ? u.height(heightCm) : 'Sin indicar'} />
                  <SummaryRow label="Actividad" value={ACTIVITY_LEVELS[d.activity].label} />
                  <SummaryRow label="Agua" value={u.volume(d.water ? (u.parseVolume(d.water) ?? suggestedWater) : suggestedWater)} />
                  <SummaryRow label="Pasos" value={`${formatInt(Number(d.steps) || 8000)} al día`} />
                  <SummaryRow label="Inicio" value={formatDate.long(d.startDate)} />
                </motion.dl>
              </>
            )}

            {error && (
              <p className="field__error" role="alert" style={{ marginTop: 4 }}>
                {error}
              </p>
            )}
          </motion.section>
        </AnimatePresence>

        <div className="onb__actions">
          {step === 'summary' ? (
            <Button size="lg" block onClick={finish} loading={saving} iconRight={<ArrowRight />}>
              Crear mi RUMBO
            </Button>
          ) : (
            <Button size="lg" block onClick={() => go(1)} iconRight={<ArrowRight />}>
              {step === 'welcome' ? 'Empezar' : 'Continuar'}
            </Button>
          )}
          {step === 'welcome' && (
            <p className="onb__hint" aria-hidden="true">
              Menos de 2 minutos · Puedes saltar lo opcional
            </p>
          )}
          {optional && (
            <Button
              variant="ghost"
              block
              onClick={() => {
                // Skip clears this step's optional fields so nothing half-typed is saved.
                if (step === 'about') setD((p) => ({ ...p, age: '', sex: 'unspecified' }));
                if (step === 'body') setD((p) => ({ ...p, height: '' }));
                if (step === 'weight') setD((p) => ({ ...p, current: '', initial: '', startDate: today }));
                if (step === 'target') setD((p) => ({ ...p, target: '' }));
                setError(null);
                setDir(1);
                setIndex((i) => i + 1);
              }}
            >
              Ahora no
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}

function StepTitle({ id, eyebrow, title, subtitle }: { id: string; eyebrow: string; title: string; subtitle?: string }) {
  return (
    <motion.div variants={itemVariants} className="onb__title">
      <p className="t-eyebrow">{eyebrow}</p>
      <h1 id={id} className="t-title">
        {title}
      </h1>
      {subtitle && <p className="t-body">{subtitle}</p>}
    </motion.div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-list__row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

