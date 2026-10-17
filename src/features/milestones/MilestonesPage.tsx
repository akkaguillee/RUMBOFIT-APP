import { ChevronDown, ChevronRight, CircleCheck, Info, Lock, Sparkles, Trophy } from 'lucide-react';
import { animate, motion, useReducedMotion } from 'motion/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useAchievements } from '@/db/hooks';
import { CATEGORIES, RARITIES, type CategoryId, type Rarity } from '@/domain/achievements/catalog';
import { nextAchievement } from '@/domain/achievements/engine';
import { formatDate, todayKey, toDateKey } from '@/domain/dates';
import { formatInt, formatNumber } from '@/domain/units';
import { cx } from '@/ui/cx';
import { GlassCard } from '@/ui/GlassCard';
import { Loader } from '@/ui/Loader';
import { ease, riseVariants } from '@/ui/motion';
import { Page, PageHead } from '@/ui/Page';
import { ProgressBar } from '@/ui/ProgressBar';
import { ProgressRing } from '@/ui/ProgressRing';
import { Segmented } from '@/ui/Segmented';
import { AchievementBadge } from './AchievementBadge';
import { RARITY_COLORS } from './icons';
import { buildGroups, RARITY_ORDER, toItems, type MilestoneGroup, type MilestoneItem, type StatusFilter } from './model';
import './milestones-page.css';

const HISTORY_PREVIEW = 5;

/** Integers with thousands separators; decimals (e.g. 42,2 km) with one digit. */
const fmt = (v: number) => (Number.isInteger(v) ? formatInt(v) : formatNumber(v, 1));
const amount = (v: number, target: number, unit?: string) => `${fmt(v)}/${fmt(target)}${unit ? ` ${unit}` : ''}`;

function shortDate(at: number): string {
  const key = toDateKey(new Date(at));
  return key.slice(0, 4) === todayKey().slice(0, 4) ? formatDate.dayMonth(key) : `${formatDate.dayMonth(key)} ${key.slice(0, 4)}`;
}

const rarityVars = (r: Rarity) =>
  ({ '--rar-from': RARITY_COLORS[r].from, '--rar-to': RARITY_COLORS[r].to, '--rar-glow': RARITY_COLORS[r].glow }) as CSSProperties;

