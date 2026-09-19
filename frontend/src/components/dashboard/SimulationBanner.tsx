"use client";
import { AlertTriangle } from "lucide-react";

export function SimulationBanner() {
  return (
    <div className="h-6 bg-grid-yellow/5 border-b border-grid-yellow/20 flex items-center justify-center gap-2 shrink-0">
      <AlertTriangle className="w-3 h-3 text-grid-yellow" />
      <span className="text-2xs font-mono text-grid-yellow tracking-wider">
        SIMULATION MODE — NO LIVE GRID ACTIONS
      </span>
    </div>
  );
}
