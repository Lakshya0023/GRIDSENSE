"use client";
import { useEffect, useState } from "react";

const INTRO_KEY = "gridsense_intro_seen";

export type IntroState = "initializing" | "playing" | "completed" | "skipped";

export function useIntroVideo() {
  const [state, setState] = useState<IntroState>("initializing");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    try {
      const seen = localStorage.getItem(INTRO_KEY);
      if (seen === "true") {
        setState("skipped");
      } else {
        setState("playing");
      }
    } catch {
      setState("playing");
    }
  }, []);

  const markCompleted = () => {
    try {
      localStorage.setItem(INTRO_KEY, "true");
    } catch {
      /* ignore */
    }
    setState("completed");
  };

  const reset = () => {
    try {
      localStorage.removeItem(INTRO_KEY);
    } catch {
      /* ignore */
    }
    setState("playing");
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__gridsense_reset_intro = reset;
    }
  }, []);

  return {
    state,
    hydrated,
    isVideoPlaying: state === "playing",
    shouldShowHero: state === "completed" || state === "skipped",
    markCompleted,
    reset,
  };
}