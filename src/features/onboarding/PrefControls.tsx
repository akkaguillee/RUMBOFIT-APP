import { Check, Gauge } from 'lucide-react';
import { motion } from 'motion/react';
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { ACTIVITY_LEVELS } from '@/domain/health';
import type { ActivityLevel } from '@/domain/types';
import { WEEKDAY_LABELS, WEEKDAY_SHORT } from '@/domain/dates';
import { cx } from '@/ui/cx';
import { spring } from '@/ui/motion';
import { questionVariants } from './motion';
import type { Option } from './preferences';
import './prefs.css';

/** Question building blocks shared by onboarding and Perfil → Tu personalización. */

/** Arrow-key handling shared by the single-choice groups (roving focus, selection follows focus). */
function useRoving<T extends string>(options: Option<T>[], onChange: (v: T) => void) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const n = options.length;
    let next = i;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (i + 1) % n;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (i - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else return;
    e.preventDefault();
    const opt = options[next];
    if (!opt) return;
    onChange(opt.value);
    refs.current[next]?.focus();
  };
  const ref = (i: number) => (el: HTMLButtonElement | null) => {
    refs.current[i] = el;
  };
  return { onKey, ref };
}

interface ChoiceListProps<T extends string> {
  label: string;
  options: Option<T>[];
  value: T | null | undefined;
  onChange: (value: T) => void;
  /** Denser rows, for lists of four or more options. */
  compact?: boolean;
  /** Icon tiles in a row of equal columns (e.g. Sentado / De pie / En movimiento). */
  layout?: 'list' | 'tiles';
  className?: string;
  labelledBy?: string;
}

/**
 * Single-choice cards (WAI-ARIA radio group with roving focus and arrow keys).
 * Selected state reuses the shared `.choice[aria-checked]` styling.
 */
