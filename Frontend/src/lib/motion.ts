/**
 * lib/motion.ts — Single source of truth for all animation tokens.
 * Import these instead of inlining transition props in components.
 * Respects prefers-reduced-motion: when reduced, everything collapses
 * to opacity-only, near-instant transitions.
 */

/** Check if the user prefers reduced motion */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Signature ease curve — "ease-out-expo" feel */
export const EASE = [0.16, 1, 0.3, 1] as const;

export const DURATION = {
  fast: 0.15,
  base: 0.2,
  slow: 0.35,
  page: 0.4,
} as const;

/** Fade + slight upward slide for cards/sections */
export const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: DURATION.base, ease: EASE },
};

/** Reduced-motion safe version: opacity only */
export const fadeUpReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.01 },
};

/** Returns the correct fadeUp variant based on reduced-motion preference */
export function getFadeUp() {
  return prefersReducedMotion() ? fadeUpReduced : fadeUp;
}

/** Card hover lift + press */
export const cardHover = {
  whileHover: { y: -3, transition: { duration: DURATION.fast, ease: EASE } },
  whileTap: { y: -1, scale: 0.995 },
};

/** Reduced: no y movement */
export const cardHoverReduced = {
  whileHover: {},
  whileTap: { scale: 0.998 },
};

export function getCardHover() {
  return prefersReducedMotion() ? cardHoverReduced : cardHover;
}

/** Stagger container — wraps lists of cards */
export const staggerContainer = (stagger = 0.06) => ({
  initial: {},
  animate: { transition: { staggerChildren: stagger, delayChildren: 0.05 } },
});

/** Page-level transition */
export const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.page, ease: EASE } },
  exit: { opacity: 0, y: -4, transition: { duration: DURATION.base, ease: EASE } },
};

export const pageVariantsReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.01 } },
  exit: { opacity: 0, transition: { duration: 0.01 } },
};

export function getPageVariants() {
  return prefersReducedMotion() ? pageVariantsReduced : pageVariants;
}

/** Button press — tactile scale-down */
export const buttonTap = {
  whileTap: { scale: 0.97, transition: { duration: 0.12, ease: EASE } },
};

/** Scroll-reveal: fires once when element enters viewport */
export const scrollReveal = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.slow, ease: EASE },
  },
};

export const scrollRevealReduced = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.01 } },
};

export function getScrollReveal() {
  return prefersReducedMotion() ? scrollRevealReduced : scrollReveal;
}
