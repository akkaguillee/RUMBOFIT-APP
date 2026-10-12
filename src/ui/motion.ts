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

/** Short, critically damped spring for content entering a screen (~300 ms). */
const riseSpring = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 } satisfies Transition;

/**
 * Page choreography: the old screen lifts away in 120 ms, then the new
 * one's blocks rise in a tight cascade. The whole change reads in about a
 * third of a second and taps keep working throughout. The container itself
 * never fades in: an ancestor with opacity < 1 would stop the glass cards
 * from blurring the background until the animation ends.
 */
export const pageVariants: Variants = {
  initial: {},
  enter: {
    transition: { staggerChildren: 0.04, delayChildren: 0.01 },
  },
  exit: { opacity: 0, y: -6, transition: { duration: 0.12, ease: ease.inOut } },
};

export const riseVariants: Variants = {
  initial: { opacity: 0, y: 14 },
  enter: { opacity: 1, y: 0, transition: riseSpring },
  exit: { opacity: 0, y: 0 },
};

/**
 * For wrappers that contain glass surfaces: they only slide; the surfaces
 * fade themselves in CSS (.rise-group) so their backdrop blur never pauses.
 */
export const liftVariants: Variants = {
  initial: { y: 14 },
  enter: { y: 0, transition: riseSpring },
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
