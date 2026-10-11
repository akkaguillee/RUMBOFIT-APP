import { AnimatePresence, motion } from 'motion/react';
import { useTheme } from '@/app/theme';

function Moon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" fill="currentColor" fillOpacity="0.18" />
    </svg>
  );
}

function Sun() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" fill="currentColor" fillOpacity="0.2" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line key={a} x1="12" y1="2.6" x2="12" y2="4.6" transform={`rotate(${a} 12 12)`} />
      ))}
    </svg>
  );
}

/**
 * Moon in dark mode, sun in light mode. The icon rotates out while the new
 * one rises in; the theme itself is revealed with a circular transition.
 */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className="icon-btn theme-toggle"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        toggle({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }}
      aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={dark ? 'Modo oscuro activo · cambiar a claro' : 'Modo claro activo · cambiar a oscuro'}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={theme}
          style={{ display: 'grid', placeItems: 'center' }}
          initial={{ rotate: -90, y: 14, opacity: 0 }}
          animate={{ rotate: 0, y: 0, opacity: 1 }}
          exit={{ rotate: 90, y: -14, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 26 }}
        >
          {dark ? <Moon /> : <Sun />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
