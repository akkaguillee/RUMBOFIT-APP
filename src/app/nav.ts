import { CalendarDays, ChartLine, Dumbbell, Droplets, House, Salad, Sparkles, Trophy, UserRound, type LucideIcon } from 'lucide-react';

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
  { to: '/nutricion', label: 'Nutrición', short: 'Nutrición', icon: Salad },
  { to: '/habitos', label: 'Hábitos', short: 'Hábitos', icon: Droplets },
  { to: '/hitos', label: 'Hitos', short: 'Hitos', icon: Trophy },
];

export const ACCOUNT_NAV: NavItem[] = [
  { to: '/perfil', label: 'Perfil y ajustes', short: 'Perfil', icon: UserRound },
  { to: '/quien-soy', label: '¿Quién soy?', short: '¿Quién soy?', icon: Sparkles },
];

/** Mobile tab bar: the five most frequent destinations (Calendario and Hitos live in the menu). */
export const TAB_NAV: NavItem[] = PRIMARY_NAV.filter((n) => n.to !== '/calendario' && n.to !== '/hitos');

export function sectionOf(pathname: string): string {
  const seg = pathname.split('/')[1] ?? '';
  return `/${seg}`;
}

export function titleFor(pathname: string): string {
  const section = sectionOf(pathname);
  return [...PRIMARY_NAV, ...ACCOUNT_NAV].find((n) => n.to === section)?.label ?? 'RUMBO';
}
