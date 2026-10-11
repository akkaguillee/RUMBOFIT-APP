import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { spring } from './motion';

interface Props {
  icon: ReactNode;
  title: string;
  text: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon, title, text, action }: Props) {
  return (
    <div className="empty">
      <motion.div
        className="empty__art"
        initial={{ y: 8, opacity: 0, rotate: -6 }}
        animate={{ y: 0, opacity: 1, rotate: 0 }}
        transition={spring.bouncy}
        aria-hidden="true"
      >
        {icon}
      </motion.div>
      <h3 className="empty__title">{title}</h3>
      <p className="empty__text">{text}</p>
      {action}
    </div>
  );
}
