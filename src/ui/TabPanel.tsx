import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { staggerContainer } from './motion';

const PANEL = staggerContainer(0.06, 0.02);

interface Props {
  /** Changing it remounts the panel so the new content plays its entrance. */
  tab: string;
  idPrefix: string;
  children: ReactNode;
}

/**
 * Tab panel that orchestrates its own cascade with variant labels. Cards that
 * mount on a tab switch therefore always animate in, instead of inheriting
 * the page's already-finished entrance and staying invisible.
 */
export function TabPanel({ tab, idPrefix, children }: Props) {
  return (
    <motion.div key={tab} id={`${idPrefix}-panel`} role="tabpanel" aria-labelledby={`${idPrefix}-tab-${tab}`} variants={PANEL} initial="initial" animate="enter">
      {children}
    </motion.div>
  );
}
