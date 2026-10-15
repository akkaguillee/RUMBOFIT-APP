import {
  Calculator,
  ChevronRight,
  Droplets,
  Dumbbell,
  EyeOff,
  Footprints,
  HeartPulse,
  Scale,
  ShieldCheck,
  Target,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAchievements } from '@/db/hooks';
import { greeting } from '@/domain/dates';
import { buildTipContext } from '@/domain/tips/context';
import { gatherCandidates } from '@/domain/tips/select';
import type { Tip, TipTopic } from '@/domain/tips/types';
import type { Profile } from '@/domain/types';
import { cx } from '@/ui/cx';
import { ease } from '@/ui/motion';
import { Sheet } from '@/ui/Sheet';
import { useToday } from '@/ui/useToday';
import { Mascot } from '../mascot/Mascot';
import { TOPIC_META } from '../tips/topics';
import { useDailyTips } from '../tips/useDailyTips';
import { rumbiFace, rumbiLines, type RumbiMoment } from './messages';

export type QuickLog = 'weight' | 'water' | 'steps';

/** The five areas Rumbi talks about, each gathering the tip topics that belong to it. */
const FAMILIES: { id: string; label: string; topics: TipTopic[]; empty: string }[] = [
  { id: 'habitos', label: 'Hábitos', topics: ['water', 'steps', 'food'], empty: 'Un hábito pequeño y repetido vale más que un cambio enorme que no dura.' },
  {
    id: 'constancia',
    label: 'Constancia',
    topics: ['consistency', 'comeback', 'start', 'time', 'mindset'],
    empty: 'Registrar algo, aunque sea poco, mantiene el hilo. Lo que cuenta es volver al día siguiente.',
  },
  {
    id: 'descanso',
    label: 'Descanso',
    topics: ['recovery', 'sleep', 'stress', 'wellbeing'],
    empty: 'Dormir y descansar también forman parte del progreso: el cuerpo se adapta cuando recupera.',
  },
  { id: 'entreno', label: 'Entreno', topics: ['training'], empty: 'Prioriza la técnica y sube cargas poco a poco, solo cuando el movimiento sale limpio.' },
  {
    id: 'progreso',
    label: 'Progreso',
    topics: ['progress', 'weighing', 'celebrate', 'profile'],
    empty: 'Mira la tendencia de varias semanas más que el número de un día concreto.',
  },
];

const HELP: { to: string; label: string; sub: string; icon: LucideIcon }[] = [
  { to: '/progresos?tab=calorias', label: 'Cómo se calculan tus calorías', sub: 'Metabolismo basal, actividad y objetivo', icon: Calculator },
  { to: '/progresos?tab=imc', label: 'Tu IMC y su evolución', sub: 'Qué indica y qué no', icon: Scale },
  { to: '/perfil#goal', label: 'Ajustar tu objetivo', sub: 'Objetivo, pesos y nivel de actividad', icon: Target },
  { to: '/perfil#data', label: 'Tus datos y copias de seguridad', sub: 'Exportar, importar o borrar', icon: ShieldCheck },
  { to: '/perfil#about-sec', label: 'Uso responsable', sub: 'Qué es y qué no es RUMBO', icon: HeartPulse },
];

