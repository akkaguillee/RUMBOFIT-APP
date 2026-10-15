import { Info, Sparkles, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { useAchievements } from '@/db/hooks';
import { CATEGORIES, RARITIES, type CategoryId, type Rarity } from '@/domain/achievements/catalog';
import { nextAchievement, type AchievementState } from '@/domain/achievements/engine';
import { formatDate, toDateKey } from '@/domain/dates';
import { formatInt } from '@/domain/units';
import { cx } from '@/ui/cx';
import { GlassCard } from '@/ui/GlassCard';
import { Loader } from '@/ui/Loader';
import { riseVariants, staggerContainer } from '@/ui/motion';
import { Page, PageHead } from '@/ui/Page';
import { ProgressBar } from '@/ui/ProgressBar';
import { ProgressRing } from '@/ui/ProgressRing';
import { Segmented } from '@/ui/Segmented';
import { AchievementBadge } from './AchievementBadge';
import { RARITY_COLORS } from './icons';
import './milestones-page.css';

type Filter = 'all' | 'unlocked' | 'locked';

export default function MilestonesPage() {
  const ach = useAchievements();
  const [filter, setFilter] = useState<Filter>('all');
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const [allHistory, setAllHistory] = useState(false);

  const view = useMemo(() => {
    if (!ach) return null;
    const { states, unlockMap } = ach;
    const unlocked = states.filter((s) => unlockMap.has(s.def.id));
    const byRarity = (Object.keys(RARITIES) as Rarity[]).map((r) => ({
      r,
      total: states.filter((s) => s.def.rarity === r).length,
      done: unlocked.filter((s) => s.def.rarity === r).length,
    }));
    const upcoming = states
      .filter((s) => !unlockMap.has(s.def.id) && s.applicable)
      .sort((a, b) => b.progress - a.progress || RARITIES[a.def.rarity].order - RARITIES[b.def.rarity].order)
      .slice(0, 3);
    const history = unlocked
      .map((s) => ({ s, at: unlockMap.get(s.def.id)!.unlockedAt }))
      .sort((a, b) => b.at - a.at);
    return { states, unlockMap, unlocked, byRarity, upcoming, history, next: nextAchievement(states) };
  }, [ach]);

  if (!view) return <Loader />;

  const list = view.states.filter((s) => {
    const isUnlocked = view.unlockMap.has(s.def.id);
    if (filter === 'unlocked' && !isUnlocked) return false;
    if (filter === 'locked' && isUnlocked) return false;
    if (category !== 'all' && s.def.category !== category) return false;
    return true;
  });

  const total = view.states.length;

  return (
    <Page>
      <PageHead
        eyebrow="Hitos"
        display="Hitos"
        title="Tus logros"
        subtitle="Constancia, hábitos y superación. Cada hito se calcula con tus registros reales."
        note="¡cada logro cuenta!"
      />

      <div className="ms-top">
        <GlassCard variant="glow" sheen className="ms-summary">
          <ProgressRing value={view.unlocked.length / total} size={132} stroke={11} label="Hitos desbloqueados">
            <div>
              <div className="t-num" style={{ fontSize: 30, fontWeight: 740, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {view.unlocked.length}
              </div>
              <div className="t-small">de {total}</div>
            </div>
          </ProgressRing>
          <div className="grow">
            <h2 className="card__title" style={{ marginBottom: 12 }}>
              <Trophy aria-hidden="true" /> Colección
            </h2>
            <ul className="rarity-list">
              {view.byRarity.map(({ r, total: t, done }) => (
                <li key={r}>
                  <span className="rarity-dot" style={{ background: `linear-gradient(135deg, ${RARITY_COLORS[r].to}, ${RARITY_COLORS[r].from})` }} aria-hidden="true" />
                  <span className="grow">{RARITIES[r].label}</span>
                  <span className="t-num" style={{ fontWeight: 640 }}>
                    {done}/{t}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </GlassCard>

        {view.next && (
          <GlassCard variant="strong" className="ms-next" aria-labelledby="ms-next-title">
            <p className="t-eyebrow">Próximo objetivo</p>
            <div className="hstack" style={{ marginTop: 10, alignItems: 'flex-start' }}>
              <AchievementBadge icon={view.next.def.icon} rarity={view.next.def.rarity} unlocked={false} size={64} />
              <div className="grow">
                <h2 id="ms-next-title" className="t-heading">
                  {view.next.def.name}
                </h2>
                <p className="t-small" style={{ margin: '4px 0 10px' }}>
                  {view.next.def.description}
                </p>
                <ProgressBar value={view.next.progress} label={`Progreso de ${view.next.def.name}`} />
                <p className="t-small t-num" style={{ marginTop: 6 }}>
                  {formatInt(view.next.current)} / {formatInt(view.next.target)} {view.next.def.unit ?? ''}
                </p>
              </div>
            </div>
            {view.upcoming.length > 1 && (
              <ul className="ms-upcoming">
                {view.upcoming
                  .filter((s) => s.def.id !== view.next!.def.id)
                  .slice(0, 2)
                  .map((s) => (
                    <li key={s.def.id}>
                      <span className="grow truncate">{s.def.name}</span>
                      <span className="t-small t-num">{Math.round(s.progress * 100)} %</span>
                    </li>
                  ))}
              </ul>
            )}
          </GlassCard>
        )}
      </div>

      <motion.div className="ms-filters" variants={riseVariants}>
        <Segmented
          label="Estado"
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'unlocked', label: 'Desbloqueados' },
            { value: 'locked', label: 'Pendientes' },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <div className="chip-row" role="group" aria-label="Categoría">
          <button type="button" className="chip" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>
            Todas
          </button>
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" className="chip" aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      </motion.div>

      {!list.length && <p className="t-small">No hay hitos con este filtro.</p>}
      {CATEGORIES.filter((c) => list.some((s) => s.def.category === c.id)).map((c) => {
        const items = list.filter((s) => s.def.category === c.id);
        const got = items.filter((s) => view.unlockMap.has(s.def.id)).length;
        return (
          <section key={c.id} className="ms-section" aria-labelledby={`ms-cat-${c.id}`}>
            <div className="section-head">
              <h2 id={`ms-cat-${c.id}`}>{c.label}</h2>
              <span className="t-small t-num">
                {got}/{items.length}
              </span>
            </div>
            <motion.ul className="ms-grid" key={`${filter}-${category}`} variants={staggerContainer(0.02)} initial="initial" animate="enter">
              {items.map((s) => (
                <AchievementCard key={s.def.id} state={s} unlockedAt={view.unlockMap.get(s.def.id)?.unlockedAt} />
              ))}
            </motion.ul>
          </section>
        );
      })}

      <div className="split" style={{ marginTop: 24 }}>
        <GlassCard aria-labelledby="ms-hist">
          <h2 id="ms-hist" className="card__title" style={{ marginBottom: 8 }}>
            <Sparkles aria-hidden="true" /> Historial de hitos
          </h2>
          {!view.history.length ? (
            <p className="t-small">Tus hitos desbloqueados aparecerán aquí con su fecha.</p>
          ) : (
            <ol className="ms-timeline">
              {(allHistory ? view.history : view.history.slice(0, 8)).map(({ s, at }) => (
                <li key={s.def.id}>
                  <AchievementBadge icon={s.def.icon} rarity={s.def.rarity} unlocked size={36} />
                  <span className="grow">
                    <span className="list-row__title" style={{ display: 'block' }}>
                      {s.def.name}
                    </span>
                    <span className="list-row__sub">
                      {formatDate.long(toDateKey(new Date(at)))} · {RARITIES[s.def.rarity].label}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
          {view.history.length > 8 && (
            <button type="button" className="link-btn" style={{ marginTop: 10 }} onClick={() => setAllHistory((v) => !v)} aria-expanded={allHistory}>
              {allHistory ? 'Ver menos' : `Ver los ${view.history.length} hitos`}
            </button>
          )}
        </GlassCard>
        <GlassCard aria-labelledby="ms-rules">
          <h2 id="ms-rules" className="card__title" style={{ marginBottom: 8 }}>
            <Info aria-hidden="true" /> Cómo funcionan
          </h2>
          <ul className="vstack t-small" style={{ gap: 8 }}>
            <li>Se calculan siempre a partir de tus registros: abrir una pantalla nunca desbloquea nada.</li>
            <li>Cada hito se desbloquea una sola vez. Si corriges o eliminas registros, el progreso se recalcula y un hito solo se retira si los datos que lo justificaban dejan de existir.</li>
            <li>La rareza depende de la dificultad y la constancia que exige, nunca del azar.</li>
            <li>Los hitos de peso premian el avance hacia tu objetivo, no la velocidad, y no admiten objetivos por debajo de un IMC saludable.</li>
            <li>Las pausas no te quitan nada: volver también tiene su propio hito.</li>
          </ul>
        </GlassCard>
      </div>
    </Page>
  );
}

function AchievementCard({ state, unlockedAt }: { state: AchievementState; unlockedAt?: number }) {
  const { def } = state;
  const unlocked = unlockedAt !== undefined;
  return (
    <motion.li
      variants={riseVariants}
      className={cx('ms-card glass', unlocked && 'is-unlocked', !state.applicable && 'is-na')}
      style={{ '--medal-glow': RARITY_COLORS[def.rarity].glow } as React.CSSProperties}
    >
      <AchievementBadge icon={def.icon} rarity={def.rarity} unlocked={unlocked} size={48} />
      <div className="ms-card__body">
        <div className="ms-card__title-row">
          <h3 className="ms-card__name">{def.name}</h3>
          <span className={`badge ms-rarity ms-rarity--${def.rarity}`}>{RARITIES[def.rarity].label}</span>
        </div>
        <p className="ms-card__desc">{def.description}</p>
        {unlocked ? (
          <p className="ms-card__status is-done">Desbloqueado el {formatDate.long(toDateKey(new Date(unlockedAt)))}</p>
        ) : !state.applicable ? (
          <p className="ms-card__status">{def.requires === 'maintain_goal' ? 'Disponible con objetivo de mantenimiento.' : 'Disponible con un objetivo de peso (perder o ganar).'}</p>
        ) : (
          <div className="ms-card__progress">
            <ProgressBar value={state.progress} label={`Progreso de ${def.name}`} />
            <span className="t-small t-num">
              {formatInt(state.current)}/{formatInt(state.target)}
              {def.unit ? ` ${def.unit}` : ''}
            </span>
          </div>
        )}
      </div>
    </motion.li>
  );
}
