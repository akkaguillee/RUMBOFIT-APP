import { CalendarDays, Check, ChevronRight, Dumbbell, Droplets, Footprints, Lightbulb, Plus, Scale, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAchievements, useSetting } from '@/db/hooks';
import { addWater } from '@/db/repos/tracking';
import { nextAchievement } from '@/domain/achievements/engine';
import { RARITIES } from '@/domain/achievements/catalog';
import { diffDays, formatDate, greeting, weekDays, weekdayIndex, WEEKDAY_SHORT } from '@/domain/dates';
import { percent } from '@/domain/habits';
import { dailyMessage } from '@/domain/messages';
import { muscleShort } from '@/domain/training/catalog';
import { formatFixed, formatInt, kgToDisplay } from '@/domain/units';
import { assessTrend, changeOverDays, deltaTone, goalDirection, goalProgress, latestWeight } from '@/domain/weight';
import { AnimatedNumber } from '@/ui/AnimatedNumber';
import { ButtonLink, Button } from '@/ui/Button';
import { GlassCard, GlassLinkCard } from '@/ui/GlassCard';
import { Loader } from '@/ui/Loader';
import { liftVariants, riseVariants } from '@/ui/motion';
import { Page } from '@/ui/Page';
import { ProgressBar } from '@/ui/ProgressBar';
import { ProgressRing } from '@/ui/ProgressRing';
import { StatusBadge } from '@/ui/StatusBadge';
import { toast, toastError } from '@/ui/toast';
import { useToday } from '@/ui/useToday';
import { AchievementBadge } from '../milestones/AchievementBadge';
import { usesWeightGoal } from '../shared/labels';
import { StepsSheet } from '../shared/sheets/StepsSheet';
import { WaterSheet } from '../shared/sheets/WaterSheet';
import { WeightSheet } from '../shared/sheets/WeightSheet';
import { unitsApi } from '../shared/units';
import { StreakCard } from '../streak/StreakCard';
import { RumboMeter } from './RumboMeter';
import './dashboard.css';

const TIPS: { id: string; text: string; when: (c: TipContext) => boolean; link?: { to: string; label: string } }[] = [
  {
    id: 'weigh-conditions',
    text: 'Pésate en condiciones parecidas (por ejemplo, por la mañana) para que la comparación sea más fiable.',
    when: (c) => c.weightCount < 4,
  },
  {
    id: 'trend-not-day',
    text: 'El peso varía de un día a otro por el agua y la comida. Fíjate en la tendencia de varias semanas, no en un día suelto.',
    when: (c) => c.weightCount >= 4,
    link: { to: '/progresos', label: 'Ver evolución' },
  },
  {
    id: 'plan-week',
    text: 'Organiza tus días de entrenamiento en un plan semanal. Es editable y puedes saltarte días sin problema.',
    when: (c) => !c.hasPlan,
    link: { to: '/entreno', label: 'Crear plan' },
  },
  {
    id: 'energy',
    text: 'Calcula una estimación de tus calorías de mantenimiento con tus datos. Es orientativa, no una prescripción.',
    when: (c) => !c.hasEnergy,
    link: { to: '/progresos?tab=calorias', label: 'Calcular' },
  },
  {
    id: 'calendar',
    text: 'Pulsa cualquier día del calendario para ver lo que registraste y añadir notas o datos atrasados.',
    when: () => true,
    link: { to: '/calendario', label: 'Abrir calendario' },
  },
];

const toneColor = (t: string) => (t === 'good' ? 'var(--good-text)' : t === 'bad' ? 'var(--bad-text)' : undefined);

interface TipContext {
  weightCount: number;
  hasPlan: boolean;
  hasEnergy: boolean;
}

