import { AlertCircle, ChevronRight, Compass, Footprints, Moon, Salad, ShieldCheck, SlidersHorizontal, Target, Trash2, type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { updateProfile } from '@/db/repos/profile';
import { describeActivity } from '@/domain/body';
import { formatDate, todayKey, toDateKey } from '@/domain/dates';
import { ACTIVITY_LEVELS, currentAge } from '@/domain/health';
import type { FoodHabits, MotivationProfile, Profile, Wellbeing } from '@/domain/types';
import { Button } from '@/ui/Button';
import { GlassCard } from '@/ui/GlassCard';
import { Sheet } from '@/ui/Sheet';
import { Switch } from '@/ui/Switch';
import { toast, toastError } from '@/ui/toast';
import { goalLabel, usesWeightGoal } from '../shared/labels';
import { unitsApi } from '../shared/units';
import { LevelEstimate } from '../onboarding/PrefControls';
import {
  activityAnswersOf,
  activityMissing,
  activityStarted,
  cleanFood,
  cleanMotivation,
  cleanWellbeing,
  estimatedLevel,
  foodSummary,
  goalChoiceOf,
  goalFromChoice,
  inputOrStored,
  joinList,
  mainGoalLabel,
  motivationSummary,
  TARGET_NEEDS_HEIGHT,
  targetWeightError,
  toActivityProfile,
  trainingDaysOf,
  waterGoalFor,
  wellbeingSummary,
  type ActivityAnswers,
} from '../onboarding/preferences';
import {
  ActivityDailyQuestions,
  ActivityTrainingQuestions,
  FoodQuestions,
  GoalDetailQuestions,
  GoalMainQuestions,
  MotivationBlockerQuestions,
  MotivationDriverQuestions,
  Reveal,
  WellbeingQuestions,
  type GoalAnswers,
} from '../onboarding/questions';

/** Anchor other pages link to: /perfil#preferencias. */
export const PREFERENCES_ANCHOR = 'preferencias';

/** A target weight needs the height; in Perfil it is edited in «Datos personales». */
export const HEIGHT_IN_PERSONAL = 'Añade tu altura en «Datos personales» para fijar un peso objetivo saludable.';

export type PrefGroup = 'goals' | 'activity' | 'food' | 'motivation' | 'wellbeing';

const GROUPS: { id: PrefGroup; title: string; icon: LucideIcon }[] = [
  { id: 'goals', title: 'Objetivos', icon: Target },
  { id: 'activity', title: 'Actividad', icon: Footprints },
  { id: 'food', title: 'Alimentación y hábitos', icon: Salad },
  { id: 'motivation', title: 'Obstáculos y motivación', icon: Compass },
  { id: 'wellbeing', title: 'Sueño y bienestar', icon: Moon },
];

function groupSummary(g: PrefGroup, p: Profile): string | null {
  switch (g) {
    case 'goals':
      return p.secondaryGoals?.length
        ? `${mainGoalLabel(p)} · También: ${joinList(p.secondaryGoals.map((x) => goalLabel(x).toLowerCase()))}`
        : mainGoalLabel(p);
    case 'activity':
      return p.activity ? `Nivel ${ACTIVITY_LEVELS[p.activityLevel].label.toLowerCase()} · ${describeActivity(p.activity)}` : null;
    case 'food':
      return foodSummary(p.food);
    case 'motivation':
      return motivationSummary(p.motivation);
    case 'wellbeing':
      return wellbeingSummary(p.wellbeing);
  }
}

/** Perfil → Tu personalización: one row per group of onboarding answers, each edited in a sheet. */
export function PreferencesCard({ profile, onEdit }: { profile: Profile; onEdit: (g: PrefGroup) => void }) {
  return (
    <GlassCard id={PREFERENCES_ANCHOR} className="prefs-card" aria-labelledby="prefs-title">
      <h2 id="prefs-title" className="card__title" tabIndex={-1} style={{ marginBottom: 4 }}>
        <SlidersHorizontal aria-hidden="true" />
        Tu personalización
      </h2>
      <p className="t-small prefs-card__lead">Tus respuestas ajustan tu nivel de actividad, tus objetivos y los consejos que ves. Todas se pueden cambiar.</p>
      <ul className="prefs-rows">
        {GROUPS.map((g) => {
          const summary = groupSummary(g.id, profile);
          return (
            <li key={g.id}>
              <button type="button" className="prefs-row pressable pressable--lg" onClick={() => onEdit(g.id)}>
                <span className="prefs-row__icon" aria-hidden="true">
                  <g.icon />
                </span>
                <span className="prefs-row__text">
                  <span className="prefs-row__title">
                    <span className="sr-only">Editar </span>
                    {g.title}
                  </span>
                  <span className={summary ? 'prefs-row__sub' : 'prefs-row__sub is-empty'}>{summary ?? 'Sin responder · Añadir'}</span>
                </span>
                <ChevronRight className="prefs-row__chev" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="prefs-card__privacy">
        <ShieldCheck aria-hidden="true" />
        {profile.consentAt
          ? `Guardado solo en este dispositivo. Aceptado el ${formatDate.long(toDateKey(new Date(profile.consentAt)))}.`
          : 'Guardado solo en este dispositivo.'}{' '}
        Puedes borrarlo todo en «Datos y privacidad».
      </p>
    </GlassCard>
  );
}

/**
 * The edit sheet for one group. Mount it with a new key each time it opens so
 * the answers start from the saved profile; keep the key while closing so the
 * sheet can animate out.
 */
export function PreferencesSheet({ group, open, onClose, profile, latestKg }: { group: PrefGroup; open: boolean; onClose: () => void; profile: Profile; latestKg?: number }) {
  const props = { open, onClose, profile };
  if (group === 'goals') return <GoalsEditor {...props} latestKg={latestKg} />;
  if (group === 'activity') return <ActivityEditor {...props} />;
  if (group === 'food') return <FoodEditor {...props} latestKg={latestKg} />;
  if (group === 'motivation') return <MotivationEditor {...props} />;
  return <WellbeingEditor {...props} />;
}

interface EditorProps {
  open: boolean;
  onClose: () => void;
  profile: Profile;
}

interface EditorSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  error: string | null;
  busy: boolean;
  onSave: () => void;
  /** «Borrar respuestas»: only for groups that are entirely optional. */
  onClear?: () => void;
  children: ReactNode;
}

function EditorSheet({ open, onClose, title, description, error, busy, onSave, onClear, children }: EditorSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      locked={busy}
      footer={
        <div className="pref-sheet__foot">
          {error && (
            <p className="field__error" role="alert">
              <AlertCircle aria-hidden="true" />
              {error}
            </p>
          )}
          <Button onClick={onSave} loading={busy} block>
            Guardar
          </Button>
        </div>
      }
    >
      {/* The page cascade has long finished: the questions render as they are instead of waiting for it. */}
      <motion.div inherit={false} className="pref-editor q-stack">
        {children}
        {onClear && (
          <button type="button" className="link-btn pref-clear" onClick={onClear} disabled={busy}>
            <Trash2 aria-hidden="true" />
            Borrar estas respuestas
          </button>
        )}
      </motion.div>
    </Sheet>
  );
}

/** Saves a patch, closes the sheet and confirms. */
function useSave(onClose: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (patch: Parameters<typeof updateProfile>[0], message: string) => {
    setBusy(true);
    try {
      await updateProfile(patch);
      onClose();
      toast(message);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, save };
}

function GoalsEditor({ open, onClose, profile, latestKg }: EditorProps & { latestKg?: number }) {
  const u = unitsApi(profile.units);
  const [answers, setAnswers] = useState<GoalAnswers>({
    choice: goalChoiceOf(profile.goal, profile.goalNote),
    note: profile.goalNote ?? '',
    secondary: profile.secondaryGoals ?? [],
  });
  const [target, setTarget] = useState(u.weightToInput(profile.goalWeightKg));
  const { busy, error, setError, save } = useSave(onClose);
  const age = currentAge(profile.age, profile.ageRecordedOn, todayKey());
  const minor = age !== undefined && age < 18;
  const goal = answers.choice ? goalFromChoice(answers.choice, answers.note) : null;
  const weightGoal = goal !== null && usesWeightGoal(goal.goal) && !minor;
  const targetKg = target ? (inputOrStored(target, profile.goalWeightKg, u.weightToInput, u.parseWeight) ?? NaN) : null;
  const refKg = profile.startWeightKg ?? latestKg ?? null;
  const rawTargetError = goal && weightGoal ? targetWeightError(goal.goal, targetKg, refKg, profile.heightCm ?? null, u.weight) : null;
  const targetError = rawTargetError === TARGET_NEEDS_HEIGHT ? HEIGHT_IN_PERSONAL : rawTargetError;

  const onSave = () => {
    if (!goal) return setError('Elige tu objetivo principal.');
    if (answers.choice === 'other' && !goal.goalNote) return setError('Escribe tu objetivo en pocas palabras.');
    if (targetError) return setError(targetError);
    void save(
      {
        goal: goal.goal,
        goalNote: goal.goalNote,
        secondaryGoals: answers.secondary.length ? answers.secondary : undefined,
        // Under 18 there is never a target weight (onboarding does not ask for one either).
        ...(minor ? { goalWeightKg: undefined } : weightGoal ? { goalWeightKg: targetKg ?? undefined } : {}),
      },
      'Objetivos guardados',
    );
  };

  return (
    <EditorSheet
      open={open}
      onClose={onClose}
      title="Objetivos"
      description={
        goal && goal.goal !== profile.goal
          ? 'Cambiar el objetivo principal inicia una nueva etapa. Tu historial y tus hitos se conservan.'
          : 'Tu objetivo principal y, si quieres, otros en los que trabajar.'
      }
      error={error}
      busy={busy}
      onSave={onSave}
    >
      <GoalMainQuestions
        value={answers}
        onChange={(p) => {
          setError(null);
          setAnswers((a) => ({ ...a, ...p }));
        }}
      />
      <GoalDetailQuestions
        value={answers}
        onChange={(p) => setAnswers((a) => ({ ...a, ...p }))}
        goal={goal?.goal ?? null}
        target={target}
        onTarget={(v) => {
          setError(null);
          setTarget(v);
        }}
        u={u}
        minor={minor}
        targetHint={
          !targetError && targetKg !== null && refKg !== null
            ? `${targetKg < refKg ? 'Perder' : 'Ganar'} ${u.weight(Math.abs(refKg - targetKg))} desde tu peso de partida.`
            : null
        }
      />
    </EditorSheet>
  );
}

function ActivityEditor({ open, onClose, profile }: EditorProps) {
  const [a, setA] = useState<ActivityAnswers>(() => activityAnswersOf(profile));
  const { busy, error, setError, save } = useSave(onClose);
  const level = estimatedLevel(a);
  const days = a.exercises ? a.days.length : 0;

  const onSave = () => {
    const missing = activityMissing(a);
    if (missing) return setError(missing);
    const activity = toActivityProfile(a);
    if (!activity || !level) return setError('Responde a las preguntas para estimar tu nivel de actividad.');
    void save({ activity, activityLevel: level, trainingDays: trainingDaysOf(a) }, `Actividad guardada · Nivel ${ACTIVITY_LEVELS[level].label.toLowerCase()}`);
  };

  return (
    <EditorSheet
      open={open}
      onClose={onClose}
      title="Actividad"
      description="Tu nivel de actividad se recalcula con estas respuestas."
      error={error}
      busy={busy}
      onSave={onSave}
      onClear={profile.activity ? () => void save({ activity: undefined }, 'Respuestas de actividad borradas') : undefined}
    >
      <ActivityDailyQuestions
        value={a}
        onChange={(p) => {
          setError(null);
          setA((x) => ({ ...x, ...p }));
        }}
      />
      <Reveal show={a.exercises === true}>
        <ActivityTrainingQuestions
          value={a}
          onChange={(p) => {
            setError(null);
            setA((x) => ({ ...x, ...p }));
          }}
        />
      </Reveal>
      <LevelEstimate
        level={level}
        detail={
          level
            ? `Según tu día a día${days ? ` y ${days} ${days === 1 ? 'día' : 'días'} de entreno` : ''}. Al guardar se actualiza tu nivel de actividad.`
            : activityStarted(a)
              ? 'Completa las preguntas para calcularlo.'
              : 'Responde a las preguntas para calcularlo.'
        }
      />
    </EditorSheet>
  );
}

function FoodEditor({ open, onClose, profile, latestKg }: EditorProps & { latestKg?: number }) {
  const u = unitsApi(profile.units);
  const [food, setFood] = useState<FoodHabits>(profile.food ?? {});
  const [applyWater, setApplyWater] = useState(false);
  const { busy, error, save } = useSave(onClose);
  const suggestion = waterGoalFor(food.water, latestKg);
  const offerWater = food.water !== undefined && food.water !== profile.food?.water && suggestion !== profile.waterGoalMl;

  return (
    <EditorSheet
      open={open}
      onClose={onClose}
      title="Alimentación y hábitos"
      description="Todo es opcional. No hace falta seguir ninguna dieta: solo adaptamos los consejos a ti."
      error={error}
      busy={busy}
      onSave={() => void save({ food: cleanFood(food), ...(offerWater && applyWater ? { waterGoalMl: suggestion } : {}) }, 'Alimentación y hábitos guardados')}
      onClear={profile.food ? () => void save({ food: undefined }, 'Respuestas de alimentación borradas') : undefined}
    >
      <FoodQuestions
        value={food}
        onChange={(p) => setFood((f) => ({ ...f, ...p }))}
        waterHint={`Tu objetivo de agua actual es ${u.volume(profile.waterGoalMl)} al día.`}
      />
      {offerWater && (
        <div className="setting-row pref-water">
          <span className="grow">
            <span className="list-row__title" style={{ display: 'block' }}>
              Usar {u.volume(suggestion)} como objetivo de agua
            </span>
            <span className="list-row__sub">Sugerencia orientativa según tu respuesta{latestKg ? ' y tu peso' : ''}.</span>
          </span>
          <Switch checked={applyWater} label={`Usar ${u.volume(suggestion)} como objetivo de agua`} onChange={setApplyWater} />
        </div>
      )}
    </EditorSheet>
  );
}

function MotivationEditor({ open, onClose, profile }: EditorProps) {
  const [m, setM] = useState<MotivationProfile>(profile.motivation ?? {});
  const { busy, error, save } = useSave(onClose);
  const onChange = (p: Partial<MotivationProfile>) => setM((x) => ({ ...x, ...p }));
  return (
    <EditorSheet
      open={open}
      onClose={onClose}
      title="Obstáculos y motivación"
      description="Así adaptamos el tono y el ritmo de tus consejos."
      error={error}
      busy={busy}
      onSave={() => void save({ motivation: cleanMotivation(m) }, 'Obstáculos y motivación guardados')}
      onClear={profile.motivation ? () => void save({ motivation: undefined }, 'Respuestas de motivación borradas') : undefined}
    >
      <MotivationBlockerQuestions value={m} onChange={onChange} />
      <MotivationDriverQuestions value={m} onChange={onChange} />
    </EditorSheet>
  );
}

function WellbeingEditor({ open, onClose, profile }: EditorProps) {
  const [w, setW] = useState<Wellbeing>(profile.wellbeing ?? {});
  const { busy, error, save } = useSave(onClose);
  return (
    <EditorSheet
      open={open}
      onClose={onClose}
      title="Sueño y bienestar"
      description="Solo para darte consejos generales de bienestar. No es una valoración médica."
      error={error}
      busy={busy}
      onSave={() => void save({ wellbeing: cleanWellbeing(w) }, 'Sueño y bienestar guardados')}
      onClear={profile.wellbeing ? () => void save({ wellbeing: undefined }, 'Respuestas de bienestar borradas') : undefined}
    >
      <WellbeingQuestions value={w} onChange={(p) => setW((x) => ({ ...x, ...p }))} />
    </EditorSheet>
  );
}

