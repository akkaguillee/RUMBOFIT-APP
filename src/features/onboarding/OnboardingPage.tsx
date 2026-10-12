import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  Droplets,
  Dumbbell,
  Flame,
  Footprints,
  Salad,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { RunnerMark, Wordmark } from '@/brand/Logo';
import { storageMode } from '@/db/backend';
import { createProfile } from '@/db/repos/profile';
import { describeActivity } from '@/domain/body';
import { addDays, todayKey } from '@/domain/dates';
import { estimateActivityLevel } from '@/domain/health';
import type { ActivityLevel, FoodHabits, MotivationProfile, Sex, Units, Wellbeing } from '@/domain/types';
import { checkRange, LIMITS } from '@/domain/validation';
import { Button, IconButton } from '@/ui/Button';
import { NumberField, TextField } from '@/ui/Field';
import { Segmented } from '@/ui/Segmented';
import { Sheet } from '@/ui/Sheet';
import { toastError } from '@/ui/toast';
import { SEX_OPTIONS, usesWeightGoal } from '../shared/labels';
import { unitsApi } from '../shared/units';
import { OnboardingSummary, type SummaryData } from './OnboardingSummary';
import { questionVariants } from './motion';
import { LevelEstimate } from './PrefControls';
import {
  cleanFood,
  cleanMotivation,
  cleanWellbeing,
  EMPTY_QUICK_ACTIVITY,
  goalFromChoice,
  habitsSummary,
  mainGoalLabel,
  motivationSummary,
  quickActivityMissing,
  quickActivityProfile,
  spreadTrainingDays,
  targetWeightError,
  trainingCountLabel,
  waterGoalFor,
  type QuickActivity,
} from './preferences';
import { GoalMainQuestions, HabitsQuestions, MotivationQuickQuestions, QuickActivityQuestions, Reveal, TargetQuestions, type GoalAnswers } from './questions';
import './onboarding.css';

interface Draft {
  name: string;
  age: string;
  sex: Sex;
  units: Units;
  height: string;
  current: string;
  initial: string;
  startDate: string;
  goal: GoalAnswers;
  target: string;
  activity: QuickActivity;
  food: FoodHabits;
  wellbeing: Wellbeing;
  motivation: MotivationProfile;
  consent: boolean;
}

type StepId = 'about' | 'goal' | 'activity' | 'habits' | 'motivation' | 'summary';
type ScreenId = 'welcome' | StepId;

/**
 * Only the essentials (about fifteen questions, some only when they apply):
 * five short screens and the summary. Everything else stays editable in Perfil.
 */
const STEPS: { id: StepId; title: string; icon: LucideIcon }[] = [
  { id: 'about', title: 'Sobre ti', icon: UserRound },
  { id: 'goal', title: 'Tu objetivo', icon: Target },
  { id: 'activity', title: 'Tu actividad', icon: Footprints },
  { id: 'habits', title: 'Tus hábitos', icon: Salad },
  { id: 'motivation', title: 'Tu motivación', icon: Compass },
  { id: 'summary', title: 'Resumen', icon: Sparkles },
];

const ORDER: ScreenId[] = ['welcome', ...STEPS.map((s) => s.id)];
const stepIndexOf = (s: ScreenId) => STEPS.findIndex((st) => st.id === s);
const nextOf = (from: ScreenId): ScreenId => ORDER[ORDER.indexOf(from) + 1] ?? 'summary';
const prevOf = (from: ScreenId): ScreenId => ORDER[ORDER.indexOf(from) - 1] ?? 'welcome';

/** Screens that can be skipped with «Ahora no» (nothing on them is required). */
const OPTIONAL: ScreenId[] = ['activity', 'habits', 'motivation'];

/** Used until the activity questions are answered. */
const DEFAULT_LEVEL: ActivityLevel = 'light';
const DEFAULT_STEPS_GOAL = 8000;

