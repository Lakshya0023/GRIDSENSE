"use client";

/**
 * Magnetic pointer attraction.
 *
 * The element leans toward the cursor while it is nearby and springs back when
 * it leaves. Used on the two primary calls to action only — a page where every
 * control chases the pointer feels unstable rather than responsive.
 *
 * Deliberately scoped to `pointer: fine`: on a touch screen there is no hover
 * position to lean toward, and on a coarse pointer the offset would only make
 * the target harder to hit.
 */

import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { useRef, type ReactNode } from "react";

export function Magnetic({
  children,
  strength = 0.32,
  className,
}: {
  children: ReactNode;
  /** Fraction of the cursor's offset from centre that the element follows. */
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 220, damping: 18, mass: 0.6 });
  const springY = useSpring(y, { stiffness: 220, damping: 18, mass: 0.6 });

  if (reduce) return <span className={className}>{children}</span>;

  const handleMove = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (event.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    x.set((event.clientX - (rect.left + rect.width / 2)) * strength);
    y.set((event.clientY - (rect.top + rect.height / 2)) * strength);
  };

  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.span
      ref={ref}
      className={className}
      style={{ x: springX, y: springY, display: "inline-flex" }}
      onPointerMove={handleMove}
      onPointerLeave={reset}
      // A pointer that leaves via a click-through or a route change never fires
      // pointerleave, so the element would stay stuck off-centre.
      onPointerCancel={reset}
    >
      {children}
    </motion.span>
  );
}
