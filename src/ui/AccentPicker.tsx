import { Check } from 'lucide-react';
import { motion } from 'motion/react';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { ACCENTS, useTheme } from '@/app/theme';
import { Sheet } from './Sheet';
import { spring } from './motion';

/** Radio group of accent palettes. The new colour is revealed from the tapped swatch. */
export function AccentPicker({ compact }: { compact?: boolean }) {
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
    <div role="radiogroup" aria-label="Color de la interfaz" className={compact ? 'accent-grid accent-grid--compact' : 'accent-grid'}>
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
            aria-label={`${a.name} (${a.color})`}
            tabIndex={selected ? 0 : -1}
            className="accent-opt"
            onClick={() => choose(i)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <span className="accent-opt__orb" style={{ background: `radial-gradient(circle at 32% 26%, ${a.swatch[0]}, ${a.swatch[1]} 78%)` }} aria-hidden="true">
              {selected && (
                <motion.span className="accent-opt__check" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.bouncy}>
                  <Check strokeWidth={3} />
                </motion.span>
              )}
            </span>
            {selected && <motion.span layoutId={ring} className="accent-opt__ring" transition={spring.snappy} aria-hidden="true" />}
            <span className="accent-opt__name">{a.name}</span>
            {!compact && <span className="accent-opt__color">{a.color}</span>}
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
