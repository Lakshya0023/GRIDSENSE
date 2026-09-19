"use client";

import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { useEffect } from "react";

export function FluidCursor() {
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const scale = useMotionValue(0);
  const cursorX = useSpring(x, { stiffness: 420, damping: 30, mass: 0.28 });
  const cursorY = useSpring(y, { stiffness: 420, damping: 30, mass: 0.28 });
  const cursorScale = useSpring(scale, { stiffness: 360, damping: 24, mass: 0.3 });

  useEffect(() => {
    if (reduceMotion || !window.matchMedia("(pointer: fine)").matches) return;

    document.body.classList.add("gs-fluid-cursor-active");
    const updateCursor = (event: PointerEvent) => {
      x.set(event.clientX);
      y.set(event.clientY);
      scale.set(1);
      const target = event.target instanceof Element ? event.target : null;
      scale.set(target?.closest("a, button, input, textarea, select") ? 1.55 : 1);
    };
    const hideCursor = () => scale.set(0);

    window.addEventListener("pointermove", updateCursor, { passive: true });
    document.addEventListener("pointerleave", hideCursor);
    return () => {
      document.body.classList.remove("gs-fluid-cursor-active");
      window.removeEventListener("pointermove", updateCursor);
      document.removeEventListener("pointerleave", hideCursor);
    };
  }, [reduceMotion, scale, x, y]);

  if (reduceMotion) return null;

  return (
    <motion.div
      aria-hidden="true"
      className="gs-fluid-cursor"
      style={{ x: cursorX, y: cursorY, scale: cursorScale }}
    >
      <span>GS</span>
    </motion.div>
  );
}
