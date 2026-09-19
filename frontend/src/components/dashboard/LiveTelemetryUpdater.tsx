"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";
import { useGridStore } from "@/store/gridStore";

/** Keeps the 3D views on the same +/-1% simulated telemetry cadence as GIS. */
export function LiveTelemetryUpdater() {
  const setGridState = useGridStore((state) => state.setGridState);
  const setPrediction = useGridStore((state) => state.setPrediction);
  useEffect(() => {
    const refresh = async () => {
      try {
        const live = await api.getLiveGrid();
        setGridState(live.grid_state);
        setPrediction(live.model_output);
      } catch { /* retain last authoritative snapshot */ }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => window.clearInterval(timer);
  }, [setGridState, setPrediction]);
  return null;
}
