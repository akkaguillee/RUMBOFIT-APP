import { AlertTriangle, Check, Info } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useSyncExternalStore } from 'react';
import { cx } from './cx';
import { spring } from './motion';
import { dismissToast, getToasts, subscribeToasts } from './toast';

const icons = { success: Check, error: AlertTriangle, info: Info };

export function ToastViewport() {
  const list = useSyncExternalStore(subscribeToasts, getToasts, getToasts);
  return (
    <div className="toasts" role="status" aria-live="polite" aria-atomic="false">
      <AnimatePresence initial={false}>
        {list.map((t) => {
          const Icon = icons[t.tone];
          return (
            <motion.div
              key={t.id}
              layout
              className={cx('toast glass glass--sheet', `toast--${t.tone}`)}
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: spring.bouncy }}
              exit={{ opacity: 0, y: 12, transition: { duration: 0.16 } }}
            >
              <span className="toast__icon" aria-hidden="true">
                <Icon />
              </span>
              <span className="toast__msg">{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  className="toast__action"
                  onClick={() => {
                    t.action?.onClick();
                    dismissToast(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
