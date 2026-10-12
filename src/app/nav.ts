import { CalendarDays, ChartLine, Dumbbell, Droplets, House, Sparkles, Trophy, UserRound, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  short: string;
  icon: LucideIcon;
}

export const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Inicio', short: 'Inicio', icon: House },
  { to: '/progresos', label: 'Progresos', short: 'Progreso', icon: ChartLine },
  { to: '/calendario', label: 'Calendario', short: 'Calendario', icon: CalendarDays },
  { to: '/entreno', label: 'Entrenamiento', short: 'Entreno', icon: Dumbbell },
  { to: '/habitos', label: 'Hábitos', short: 'Hábitos', icon: Droplets },
  { to: '/hitos', label: 'Hitos', short: 'Hitos', icon: Trophy },
];

export const ACCOUNT_NAV: NavItem[] = [
  { to: '/perfil', label: 'Perfil y ajustes', short: 'Perfil', icon: UserRound },
  { to: '/quien-soy', label: '¿Quién soy?', short: '¿Quién soy?', icon: Sparkles },
];

/** Mobile tab bar: every main section except Calendario, which lives in the menu. */
export const TAB_NAV: NavItem[] = PRIMARY_NAV.filter((n) => n.to !== '/calendario');

export function sectionOf(pathname: string): string {
  const seg = pathname.split('/')[1] ?? '';
  return `/${seg}`;
}

export function navItemFor(pathname: string): NavItem | undefined {
  const section = sectionOf(pathname);
  return [...PRIMARY_NAV, ...ACCOUNT_NAV].find((n) => n.to === section);
}

export function titleFor(pathname: string): string {
  return navItemFor(pathname)?.label ?? 'RUMBO';
}