export function ChoiceList<T extends string>({ label, options, value, onChange, compact, layout = 'list', className, labelledBy }: ChoiceListProps<T>) {
  const { onKey, ref } = useRoving(options, onChange);
  const selected = options.findIndex((o) => o.value === value);
  const focusable = selected >= 0 ? selected : 0;

  return (
    <div
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      className={cx(layout === 'tiles' ? 'choice-tiles' : 'choice-list', compact && 'choice-list--compact', className)}
      style={layout === 'tiles' ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            ref={ref(i)}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === focusable ? 0 : -1}
            className={cx('choice', layout === 'tiles' ? 'choice--tile' : 'choice--row', compact && 'choice--compact')}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {Icon && (
              <span className="choice__icon">
                <Icon aria-hidden="true" />
              </span>
            )}
            <span className="choice__text">
              <span className="choice__label">{o.label}</span>
              {o.description && <span className="choice__desc">{o.description}</span>}
            </span>
            <span className="choice__check" aria-hidden="true">
              <Check />
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface ChipChoiceProps<T extends string> {
  label: string;
  options: Option<T>[];
  value: T | null | undefined;
  onChange: (value: T) => void;
  labelledBy?: string;
  describedBy?: string;
}

/** Single choice drawn as chips that wrap (radio group). "No lo sé" style answers are drawn more softly. */
export function ChipChoice<T extends string>({ label, options, value, onChange, labelledBy, describedBy }: ChipChoiceProps<T>) {
  const { onKey, ref } = useRoving(options, onChange);
  const selected = options.findIndex((o) => o.value === value);
  const focusable = selected >= 0 ? selected : 0;
  return (
    <div role="radiogroup" aria-label={labelledBy ? undefined : label} aria-labelledby={labelledBy} aria-describedby={describedBy} className="pref-chips">
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={ref(i)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={i === focusable ? 0 : -1}
          className={cx('chip', o.quiet && 'chip--quiet')}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface ChipToggleGroupProps<T extends string> {
  label: string;
  options: Option<T>[];
  values: readonly T[];
  onChange: (values: T[]) => void;
  /** Maximum number of selections; further chips are announced as unavailable. */
  max?: number;
  labelledBy?: string;
  describedBy?: string;
}

/** Multi-select chips that wrap cleanly onto several lines. */
export function ChipToggleGroup<T extends string>({ label, options, values, onChange, max, labelledBy, describedBy }: ChipToggleGroupProps<T>) {
  const full = max !== undefined && values.length >= max;
  return (
    <div role="group" aria-label={labelledBy ? undefined : label} aria-labelledby={labelledBy} aria-describedby={describedBy} className="pref-chips">
      {options.map((o) => {
        const on = values.includes(o.value);
        const blocked = full && !on;
        return (
          <button
            key={o.value}
            type="button"
            className={cx('chip', o.quiet && 'chip--quiet')}
            aria-pressed={on}
            aria-disabled={blocked || undefined}
            onClick={() => {
              if (on) onChange(values.filter((v) => v !== o.value));
              else if (!blocked) onChange(options.filter((x) => x.value === o.value || values.includes(x.value)).map((x) => x.value));
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

interface QuestionProps {
  label: string;
  hint?: ReactNode;
  /** Right-aligned note next to the label, e.g. "2 de 3" or "Opcional". */
  aside?: ReactNode;
  className?: string;
  children: (ids: { labelId: string; hintId?: string }) => ReactNode;
}

/** A question: its label, the control and an optional hint underneath. */
export function Question({ label, hint, aside, className, children }: QuestionProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <motion.div variants={questionVariants} className={cx('q', className)}>
      <div className="q__head">
        <span className="q__label" id={labelId}>
          {label}
        </span>
        {aside && <span className="q__aside">{aside}</span>}
      </div>
      {children({ labelId, hintId })}
      {hint && (
        <p className="q__hint" id={hintId}>
          {hint}
        </p>
      )}
    </motion.div>
  );
}

interface SingleQuestionProps<T extends string> {
  label: string;
  hint?: ReactNode;
  options: Option<T>[];
  value: T | null | undefined;
  onChange: (value: T) => void;
  layout?: 'chips' | 'cards' | 'tiles';
}

export function SingleQuestion<T extends string>({ label, hint, options, value, onChange, layout = 'chips' }: SingleQuestionProps<T>) {
  return (
    <Question label={label} hint={hint}>
      {({ labelId, hintId }) =>
        layout === 'chips' ? (
          <ChipChoice label={label} labelledBy={labelId} describedBy={hintId} options={options} value={value} onChange={onChange} />
        ) : (
          <ChoiceList label={label} labelledBy={labelId} options={options} value={value} onChange={onChange} layout={layout === 'tiles' ? 'tiles' : 'list'} compact />
        )
      }
    </Question>
  );
}

interface MultiQuestionProps<T extends string> {
  label: string;
  hint?: ReactNode;
  options: Option<T>[];
  values: readonly T[] | undefined;
  onChange: (values: T[]) => void;
  max?: number;
}

export function MultiQuestion<T extends string>({ label, hint, options, values = [], onChange, max }: MultiQuestionProps<T>) {
  return (
    <Question
      label={label}
      hint={max !== undefined && values.length >= max ? `Has elegido ${max}. Quita una para cambiarla.` : hint}
      aside={max !== undefined ? `${values.length} de ${max}` : 'Elige varias'}
    >
      {({ labelId, hintId }) => (
        <ChipToggleGroup label={label} labelledBy={labelId} describedBy={hintId} options={options} values={values} onChange={onChange} max={max} />
      )}
    </Question>
  );
}

/** Monday-first weekday toggles. */
export function DayPicker({ days, onChange, labelledBy }: { days: number[]; onChange: (days: number[]) => void; labelledBy: string }) {
  return (
    <div className="day-picker" role="group" aria-labelledby={labelledBy}>
      {WEEKDAY_SHORT.map((label, i) => {
        const on = days.includes(i);
        return (
          <button
            key={i}
            type="button"
            className="day-picker__day pressable"
            aria-pressed={on}
            aria-label={WEEKDAY_LABELS[i]}
            onClick={() => onChange(on ? days.filter((x) => x !== i) : [...days, i].sort((a, b) => a - b))}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

interface CountPickerProps {
  value: number | null;
  onChange: (n: number) => void;
  /** Highest count offered; the picker shows 0 to `max`. */
  max: number;
  /** Accessible name of each count, e.g. «3 días». */
  labelOf: (n: number) => string;
  labelledBy: string;
  describedBy?: string;
}

/**
 * A row of equal cells from 0 to `max` (radio group with arrow keys). The
 * selection is a single thumb that glides between cells, like `Segmented`.
 */
export function CountPicker({ value, onChange, max, labelOf, labelledBy, describedBy }: CountPickerProps) {
  const thumbId = useId();
  const options = Array.from({ length: max + 1 }, (_, n) => ({ value: String(n), label: labelOf(n) }));
  const { onKey, ref } = useRoving(options, (v) => onChange(Number(v)));
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="count-picker"
      style={{ gridTemplateColumns: `repeat(${max + 1}, minmax(0, 1fr))` }}
    >
      {options.map((o, n) => {
        const on = n === value;
        return (
          <button
            key={o.value}
            ref={ref(n)}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.label}
            tabIndex={n === (value ?? 0) ? 0 : -1}
            className="count-picker__cell"
            onClick={() => onChange(n)}
            onKeyDown={(e) => onKey(e, n)}
          >
            {on && <motion.span layoutId={thumbId} className="count-picker__thumb" transition={spring.snappy} aria-hidden="true" />}
            <span className="count-picker__n t-num">{n}</span>
          </button>
        );
      })}
    </div>
  );
}

const LEVELS = Object.keys(ACTIVITY_LEVELS) as ActivityLevel[];

/** "Tu nivel estimado: Moderado" with a five-step meter. */
export function LevelEstimate({ level, detail }: { level: ActivityLevel | null; detail: string }) {
  const at = level ? LEVELS.indexOf(level) : -1;
  return (
    <motion.div variants={questionVariants} className={cx('level', !level && 'level--empty')}>
      <span className="level__icon" aria-hidden="true">
        <Gauge />
      </span>
      <div className="level__body">
        <p className="level__title" aria-live="polite">
          <span className="level__label">Tu nivel estimado</span>
          <span className="level__value">{level ? ACTIVITY_LEVELS[level].label : 'Sin calcular'}</span>
        </p>
        <span className="level__meter" aria-hidden="true">
          {LEVELS.map((l, i) => (
            <span key={l} className={cx('level__bar', i <= at && 'is-on')} />
          ))}
        </span>
        <p className="level__detail">{detail}</p>
      </div>
    </motion.div>
  );
}
