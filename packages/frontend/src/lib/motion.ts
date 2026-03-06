"use client";

import type { Variants, Transition } from "framer-motion";

/* ── Shared spring configs ── */
export const springDefault: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 24,
};

export const springGentle: Transition = {
  type: "spring",
  stiffness: 180,
  damping: 20,
};

export const springSnappy: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
};

/* ── Page enter animation ── */
export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { ...springGentle, staggerChildren: 0.06 },
  },
};

/* ── Stagger container / item ── */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springDefault,
  },
};

/* ── Card hover (use with whileHover) ── */
export const cardHover = {
  y: -2,
  transition: springSnappy,
};

/* ── Scale press (use with whileTap) ── */
export const tapScale = { scale: 0.97 };

/* ── Fade in from bottom (for dialogs, modals) ── */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: springDefault },
  exit: { opacity: 0, y: 10, transition: { duration: 0.15 } },
};
