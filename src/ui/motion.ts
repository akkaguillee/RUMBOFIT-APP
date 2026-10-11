import type { Transition, Variants } from 'motion/react';

export const spring = {
  soft: { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 } satisfies Transition,
  snappy: { type: 'spring', stiffness: 520, damping: 38 } satisfies Transition,
  bouncy: { type: 'spring', stiffness: 380, damping: 22 } satisfies Transition,
  sheet: { type: 'spring', stiffness: 420, damping: 40, mass: 0.9 } satisfies Transition,
};

export const ease = {
  out: [0.22, 1, 0.36, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
};

/**
 * Page choreography: children rise in a cascade with a slight "settle"
 * (they overshoot a few pixels upward and land), which gives a liquid feel
 * without zooms or blurs. The container itself never fades in: an ancestor
 * with opacity < 1 would stop the glass cards from blurring the background
 * until the animation ends.
 */
export const pageVariants: Variants = {
  initial: {},
  enter: {
    transition: { staggerChildren: 0.055, delayChildren: 0.02 },
  },
  exit: { opacity: 0, transition: { duration: 0.14, ease: ease.inOut } },
};

export const riseVariants: Variants = {
  initial: { opacity: 0, y: 18 },
  enter: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 28, mass: 0.8 } },
  exit: { opacity: 0, y: 0 },
};

/**
 * For wrappers that contain glass surfaces: they only slide; the surfaces
 * fade themselves in CSS (.rise-group) so their backdrop blur never pauses.
 */
export const liftVariants: Variants = {
  initial: { y: 18 },
  enter: { y: 0, transition: { type: 'spring', stiffness: 300, damping: 28, mass: 0.8 } },
  exit: {},
};

export const staggerContainer = (stagger = 0.05, delay = 0): Variants => ({
  initial: {},
  enter: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

export const popVariants: Variants = {
  initial: { opacity: 0, scale: 0.6 },
  enter: { opacity: 1, scale: 1, transition: spring.bouncy },
  exit: { opacity: 0, scale: 0.8, transition: { duration: 0.12 } },
};
