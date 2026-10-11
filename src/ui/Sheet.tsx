import { X } from 'lucide-react';
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from 'motion/react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './Button';
import { cx } from './cx';
import { spring } from './motion';
import { useIsWide } from './useMediaQuery';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** Prevents closing by backdrop/escape (e.g. while saving). */
  locked?: boolean;
  initialFocus?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openCount = 0;

/**
 * Bottom sheet on phones, centered dialog on larger screens. Traps focus,
 * closes with Escape, restores focus and locks page scroll while open.
 */
export function Sheet(props: SheetProps) {
  return createPortal(<AnimatePresence>{props.open && <SheetInner {...props} />}</AnimatePresence>, document.body);
}

function SheetInner({ onClose, title, description, children, footer, wide, locked, initialFocus }: SheetProps) {
  const wideScreen = useIsWide();
  const reduce = useReducedMotion();
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useDragControls();
  const lockedRef = useRef(locked);
  const closeRef = useRef(onClose);
  useEffect(() => {
    lockedRef.current = locked;
    closeRef.current = onClose;
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    openCount += 1;
    document.documentElement.style.overflow = 'hidden';
    const panel = panelRef.current;
    const focusTarget =
      (initialFocus && panel?.querySelector<HTMLElement>(initialFocus)) ||
      panel?.querySelector<HTMLElement>('[data-autofocus]') ||
      panel?.querySelector<HTMLElement>('.sheet__body ' + FOCUSABLE) ||
      panel;
    requestAnimationFrame(() => focusTarget?.focus({ preventScroll: true }));

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !lockedRef.current) {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === 'Tab' && panel) {
        const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0] as HTMLElement;
        const last = items[items.length - 1] as HTMLElement;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      openCount -= 1;
      if (openCount === 0) document.documentElement.style.overflow = '';
      previous?.focus?.({ preventScroll: true });
    };
  }, [initialFocus]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (!locked && (info.offset.y > 120 || info.velocity.y > 600)) onClose();
  };

  const panelMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : wideScreen
      ? {
          initial: { opacity: 0, y: 32 },
          animate: { opacity: 1, y: 0, transition: spring.sheet },
          exit: { opacity: 0, y: 16, transition: { duration: 0.16 } },
        }
      : {
          initial: { y: '100%' },
          animate: { y: 0, transition: spring.sheet },
          exit: { y: '100%', transition: { duration: 0.22, ease: [0.65, 0, 0.35, 1] as const } },
        };

  return (
    <div className="overlay">
      <motion.div
        className="overlay__scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={() => !locked && onClose()}
        aria-hidden="true"
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx('sheet glass glass--sheet', wide && 'sheet--wide')}
        drag={wideScreen || reduce ? false : 'y'}
        dragListener={false}
        dragControls={drag}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={onDragEnd}
        {...panelMotion}
      >
        <div className="sheet__grabber" onPointerDown={(e) => drag.start(e)} aria-hidden="true" />
        <div className="sheet__head" onPointerDown={(e) => !wideScreen && drag.start(e)}>
          <h2 id={titleId} className="sheet__title">
            {title}
          </h2>
          <IconButton label="Cerrar" size="sm" onClick={onClose} disabled={locked}>
            <X />
          </IconButton>
        </div>
        {description && (
          <p id={descId} className="sheet__desc">
            {description}
          </p>
        )}
        <div className="sheet__body">{children}</div>
        {footer && <div className="sheet__foot">{footer}</div>}
      </motion.div>
    </div>
  );
}
