"use client";
import { useEffect } from "react";
import { useGridStore } from "@/store/gridStore";

export function CascadeAnimation() {
  const prediction = useGridStore((s) => s.prediction);
  const demoPhase = useGridStore((s) => s.demoPhase);
  const setActiveCascadeStep = useGridStore((s) => s.setActiveCascadeStep);

  useEffect(() => {
    if (demoPhase !== "cascade_visualized" || !prediction?.cascade_path?.length) return;
    let step = 0;
    const interval = setInterval(() => {
      setActiveCascadeStep(step);
      step = (step + 1) % prediction.cascade_path.length;
    }, 1200);
    return () => clearInterval(interval);
  }, [demoPhase, prediction, setActiveCascadeStep]);

  return null;
}
