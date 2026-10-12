import { motion } from 'motion/react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { cx } from './cx';
import { spring } from './motion';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  block?: boolean;
  className?: string;
  /** "tabs" renders a WAI-ARIA tablist; "radio" a radio group. */
  mode?: 'tabs' | 'radio';
  idPrefix?: string;
}

export function Segmented<T extends string>({ options, value, onChange, label, block, className, mode = 'radio', idPrefix }: SegmentedProps<T>) {
  const layoutId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState<'none' | 'start' | 'middle' | 'end'>('none');

  // When options don't fit, the control scrolls horizontally with an edge fade,
  // and the selected option is kept in view.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => {
      if (el.scrollWidth <= el.clientWidth + 1) setScroll('none');
      else if (el.scrollLeft <= 2) setScroll('start');
      else setScroll(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 ? 'end' : 'middle');
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener('scroll', update, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', update);
    };
  }, []);

  const selectedIndex = options.findIndex((o) => o.value === value);
  useEffect(() => {
    const btn = refs.current[selectedIndex];
    const el = rootRef.current;
    if (btn && el && el.scrollWidth > el.clientWidth) {
      el.scrollTo({ left: btn.offsetLeft - el.clientWidth / 2 + btn.offsetWidth / 2, behavior: 'smooth' });
    }
  }, [selectedIndex]);

  const onKey = (e: KeyboardEvent, i: number) => {
    let next = i;
    if (e.key === 'ArrowRight') next = (i + 1) % options.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + options.length) % options.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    else return;
    e.preventDefault();
    const opt = options[next];
    if (opt) {
      onChange(opt.value);
      refs.current[next]?.focus();
    }
  };
  return (
    <div
      ref={rootRef}
      role={mode === 'tabs' ? 'tablist' : 'radiogroup'}
      aria-label={label}
      className={cx('segmented', block && 'segmented--block', scroll !== 'none' && `segmented--scroll is-${scroll}`, className)}
    >
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role={mode === 'tabs' ? 'tab' : 'radio'}
            id={idPrefix ? `${idPrefix}-tab-${o.value}` : undefined}
            aria-controls={idPrefix && mode === 'tabs' ? `${idPrefix}-panel` : undefined}
            aria-selected={mode === 'tabs' ? selected : undefined}
            aria-checked={mode === 'radio' ? selected : undefined}
            tabIndex={selected ? 0 : -1}
            className="segmented__item"
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {selected && <motion.span layoutId={layoutId} className="segmented__thumb" transition={spring.snappy} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
