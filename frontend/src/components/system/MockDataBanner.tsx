"use client";

import { useState, useSyncExternalStore } from "react";
import { AlertTriangle, X } from "lucide-react";
import {
  getDataSourceServerSnapshot,
  getDataSourceSnapshot,
  subscribeToDataSource,
} from "@/lib/dataSource";

/**
 * Visible, non-intrusive warning shown whenever the API client has fallen back
 * to the bundled mock scenarios because the backend could not be reached.
 *
 * Previously this condition was only a console.warn, which meant a dead backend
 * looked identical to a healthy one on screen.
 */
export function MockDataBanner() {
  const state = useSyncExternalStore(
    subscribeToDataSource,
    getDataSourceSnapshot,
    getDataSourceServerSnapshot
  );

  // Remember which outage the user dismissed rather than a plain boolean, so a
  // fresh failure re-surfaces the banner without needing an effect to reset it.
  const [dismissedSince, setDismissedSince] = useState<number | null>(null);

  if (!state.degraded) return null;
  if (dismissedSince !== null && dismissedSince === state.since) return null;

  const count = state.endpoints.length;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-3 pointer-events-none"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="pointer-events-auto flex w-full max-w-2xl items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-950/95 px-4 py-3 shadow-[0_10px_40px_rgba(0,0,0,.45)] backdrop-blur-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-100">
            Backend unreachable — displaying mock demo data
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-200/80">
            {count === 1
              ? `${state.endpoints[0]} did not respond.`
              : `${count} endpoints did not respond: ${state.endpoints.join(", ")}.`}{" "}
            Figures on screen are bundled demo scenarios, not live model output. Start the
            API with{" "}
            <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[11px] text-amber-100">
              python -m uvicorn backend.main:app --port 8000
            </code>
            .
          </p>
        </div>

        <button
          type="button"
          onClick={() => setDismissedSince(state.since)}
          aria-label="Dismiss mock data warning"
          className="shrink-0 rounded p-1 text-amber-300/70 transition-colors hover:bg-amber-900/60 hover:text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
