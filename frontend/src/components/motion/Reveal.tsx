"use client";

/**
 * Scroll-reveal primitives.
 *
 * These exist so that "animate this in as it scrolls past" is one component
 * rather than a bespoke IntersectionObserver per section. Every reveal here is
 * one-shot (`once: true`) — content that re-animates every time it re-enters
 * the viewport makes a page feel unstable and punishes users who scroll back.
 *
 * Reduced motion is handled at the source: when the user asks for it, each
 * component renders the *settled* state with no transition at all, rather than
 * a faster animation. Nothing moves.
 *
 * NOTE ON `as`: the motion components are looked up from a static map built
 * once at module load. Calling motion.create() during render would mint a new
 * component type on every pass, and React would unmount and remount the whole
 * subtree each time — which is both slow and, for anything holding state, a bug.
 */

import { motion, useReducedMotion, useScroll, useTransform, type Variants } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { DUR, EASE, RISE, STAGGER, VIEWPORT } from "./tokens";

const TAGS = {
  div: motion.div,
  span: motion.span,
  section: motion.section,
  article: motion.article,
  header: motion.header,
  li: motion.li,
  ul: motion.ul,
  p: motion.p,
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  dl: motion.dl,
} as const;

export type RevealTag = keyof typeof TAGS;
type RevealKind = "rise" | "blur" | "wipe" | "scale" | "left" | "right";

const KINDS: Record<RevealKind, Variants> = {
  // The workhorse: lift into place while resolving out of a slight blur.
  rise: {
    hidden: { opacity: 0, y: RISE, filter: "blur(6px)" },
    visible: { opacity: 1, y: 0, filter: "blur(0px)" },
  },
  // For type that should resolve rather than travel.
  blur: {
    hidden: { opacity: 0, filter: "blur(12px)" },
    visible: { opacity: 1, filter: "blur(0px)" },
  },
  // A hard edge sweeps the element open. Reads as a readout being drawn.
  wipe: {
    hidden: { opacity: 0, clipPath: "inset(0 100% 0 0)" },
    visible: { opacity: 1, clipPath: "inset(0 0% 0 0)" },
  },
  // For cards and panels — arrives from slightly behind the page plane.
  scale: {
    hidden: { opacity: 0, scale: 0.94, y: RISE * 0.6 },
    visible: { opacity: 1, scale: 1, y: 0 },
  },
  left: {
    hidden: { opacity: 0, x: -RISE * 1.6, filter: "blur(5px)" },
    visible: { opacity: 1, x: 0, filter: "blur(0px)" },
  },
  right: {
    hidden: { opacity: 0, x: RISE * 1.6, filter: "blur(5px)" },
    visible: { opacity: 1, x: 0, filter: "blur(0px)" },
  },
};

export function Reveal({
  children,
  kind = "rise",
  delay = 0,
  duration = DUR.base,
  className,
  as = "div",
}: {
  children: ReactNode;
  kind?: RevealKind;
  delay?: number;
  duration?: number;
  className?: string;
  as?: RevealTag;
}) {
  const reduce = useReducedMotion();
  const Tag = TAGS[as];
  const Plain = as;

  if (reduce) return <Plain className={className}>{children}</Plain>;

  return (
    <Tag
      className={className}
      variants={KINDS[kind]}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      transition={{ duration, delay, ease: EASE.out }}
    >
      {children}
    </Tag>
  );
}

/**
 * Staggered group. Children should be <RevealItem>. The container itself does
 * not animate — it only schedules its children, so a grid of cards deals itself
 * out instead of appearing as one block.
 */
export function RevealGroup({
  children,
  className,
  stagger = STAGGER,
  delay = 0,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
  as?: RevealTag;
}) {
  const reduce = useReducedMotion();
  const Tag = TAGS[as];
  const Plain = as;

  if (reduce) return <Plain className={className}>{children}</Plain>;

  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
    >
      {children}
    </Tag>
  );
}

export function RevealItem({
  children,
  className,
  kind = "rise",
  duration = DUR.base,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  kind?: RevealKind;
  duration?: number;
  as?: RevealTag;
}) {
  const reduce = useReducedMotion();
  const Tag = TAGS[as];
  const Plain = as;

  if (reduce) return <Plain className={className}>{children}</Plain>;

  return (
    <Tag className={className} variants={KINDS[kind]} transition={{ duration, ease: EASE.out }}>
      {children}
    </Tag>
  );
}

/**
 * Word-by-word headline reveal. Splitting on words rather than characters keeps
 * the text selectable, and avoids the ransom-note look that per-character
 * animation gives condensed display type.
 */
export function RevealText({
  text,
  className,
  delay = 0,
  as = "h2",
}: {
  text: string;
  className?: string;
  delay?: number;
  as?: Extract<RevealTag, "h1" | "h2" | "h3" | "p" | "div" | "span">;
}) {
  const reduce = useReducedMotion();
  const Plain = as;

  if (reduce) return <Plain className={className}>{text}</Plain>;

  const words = text.split(" ");

  return (
    <Plain className={className}>
      {/* Announced once as a whole sentence. The animated spans are hidden from
          assistive tech so the heading is not read out word by word. */}
      <span className="sr-only">{text}</span>
      <motion.span
        aria-hidden="true"
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.055, delayChildren: delay } },
        }}
      >
        {words.map((word, i) => (
          // The outer span clips; the inner one slides up out of that clip, so
          // each word appears to rise from behind its own baseline.
          <span key={`${word}-${i}`} className="inline-block overflow-hidden align-bottom">
            <motion.span
              className="inline-block"
              variants={{ hidden: { y: "110%" }, visible: { y: "0%" } }}
              transition={{ duration: DUR.slow, ease: EASE.out }}
            >
              {word}
              {i < words.length - 1 ? " " : ""}
            </motion.span>
          </span>
        ))}
      </motion.span>
    </Plain>
  );
}

/**
 * Scroll-linked parallax. `distance` is how far the element drifts over the
 * whole time it is on screen — positive starts it low and lets the page catch
 * up (slower than scroll), negative runs it ahead.
 */
export function Parallax({
  children,
  distance = 60,
  className,
}: {
  children: ReactNode;
  distance?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <div ref={ref} className={className}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}
