"use client";

/**
 * Scroll position readout.
 *
 * A cyan hairline across the top of the viewport, scaled by scroll progress.
 * It uses the accent for the same reason everything else does: it reports a
 * live value. The spring stops it from twitching on trackpads, which emit many
 * small scroll deltas per second.
 */

import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const reduce = useReducedMotion();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 26, restDelta: 0.001 });

  // The bar is decorative — the page already reports position through its own
  // scrollbar — so it is simply dropped when motion is not wanted.
  if (reduce) return null;

  return <motion.div className="gs-scroll-progress" style={{ scaleX }} aria-hidden="true" />;
}