function TipBlock({ tip, onNavigate, kicker }: { tip: Tip; onNavigate: () => void; kicker?: string }) {
  const meta = TOPIC_META[tip.topic];
  const Icon = meta.icon;
  return (
    <div className="rumbi-tip">
      <p className="rumbi-tip__topic">
        <Icon aria-hidden="true" />
        {kicker ?? meta.label}
      </p>
      <h4 className="rumbi-tip__title">{tip.title}</h4>
      <p className="rumbi-tip__body">{tip.body}</p>
      {tip.action && (
        <Link to={tip.action.to} className="link-btn pressable rumbi-tip__action" onClick={onNavigate}>
          {tip.action.label}
          <ChevronRight aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  onLog: (what: QuickLog) => void;
  onQuickWater: () => void;
  onTrain: () => void;
  onHide: () => void;
}

/**
 * Rumbi's panel: a greeting and a short handwritten line built from today's
 * records, the tip of the day, tips by area (habits, consistency, rest,
 * training, progress) chosen by the same rules as the tip card, quick
 * logging shortcuts and the help that already exists in the app.
 */
export function RumbiPanel({ open, onClose, profile, onLog, onQuickWater, onTrain, onHide }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={<span className="display rumbi-title">Rumbi</span>} description="Tu compañero en RUMBO">
      <PanelBody profile={profile} onClose={onClose} onLog={onLog} onQuickWater={onQuickWater} onTrain={onTrain} onHide={onHide} />
    </Sheet>
  );
}

function PanelBody({ profile, onClose, onLog, onQuickWater, onTrain, onHide }: Omit<Props, 'open'>) {
  const reduce = useReducedMotion();
  const today = useToday();
  const ach = useAchievements();
  const daily = useDailyTips();
  const [lineIndex, setLineIndex] = useState(0);
  const [family, setFamily] = useState(FAMILIES[0]!.id);

  const ctx = useMemo(() => {
    if (!ach?.data.profile) return null;
    const { weights, water, steps, workouts, plan, snapshots } = ach.data;
    return buildTipContext({ profile: ach.data.profile, weights, water, steps, workouts, plan, snapshots, today });
  }, [ach, today]);

  const moment: RumbiMoment | null = ctx
    ? {
        hour: new Date().getHours(),
        streak: ctx.streak.current,
        recordedToday: ctx.records.recordedToday,
        goalsMet: ctx.goalsToday.met,
        goalsTotal: ctx.goalsToday.total,
        workoutToday: ctx.training.doneToday,
      }
    : null;
  const lines = moment ? rumbiLines(moment) : ['tu ritmo, tu rumbo'];
  const line = lines[lineIndex % lines.length]!;
  const face = moment ? rumbiFace(moment) : 'happy';

  const mainId = daily.status === 'ready' ? daily.main.id : null;
  const byFamily = useMemo(() => {
    if (!ctx) return new Map<string, Tip>();
    const candidates = gatherCandidates(ctx).sort((a, b) => b.priority - a.priority);
    return new Map(
      FAMILIES.flatMap((f) => {
        const best = candidates.find((c) => f.topics.includes(c.topic) && c.id !== mainId);
        return best ? [[f.id, { id: best.id, topic: best.topic, title: best.title, body: best.body, ...(best.action ? { action: best.action } : {}) }] as const] : [];
      }),
    );
  }, [ctx, mainId]);
  const current = FAMILIES.find((f) => f.id === family)!;
  const familyTip = byFamily.get(family);

  const enter = reduce ? { opacity: 0 } : { opacity: 0, y: 6 };

  return (
    <div className="rumbi-panel">
      <section className="rumbi-hero" aria-label="Rumbi">
        <Mascot
          className="rumbi-hero__mascot"
          expression={face}
          size={88}
          interactive
          label="Rumbi. Tócalo para otro mensaje"
          onTap={() => setLineIndex((i) => i + 1)}
        />
        <div className="rumbi-hero__text">
          <p className="rumbi-hero__hello">
            {greeting()}, <span>{profile.name}</span>
          </p>
          <div aria-live="polite" className="rumbi-hero__line-wrap">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={line}
                className="hand rumbi-hero__line"
                initial={enter}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.28, ease: ease.out } }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
              >
                {line}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </section>
      <p className="rumbi-panel__note">Mis consejos salen de lo que registras en RUMBO, que se guarda solo en este dispositivo.</p>

      <section className="rumbi-sec" aria-labelledby="rumbi-today">
        <h3 id="rumbi-today" className="rumbi-sec__title">
          Tu consejo de hoy
        </h3>
        {daily.status === 'loading' && <div className="rumbi-tip rumbi-tip--loading" aria-busy="true" />}
        {daily.status === 'empty' && <p className="rumbi-tip__body">Hoy no hay un consejo nuevo. Vuelve mañana.</p>}
        {daily.status === 'ready' && (
          <div className="vstack" style={{ gap: 10 }}>
            <TipBlock tip={daily.main} onNavigate={onClose} />
            {daily.extra && <TipBlock tip={daily.extra} onNavigate={onClose} kicker="Un paso más" />}
          </div>
        )}
      </section>

      <section className="rumbi-sec" aria-labelledby="rumbi-topics">
        <h3 id="rumbi-topics" className="rumbi-sec__title">
          Consejos por tema
        </h3>
        <div className="chip-row rumbi-topics" role="radiogroup" aria-label="Tema">
          {FAMILIES.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={f.id === family}
              className={cx('chip', f.id === family && 'chip--active')}
              onClick={() => setFamily(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={family}
              initial={enter}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.26, ease: ease.out } }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
            >
              {familyTip ? (
                <TipBlock tip={familyTip} onNavigate={onClose} />
              ) : (
                <div className="rumbi-tip">
                  <p className="rumbi-tip__topic">{current.label}</p>
                  <p className="rumbi-tip__body">{current.empty}</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      <section className="rumbi-sec" aria-labelledby="rumbi-quick">
        <h3 id="rumbi-quick" className="rumbi-sec__title">
          Atajos
        </h3>
        <div className="rumbi-quick">
          <button type="button" className="rumbi-quick__btn pressable" onClick={() => onLog('weight')}>
            <span className="rumbi-quick__icon rumbi-quick__icon--accent">
              <Scale aria-hidden="true" />
            </span>
            Peso
          </button>
          <button type="button" className="rumbi-quick__btn pressable" onClick={onQuickWater} aria-label={profile.units === 'metric' ? 'Añadir 250 ml de agua' : 'Añadir 8,5 oz de agua'}>
            <span className="rumbi-quick__icon rumbi-quick__icon--water">
              <Droplets aria-hidden="true" />
            </span>
            {profile.units === 'metric' ? '+250 ml' : '+8,5 oz'}
          </button>
          <button type="button" className="rumbi-quick__btn pressable" onClick={() => onLog('steps')}>
            <span className="rumbi-quick__icon rumbi-quick__icon--steps">
              <Footprints aria-hidden="true" />
            </span>
            Pasos
          </button>
          <button type="button" className="rumbi-quick__btn pressable" onClick={onTrain}>
            <span className="rumbi-quick__icon">
              <Dumbbell aria-hidden="true" />
            </span>
            Entrenar
          </button>
        </div>
        <Link to="/hitos" className="list-row rumbi-row" onClick={onClose}>
          <span className="icon-tile icon-tile--accent">
            <Trophy aria-hidden="true" />
          </span>
          <span className="list-row__main">
            <span className="list-row__title" style={{ display: 'block' }}>
              Tus hitos
            </span>
            <span className="list-row__sub">Lo que ya has conseguido y lo próximo</span>
          </span>
          <ChevronRight aria-hidden="true" className="rumbi-row__chevron" />
        </Link>
      </section>

      <section className="rumbi-sec" aria-labelledby="rumbi-help">
        <h3 id="rumbi-help" className="rumbi-sec__title">
          Ayuda
        </h3>
        <ul className="list">
          {HELP.map(({ to, label, sub, icon: Icon }) => (
            <li key={to}>
              <Link to={to} className="list-row rumbi-row" onClick={onClose}>
                <span className="icon-tile">
                  <Icon aria-hidden="true" />
                </span>
                <span className="list-row__main">
                  <span className="list-row__title" style={{ display: 'block' }}>
                    {label}
                  </span>
                  <span className="list-row__sub">{sub}</span>
                </span>
                <ChevronRight aria-hidden="true" className="rumbi-row__chevron" />
              </Link>
            </li>
          ))}
          <li>
            <button type="button" className="list-row rumbi-row" onClick={onHide}>
              <span className="icon-tile">
                <EyeOff aria-hidden="true" />
              </span>
              <span className="list-row__main">
                <span className="list-row__title" style={{ display: 'block' }}>
                  Ocultar a Rumbi
                </span>
                <span className="list-row__sub">Puedes volver a mostrarlo en Perfil › Apariencia</span>
              </span>
            </button>
          </li>
        </ul>
      </section>
      <p className="rumbi-panel__fine">Rumbi da consejos generales de hábitos: no sustituye a un profesional sanitario.</p>
    </div>
  );
}
