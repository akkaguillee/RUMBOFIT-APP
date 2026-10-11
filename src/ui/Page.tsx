import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cx } from './cx';
import { pageVariants, riseVariants } from './motion';

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={cx('page', className)} variants={pageVariants} initial="initial" animate="enter" exit="exit">
      {children}
    </motion.div>
  );
}

interface PageHeadProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function PageHead({ title, eyebrow, subtitle, actions }: PageHeadProps) {
  return (
    <motion.header className="page-head" variants={riseVariants}>
      <div className="page-head__text">
        {eyebrow && <p className="t-eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</p>}
        <h1 className="t-title">{title}</h1>
        {subtitle && <p className="page-head__sub">{subtitle}</p>}
      </div>
      {actions && <div className="hstack">{actions}</div>}
    </motion.header>
  );
}

/** Wraps arbitrary content so it joins the page cascade. */
export function Rise({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' }) {
  const C = as === 'section' ? motion.section : motion.div;
  return (
    <C className={className} variants={riseVariants}>
      {children}
    </C>
  );
}
