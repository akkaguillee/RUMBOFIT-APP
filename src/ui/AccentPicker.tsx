import { Check } from 'lucide-react';
import { motion } from 'motion/react';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { ACCENTS, useTheme } from '@/app/theme';
import { Sheet } from './Sheet';
import { spring } from './motion';

/** Radio group of accent palettes. The new colour is revealed from the tapped swatch. */
export function AccentPicker() {
  const { accent, setAccent } = useTheme();
  const ring = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const choose = (i: number) => {
    const opt = ACCENTS[i];
    const el = refs.current[i];
    if (!opt || opt.id === accent) return;
    const r = el?.getBoundingClientRect();
    setAccent(opt.id, r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : undefined);
  };

  const onKey = (e: KeyboardEvent, i: number) => {
    let next = i;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % ACCENTS.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + ACCENTS.length) % ACCENTS.length;
    else return;
    e.preventDefault();
    refs.current[next]?.focus();
    choose(next);
  };

  return (
    <div role="radiogroup" aria-label="Color de la interfaz" className="accent-grid">
      {ACCENTS.map((a, i) => {
        const selected = a.id === accent;
        return (
          <button
            key={a.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${a.name.charAt(0)}${a.name.slice(1).toLowerCase()} (${a.color})`}
            tabIndex={selected ? 0 : -1}
            className="accent-opt"
            data-on-dark={a.id === 'rojo' || a.id === 'violeta' || a.id === 'fucsia'}
            onClick={() => choose(i)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <span className="accent-opt__chip" style={{ background: a.swatch[0] }} aria-hidden="true">
              {selected && (
                <motion.span className="accent-opt__check" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.18 }}>
                  <Check strokeWidth={3} />
                </motion.span>
              )}
            </span>
            <span className="accent-opt__name">{a.name}</span>
            {selected && <motion.span layoutId={ring} className="accent-opt__ring" style={{ borderColor: a.swatch[0] }} transition={spring.snappy} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

/** Top-bar button: a colour wheel with the current accent in the middle. */
export function AccentButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="icon-btn accent-btn"
        aria-label="Cambiar el color de la interfaz"
        title="Color de la interfaz"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span className="accent-btn__wheel" aria-hidden="true">
          <span className="accent-btn__dot" />
        </span>
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Color de la interfaz"
        description="Elige el color que acompaña a botones, anillos y destacados. Los colores de estado (verde, amarillo y rojo) no cambian."
      >
        <AccentPicker />
      </Sheet>
    </>
  );
}
