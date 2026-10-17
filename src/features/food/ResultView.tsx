import { AlertTriangle, ArrowLeft, Barcode, Check, ChevronRight, Info, Lightbulb, Pencil, PencilLine, Plus, RefreshCw, ScanLine, Search, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useMealsDay, useProfile, useWeights } from '@/db/hooks';
import { energyEstimate, latestWeightUpTo } from '@/domain/body';
import { nowTime, todayKey } from '@/domain/dates';
import { MAX_HINT_LENGTH } from '@/domain/nutrition/analysis';
import { mealGuidance } from '@/domain/nutrition/guidance';
import { MEAL_TYPES, mealForTime } from '@/domain/nutrition/meals';
import { kcalToKj, mealTotals, OPTIONAL_NUTRIENTS, type OptionalNutrient } from '@/domain/nutrition/nutrients';
import type { MealType, Nutrients } from '@/domain/types';
import { formatInt, formatNumber } from '@/domain/units';
import { AnimatedNumber } from '@/ui/AnimatedNumber';
import { Button } from '@/ui/Button';
import { cx } from '@/ui/cx';
import { TextField } from '@/ui/Field';
import { Segmented } from '@/ui/Segmented';
import { Sheet } from '@/ui/Sheet';
import { goalLabel } from '../shared/labels';
import type { FoodApiError, PreparedImage } from './api';
import {
  addItem,
  availableBases,
  canSave,
  chooseEstimate,
  chooseFood,
  confirmAmount,
  itemValues,
  newKey,
  removeItem,
  renameItem,
  setGrams,
  setManualValues,
  summarize,
  unresolved,
  usdaSource,
  valuesFor,
  type Basis,
  type Draft,
  type DraftItem,
} from './draft';
import { FoodSearchSheet } from './FoodSearchSheet';
import { ItemSheet } from './ItemSheet';
import { ManualFoodSheet } from './ManualFoodSheet';

interface Props {
  draft: Draft;
  /** Day the meal will be saved to (today when absent). */
  date?: string;
  image?: PreparedImage;
  lookupError?: FoodApiError;
  saving: boolean;
  onChange: (draft: Draft) => void;
  onRetryValues: () => void;
  onReanalyze?: (hint: string) => void;
  onSave: (meal: MealType) => void;
  onRescan: () => void;
  onClose: () => void;
}

const BASIS_LABEL: Record<Basis, string> = { portion: 'Tu porción', per100: 'Por 100 g', serving: 'Por ración' };
const OPTIONAL_LABEL: Record<OptionalNutrient, string> = { satFat: 'Grasa saturada', fiber: 'Fibra', sugars: 'Azúcares' };
const CONFIDENCE_LABEL = { high: 'Cantidad fiable', medium: 'Cantidad aproximada', low: 'Revisa la cantidad' } as const;
const QUALITY_NOTE: Partial<Record<string, string>> = {
  blurry: 'La foto está algo borrosa: revisa los alimentos y las cantidades.',
  dark: 'La foto está oscura: revisa los alimentos y las cantidades.',
  partial: 'Parte del plato queda fuera de la foto: puede faltar algún alimento.',
};

type SheetState =
  | { kind: 'item'; key: string }
  | { kind: 'search'; key?: string; initial?: string }
  | { kind: 'manual'; key?: string; initial?: string }
  | { kind: 'hint' }
  | { kind: 'name' }
  | null;

