import type { Variants } from 'motion/react';

/**
 * Each question rises with its screen in onboarding; in a Perfil sheet there
 * is no parent cascade, so it simply renders.
 */
export const questionVariants: Variants = {
  initial: { opacity: 0, y: 12 },
  enter: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 340, damping: 32 } },
};
