/**
 * The motion vocabulary for the whole product.
 *
 * Everything that animates — the route veil, scroll reveals, button feedback —
 * imports its timing from here, so the interface moves with one rhythm instead
 * of a dozen hand-tuned durations that drift apart. This is the motion
 * equivalent of the colour tokens in globals.css.
 *
 * The three curves encode intent, not taste:
 *   out   — decelerate. Things ARRIVING. Fast start, long settle.
 *   in    — accelerate. Things LEAVING. Slow start, quick exit.
 *   inOut — symmetric. Things TRAVELLING across the screen.
 */

/** Cubic-bezier control points, typed as a mutable 4-tuple because that is what
 *  framer-motion's easing definition accepts (a readonly tuple is not). */
type Bezier = [number, number, number, number];

export const EASE: Record<"out" | "in" | "inOut" | "spring", Bezier> = {
  out: [0.16, 1, 0.3, 1],
  in: [0.7, 0, 0.84, 0],
  inOut: [0.76, 0, 0.24, 1],
  // Slight overshoot, for elements that should feel physical (button press).
  spring: [0.34, 1.56, 0.64, 1],
};

export const DUR = {
  /** Button press / hover feedback. Must be imperceptible as "animation". */
  micro: 0.18,
  fast: 0.34,
  base: 0.58,
  slow: 0.9,
  /** Route veil closing over the outgoing page. */
  cover: 0.38,
  /** Route veil lifting off the incoming page. */
  reveal: 0.46,
} as const;

/** Per-child delay in a staggered group. */
export const STAGGER = 0.07;

/**
 * How far an element travels on a scroll reveal. Kept small on purpose: long
 * travel reads as "the page is broken" rather than "this arrived".
 */
export const RISE = 26;

/**
 * Viewport trigger for scroll reveals. The negative bottom margin means an
 * element starts animating once it is ~14% into the viewport rather than the
 * instant its first pixel appears, so the motion happens where the eye is.
 */
export const VIEWPORT = { once: true, margin: "0px 0px -14% 0px" } as const;

/**
 * The route veil will lift after this long even if the new route never reports
 * a pathname change. Without it, a failed or cancelled navigation would leave
 * the screen covered forever — the one failure mode of a cover transition that
 * users cannot recover from.
 */
export const VEIL_TIMEOUT_MS = 2600;

/**
 * Human labels for the veil caption. Falls back to the de-slugged pathname, so
 * a new route still gets a sensible caption without being registered here.
 */
const ROUTE_LABELS: Record<string, string> = {
  "/": "Home",
  "/map-explorer": "Map Explorer",
  "/dashboard": "Operational Dashboard",
  "/intelligence": "AI Intelligence",
  "/analytics": "Analytics",
  "/operations": "Operations Command",
  "/alerts": "Grid Alerts",
  "/documentation": "Resources",
  "/about": "About",
  "/admin": "Admin Portal",
  "/login": "Operator Login",
  "/custom-data": "Custom Data",
  "/all-in-one": "Unified View",
};

export function routeLabel(pathname: string): string {
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];
  const slug = pathname.split("/").filter(Boolean).pop();
  if (!slug) return "GridSense";
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