export function ResultView({ draft, date, image, lookupError, saving, onChange, onRetryValues, onReanalyze, onSave, onRescan, onClose }: Props) {
  const [meal, setMeal] = useState<MealType>(() => mealForTime(nowTime()));
  const [basis, setBasis] = useState<Basis>('portion');
  const [sheet, setSheet] = useState<SheetState>(null);
  const summary = summarize(draft);
  const bases = availableBases(draft);
  const shownBasis = bases.includes(basis) ? basis : 'portion';
  const values = valuesFor(draft, shownBasis);
  const pending = unresolved(draft);
  const ready = canSave(draft);
  const unitWord = summary.liquid ? 'ml' : 'g';
  const isProduct = draft.origin === 'barcode';
  const sheetItem = sheet?.kind === 'item' ? draft.items.find((i) => i.key === sheet.key) : undefined;
  const loading = draft.items.some((i) => i.status === 'loading');

  const addFood = (food: Parameters<typeof chooseFood>[2], name: string) => {
    const item: DraftItem = { key: newKey(), name, query: '', grams: 100, amount: 'user', status: 'ok', per100: food.per100, source: usdaSource(food), alternatives: [] };
    onChange({ ...addItem(draft, item), dish: draft.dish || name });
    setSheet({ kind: 'item', key: item.key });
  };

  const addEstimate = (per100: Nutrients, name: string) => {
    const item: DraftItem = { key: newKey(), name, query: '', grams: 100, amount: 'user', status: 'ok', per100, source: { kind: 'ai', label: name }, alternatives: [] };
    onChange({ ...addItem(draft, item), dish: draft.dish || name });
    setSheet({ kind: 'item', key: item.key });
  };
  const missingValues = draft.items.some((i) => i.status === 'error');

  return (
    <motion.div className="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.14 } }}>
      <div className={cx('result__hero', !image && 'result__hero--plain')}>
        {image && <img src={image.url} alt="Foto analizada" className="result__photo" />}
        {image && <FoodTags items={draft.items} src={image.url} onOpen={(key) => setSheet({ kind: 'item', key })} />}
        <div className="result__hero-bar">
          <button type="button" className="scan-btn" aria-label="Volver a la cámara" onClick={onRescan}>
            <ArrowLeft />
          </button>
          <button type="button" className="scan-btn" aria-label="Cerrar escáner" onClick={onClose}>
            <X />
          </button>
        </div>
      </div>

      <div className="result__panel">
        <div className="result__badges">
          {draft.origin === 'photo' && (
            <span className="badge badge--accent">
              <Sparkles aria-hidden="true" /> Estimación con IA
            </span>
          )}
          {isProduct && (
            <span className="badge badge--good">
              <Barcode aria-hidden="true" /> Datos del envase · Open Food Facts
            </span>
          )}
          {draft.origin === 'manual' && (
            <span className="badge">
              <PencilLine aria-hidden="true" /> Registro manual
            </span>
          )}
        </div>

        <div className="result__name">
          <h2>{draft.dish || (draft.origin === 'manual' ? 'Nueva comida' : 'Comida')}</h2>
          <button type="button" className="icon-btn icon-btn--sm" aria-label="Cambiar el nombre de la comida" onClick={() => setSheet({ kind: 'name' })}>
            <Pencil />
          </button>
        </div>
        {draft.brand && <p className="result__brand">{draft.brand}</p>}
        {summary.ready > 0 && (
          <p className="result__meta">
            {draft.items.length} {draft.items.length === 1 ? 'alimento' : 'alimentos'} · {summary.estimated ? '≈ ' : ''}
            {formatInt(summary.grams)} {unitWord}
          </p>
        )}

        {draft.quality && QUALITY_NOTE[draft.quality] && (
          <p className="result__note result__note--warn">
            <AlertTriangle aria-hidden="true" /> {QUALITY_NOTE[draft.quality]}
          </p>
        )}

        {values && (
          <section aria-label="Valores nutricionales">
            {bases.length > 1 && (
              <Segmented
                label="Base de los valores"
                options={bases.map((b) => ({ value: b, label: b === 'per100' && summary.liquid ? 'Por 100 ml' : BASIS_LABEL[b] }))}
                value={shownBasis}
                onChange={setBasis}
                block
                className="result__basis"
              />
            )}
            <NutrientTiles values={values} approx={shownBasis === 'portion' && summary.estimated} />
            <OptionalRow values={values} missing={summary.missing} />
            <p className="result__basis-note">{basisNote(draft, shownBasis, summary.estimated)}</p>
            {summary.aiValues && (
              <p className="result__note">
                <Sparkles aria-hidden="true" />
                <span>
                  Incluye valores típicos por 100 g estimados por la IA a partir de tablas de composición: tómalos como aproximados.
                  {draft.items.some((i) => i.verify === 'verified') ? ' Los marcados como «Verificado» coinciden con USDA FoodData Central.' : ''}
                </span>
              </p>
            )}
          </section>
        )}

        {lookupError && missingValues && (
          <div className="result__note result__note--warn" role="alert">
            <AlertTriangle aria-hidden="true" />
            <span>
              No hemos podido obtener los valores nutricionales: {lookupError.message}
              <button type="button" className="link-btn" onClick={onRetryValues}>
                Reintentar
              </button>
            </span>
          </div>
        )}

        {pending.length > 0 && !loading && !(lookupError && missingValues) && draft.items.length > 0 && (
          <p className="result__note result__note--warn" role="status">
            <Info aria-hidden="true" />
            {pending.length === 1
              ? 'Revisa el alimento marcado: no lo sumamos hasta que tenga valores y cantidad.'
              : `Revisa los ${pending.length} alimentos marcados: no los sumamos hasta que tengan valores y cantidad.`}
          </p>
        )}

        <section className="result__items" aria-labelledby="items-title">
          <div className="result__section-head">
            <h3 id="items-title">{isProduct ? 'Producto' : 'Alimentos'}</h3>
            {!isProduct && (
              <button type="button" className="link-btn" onClick={() => setSheet({ kind: 'search' })}>
                <Plus aria-hidden="true" /> Añadir
              </button>
            )}
          </div>
          {draft.items.length === 0 ? (
            <div className="result__empty">
              <p>Busca un alimento por su nombre o introduce sus valores tal como aparecen en la etiqueta.</p>
              <div className="result__empty-actions">
                <Button icon={<Search />} onClick={() => setSheet({ kind: 'search' })}>
                  Buscar alimento
                </Button>
                <Button variant="secondary" icon={<PencilLine />} onClick={() => setSheet({ kind: 'manual' })}>
                  Introducir valores
                </Button>
              </div>
            </div>
          ) : (
            <ul className="items">
              <AnimatePresence initial={false}>
                {draft.items.map((it, index) => (
                  <ItemRow
                    index={index}
                    key={it.key}
                    item={it}
                    onOpen={() => setSheet({ kind: 'item', key: it.key })}
                    onSearch={() => setSheet({ kind: 'search', key: it.key, initial: it.name })}
                    onManual={() => setSheet({ kind: 'manual', key: it.key, initial: it.name })}
                    onRemove={() => onChange(removeItem(draft, it.key))}
                    onConfirm={() => onChange(confirmAmount(draft, it.key))}
                    onRetry={onRetryValues}
                  />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>

        {draft.caveats.length > 0 && (
          <section className="result__card" aria-labelledby="caveats-title">
            <h3 id="caveats-title">
              <Info aria-hidden="true" /> Ten en cuenta
            </h3>
            <ul className="result__caveats">
              {draft.caveats.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </section>
        )}

        {summary.ready > 0 && <GuidanceCard total={summary.total} meal={meal} estimated={summary.estimated} date={date} />}

        {onReanalyze && (
          <button type="button" className="result__reanalyze" onClick={() => setSheet({ kind: 'hint' })}>
            <span className="icon-tile icon-tile--accent">
              <RefreshCw aria-hidden="true" />
            </span>
            <span className="grow">
              <strong>¿No es correcto?</strong>
              <span className="t-small">Dinos qué es y lo analizamos de nuevo</span>
            </span>
            <ChevronRight aria-hidden="true" />
          </button>
        )}

        <p className="result__sources">{sourcesNote(draft)}</p>
      </div>

      <div className="result__foot">
        <div className="meal-chips" role="radiogroup" aria-label="Comida del día">
          {MEAL_TYPES.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={meal === m.id} className="chip" onClick={() => setMeal(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <Button block size="lg" loading={saving} disabled={!ready} onClick={() => onSave(meal)}>
          Guardar en mi registro
        </Button>
        {!ready && draft.items.length > 0 && !loading && <p className="result__foot-hint">Revisa los alimentos marcados para poder guardar.</p>}
      </div>

      <ItemSheet
        item={sheetItem}
        open={sheet?.kind === 'item' && !!sheetItem}
        onClose={() => setSheet(null)}
        onGrams={(g) => sheetItem && onChange(setGrams(draft, sheetItem.key, g))}
        onRename={(name) => sheetItem && onChange(renameItem(draft, sheetItem.key, name))}
        onChoose={(food) => sheetItem && onChange(chooseFood(draft, sheetItem.key, food))}
        onSearch={() => sheetItem && setSheet({ kind: 'search', key: sheetItem.key, initial: sheetItem.name })}
        onRemove={() => {
          if (sheetItem) onChange(removeItem(draft, sheetItem.key));
          setSheet(null);
        }}
      />
      <FoodSearchSheet
        open={sheet?.kind === 'search'}
        initial={sheet?.kind === 'search' ? sheet.initial : undefined}
        onClose={() => setSheet(null)}
        onPick={(food, name) => {
          if (sheet?.kind === 'search' && sheet.key) {
            onChange(chooseFood(draft, sheet.key, food, name));
            setSheet({ kind: 'item', key: sheet.key });
          } else addFood(food, name);
        }}
        onEstimate={(per100, name) => {
          if (sheet?.kind === 'search' && sheet.key) {
            onChange(chooseEstimate(draft, sheet.key, per100, name));
            setSheet({ kind: 'item', key: sheet.key });
          } else addEstimate(per100, name);
        }}
        onManual={(name) => setSheet({ kind: 'manual', key: sheet?.kind === 'search' ? sheet.key : undefined, initial: name })}
      />
      <ManualFoodSheet
        open={sheet?.kind === 'manual'}
        initialName={sheet?.kind === 'manual' ? sheet.initial : undefined}
        onClose={() => setSheet(null)}
        onSubmit={({ name, per100, grams }) => {
          if (sheet?.kind === 'manual' && sheet.key) {
            onChange(setGrams(setManualValues(draft, sheet.key, per100, name), sheet.key, grams));
          } else {
            const item: DraftItem = { key: newKey(), name, query: '', grams, amount: 'user', status: 'ok', per100, source: { kind: 'manual' }, alternatives: [] };
            onChange({ ...addItem(draft, item), dish: draft.dish || name });
          }
          setSheet(null);
        }}
      />
      <HintSheet
        open={sheet?.kind === 'hint'}
        onClose={() => setSheet(null)}
        onSubmit={(hint) => {
          setSheet(null);
          onReanalyze?.(hint);
        }}
      />
      <NameSheet open={sheet?.kind === 'name'} value={draft.dish} onClose={() => setSheet(null)} onSubmit={(dish) => onChange({ ...draft, dish })} />
    </motion.div>
  );
}

function basisNote(draft: Draft, basis: Basis, estimated: boolean): string {
  const one = draft.items.length === 1 ? draft.items[0] : undefined;
  const unit = one?.unit === 'ml' ? 'ml' : 'g';
  if (basis === 'serving' && one?.serving) return `Valores por ración: ${one.serving.label ?? `${formatInt(one.serving.grams)} ${unit}`}, según el envase.`;
  if (basis === 'per100') return one ? `Valores por 100 ${unit} del alimento.` : 'Valores por 100 g del plato completo.';
  if (estimated) return 'Valores para la cantidad estimada en la foto. Ajusta los gramos si los conoces.';
  return 'Valores para la cantidad indicada.';
}

function sourcesNote(draft: Draft): string {
  const kinds = new Set(draft.items.map((i) => i.source?.kind).filter(Boolean));
  const parts: string[] = [];
  if (kinds.has('usda')) parts.push('USDA FoodData Central');
  if (kinds.has('off')) parts.push('Open Food Facts');
  if (kinds.has('ai')) parts.push('estimaciones de IA a partir de tablas de composición');
  if (kinds.has('manual')) parts.push('valores introducidos por ti');
  const from = parts.length ? `Valores de ${parts.join(', ')}.` : '';
  const how = draft.origin === 'photo' ? ' Alimentos y cantidades estimados por IA a partir de la foto; la foto no se guarda.' : '';
  return `${from}${how} Orientativo: no sustituye el consejo de un profesional sanitario.`.trim();
}

export function NutrientTiles({ values, approx }: { values: Nutrients; approx: boolean }) {
  const a = approx ? '≈ ' : '';
  return (
    <div className="tiles">
      <div className="tile tile--kcal">
        <span className="tile__label">Calorías</span>
        <span className="tile__value t-num">
          {a}
          <AnimatedNumber value={values.kcal} format={formatInt} duration={0.6} />
          <small> kcal</small>
        </span>
        <span className="tile__sub t-num">
          <AnimatedNumber value={kcalToKj(values.kcal)} format={formatInt} duration={0.6} /> kJ
        </span>
      </div>
      {(
        [
          ['protein', 'Proteína'],
          ['carbs', 'Hidratos'],
          ['fat', 'Grasa'],
        ] as const
      ).map(([k, label]) => (
        <div key={k} className={`tile tile--${k}`}>
          <span className="tile__label">
            <span className="tile__dot" aria-hidden="true" />
            {label}
          </span>
          <span className="tile__value t-num">
            {a}
            <AnimatedNumber value={values[k]} format={(n) => formatNumber(n, values[k] < 10 ? 1 : 0)} duration={0.6} />
            <small> g</small>
          </span>
        </div>
      ))}
    </div>
  );
}

function OptionalRow({ values, missing }: { values: Nutrients; missing: readonly OptionalNutrient[] }) {
  const shown = OPTIONAL_NUTRIENTS.filter((k) => values[k] !== undefined);
  const absent = OPTIONAL_NUTRIENTS.filter((k) => values[k] === undefined || missing.includes(k));
  return (
    <div className="optional-row">
      {shown.map((k) => (
        <span key={k} className="optional-row__item">
          {OPTIONAL_LABEL[k]} <strong className="t-num">{formatNumber(values[k]!, 1)} g</strong>
        </span>
      ))}
      {absent.length > 0 && (
        <span className="optional-row__missing">
          Sin datos completos de {absent.map((k) => OPTIONAL_LABEL[k].toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' y $1')}
        </span>
      )}
    </div>
  );
}

function ItemRow({
  item,
  index,
  onOpen,
  onSearch,
  onManual,
  onRemove,
  onConfirm,
  onRetry,
}: {
  item: DraftItem;
  index: number;
  onOpen: () => void;
  onSearch: () => void;
  onManual: () => void;
  onRemove: () => void;
  onConfirm: () => void;
  onRetry: () => void;
}) {
  const values = itemValues(item);
  const unit = item.unit ?? 'g';
  const approx = item.amount === 'photo' ? '≈ ' : '';
  return (
    <motion.li
      layout="position"
      className={cx('item', `item--${item.status}`, item.amount === 'default' && 'item--ask')}
      // Full transform strings stay on the compositor; a short stagger lets the list read in order.
      initial={{ opacity: 0, transform: 'translateY(10px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.32, ease: [0.23, 1, 0.32, 1], delay: Math.min(index, 8) * 0.045 } }}
      exit={{ opacity: 0, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0, transition: { duration: 0.2 } }}
    >
      <button type="button" className="item__main" onClick={onOpen} disabled={item.status === 'loading'}>
        <span className="item__text">
          <span className="item__name">{item.name}</span>
          <span className="item__sub">
            {approx}
            {formatInt(item.grams)} {unit}
            {item.preparation ? ` · ${item.preparation}` : ''}
            {item.amount === 'label' ? ' · ración del envase' : ''}
          </span>
          <span className="item__chips">
            {item.amount === 'photo' && item.confidence && <span className={`conf conf--${item.confidence}`}>{CONFIDENCE_LABEL[item.confidence]}</span>}
            <ValueChip item={item} />
          </span>
        </span>
        <span className="item__kcal t-num">
          {item.status === 'loading' ? (
            <span className="item__skeleton" aria-label="Buscando valores" />
          ) : values ? (
            <>
              {approx}
              {formatInt(values.kcal)}
              <small> kcal</small>
            </>
          ) : (
            <AlertTriangle aria-label="Sin valores" />
          )}
        </span>
        {item.status !== 'loading' && <ChevronRight className="item__chev" aria-hidden="true" />}
      </button>
      {item.status === 'none' && (
        <div className="item__fix">
          <p>No hemos encontrado datos fiables para este alimento.</p>
          <div className="item__fix-actions">
            <button type="button" className="chip" onClick={onSearch}>
              <Search aria-hidden="true" /> Buscar otro
            </button>
            <button type="button" className="chip" onClick={onManual}>
              <PencilLine aria-hidden="true" /> Introducir valores
            </button>
            <button type="button" className="chip" onClick={onRemove}>
              <X aria-hidden="true" /> Quitar
            </button>
          </div>
        </div>
      )}
      {item.status === 'error' && (
        <div className="item__fix">
          <p>Faltan sus valores nutricionales.</p>
          <div className="item__fix-actions">
            <button type="button" className="chip" onClick={onRetry}>
              <RefreshCw aria-hidden="true" /> Reintentar
            </button>
            <button type="button" className="chip" onClick={onManual}>
              <PencilLine aria-hidden="true" /> Introducir valores
            </button>
            <button type="button" className="chip" onClick={onRemove}>
              <X aria-hidden="true" /> Quitar
            </button>
          </div>
        </div>
      )}
      {item.amount === 'default' && item.status === 'ok' && (
        <div className="item__fix">
          <p>El envase no indica la ración. ¿Cuánto has tomado?</p>
          <div className="item__fix-actions">
            <button type="button" className="chip chip--active" onClick={onOpen}>
              <ScanLine aria-hidden="true" /> Indicar cantidad
            </button>
            <button type="button" className="chip" onClick={onConfirm}>
              Son {formatInt(item.grams)} {unit}
            </button>
          </div>
        </div>
      )}
    </motion.li>
  );
}

function GuidanceCard({ total, meal, estimated, date }: { total: Nutrients; meal: MealType; estimated: boolean; date?: string }) {
  const profile = useProfile();
  const weights = useWeights();
  const today = date ?? todayKey();
  const meals = useMealsDay(today);
  const guidance = useMemo(() => {
    if (!profile || !weights || !meals) return null;
    const est = energyEstimate(profile, weights, today);
    const logged = mealTotals(meals.flatMap((m) => m.items)).total.kcal;
    return mealGuidance({
      total,
      meal,
      goal: profile.goal,
      targetKcal: est.status === 'ok' && est.target ? est.target.kcal : null,
      noTarget: est.status === 'missing' ? 'missing' : est.restricted ? 'restricted' : undefined,
      kg: est.status === 'ok' ? est.kg : latestWeightUpTo(weights, today)?.kg,
      loggedKcal: logged,
      estimated,
      healthFlags: profile.healthFlags ?? [],
    });
  }, [profile, weights, meals, total, meal, estimated, today]);
  if (!guidance || !profile) return null;
  return (
    <section className="result__card guidance" aria-labelledby="guidance-title">
      <h3 id="guidance-title">
        <Lightbulb aria-hidden="true" /> Para tu objetivo · {goalLabel(profile.goal)}
      </h3>
      <p className="guidance__headline">{guidance.headline}</p>
      {guidance.tips.length > 0 && (
        <ul className="guidance__tips">
          {guidance.tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      {guidance.note && <p className="guidance__note">{guidance.note}</p>}
    </section>
  );
}

function HintSheet({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (hint: string) => void }) {
  const [hint, setHint] = useState('');
  const text = hint.trim();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Volver a analizar"
      description="Cuéntanos qué hay en el plato y lo identificamos de nuevo con la misma foto."
      footer={
        <Button block icon={<RefreshCw />} disabled={!text} onClick={() => onSubmit(text)}>
          Analizar de nuevo
        </Button>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text) onSubmit(text);
        }}
      >
        <TextField
          label="¿Qué es?"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          maxLength={MAX_HINT_LENGTH}
          placeholder="Ej.: lentejas con chorizo y pan"
          hint="La foto se envía otra vez solo para este análisis."
          data-autofocus
        />
      </form>
    </Sheet>
  );
}

function NameSheet({ open, value, onClose, onSubmit }: { open: boolean; value: string; onClose: () => void; onSubmit: (v: string) => void }) {
  const [name, setName] = useState(value);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setName(value);
  }
  const submit = () => {
    if (!name.trim()) return;
    onSubmit(name.trim().slice(0, 80));
    onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Nombre de la comida"
      footer={
        <Button block disabled={!name.trim()} onClick={submit}>
          Guardar nombre
        </Button>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <TextField label="Nombre" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} data-autofocus />
      </form>
    </Sheet>
  );
}

/** Where an item's values come from, and whether the database confirmed them. */
function ValueChip({ item }: { item: DraftItem }) {
  if (item.status !== 'ok') return null;
  if (item.verify === 'pending') {
    return (
      <span key="pending" className="vchip vchip--pending">
        <span className="vchip__spin" aria-hidden="true" /> Verificando valores…
      </span>
    );
  }
  if (item.verify === 'verified' && item.source?.kind === 'usda') {
    return (
      <span key="verified" className="vchip vchip--verified">
        <Check aria-hidden="true" /> Verificado · USDA
      </span>
    );
  }
  if (item.source?.kind === 'ai') {
    return (
      <span key="estimate" className="vchip vchip--estimate">
        <Sparkles aria-hidden="true" /> Valores estimados
      </span>
    );
  }
  return null;
}

/**
 * Labels on the photo where each food is, as the AI placed them. The photo is
 * shown cropped to fill (object-fit: cover), so positions are mapped through
 * the same crop; labels that would fall off the visible area are left out.
 */
function FoodTags({ items, src, onOpen }: { items: DraftItem[]; src: string; onOpen: (key: string) => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.onload = () => alive && setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = src;
    return () => {
      alive = false;
    };
  }, [src]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => entry && setBox({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tags =
    natural && box
      ? items
          .filter((it) => it.at && it.status === 'ok')
          .map((it) => {
            const scale = Math.max(box.w / natural.w, box.h / natural.h);
            const dw = natural.w * scale;
            const dh = natural.h * scale;
            return { it, x: (box.w - dw) / 2 + it.at!.x * dw, y: (box.h - dh) / 2 + it.at!.y * dh };
          })
          .filter(({ x, y }) => x > 16 && x < box.w - 16 && y > 64 && y < box.h - 44)
      : [];

  return (
    <div ref={boxRef} className="tags">
      {tags.map(({ it, x, y }, i) => {
        const v = itemValues(it);
        const side = box && x > box.w * 0.58 ? 'left' : 'right';
        return (
          <button
            key={it.key}
            type="button"
            className={`tag tag--${side}`}
            style={{ transform: `translate(${Math.round(x)}px, ${Math.round(y)}px)`, '--i': i } as CSSProperties}
            onClick={() => onOpen(it.key)}
            aria-label={`${it.name}: ver y ajustar`}
          >
            <span className="tag__inner">
              <span className="tag__dot" aria-hidden="true" />
              <span className="tag__label">
                {it.name}
                {v && <span className="tag__kcal t-num"> · {formatInt(v.kcal)} kcal</span>}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
