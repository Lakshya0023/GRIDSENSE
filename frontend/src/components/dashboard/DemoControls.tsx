"use client";
import { useGridStore } from "@/store/gridStore";
import { DEMO_SCENARIOS } from "@/lib/mockData";
import type { DemoPhase } from "@/lib/types";
import { ChevronRight, ChevronLeft, RotateCcw, Play } from "lucide-react";

const PHASES: { key: DemoPhase; label: string }[] = [
  { key: "healthy", label: "1. Healthy" },
  { key: "stress_applied", label: "2. Stress" },
  { key: "predicting", label: "3. Predict" },
  { key: "root_cause_found", label: "4. Root Cause" },
  { key: "cascade_visualized", label: "5. Cascade" },
  { key: "mitigated", label: "6. Mitigated" },
];

export function DemoControls() {
  const { demoPhase, setDemoPhase, setGridState, setPrediction, setInterventionResult, resetSimulation } = useGridStore();
  const currentIdx = PHASES.findIndex((p) => p.key === demoPhase);

  const goTo = (phase: DemoPhase) => {
    const data = DEMO_SCENARIOS[phase as keyof typeof DEMO_SCENARIOS]();
    setGridState(data.gridState);
    setPrediction(data.prediction);
    if ("intervention" in data) setInterventionResult((data as any).intervention);
    setDemoPhase(phase);
  };

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-grid-bg-panel/95 backdrop-blur-md border border-grid-cyan/20 rounded-xl px-4 py-2 flex items-center gap-2 shadow-panel">
        <Play className="w-3.5 h-3.5 text-grid-cyan" />
        <span className="text-2xs font-mono text-grid-cyan mr-2">DEMO MODE</span>
        <button onClick={() => currentIdx > 0 && goTo(PHASES[currentIdx - 1].key)} disabled={currentIdx <= 0} className="p-1 rounded hover:bg-grid-bg-elevated disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
        {PHASES.map((p, idx) => (
          <button key={p.key} onClick={() => goTo(p.key)} className={`px-2 py-1 rounded text-2xs font-mono font-semibold ${idx === currentIdx ? "bg-grid-cyan/20 text-grid-cyan border border-grid-cyan" : "bg-grid-bg-primary text-grid-text-tertiary"}`}>{p.label}</button>
        ))}
        <button onClick={() => currentIdx < PHASES.length - 1 && goTo(PHASES[currentIdx + 1].key)} disabled={currentIdx >= PHASES.length - 1} className="p-1 rounded hover:bg-grid-bg-elevated disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
        <button onClick={() => { resetSimulation(); goTo("healthy"); }} className="p-1 rounded hover:bg-grid-bg-elevated"><RotateCcw className="w-3.5 h-3.5 text-grid-text-tertiary" /></button>
      </div>
    </div>
  );
}
