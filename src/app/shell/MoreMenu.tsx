import { CalendarDays, ChevronRight, Sparkles, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Sheet } from '@/ui/Sheet';
import { ThemeToggle } from '@/ui/ThemeToggle';
import { useTheme } from '../theme';

const links = [
  { to: '/calendario', label: 'Calendario', sub: 'Tu historial día a día', icon: CalendarDays },
  { to: '/perfil', label: 'Perfil y ajustes', sub: 'Datos, objetivos, unidades y privacidad', icon: UserRound },
  { to: '/quien-soy', label: '¿Quién soy?', sub: 'Conoce al creador de RUMBO', icon: Sparkles },
];

export function MoreMenu({ open, onClose, name }: { open: boolean; onClose: () => void; name: string }) {
  const { theme } = useTheme();
  return (
    <Sheet open={open} onClose={onClose} title={`Hola, ${name}`}>
      <ul className="list">
        {links.map(({ to, label, sub, icon: Icon }) => (
          <li key={to}>
            <Link to={to} className="list-row" onClick={onClose}>
              <span className="icon-tile icon-tile--accent">
                <Icon aria-hidden="true" />
              </span>
              <span className="list-row__main">
                <span className="list-row__title" style={{ display: 'block' }}>
                  {label}
                </span>
                <span className="list-row__sub">{sub}</span>
              </span>
              <ChevronRight aria-hidden="true" style={{ width: 18, color: 'var(--text-3)' }} />
            </Link>
          </li>
        ))}
        <li className="list-row">
          <span className="list-row__main">
            <span className="list-row__title" style={{ display: 'block' }}>
              Apariencia
            </span>
            <span className="list-row__sub">{theme === 'dark' ? 'Modo oscuro' : 'Modo claro'}</span>
          </span>
          <ThemeToggle />
        </li>
      </ul>
    </Sheet>
  );
}
