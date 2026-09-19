"use client";

/**
 * Route transition veil.
 *
 * Panels of the same charcoal plaster as the page sweep up to cover the
 * outgoing route, the new route renders behind them, then the panels keep
 * travelling up to uncover it. One continuous upward motion, not a cover
 * followed by an unrelated uncover.
 *
 * ── Why it is built this way ────────────────────────────────────────────────
 *
 * The obvious implementation intercepts link clicks, calls preventDefault(),
 * animates, then router.push()es. That breaks two things: Next's <Link> never
 * gets its click, and — worse — neither does any component's own onClick, so
 * things like the navbar mega-menu would stop closing on navigate.
 *
 * So this listener never calls preventDefault(). Next navigates exactly as it
 * normally would, and the veil plays *concurrently*. The new route renders
 * while the screen is covered, which is why the veil doubles as a loading
 * screen for the heavy routes (/dashboard mounts a three.js scene).
 *
 * The listener runs in the CAPTURE phase so the veil starts on the same frame
 * as the click, before React's delegated handler at the root has run.
 *
 * A navigation that never completes is the one failure mode a cover transition
 * cannot recover from on its own, so VEIL_TIMEOUT_MS always lifts it.
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DUR, EASE, VEIL_TIMEOUT_MS, routeLabel } from "./tokens";

/** Event name for raising the veil from code rather than from a link click. */
const VEIL_EVENT = "gs:route-veil";

/**
 * Raise the route veil for a navigation that does not go through a link.
 *
 * Most navigation is an <a>, which the veil picks up automatically. A couple
 * of places call router.push() instead — the post-login redirect and the
 * "View in Live GIS" button — and those would otherwise jump with no
 * transition at all. Call this immediately before the push.
 */
export function startRouteVeil(pathname: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(VEIL_EVENT, { detail: { pathname } }));
}

const PANELS = 5;
const PANEL_STAGGER = 0.025;

/** Time until the last panel has finished closing — the veil must hold at least
 *  this long or the incoming page flashes through a gap. The small pad absorbs
 *  the frame or two between React committing the veil and the first animation
 *  tick actually running. */
const COVER_COMPLETE_MS = (DUR.cover + (PANELS - 1) * PANEL_STAGGER) * 1000 + 70;
const REVEAL_COMPLETE_MS = (DUR.reveal + (PANELS - 1) * PANEL_STAGGER) * 1000 + 70;
/** Longest the veil will wait for a heavy route to finish painting. */
const SETTLE_CAP_MS = 1800;

/**
 * Resolves once the incoming route has actually painted and the main thread
 * has gone quiet.
 *
 * A pathname change only means the route *committed* — not that it finished
 * painting. /dashboard mounts a three.js scene and /map-explorer builds a
 * Leaflet map; both commit early and then block the main thread for hundreds
 * of milliseconds. Lifting the veil on the pathname alone drops the user onto
 * a half-built page.
 *
 * Two animation frames let React commit and the browser paint. Then
 * requestIdleCallback waits for the main thread to be free, which is exactly
 * "the new page has stopped doing work". Idleness is the right signal rather
 * than frame timing: frame rate is throttled in background tabs and on weak
 * hardware, so a frame-duration heuristic reports "busy" on pages that are
 * simply idle and over-holds the veil.
 *
 * `cap` bounds the wait, so a route that never goes idle — a looping
 * animation, a polling spinner — still gets uncovered.
 */
function whenSettled(onSettled: () => void, cap: number): () => void {
  type IdleWindow = Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  const w = window as IdleWindow;

  let done = false;
  let rafA = 0;
  let rafB = 0;
  let idleHandle = 0;

  const finish = () => {
    if (done) return;
    done = true;
    window.clearTimeout(hardCap);
    onSettled();
  };

  // Absolute bound, independent of whether idle ever arrives.
  const hardCap = window.setTimeout(finish, cap);

  rafA = requestAnimationFrame(() => {
    rafB = requestAnimationFrame(() => {
      if (typeof w.requestIdleCallback === "function") {
        idleHandle = w.requestIdleCallback(finish, { timeout: cap });
      } else {
        // Safari without requestIdleCallback: the two frames above already
        // guarantee a paint, so settle shortly after.
        idleHandle = window.setTimeout(finish, 250);
      }
    });
  });

  return () => {
    done = true;
    cancelAnimationFrame(rafA);
    cancelAnimationFrame(rafB);
    window.clearTimeout(hardCap);
    if (typeof w.cancelIdleCallback === "function") w.cancelIdleCallback(idleHandle);
    else window.clearTimeout(idleHandle);
  };
}

type Phase = "idle" | "cover" | "reveal";