const WELCOME_FEATURES = [
  { icon: TrendingUp, title: 'Tu evolución', desc: 'Peso, IMC y calorías.', tone: 'accent' },
  { icon: Droplets, title: 'Hábitos diarios', desc: 'Agua y pasos a tu medida.', tone: 'water' },
  { icon: Dumbbell, title: 'Entrenamiento', desc: 'Rutinas, series y marcas.', tone: 'steps' },
  { icon: Flame, title: 'Racha e hitos', desc: 'Tu constancia, celebrada.', tone: 'ink' },
] as const;

const stepVariants: Variants = {
  initial: (dir: number) => ({ opacity: 0, x: dir * 32 }),
  enter: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 320, damping: 34, staggerChildren: 0.04, delayChildren: 0.04 } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -20, transition: { duration: 0.15 } }),
};

/** Reduced motion: a short cross-fade, no sliding. */
const stepVariantsReduced: Variants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { duration: 0.12 } },
  exit: { opacity: 0, transition: { duration: 0.08 } },
};

/** Fades the scroll area's edges only while there is more content in that direction. */
function useScrollFade(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const up = el.scrollTop > 2;
      const down = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
      const fade = up && down ? 'both' : up ? 'top' : down ? 'bottom' : null;
      if (fade) el.dataset.fade = fade;
      else delete el.dataset.fade;
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
      mo.disconnect();
    };
  }, [ref]);
}

