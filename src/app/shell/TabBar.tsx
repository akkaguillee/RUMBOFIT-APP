import { motion } from 'motion/react';
import { NavLink, useLocation } from 'react-router-dom';
import { spring } from '@/ui/motion';
import { sectionOf, TAB_NAV } from '../nav';

export function TabBar() {
  const { pathname } = useLocation();
  const section = sectionOf(pathname);
  return (
    <nav className="tabbar" aria-label="Navegación principal">
      <div className="tabbar__panel glass glass--nav">
        {TAB_NAV.map((item) => {
          const active = section === item.to;
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} className="tab" aria-current={active ? 'page' : undefined}>
              {active && <motion.span layoutId="tab-pill" className="tab__pill" transition={spring.snappy} aria-hidden="true" />}
              <motion.span animate={{ y: active ? -1 : 0, scale: active ? 1.06 : 1 }} transition={spring.bouncy} style={{ display: 'grid' }}>
                <Icon aria-hidden="true" />
              </motion.span>
              <span>{item.short}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