export default function MilestonesPage() {
  const ach = useAchievements();
  const reduce = useReducedMotion();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const [expanded, setExpanded] = useState<ReadonlySet<Rarity>>(() => new Set());
  const [allHistory, setAllHistory] = useState(false);

  const view = useMemo(() => {
    if (!ach) return null;
    const { states, unlockMap } = ach;
    const items = toItems(states, unlockMap);
    const byRarity = RARITY_ORDER.map((r) => ({
      r,
      total: items.filter((i) => i.state.def.rarity === r).length,
      done: items.filter((i) => i.state.def.rarity === r && i.status === 'done').length,
    }));
    const history = items
      .filter((i) => i.unlockedAt !== undefined)
      .map((i) => ({ s: i.state, at: i.unlockedAt! }))
      .sort((a, b) => b.at - a.at);
    const next = nextAchievement(states);
    // Two more that are close, for the wide layout (the blocks already lead with them on phones).
    const alsoClose = items
      .filter((i) => i.status === 'progress' && i.state.def.id !== next?.def.id)
      .sort((a, b) => b.state.progress - a.state.progress || a.order - b.order)
      .slice(0, 2);
    return { items, byRarity, history, unlocked: history.length, total: items.length, next, alsoClose };
  }, [ach]);

  const groups = useMemo(() => (view ? buildGroups(view.items, { status, category }) : []), [view, status, category]);

  if (!view) return <Loader />;

  const toggle = (r: Rarity) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });

  // The collection rows jump to their block (clearing filters that hide it).
  const jumpTo = (r: Rarity) => {
    if (!document.getElementById(`ms-group-${r}`)) {
      flushSync(() => {
        setStatus('all');
        setCategory('all');
      });
    }
    const el = document.getElementById(`ms-group-${r}`);
    if (!el) return;
    el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    el.focus({ preventScroll: true });
  };

  const filtered = status !== 'all' || category !== 'all';
  const next = view.next;

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
        <GlassCard variant="glow" sheen className="ms-summary" aria-labelledby="ms-summary-title">
          <ProgressRing value={view.total ? view.unlocked / view.total : 0} size={92} stroke={9} label="Hitos desbloqueados">
            <div className="ms-summary__ring">
              <span className="ms-summary__count t-num">{view.unlocked}</span>
              <span className="t-small">de {view.total}</span>
            </div>
          </ProgressRing>
          <div className="grow">
            <h2 id="ms-summary-title" className="card__title ms-summary__title">
              <Trophy aria-hidden="true" /> Colección
            </h2>
            <ul className="ms-rarities">
              {view.byRarity.map(({ r, total, done }) => (
                <li key={r}>
                  <button type="button" className="ms-rarities__row" onClick={() => jumpTo(r)}>
                    <span className="rarity-dot" style={{ background: `linear-gradient(135deg, ${RARITY_COLORS[r].to}, ${RARITY_COLORS[r].from})` }} aria-hidden="true" />
                    <span className="grow">{RARITIES[r].label}</span>
                    <span className="t-num ms-rarities__count" aria-hidden="true">
                      {done}/{total}
                    </span>
                    <span className="sr-only">
                      : {done} de {total} desbloqueados. Ir al bloque
                    </span>
                    <ChevronRight aria-hidden="true" className="ms-rarities__chev" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </GlassCard>

        {next && (
          <GlassCard variant="strong" className="ms-next" aria-labelledby="ms-next-title">
            <p className="t-eyebrow">Próximo objetivo · {RARITIES[next.def.rarity].label}</p>
            <div className="ms-next__row">
              <AchievementBadge icon={next.def.icon} rarity={next.def.rarity} unlocked={false} inProgress={next.current > 0} size={52} />
              <div className="grow">
                <h2 id="ms-next-title" className="ms-next__name">
                  {next.def.name}
                </h2>
                <p className="ms-next__desc">{next.def.description}</p>
                <div className="ms-card__progress">
                  <ProgressBar value={next.progress} label={`Progreso de ${next.def.name}`} />
                  <span className="t-num">{amount(next.current, next.target, next.def.unit)}</span>
                </div>
              </div>
            </div>
            {view.alsoClose.length > 0 && (
              <ul className="ms-next__more" aria-label="También cerca">
                {view.alsoClose.map((i) => (
                  <li key={i.state.def.id}>
                    <span className="grow truncate">{i.state.def.name}</span>
                    <span className="t-small t-num">{Math.round(i.state.progress * 100)} %</span>
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
          block
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'done', label: 'Logrados' },
            { value: 'progress', label: 'En curso' },
            { value: 'locked', label: 'Bloqueados' },
          ]}
          value={status}
          onChange={setStatus}
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

      {!groups.length && (
        <div className="ms-empty glass">
          <p className="t-small">No hay hitos con este filtro.</p>
          {filtered && (
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setStatus('all');
                setCategory('all');
              }}
            >
              Ver todos los hitos
            </button>
          )}
        </div>
      )}

      <div className="ms-groups">
        {groups.map((g) => (
          <GroupBlock key={g.rarity} group={g} expanded={expanded.has(g.rarity)} onToggle={() => toggle(g.rarity)} />
        ))}
      </div>

      <div className="split ms-bottom">
        <GlassCard aria-labelledby="ms-hist">
          <h2 id="ms-hist" className="card__title" style={{ marginBottom: 8 }}>
            <Sparkles aria-hidden="true" /> Historial de hitos
          </h2>
          {!view.history.length ? (
            <p className="t-small">Tus hitos desbloqueados aparecerán aquí con su fecha.</p>
          ) : (
            <ol className="ms-timeline" id="ms-timeline">
              {(allHistory ? view.history : view.history.slice(0, HISTORY_PREVIEW)).map(({ s, at }) => (
                <li key={s.def.id}>
                  <AchievementBadge icon={s.def.icon} rarity={s.def.rarity} unlocked size={34} />
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
          {view.history.length > HISTORY_PREVIEW && (
            <button type="button" className="link-btn" style={{ marginTop: 10 }} onClick={() => setAllHistory((v) => !v)} aria-expanded={allHistory} aria-controls="ms-timeline">
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
            <li>La rareza depende de la dificultad y la constancia que exige, nunca del azar: de Común (enseguida) a Legendario (meses de constancia).</li>
            <li>Los hitos de peso premian pesarte con regularidad y avanzar a un ritmo gradual, nunca la velocidad, y no admiten objetivos por debajo de un IMC saludable.</li>
            <li>Los retos de entreno se miden por semanas y dejan sitio al descanso. Los de agua premian cumplir tu objetivo, no superarlo, y las rachas valen con cualquier registro.</li>
            <li>Las pausas no te quitan nada: volver también tiene su propio hito.</li>
          </ul>
        </GlassCard>
      </div>
    </Page>
  );
}

/** A rarity block: header with its progress, up to five milestones, and «Ver todos». */
function GroupBlock({ group, expanded, onToggle }: { group: MilestoneGroup; expanded: boolean; onToggle: () => void }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const id = `ms-group-${group.rarity}`;
  const items = expanded ? [...group.preview, ...group.rest] : group.preview;
  const count = group.preview.length + group.rest.length;

  const onClick = () => {
    const collapsing = expanded;
    onToggle();
    // After «Mostrar menos», bring the block back into view if its top scrolled away.
    if (collapsing) {
      requestAnimationFrame(() => {
        const el = ref.current;
        if (el && el.getBoundingClientRect().top < 72) el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
      });
    }
  };

  return (
    <motion.section
      ref={ref}
      id={id}
      tabIndex={-1}
      className={cx('ms-group glass', `ms-group--${group.rarity}`)}
      style={rarityVars(group.rarity)}
      variants={riseVariants}
      aria-labelledby={`${id}-title`}
    >
      <header className="ms-group__head">
        <AchievementBadge icon="gem" rarity={group.rarity} unlocked size={38} />
        <div className="grow">
          <h2 id={`${id}-title`} className="ms-group__title">
            {group.label}
          </h2>
          <p className="ms-group__hint">{group.hint}</p>
        </div>
        <div className="ms-group__count">
          <span className="t-num" aria-hidden="true">
            <strong>{group.done}</strong>/{group.total}
          </span>
          <ProgressBar value={group.total ? group.done / group.total : 0} tone="good" label={`${group.label}: ${group.done} de ${group.total} hitos desbloqueados`} />
        </div>
      </header>

      <AutoHeight contentKey={items.map((i) => i.state.def.id).join()}>
        <ul id={`${id}-list`} className="ms-grid">
          {items.map((it) => (
            <MilestoneCard key={it.state.def.id} item={it} />
          ))}
        </ul>
      </AutoHeight>

      {group.rest.length > 0 && (
        <button type="button" className="ms-group__toggle pressable" aria-expanded={expanded} aria-controls={`${id}-list`} onClick={onClick}>
          <span>
            {expanded ? 'Mostrar menos' : `Ver todos (${count})`}
            <span className="sr-only"> · {group.label}</span>
          </span>
          <ChevronDown aria-hidden="true" />
        </button>
      )}
    </motion.section>
  );
}

function MilestoneCard({ item }: { item: MilestoneItem }) {
  const { state, status, unlockedAt } = item;
  const { def } = state;
  const c = RARITY_COLORS[def.rarity];
  return (
    <li
      className={cx('ms-card', `is-${status}`)}
      style={{ '--medal-from': c.from, '--medal-to': c.to, '--medal-glow': c.glow } as CSSProperties}
    >
      <AchievementBadge icon={def.icon} rarity={def.rarity} unlocked={status === 'done'} inProgress={status === 'progress'} size={42} />
      <div className="ms-card__body">
        <h3 className="ms-card__name">{def.name}</h3>
        <p className="ms-card__desc">{def.description}</p>
        {status === 'done' && unlockedAt !== undefined ? (
          <p className="ms-card__state is-done">
            <CircleCheck aria-hidden="true" />
            Desbloqueado · {shortDate(unlockedAt)}
          </p>
        ) : status === 'progress' ? (
          <div className="ms-card__progress">
            <ProgressBar value={state.progress} label={`Progreso de ${def.name}`} />
            <span className="t-num">{amount(state.current, def.target, def.unit)}</span>
          </div>
        ) : status === 'na' ? (
          <p className="ms-card__state">
            <Lock aria-hidden="true" />
            {def.requires === 'maintain_goal' ? 'Disponible con objetivo de mantenimiento' : 'Disponible con un objetivo de perder o ganar peso'}
          </p>
        ) : (
          <p className="ms-card__state">
            <Lock aria-hidden="true" />
            Bloqueado{def.target > 1 ? ` · ${amount(0, def.target, def.unit)}` : ''}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * Animates its height when the content changes (expanding or collapsing a
 * block, changing a filter) and stays `auto` otherwise, so it follows the
 * layout on resize. With reduced motion the change is instant.
 */
function AutoHeight({ contentKey, children }: { contentKey: string; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const last = useRef<number | null>(null);
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    const box = outer.current;
    const content = inner.current;
    if (!box || !content) return;
    const to = content.offsetHeight;
    const from = last.current;
    last.current = to;
    if (reduce || from === null || Math.abs(from - to) < 2) return;
    const reset = () => {
      box.style.height = '';
      box.style.overflow = '';
    };
    box.style.height = `${from}px`;
    box.style.overflow = 'hidden';
    const controls = animate(box, { height: [from, to] }, { duration: 0.42, ease: ease.out });
    void controls.then(reset);
    return () => {
      controls.stop();
      reset();
    };
  }, [contentKey, reduce]);

  // Keep the reference height current when the layout changes for other reasons.
  useEffect(() => {
    const content = inner.current;
    if (!content || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (!outer.current?.style.height) last.current = content.offsetHeight;
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outer} className="ms-autoheight">
      <div ref={inner}>{children}</div>
    </div>
  );
}