export function RouteVeil() {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  const [phase, setPhase] = useState<Phase>("idle");
  const [label, setLabel] = useState("GridSense");

  const targetRef = useRef<string | null>(null);
  const coverStartRef = useRef(0);
  const timers = useRef<number[]>([]);
  const cancelSettleRef = useRef<(() => void) | null>(null);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    cancelSettleRef.current?.();
    cancelSettleRef.current = null;
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const begin = useCallback(
    (pathname_: string) => {
      clearTimers();
      targetRef.current = pathname_;
      coverStartRef.current = performance.now();
      setLabel(routeLabel(pathname_));
      setPhase("cover");

      // Backstop: lift the veil even if the route never arrives, and take it
      // all the way back to idle so a stalled navigation cannot strand it.
      later(() => {
        targetRef.current = null;
        setPhase((p) => (p === "cover" ? "reveal" : p));
        later(() => setPhase("idle"), REVEAL_COMPLETE_MS);
      }, VEIL_TIMEOUT_MS);
    },
    [clearTimers, later],
  );

  // ── Start the veil on any same-origin link click ──────────────────────────
  useEffect(() => {
    if (reduce) return;

    const onClick = (event: MouseEvent) => {
      // Modified clicks open a new tab — the current page stays put, so a veil
      // over it would be wrong.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const anchor = (event.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      // Opt-out hatch for links that must not veil (e.g. in-page anchors).
      if (anchor.dataset.noVeil !== undefined) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Same page, or a pure hash jump: nothing is replaced, so nothing to veil.
      if (url.pathname === window.location.pathname) return;

      begin(url.pathname);
    };

    const onProgrammatic = (event: Event) => {
      const detail = (event as CustomEvent<{ pathname?: string }>).detail;
      if (detail?.pathname && detail.pathname !== window.location.pathname) begin(detail.pathname);
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener(VEIL_EVENT, onProgrammatic);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(VEIL_EVENT, onProgrammatic);
    };
  }, [reduce, begin]);

  // The panels only begin moving once React has committed them, which is a
  // frame or two after the click. Timing the hold from the click instead would
  // flip to "reveal" while the cover was still closing.
  useEffect(() => {
    if (phase === "cover") coverStartRef.current = performance.now();
  }, [phase]);

  // ── Lift the veil once the new route is actually on screen ────────────────
  //
  // Both phase changes are driven by timers rather than by onAnimationComplete.
  // The callback approach looked simpler but was wrong: when the reveal begins
  // while the cover tween is still settling, the cover's completion callback
  // fires *after* the phase has already flipped, so it read the new phase and
  // sent the veil straight to idle — the panels snapped away instead of
  // sliding up, and the reveal never played at all.
  useEffect(() => {
    if (phase !== "cover") return;
    if (targetRef.current === null || pathname !== targetRef.current) return;

    targetRef.current = null;
    const elapsed = performance.now() - coverStartRef.current;
    const hold = Math.max(0, COVER_COMPLETE_MS - elapsed);

    // The backstop is no longer needed: the route arrived, so from here the
    // settle detector owns the timing.
    clearTimers();
    later(() => {
      cancelSettleRef.current = whenSettled(() => {
        setPhase("reveal");
        later(() => setPhase("idle"), REVEAL_COMPLETE_MS);
      }, SETTLE_CAP_MS);
    }, hold);
  }, [pathname, phase, clearTimers, later]);

  useEffect(() => clearTimers, [clearTimers]);

  if (reduce) return null;

  const covering = phase === "cover";

  return (
    <AnimatePresence>
      {phase !== "idle" && (
        <div className="gs-veil" aria-hidden="true">
          <div className="gs-veil-panels">
            {Array.from({ length: PANELS }).map((_, i) => (
              <motion.div
                key={i}
                className="gs-veil-panel"
                initial={{ y: "100%" }}
                animate={{ y: covering ? "0%" : "-100%" }}
                transition={{
                  duration: covering ? DUR.cover : DUR.reveal,
                  ease: covering ? EASE.inOut : EASE.in,
                  // Closing deals left-to-right; opening peels from the far
                  // side, so the two halves do not look like one loop.
                  delay: (covering ? i : PANELS - 1 - i) * PANEL_STAGGER,
                }}
              />
            ))}
          </div>

          <motion.div
            className="gs-veil-caption"
            initial={{ opacity: 0, y: 10 }}
            animate={covering ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
            transition={{
              duration: covering ? DUR.fast : DUR.micro,
              ease: EASE.out,
              delay: covering ? DUR.cover * 0.55 : 0,
            }}
          >
            <img src="/gridsense-mark.svg" alt="" className="gs-veil-mark" />
            <span className="gs-veil-label">{label}</span>
            {/* Indeterminate on purpose. The hold is as long as the incoming
                route needs, so a bar that filled once and stopped would read
                as stalled on exactly the heavy pages where it matters most. */}
            <span className="gs-veil-bar">
              <motion.i
                initial={{ x: "-110%" }}
                animate={covering ? { x: ["-110%", "230%"] } : { opacity: 0 }}
                transition={
                  covering
                    ? { duration: 1.15, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.12 }
                    : { duration: DUR.micro }
                }
              />
            </span>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
