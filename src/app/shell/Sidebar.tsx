import { motion } from 'motion/react';
import { NavLink, useLocation } from 'react-router-dom';
import { RunnerMark, Wordmark } from '@/brand/Logo';
import type { Profile } from '@/domain/types';
import { spring } from '@/ui/motion';
import { ACCOUNT_NAV, PRIMARY_NAV, sectionOf, type NavItem } from '../nav';
import { AvatarContent } from '@/ui/Avatar';

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink to={item.to} className="side-link" aria-current={active ? 'page' : undefined}>
      <span className="side-link__hover" aria-hidden="true" />
      {active && <motion.span layoutId="side-active" className="side-link__active" transition={spring.snappy} aria-hidden="true" />}
      <Icon aria-hidden="true" />
      {item.label}
    </NavLink>
  );
}

export function Sidebar({ profile }: { profile: Profile }) {
  const { pathname } = useLocation();
  const section = sectionOf(pathname);
  return (
    <aside className="sidebar" aria-label="Navegación principal">
      <div className="sidebar__panel glass glass--nav">
        <NavLink to="/" className="sidebar__brand" aria-label="RUMBO · Inicio">
          <RunnerMark size={40} />
          <Wordmark height={17} />
        </NavLink>
        <nav className="sidebar__group" aria-label="Secciones">
          <p className="t-eyebrow sidebar__label">Tu rumbo</p>
          {PRIMARY_NAV.map((item) => (
            <SideLink key={item.to} item={item} active={section === item.to} />
          ))}
        </nav>
        <nav className="sidebar__group" aria-label="Cuenta">
          <p className="t-eyebrow sidebar__label">Cuenta</p>
          {ACCOUNT_NAV.map((item) => (
            <SideLink key={item.to} item={item} active={section === item.to} />
          ))}
        </nav>
        <div className="sidebar__footer">
          <NavLink to="/perfil" className="sidebar__profile">
            <span className="avatar-btn" data-photo={profile.photo ? '' : undefined} aria-hidden="true">
              <AvatarContent name={profile.name} photo={profile.photo} />
            </span>
            <span className="grow">
              <span className="truncate" style={{ display: 'block', fontWeight: 640 }}>
                {profile.name}
              </span>
              <span className="t-small t-muted">Ver perfil</span>
            </span>
          </NavLink>
        </div>
      </div>
    </aside>
  );
}
