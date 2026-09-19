"use client";
import { useState } from "react";
import { useGridStore } from "@/store/gridStore";
import { api } from "@/lib/api";
import { RotateCcw, Zap, Sliders, ShieldAlert, Shuffle, MapPin, Wrench, CheckCircle2 } from "lucide-react";

export function WhatIfSimulator() {
  const {
    setGridState,
    setPrediction,
    setInterventionResult,
    setDemoPhase,
    setProcessing,
    resetSimulation,
    selectedNodeId,
    selectNode,
    gridState,
    prediction,
  } = useGridStore();

  const [stress, setStress] = useState(18);
  const [loadReduction, setLoadReduction] = useState(12);
  const [expanded, setExpanded] = useState(true);
  const [decisionOpen, setDecisionOpen] = useState(false);

  const randomizeScenario = () => {
    const nodes = gridState?.nodes ?? [];
    if (!nodes.length) return;
    const target = nodes[Math.floor(Math.random() * nodes.length)];
    selectNode(target.id);
    setStress(Math.floor(Math.random() * 25) + 10);
    setLoadReduction(Math.floor(Math.random() * 12) + 8);
  };

  const runStress = async () => {
    setProcessing(true, "simulation");
    try {
      setProcessing(true, "gnn");
      const targetNode = selectedNodeId || "T17";
      const res = await api.simulate(
        {
          demand_stress_pct: stress,
          temperature_delta_c: Math.round(stress * 0.2),
          load_multiplier: 1.0 + (stress / 100) * 1.25,
          disabled_nodes: [],
        },
        targetNode
      );

      setProcessing(true, "root_cause_analysis");
      setGridState(res.gridState);
      setPrediction(res.prediction);
      setDemoPhase("cascade_visualized");
    } catch (e) {
      console.error("Simulation failed:", e);
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = async () => {
    setProcessing(true, "grid_state");
    resetSimulation();
    try {
      const state = await api.getGridState();
      setGridState(state);
      setPrediction(null);
      setInterventionResult(null);
      setStress(0);
      setDemoPhase("healthy");
    } catch (e) {
      console.error("Reset failed:", e);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="absolute bottom-4 left-4 z-10 w-[310px]">
      <div className="panel backdrop-blur-md bg-grid-bg-panel/90 border border-grid-border shadow-2xl rounded-lg overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-grid-bg-secondary/60 border-b border-grid-border hover:bg-grid-bg-elevated transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-grid-cyan" />
            <span className="text-xs font-semibold text-grid-text-primary tracking-wide">
              WHAT-IF CASCADE SIMULATOR
            </span>
          </div>
          <span className="text-[10px] font-mono text-grid-text-tertiary">
            {expanded ? "▼" : "▶"}
          </span>
        </button>

        {expanded && (
          <div className="p-3 space-y-3">
            {/* Target Asset Indicator */}
            <div className="flex items-center justify-between text-[11px] bg-grid-bg-primary/80 px-2.5 py-1.5 rounded border border-grid-border/40">
              <span className="text-grid-text-secondary">Target Asset:</span>
              <span className="font-mono font-bold text-grid-cyan">
                {selectedNodeId || "T17 (Nashik)"}
              </span>
            </div>

            {/* Demand Stress */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-grid-text-secondary flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-grid-yellow" /> Demand Stress Surge
                </span>
                <span className="font-mono text-xs text-grid-yellow font-bold">
                  +{stress}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                value={stress}
                onChange={(e) => setStress(Number(e.target.value))}
                className="w-full h-1.5 bg-grid-bg-primary rounded-full appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-grid-yellow [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>

            {/* Load Reduction */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-grid-text-secondary">
                  Intervention Load Curtailment
                </span>
                <span className="font-mono text-xs text-grid-cyan font-bold">
                  -{loadReduction}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                value={loadReduction}
                onChange={(e) => setLoadReduction(Number(e.target.value))}
                className="w-full h-1.5 bg-grid-bg-primary rounded-full appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-grid-cyan [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={runStress}
                className="py-2 rounded bg-grid-yellow/15 border border-grid-yellow/40 text-grid-yellow text-[10px] font-mono font-bold hover:bg-grid-yellow/25 transition-all flex items-center justify-center gap-1 shadow-sm"
              >
                <Zap className="w-3 h-3" />
                RUN STRESS
              </button>
              <button
                onClick={handleReset}
                className="py-2 rounded bg-grid-bg-primary border border-grid-border text-grid-text-secondary text-[10px] font-mono font-bold hover:bg-grid-bg-elevated transition-all flex items-center justify-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                RESET
              </button>
            </div>
            <button onClick={randomizeScenario} className="w-full rounded border border-grid-cyan/30 bg-grid-cyan/5 py-2 text-[10px] font-mono font-bold text-grid-cyan transition hover:bg-grid-cyan/15 active:scale-[0.98]">
              <Shuffle className="mr-1 inline h-3 w-3" /> RANDOMIZE CITY &amp; CONDITION
            </button>
            {selectedNodeId && gridState?.nodes.find((node) => node.id === selectedNodeId) && (
              <div className="rounded border border-grid-border/70 bg-grid-bg-primary/60 p-2 text-[10px] text-grid-text-secondary">
                <MapPin className="mr-1 inline h-3 w-3 text-grid-cyan" /> Nearest grid station: <span className="font-mono font-bold text-grid-text-primary">{gridState.nodes.find((node) => node.id === selectedNodeId)?.state || "mapped network node"}</span>
              </div>
            )}
            {prediction && (
              <div className={`rounded border p-2 ${prediction.cascade_risk_pct >= 40 ? "border-grid-red/40 bg-grid-red/10" : "border-grid-green/40 bg-grid-green/10"}`}>
                <div className="flex items-center justify-between"><span className="font-mono text-[10px] font-bold text-grid-text-primary">RESULT: {prediction.cascade_risk_pct >= 40 ? "CRITICAL" : "STABLE"}</span><button onClick={() => setDecisionOpen(!decisionOpen)} className="rounded border border-grid-cyan/40 px-2 py-1 text-[9px] font-mono font-bold text-grid-cyan">NEXT STEP</button></div>
                {decisionOpen && <p className="mt-2 text-[10px] leading-relaxed text-grid-text-secondary">{prediction.cascade_risk_pct >= 40 ? <><Wrench className="mr-1 inline h-3 w-3 text-grid-red" />Repair / curtail the selected asset before continuing operation.</> : <><CheckCircle2 className="mr-1 inline h-3 w-3 text-grid-green" />Keep operating with enhanced monitoring and reassess on the next telemetry refresh.</>}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