export default function OnboardingPage() {
  const today = todayKey();
  const reduce = useReducedMotion();
  const bodyRef = useRef<HTMLDivElement>(null);
  useScrollFade(bodyRef);
  const [screen, setScreen] = useState<ScreenId>('welcome');
  const [dir, setDir] = useState(1);
  /** Set after «Editar respuestas»: each screen offers a way straight back to the summary. */
  const [returning, setReturning] = useState(false);
  /** The goal screen also asks for the height: decided on arrival, so the field never vanishes while it is being typed. */
  const [heightInGoal, setHeightInGoal] = useState(false);
  /** «¿Empezaste antes?»: an earlier starting weight and its date, collapsed unless already answered. */
  const [startOpen, setStartOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [d, setD] = useState<Draft>({
    name: '',
    age: '',
    sex: 'unspecified',
    units: 'metric',
    height: '',
    current: '',
    initial: '',
    startDate: today,
    goal: { choice: null, note: '', secondary: [] },
    target: '',
    activity: EMPTY_QUICK_ACTIVITY,
    food: {},
    wellbeing: {},
    motivation: {},
    consent: false,
  });
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setError(null);
    setD((prev) => ({ ...prev, [k]: v }));
  };
  /** Merges a partial answer into one of the grouped answers. */
  const patch =
    <K extends 'goal' | 'activity' | 'food' | 'wellbeing' | 'motivation'>(k: K) =>
    (p: Partial<Draft[K]>) => {
      setError(null);
      setD((prev) => ({ ...prev, [k]: { ...prev[k], ...p } }));
    };

  // Without consent, bring the checkbox into view once the error has made room for itself.
  const needsConsent = screen === 'summary' && error !== null && !d.consent;
  useEffect(() => {
    if (needsConsent) bodyRef.current?.querySelector('.consent')?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [needsConsent, reduce]);

  const u = useMemo(() => unitsApi(d.units), [d.units]);
  const heightCm = d.height ? u.parseHeight(d.height) : null;
  const currentKg = d.current ? u.parseWeight(d.current) : null;
  const initialKg = d.initial ? u.parseWeight(d.initial) : null;
  const targetKg = d.target ? u.parseWeight(d.target) : null;
  const refKg = initialKg ?? currentKg;
  const age = d.age ? Number(d.age) : null;
  const minor = age !== null && age < 18;
  const goal = d.goal.choice ? goalFromChoice(d.goal.choice, d.goal.note) : null;
  const weightGoal = goal !== null && usesWeightGoal(goal.goal) && !minor;
  const activity = quickActivityProfile(d.activity);
  const level = activity ? estimateActivityLevel(activity) : null;
  const waterMl = waterGoalFor(d.food.water, currentKg ?? undefined);

  const stepIndex = stepIndexOf(screen);
  const step = STEPS[stepIndex];

  /** Returns an error message for a screen, or null when it can continue. */
  const validate = (s: ScreenId = screen): string | null => {
    switch (s) {
      case 'about': {
        if (!d.name.trim()) return 'Escribe un nombre o alias para continuar.';
        if (d.name.trim().length > 40) return 'El nombre no puede superar 40 caracteres.';
        const range =
          (d.age && checkRange(age, LIMITS.age)) ||
          (d.height && checkRange(heightCm, LIMITS.heightCm)) ||
          (d.current && checkRange(currentKg, LIMITS.weightKg)) ||
          (d.initial && checkRange(initialKg, LIMITS.weightKg));
        if (range) return range;
        if (d.initial && !d.current) return 'Indica también tu peso actual.';
        if (d.startDate > today) return 'La fecha de inicio no puede estar en el futuro.';
        // An initial weight different from today's needs the day it was taken, or it would be saved as today's start.
        if (d.initial && initialKg !== currentKg && d.startDate === today) return 'Indica la fecha de inicio: el día en que pesabas eso, antes de hoy.';
        return null;
      }
      case 'goal':
        if (!d.goal.choice) return 'Elige el objetivo que mejor te describa.';
        if (d.goal.choice === 'other' && !d.goal.note.trim()) return 'Escribe tu objetivo en pocas palabras.';
        if (d.height && checkRange(heightCm, LIMITS.heightCm)) return checkRange(heightCm, LIMITS.heightCm);
        return goal && weightGoal && d.target ? targetWeightError(goal.goal, targetKg ?? NaN, refKg, heightCm, u.weight) : null;
      case 'activity':
        return quickActivityMissing(d.activity);
      case 'summary':
        return d.consent ? null : 'Marca la casilla para crear tu RUMBO.';
      default:
        return null;
    }
  };

  /** First answered screen that would not pass its own check, e.g. after changing the goal from «Editar respuestas». */
  const firstInvalid = (): { screen: ScreenId; error: string } | null => {
    for (const s of ORDER) {
      if (s === 'summary') continue;
      const err = validate(s);
      if (err) return { screen: s, error: err };
    }
    return null;
  };

  const goTo = (target: ScreenId, direction: number, message: string | null = null) => {
    setError(message);
    setDir(direction);
    setScreen(target);
    // Without a valid height from «Sobre ti», the target weight asks for it on its own screen.
    if (target === 'goal') setHeightInGoal(!d.height || checkRange(heightCm, LIMITS.heightCm) !== null);
    if (target === 'about') setStartOpen(d.initial !== '' || d.startDate !== today);
  };

  /** Opens the summary only when every answer is still valid; otherwise shows the first one to fix. */
  const toSummary = () => {
    const bad = firstInvalid();
    if (!bad) return goTo('summary', 1);
    setReturning(true);
    goTo(bad.screen, ORDER.indexOf(bad.screen) < ORDER.indexOf(screen) ? -1 : 1, bad.error);
  };

  const next = () => {
    const err = validate();
    if (err) return setError(err);
    const target = nextOf(screen);
    if (target === 'summary') return toSummary();
    goTo(target, 1);
  };

  const back = () => goTo(prevOf(screen), -1);

  /** «Ahora no»: clears what this screen asked, so nothing half-answered is saved. */
  const skip = () => {
    setD((p) => {
      switch (screen) {
        case 'activity':
          return { ...p, activity: EMPTY_QUICK_ACTIVITY };
        case 'habits':
          return { ...p, food: {}, wellbeing: {} };
        case 'motivation':
          return { ...p, motivation: {} };
        default:
          return p;
      }
    });
    const target = nextOf(screen);
    if (target === 'summary') return toSummary();
    goTo(target, 1);
  };

  /** Closing «¿Empezaste antes?» removes what it held: what is on screen is what gets saved. */
  const toggleStart = () => {
    if (startOpen) setD((p) => ({ ...p, initial: '', startDate: today }));
    setError(null);
    setStartOpen(!startOpen);
  };

  const backToSummary = () => {
    const err = validate();
    if (err) return setError(err);
    toSummary();
  };

  const editStep = (id: StepId) => {
    setEditOpen(false);
    setReturning(true);
    goTo(id, -1);
  };

  const finish = async () => {
    const bad = firstInvalid();
    if (bad) {
      setReturning(true);
      return goTo(bad.screen, -1, bad.error);
    }
    const err = validate('summary');
    if (err) return setError(err);
    if (!goal) return goTo('goal', -1);
    setSaving(true);
    try {
      await createProfile({
        name: d.name,
        age: age ?? undefined,
        sex: d.sex,
        heightCm: heightCm ?? undefined,
        goal: goal.goal,
        goalNote: goal.goalNote,
        currentWeightKg: currentKg ?? undefined,
        startWeightKg: initialKg ?? undefined,
        goalWeightKg: weightGoal ? (targetKg ?? undefined) : undefined,
        activityLevel: level ?? DEFAULT_LEVEL,
        units: d.units,
        startDate: d.startDate,
        trainingDays: activity ? spreadTrainingDays(activity.trainingDays) : [],
        waterGoalMl: waterMl,
        stepsGoal: DEFAULT_STEPS_GOAL,
        activity,
        food: cleanFood(d.food),
        motivation: cleanMotivation(d.motivation),
        wellbeing: cleanWellbeing(d.wellbeing),
        consentAt: Date.now(),
      });
    } catch (e) {
      toastError(e);
      setSaving(false);
    }
  };

  const summary: SummaryData | null = goal && {
    name: d.name.trim(),
    goal: goal.goal,
    goalLabel: mainGoalLabel(goal),
    custom: d.goal.choice === 'other',
    currentKg,
    initialKg: initialKg !== null && d.startDate < today ? initialKg : null,
    heightCm,
    weightGoal,
    targetKg: weightGoal ? targetKg : null,
    refKg,
    level: level ?? DEFAULT_LEVEL,
    trainingDays: activity?.trainingDays ?? null,
    waterMl,
    stepsGoal: DEFAULT_STEPS_GOAL,
    food: cleanFood(d.food),
    motivation: cleanMotivation(d.motivation),
    wellbeing: cleanWellbeing(d.wellbeing),
  };

  const levelDetail = activity
    ? `Según tu día a día${activity.trainingDays ? ` y ${trainingCountLabel(activity.trainingDays)} de entreno` : ''}. Lo usamos para estimar tus calorías; podrás ajustarlo en Perfil.`
    : 'Responde a las dos primeras preguntas para calcularlo.';
  const waterHint =
    d.food.water === 'low' || d.food.water === 'medium'
      ? `Empezaremos con ${u.volume(waterMl)} al día, una meta alcanzable que podrás subir poco a poco.`
      : `Objetivo de partida: ${u.volume(waterMl)} al día${currentKg ? ' según tu peso' : ''}. Podrás cambiarlo cuando quieras.`;

  const titles: Record<ScreenId, { title: string; subtitle?: string }> = {
    welcome: { title: 'Vamos a preparar tu RUMBO' },
    about: { title: 'Cuéntanos sobre ti', subtitle: 'Solo el nombre es obligatorio.' },
    goal: { title: '¿Qué quieres conseguir?', subtitle: 'Elige tu objetivo principal. Podrás cambiarlo cuando quieras.' },
    activity: { title: '¿Cómo es tu día a día?', subtitle: 'Así estimamos tu nivel de actividad sin que tengas que adivinarlo.' },
    habits: { title: 'Tus hábitos', subtitle: 'Opcional. No hace falta seguir ninguna dieta: solo queremos que los consejos encajen contigo.' },
    motivation: { title: 'Para acompañarte mejor', subtitle: 'Opcional. Así ajustamos el ritmo y el tono de tus consejos.' },
    summary: { title: `Encantados, ${d.name.trim()}`, subtitle: 'Este es tu punto de partida. Revísalo antes de empezar.' },
  };
  const t = titles[screen];
  const optional = OPTIONAL.includes(screen);

  return (
    <main id="main" tabIndex={-1} className="onb" style={{ outline: 'none' }}>
      <div className="onb__panel glass glass--sheet">
        {screen !== 'welcome' && (
          <div className="onb__top">
            <IconButton label="Paso anterior" size="sm" onClick={back} disabled={saving}>
              <ArrowLeft />
            </IconButton>
            <StepsProgress step={stepIndex} />
            <span className="t-small t-num onb__count" aria-hidden="true">
              {stepIndex + 1}/{STEPS.length}
            </span>
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {step ? `Paso ${stepIndex + 1} de ${STEPS.length}, ${step.title}: ${t.title}` : ''}
        </p>

        <div className="onb__body" ref={bodyRef}>
          <AnimatePresence
            mode="wait"
            custom={dir}
            initial={false}
            onExitComplete={() => {
              if (bodyRef.current) bodyRef.current.scrollTop = 0;
            }}
          >
            <motion.section
              key={screen}
              className="onb__step"
              data-screen={screen}
              custom={dir}
              variants={reduce ? stepVariantsReduced : stepVariants}
              initial="initial"
              animate="enter"
              exit="exit"
              aria-labelledby={`onb-${screen}`}
            >
              {screen === 'welcome' ? (
                <div className="onb__welcome">
                  <motion.div variants={questionVariants} className="onb__brand" style={{ color: 'var(--brand-ink)' }}>
                    <span className="onb__medal" aria-hidden="true">
                      <span className="onb__medal-ring" />
                      <span className="onb__medal-core">
                        <RunnerMark size={34} />
                      </span>
                    </span>
                    <Wordmark height={14} title="RUMBO" />
                  </motion.div>
                  <motion.h1 id="onb-welcome" variants={questionVariants} className="onb__headline">
                    {t.title}
                  </motion.h1>
                  <motion.p variants={questionVariants} className="onb__lead">
                    Unas preguntas rápidas para personalizar tu seguimiento. Solo el nombre y tu objetivo son imprescindibles.
                  </motion.p>
                  <motion.ul variants={questionVariants} className="onb__features" aria-label="Qué podrás hacer">
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
                  <motion.p variants={questionVariants} className="onb__privacy">
                    <ShieldCheck aria-hidden="true" />
                    {storageMode() === 'memory'
                      ? 'Modo temporal: ahora mismo no se puede guardar en este dispositivo, así que nada se conservará al cerrar.'
                      : 'Tus datos se guardan solo en este dispositivo y no se envían a ningún servidor.'}
                  </motion.p>
                </div>
              ) : (
                <StepTitle id={`onb-${screen}`} eyebrow={step!.title} title={t.title} subtitle={t.subtitle} />
              )}

              {screen === 'about' && (
                <>
                  <motion.div variants={questionVariants}>
                    <TextField
                      label="Nombre o alias"
                      value={d.name}
                      onChange={(e) => set('name', e.target.value)}
                      placeholder="Por ejemplo, Guille"
                      autoComplete="nickname"
                      maxLength={40}
                      size="lg"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && next()}
                    />
                  </motion.div>
                  <motion.div variants={questionVariants} className="grid-2">
                    <NumberField label="Edad" value={d.age} onChange={(e) => set('age', e.target.value.replace(/\D/g, ''))} suffix="años" decimals={false} />
                    <NumberField label="Altura" value={d.height} onChange={(e) => set('height', e.target.value)} suffix={u.h} />
                  </motion.div>
                  <motion.div variants={questionVariants} className="grid-2">
                    <NumberField label="Peso actual" value={d.current} onChange={(e) => set('current', e.target.value)} suffix={u.w} />
                    <div className="field onb-units">
                      <span className="field__label" aria-hidden="true">
                        Unidades
                      </span>
                      <Segmented
                        label="Unidades"
                        options={[
                          { value: 'metric', label: 'kg · cm' },
                          { value: 'imperial', label: 'lb · in' },
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
                          }));
                        }}
                        block
                      />
                    </div>
                  </motion.div>
                  <motion.div variants={questionVariants} className="field">
                    <span className="field__label" aria-hidden="true">
                      Sexo biológico
                    </span>
                    <Segmented label="Sexo biológico" options={SEX_OPTIONS} value={d.sex} onChange={(v) => set('sex', v)} block />
                    <p className="field__hint">Solo para estimar tu metabolismo. Sin él usamos un valor intermedio, algo menos preciso.</p>
                  </motion.div>
                  <motion.div variants={questionVariants} className="onb-start">
                    <button type="button" className="disclosure onb-start__toggle" aria-expanded={startOpen} aria-controls="onb-start" onClick={toggleStart}>
                      {!startOpen && <span className="onb-start__ask">¿Empezaste antes?</span>}
                      <span className="onb-start__action">
                        {startOpen ? 'Quitar peso y fecha de inicio' : 'Añadir peso y fecha de inicio'}
                        <ChevronDown aria-hidden="true" />
                      </span>
                    </button>
                  </motion.div>
                  <Reveal show={startOpen}>
                    <div id="onb-start" className="grid-2">
                      <NumberField label="Peso inicial" value={d.initial} onChange={(e) => set('initial', e.target.value)} suffix={u.w} />
                      <TextField
                        label="Fecha de inicio"
                        type="date"
                        value={d.startDate}
                        max={today}
                        min={addDays(today, -3650)}
                        onChange={(e) => set('startDate', e.target.value || today)}
                      />
                    </div>
                  </Reveal>
                </>
              )}

              {screen === 'goal' && (
                <>
                  <GoalMainQuestions value={d.goal} onChange={patch('goal')} />
                  <Reveal show={goal !== null && usesWeightGoal(goal.goal)}>
                    <TargetQuestions
                      goal={goal?.goal ?? null}
                      target={d.target}
                      onTarget={(v) => set('target', v)}
                      u={u}
                      minor={minor}
                      height={heightInGoal && (weightGoal || d.height !== '') ? { value: d.height, onChange: (v) => set('height', v) } : undefined}
                      targetHint={
                        refKg !== null && targetKg !== null && !validate('goal')
                          ? `${targetKg < refKg ? 'Perder' : 'Ganar'} ${u.weight(Math.abs(refKg - targetKg))} desde tu punto de partida.`
                          : null
                      }
                    />
                  </Reveal>
                </>
              )}

              {screen === 'activity' && (
                <>
                  <QuickActivityQuestions value={d.activity} onChange={patch('activity')} />
                  <LevelEstimate level={level} detail={levelDetail} />
                </>
              )}

              {screen === 'habits' && (
                <HabitsQuestions food={d.food} wellbeing={d.wellbeing} onFood={patch('food')} onWellbeing={patch('wellbeing')} waterHint={waterHint} />
              )}

              {screen === 'motivation' && <MotivationQuickQuestions value={d.motivation} onChange={patch('motivation')} />}

              {screen === 'summary' && summary && (
                <OnboardingSummary
                  data={summary}
                  u={u}
                  consent={d.consent}
                  onConsent={(v) => set('consent', v)}
                  invalid={needsConsent}
                  temporary={storageMode() === 'memory'}
                />
              )}
            </motion.section>
          </AnimatePresence>
        </div>

        <div className="onb__actions">
          {error && (
            <p className="onb__error" role="alert">
              <AlertCircle aria-hidden="true" />
              {error}
            </p>
          )}
          {screen === 'welcome' && (
            <>
              <Button size="lg" block onClick={next} iconRight={<ArrowRight />}>
                Empezar
              </Button>
              <p className="onb__hint" aria-hidden="true">
                Unos 2 minutos · Puedes saltar lo opcional
              </p>
            </>
          )}
          {screen === 'summary' && (
            <>
              <Button size="lg" block onClick={finish} loading={saving} iconRight={<Check />}>
                Crear mi RUMBO
              </Button>
              <Button variant="ghost" block onClick={() => setEditOpen(true)} disabled={saving}>
                Editar respuestas
              </Button>
            </>
          )}
          {screen !== 'welcome' && screen !== 'summary' && (
            <div className="onb__row">
              {returning ? (
                <Button variant="ghost" onClick={backToSummary}>
                  Ir al resumen
                </Button>
              ) : (
                optional && (
                  <Button variant="ghost" onClick={skip}>
                    Ahora no
                  </Button>
                )
              )}
              <Button size="lg" className="grow" onClick={next} iconRight={<ArrowRight />}>
                Continuar
              </Button>
            </div>
          )}
        </div>
      </div>

      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title="Editar respuestas" description="Elige qué quieres revisar. Tus respuestas se conservan.">
        <ul className="onb-edit">
          {STEPS.slice(0, -1).map((s, i) => (
            <li key={s.id}>
              <button type="button" className="onb-edit__row pressable pressable--lg" onClick={() => editStep(s.id)}>
                <span className="onb-edit__icon" aria-hidden="true">
                  <s.icon />
                </span>
                <span className="onb-edit__text">
                  <span className="onb-edit__title">
                    <span className="onb-edit__n">{i + 1}</span>
                    {s.title}
                  </span>
                  <span className="onb-edit__sub">{stepSummary(s.id)}</span>
                </span>
                <ChevronRight className="onb-edit__chev" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </main>
  );

  /** One line per step for the «Editar respuestas» list. */
  function stepSummary(id: StepId): string {
    switch (id) {
      case 'about':
        return [d.name.trim(), age !== null && `${age} años`, currentKg !== null && u.weight(currentKg)].filter(Boolean).join(' · ');
      case 'goal':
        return goal ? [mainGoalLabel(goal), weightGoal && targetKg !== null && `Meta: ${u.weight(targetKg)}`].filter(Boolean).join(' · ') : 'Sin elegir';
      case 'activity':
        return activity ? describeActivity(activity) : 'Sin responder';
      case 'habits':
        return habitsSummary(cleanFood(d.food), cleanWellbeing(d.wellbeing)) ?? 'Sin responder';
      default:
        return motivationSummary(cleanMotivation(d.motivation)) ?? 'Sin responder';
    }
  }
}

/** One segment per step; those reached so far are filled. */
function StepsProgress({ step }: { step: number }) {
  const value = Math.round(((step + 1) / STEPS.length) * 100);
  return (
    <div className="onb-progress" role="progressbar" aria-label="Progreso de la configuración" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      {STEPS.map((s, i) => (
        <span key={s.id} className="onb-progress__seg">
          <span className="onb-progress__fill" style={{ transform: `scaleX(${i <= step ? 1 : 0})` }} />
        </span>
      ))}
    </div>
  );
}

function StepTitle({ id, eyebrow, title, subtitle }: { id: string; eyebrow: string; title: string; subtitle?: string }) {
  return (
    <motion.div variants={questionVariants} className="onb__title">
      <p className="t-eyebrow">{eyebrow}</p>
      <h1 id={id} className="t-title">
        {title}
      </h1>
      {subtitle && <p className="onb__subtitle">{subtitle}</p>}
    </motion.div>
  );
}
