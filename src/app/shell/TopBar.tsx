import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { RunnerMark, Wordmark } from '@/brand/Logo';
import type { Profile } from '@/domain/types';
import { AccentButton } from '@/ui/AccentPicker';
import { ThemeToggle } from '@/ui/ThemeToggle';
import { useIsDesktop } from '@/ui/useMediaQuery';
import { navItemFor } from '../nav';
import { MoreMenu } from './MoreMenu';

export function TopBar({ profile }: { profile: Profile }) {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const desktop = useIsDesktop();
  const { pathname } = useLocation();
  const section = navItemFor(pathname);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const initial = profile.name.charAt(0).toUpperCase();

  return (
    <header className="topbar" data-scrolled={scrolled}>
      <div className="page topbar__inner">
        <Link to="/" className="topbar__brand" aria-label="RUMBO · Inicio">
          <RunnerMark size={34} />
          {!scrolled || pathname === '/' ? <Wordmark height={15} /> : null}
        </Link>
        {pathname !== '/' && section && (
          // Decorative echo of the page's own <h1>; the short label is used on narrow phones.
          <span className="topbar__title" aria-hidden="true">
            <span className="topbar__title-long truncate">{section.label}</span>
            <span className="topbar__title-short truncate">{section.short}</span>
          </span>
        )}
        <div className="topbar__actions">
          <AccentButton />
          <ThemeToggle />
          {desktop ? (
            <Link to="/perfil" className="avatar-btn" aria-label={`Perfil de ${profile.name}`}>
              {initial}
            </Link>
          ) : (
            <button type="button" className="avatar-btn" aria-label="Abrir menú: calendario, perfil y más" aria-haspopup="dialog" onClick={() => setMenu(true)}>
              {initial}
            </button>
          )}
        </div>
      </div>
      {!desktop && <MoreMenu open={menu} onClose={() => setMenu(false)} name={profile.name} />}
    </header>
  );
}