export default function DashboardPage() {
  const ach = useAchievements();
  const today = useToday();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<'weight' | 'water' | 'steps' | null>(null);
  const [dismissed, setDismissed] = useSetting<string[]>('dismissedTips', []);

  const model = useMemo(() => {
    if (!ach?.data.profile) return null;
    const { data, metrics, states } = ach;
    const profile = data.profile!;
    const u = unitsApi(profile.units);
    const current = latestWeight(data.weights);
    const start = profile.startWeightKg;
    const target = profile.goalWeightKg;
    const direction = goalDirection(profile.goal, start, target);
    const progress = start !== undefined && target !== undefined && current ? goalProgress(start, current.kg, target) : null;
    const trend = assessTrend(data.weights, direction, today);
    const week = changeOverDays(data.weights, 7, today);

    const waterToday = data.water.filter((w) => w.date === today).reduce((a, w) => a + w.ml, 0);
    const stepsToday = data.steps.find((s) => s.date === today)?.steps ?? 0;
    const completedToday = data.workouts.filter((w) => w.status === 'completed' && w.date === today);
    const active = data.workouts.find((w) => w.status === 'active');
    const wd = weekdayIndex(today);
    const planDay = data.plan.find((p) => p.weekday === wd);
    const hasPlan = data.plan.length > 0;
    const plannedToday = hasPlan ? !!planDay && !planDay.rest : profile.trainingDays.includes(wd);
    const plannedLabel = planDay && !planDay.rest ? planDay.label || planDay.muscleGroups.map(muscleShort).join(' · ') : '';

    const goalsTotal = 2 + (plannedToday ? 1 : 0);
    const goalsMet =
      (waterToday >= profile.waterGoalMl ? 1 : 0) + (stepsToday >= profile.stepsGoal ? 1 : 0) + (plannedToday && completedToday.length ? 1 : 0);

    const activeDays = new Set<string>([
      ...data.weights.map((w) => w.date),
      ...data.water.map((w) => w.date),
      ...data.steps.filter((s) => s.steps > 0).map((s) => s.date),
      ...data.workouts.filter((w) => w.status === 'completed').map((w) => w.date),
    ]);
    const sortedActive = [...activeDays].filter((d) => d <= today).sort();
    const lastActive = sortedActive[sortedActive.length - 1];

    const message = dailyMessage({
      today,
      hasAnyRecord: activeDays.size > 0,
      recordedToday: activeDays.has(today),
      currentStreak: metrics.currentStreak,
      daysSinceLast: lastActive ? diffDays(lastActive, today) : null,
      goalsMetToday: goalsMet,
      goalsTotal,
      workoutToday: completedToday.length > 0,
      plannedToday,
    });

    return {
      profile,
      u,
      current,
      start,
      target,
      direction,
      progress,
      trend,
      week,
      waterToday,
      stepsToday,
      completedToday,
      active,
      plannedToday,
      plannedLabel,
      goalsMet,
      goalsTotal,
      message,
      activeDays,
      next: nextAchievement(states),
      metrics,
      tipCtx: { weightCount: data.weights.length, hasPlan, hasEnergy: data.energy.length > 0 } satisfies TipContext,
    };
  }, [ach, today]);

  if (!model || dismissed === undefined) return <Loader />;
  const { profile, u, current, start, target, progress, trend, week } = model;
  const tip = TIPS.find((t) => !dismissed.includes(t.id) && t.when(model.tipCtx));
  const dismissTip = (id: string) => void setDismissed([...dismissed, id]);

  const quickWater = async () => {
    try {
      await addWater(today, 250);
      toast(`+${u.volume(250)} de agua`, { tone: 'success' });
    } catch (e) {
      toastError(e);
    }
  };

  const days = weekDays(today);
  const showWeightGoal = usesWeightGoal(profile.goal) && target !== undefined;

  return (
    <Page>
      <motion.header className="greet" variants={riseVariants}>
        <p className="t-eyebrow greet__date">{formatDate.header(today)}</p>
        <h1 className="greet__name">
          {greeting()},<br />
          <span>{profile.name}</span>
        </h1>
        <p className="greet__msg">{model.message}</p>
      </motion.header>

      <div className="dash">
        {/* ── Hero: weight progress ─────────────────────────────── */}
        <GlassCard variant="glow" sheen className="dash__hero" aria-labelledby="hero-title">
          <div className="hero__top">
            <h2 id="hero-title" className="card__title">
              <Scale aria-hidden="true" />
              {showWeightGoal ? 'Tu rumbo hacia el objetivo' : 'Tu peso'}
            </h2>
            {current && <StatusBadge tone={trend.tone} label={trend.label} icon={trend.reliable ? undefined : 'pending'} />}
          </div>
          {current ? (
            <Link to="/progresos" aria-label="Ver evolución del peso" style={{ display: 'block', borderRadius: 24 }}>
              <RumboMeter
                progress={showWeightGoal && progress !== null ? progress : null}
                startLabel={showWeightGoal && start !== undefined ? u.weight(start) : undefined}
                goalLabel={showWeightGoal && target !== undefined ? u.weight(target) : undefined}
              >
                <span className="t-eyebrow">Peso actual</span>
                <span className="meter__value">
                  <AnimatedNumber className="t-hero" value={kgToDisplay(current.kg, profile.units)} format={(n) => formatFixed(n, 1)} />
                  <span className="meter__unit">{u.w}</span>
                </span>
                <span className="meter__caption">
                  {showWeightGoal && progress !== null
                    ? progress >= 1
                      ? '¡Objetivo alcanzado!'
                      : `${Math.max(0, Math.round(progress * 100))} % del camino`
                    : formatDate.relative(current.date, today)}
                </span>
              </RumboMeter>
            </Link>
          ) : (
            <div className="empty" style={{ padding: '28px 8px 8px' }}>
              <p className="empty__title">Registra tu primer peso</p>
              <p className="empty__text">Con un registro empezamos a dibujar tu evolución. No hace falta que sea perfecto.</p>
              <Button icon={<Plus />} onClick={() => setSheet('weight')}>
                Registrar peso
              </Button>
            </div>
          )}
          {current && (
            <div className="hero__stats">
              <div className="stat">
                <span className="stat__label">Inicial</span>
                <span className="stat__value">{start !== undefined ? u.weightValue(start) : '—'}<small>{u.w}</small></span>
              </div>
              <div className="stat">
                <span className="stat__label">{start !== undefined && current.kg <= start ? 'Perdido' : 'Cambio'}</span>
                <span className="stat__value">
                  {start !== undefined ? (current.kg <= start ? u.weightValue(start - current.kg) : u.weightDelta(current.kg - start).replace(` ${u.w}`, '')) : '—'}
                  <small>{u.w}</small>
                </span>
              </div>
              <div className="stat">
                <span className="stat__label">7 días</span>
                <span className="stat__value" style={{ color: week ? toneColor(deltaTone(week.delta, model.direction)) : undefined }}>
                  {week ? u.weightDelta(week.delta).replace(` ${u.w}`, '') : '—'}
                  <small>{u.w}</small>
                </span>
              </div>
            </div>
          )}
          {current && !showWeightGoal && usesWeightGoal(profile.goal) && (
            <p className="t-small" style={{ marginTop: 12 }}>
              <Link to="/perfil" className="link-btn">
                Define tu peso objetivo <ChevronRight aria-hidden="true" />
              </Link>
            </p>
          )}
        </GlassCard>

        {/* ── Streak ────────────────────────────────────────────── */}
        <StreakCard className="dash__streak" />

        {/* ── Quick actions ─────────────────────────────────────── */}
        <motion.nav className="dash__actions glass card card--tight" variants={riseVariants} aria-label="Registro rápido">
          <div className="quick">
            <button type="button" className="quick__btn" onClick={() => setSheet('weight')}>
              <span className="quick__icon icon-tile--accent">
                <Scale aria-hidden="true" />
              </span>
              Peso
            </button>
            <button type="button" className="quick__btn" onClick={() => setSheet('water')}>
              <span className="quick__icon icon-tile--water">
                <Droplets aria-hidden="true" />
              </span>
              Agua
            </button>
            <button type="button" className="quick__btn" onClick={() => setSheet('steps')}>
              <span className="quick__icon icon-tile--steps">
                <Footprints aria-hidden="true" />
              </span>
              Pasos
            </button>
            <button type="button" className="quick__btn" onClick={() => navigate(model.active ? '/entreno/sesion' : '/entreno')}>
              <span className="quick__icon icon-tile--accent" style={{ background: 'var(--control-fill-hover)', color: 'var(--text)' }}>
                <Dumbbell aria-hidden="true" />
              </span>
              {model.active ? 'Continuar' : 'Entrenar'}
            </button>
          </div>
        </motion.nav>

        {/* ── Today ─────────────────────────────────────────────── */}
        <motion.section className="dash__today rise-group" variants={liftVariants} aria-labelledby="today-title">
          <div className="section-head">
            <h2 id="today-title">Hoy</h2>
            <span className="t-small">
              {model.goalsMet}/{model.goalsTotal} objetivos
            </span>
          </div>
          <div className="today-grid">
            <div className="glass habit-card">
              <div className="habit-card__head">
                <Link to="/habitos?tab=agua" className="habit-card__name">
                  Agua
                </Link>
                {model.waterToday >= profile.waterGoalMl && <StatusBadge tone="good" label="Hecho" />}
              </div>
              <div className="habit-card__ring">
                <ProgressRing value={model.waterToday / profile.waterGoalMl} size={96} stroke={9} tone="water" label="Agua de hoy">
                  <span className="t-num" style={{ fontWeight: 700, fontSize: 18 }}>
                    {percent(model.waterToday, profile.waterGoalMl)}%
                  </span>
                </ProgressRing>
              </div>
              <div className="habit-card__foot">
                <div>
                  <div className="habit-card__value">{u.volume(model.waterToday)}</div>
                  <div className="habit-card__goal">de {u.volume(profile.waterGoalMl)}</div>
                </div>
                <button type="button" className="mini-add" onClick={quickWater} aria-label={`Añadir ${u.volume(250)} de agua`}>
                  <Plus aria-hidden="true" />
                  {u.units === 'metric' ? '250' : '8,5'}
                </button>
              </div>
            </div>

            <div className="glass habit-card">
              <div className="habit-card__head">
                <Link to="/habitos?tab=pasos" className="habit-card__name">
                  Pasos
                </Link>
                {model.stepsToday >= profile.stepsGoal && <StatusBadge tone="good" label="Hecho" />}
              </div>
              <div className="habit-card__ring">
                <ProgressRing value={model.stepsToday / profile.stepsGoal} size={96} stroke={9} tone="steps" label="Pasos de hoy">
                  <span className="t-num" style={{ fontWeight: 700, fontSize: 18 }}>
                    {percent(model.stepsToday, profile.stepsGoal)}%
                  </span>
                </ProgressRing>
              </div>
              <div className="habit-card__foot">
                <div>
                  <div className="habit-card__value">
                    <AnimatedNumber value={model.stepsToday} format={(n) => formatInt(n)} />
                  </div>
                  <div className="habit-card__goal">de {formatInt(profile.stepsGoal)}</div>
                </div>
                <button type="button" className="mini-add" onClick={() => setSheet('steps')} aria-label="Registrar pasos">
                  <Plus aria-hidden="true" />
                </button>
              </div>
            </div>

            <GlassLinkCard to={model.active ? '/entreno/sesion' : '/entreno'} padded={false} rise={false} className="train-card">
              <span className={`icon-tile ${model.completedToday.length ? 'icon-tile--good' : 'icon-tile--accent'}`}>
                {model.completedToday.length ? <Check aria-hidden="true" /> : <Dumbbell aria-hidden="true" />}
              </span>
              <span className="grow">
                <span className="list-row__title" style={{ display: 'block' }}>
                  {model.active
                    ? 'Entrenamiento en curso'
                    : model.completedToday.length
                      ? `Entrenamiento completado`
                      : model.plannedToday
                        ? `Toca entrenar${model.plannedLabel ? `: ${model.plannedLabel}` : ''}`
                        : 'Día libre de entrenamiento'}
                </span>
                <span className="list-row__sub">
                  {model.active
                    ? 'Toca para continuar donde lo dejaste'
                    : model.completedToday.length
                      ? model.completedToday.map((w) => w.name).join(' · ')
                      : model.plannedToday
                        ? 'Cuando estés listo, empieza la sesión'
                        : 'Descansar también es progresar'}
                </span>
              </span>
              <ChevronRight aria-hidden="true" style={{ width: 18, color: 'var(--text-3)', flex: 'none' }} />
            </GlassLinkCard>
          </div>
        </motion.section>

        {/* ── Week ──────────────────────────────────────────────── */}
        <GlassLinkCard to="/calendario" className="dash__week" aria-label="Abrir calendario">
          <div className="card__head">
            <h2 className="card__title">
              <CalendarDays aria-hidden="true" />
              Esta semana
            </h2>
            <span className="t-small t-num">
              {days.filter((d) => model.activeDays.has(d)).length}/7 días activos
            </span>
          </div>
          <div className="week">
            {days.map((d, i) => {
              const s = ach!.data;
              const has = {
                w: s.weights.some((x) => x.date === d),
                a: s.water.some((x) => x.date === d),
                p: s.steps.some((x) => x.date === d && x.steps > 0),
                e: s.workouts.some((x) => x.date === d && x.status === 'completed'),
              };
              return (
                <div key={d} className="week__day" data-today={d === today}>
                  <span>{WEEKDAY_SHORT[i]}</span>
                  <span className="week__num">{Number(d.slice(8))}</span>
                  <span className="week__dots" aria-label={model.activeDays.has(d) ? 'Con registros' : 'Sin registros'}>
                    {has.w && <i style={{ background: 'var(--series-weight)' }} />}
                    {has.a && <i style={{ background: 'var(--series-water)' }} />}
                    {has.p && <i style={{ background: 'var(--series-steps)' }} />}
                    {has.e && <i style={{ boxShadow: 'inset 0 0 0 1.5px var(--text)' }} />}
                  </span>
                </div>
              );
            })}
          </div>
        </GlassLinkCard>

        {/* ── Next milestone ────────────────────────────────────── */}
        {model.next && (
          <GlassLinkCard to="/hitos" className="dash__next" aria-label={`Próximo hito: ${model.next.def.name}`}>
            <div className="next-ms">
              <AchievementBadge icon={model.next.def.icon} rarity={model.next.def.rarity} unlocked={false} size={58} />
              <div className="grow">
                <p className="t-eyebrow">Próximo hito · {RARITIES[model.next.def.rarity].label}</p>
                <p className="list-row__title" style={{ margin: '2px 0 4px' }}>
                  {model.next.def.name}
                </p>
                <p className="t-small" style={{ marginBottom: 10 }}>
                  {model.next.def.description}
                </p>
                <ProgressBar value={model.next.progress} label={`Progreso de ${model.next.def.name}`} />
                <p className="t-small t-num" style={{ marginTop: 6 }}>
                  {formatInt(model.next.current)} / {formatInt(model.next.target)} {model.next.def.unit ?? ''}
                </p>
              </div>
            </div>
          </GlassLinkCard>
        )}

        {/* ── Tip ───────────────────────────────────────────────── */}
        {tip && (
          <GlassCard className="dash__tip" padded="tight">
            <div className="tip">
              <span className="icon-tile icon-tile--accent">
                <Lightbulb aria-hidden="true" />
              </span>
              <div className="grow">
                <p className="t-small" style={{ color: 'var(--text)' }}>
                  {tip.text}
                </p>
                {tip.link && (
                  <ButtonLink to={tip.link.to} variant="ghost" size="sm" style={{ marginLeft: -12, marginTop: 4, color: 'var(--accent-text)' }}>
                    {tip.link.label}
                  </ButtonLink>
                )}
              </div>
              <button type="button" className="icon-btn icon-btn--sm icon-btn--plain" aria-label="Descartar consejo" onClick={() => dismissTip(tip.id)}>
                <X />
              </button>
            </div>
          </GlassCard>
        )}
      </div>

      <WeightSheet open={sheet === 'weight'} onClose={() => setSheet(null)} units={profile.units} lastKg={current?.kg} />
      <WaterSheet open={sheet === 'water'} onClose={() => setSheet(null)} units={profile.units} />
      <StepsSheet open={sheet === 'steps'} onClose={() => setSheet(null)} />
    </Page>
  );
}
