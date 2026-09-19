"use client";
import { useGridStore } from "@/store/gridStore";
import { api } from "@/lib/api";
import {
  Brain,
  Crosshair,
  HelpCircle,
  Route,
  Wrench,
  Check,
  ArrowDown,
  Target,
  Zap,
  AlertOctagon,
  ChevronRight,
  ShieldCheck,
  Activity
} from "lucide-react";

export function IntelligencePanel() {
  const {
    gridState,
    prediction,
    demoPhase,
    setDemoPhase,
    setGridState,
    setPrediction,
    setInterventionResult,
    interventionResult,
    setProcessing,
    selectNode
  } = useGridStore();

  const rootCause = prediction?.root_cause_ranking[0];
  const isMitigated = demoPhase === "mitigated";
  const hasStress = demoPhase !== "healthy" && Boolean(prediction);

  const handleIntervention = async () => {
    if (!rootCause) return;
    setProcessing(true, "intervention");
    try {
      const targetId = rootCause.node_id;
      const res = await api.intervene(targetId, 12);
      setInterventionResult(res);

      // Re-fetch updated healthy/mitigated grid state
      const updatedGrid = await api.getGridState();
      // Apply mitigated status
      if (res.new_node_risk) {
        updatedGrid.nodes.forEach((n) => {
          const r = res.new_node_risk[n.id] ?? 0.05;
          n.risk_score = r;
          n.status = r > 0.4 ? "warning" : "healthy";
          n.is_root_cause = false;
        });
      }
      setGridState(updatedGrid);

      // Update prediction object to reflect mitigated state
      if (prediction) {
        setPrediction({
          ...prediction,
          cascade_risk_pct: res.new_cascade_risk_pct,
          cascade_path: res.new_cascade_path || [],
        });
      }

      setDemoPhase("mitigated");
    } catch (e) {
      console.error("Intervention request failed:", e);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="w-[360px] bg-grid-bg-secondary border-l border-grid-border flex flex-col overflow-y-auto shrink-0 z-20 shadow-xl">
      <div className="p-3 space-y-2.5">
        {/* Header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-grid-purple" />
            <span className="text-xs font-semibold text-grid-text-primary tracking-wide">
              AI INTELLIGENCE CORE
            </span>
          </div>
          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-grid-cyan/15 text-grid-cyan border border-grid-cyan/30">
            ONLINE (GAT v2)
          </span>
        </div>

        {/* Normal / Baseline State */}
        {!hasStress && (
          <div className="panel p-4 text-center space-y-2 border border-grid-border/60">
            <div className="w-8 h-8 rounded-full bg-grid-green/10 border border-grid-green/30 flex items-center justify-center mx-auto text-grid-green">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="text-xs font-semibold text-grid-text-primary">
              GRID IN SECURE OPERATING STATE
            </div>
            <div className="text-[11px] text-grid-text-secondary">
              All 28 national substations & transformers within N-0 thermal limits.
              Use the <span className="text-grid-cyan font-semibold">What-If Simulator</span> or select an asset to run cascade stress testing.
            </div>
          </div>
        )}

        {/* AI Prediction */}
        {hasStress && rootCause && (
          <div className="panel p-3 glow-border-cyan border border-grid-cyan/40">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-3.5 h-3.5 text-grid-purple" />
              <span className="label text-[10px] text-grid-purple font-bold">GNN INFERENCE RESULT</span>
            </div>
            <div className="bg-grid-bg-primary rounded-lg p-2.5 mb-2 border border-grid-border/40">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-lg font-bold text-grid-red">{rootCause.node_id}</span>
                <span className="text-[9px] font-mono text-grid-text-secondary uppercase px-1.5 py-0.5 bg-grid-bg-secondary rounded">
                  {rootCause.type || "TRANSFORMER"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="label mb-0.5 text-[9px]">FAILURE PROBABILITY</div>
                  <div className="font-mono text-base font-bold text-grid-red">
                    {Math.round(rootCause.root_cause_score * 100)}%
                  </div>
                </div>
                <div>
                  <div className="label mb-0.5 text-[9px]">TIME-TO-CRITICAL</div>
                  <div className="font-mono text-base font-bold text-grid-yellow">
                    ~{prediction?.prediction_window_hours || 24}h
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="label text-[10px]">SPLIT-CONFORMAL (90% CI)</span>
              <span className="font-mono text-xs text-grid-purple font-bold">
                {prediction?.confidence_interval.lower}–{prediction?.confidence_interval.upper}%
              </span>
            </div>
            <div className="mt-1 h-1.5 bg-grid-bg-primary rounded-full overflow-hidden relative border border-grid-border/30">
              <div
                className="absolute h-full bg-grid-purple/70 rounded-full"
                style={{
                  left: `${prediction?.confidence_interval.lower || 0}%`,
                  width: `${(prediction?.confidence_interval.upper ?? 100) - (prediction?.confidence_interval.lower ?? 0)}%`
                }}
              />
            </div>
          </div>
        )}

        {/* Root Cause */}
        {hasStress && rootCause && (
          <div className="panel p-3 border border-grid-red/30">
            <div className="flex items-center gap-2 mb-2">
              <Crosshair className="w-3.5 h-3.5 text-grid-red" />
              <span className="label text-[10px] text-grid-red font-bold">ROOT CAUSE ISOLATION</span>
            </div>
            <button
              onClick={() => selectNode(rootCause.node_id)}
              className="w-full bg-grid-red/10 border border-grid-red/40 rounded-lg p-2.5 mb-2 text-left hover:bg-grid-red/20 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <AlertOctagon className="w-4 h-4 text-grid-red" />
                  <span className="font-mono text-base font-bold text-grid-red">{rootCause.node_id}</span>
                </div>
                <span className="px-1.5 py-0.5 bg-grid-red/25 border border-grid-red/40 rounded text-[9px] font-mono text-grid-red font-bold">
                  TRUE ROOT
                </span>
              </div>
              <div className="text-[10px] text-grid-text-secondary leading-tight mt-1">
                {rootCause.failure_mode}
              </div>
              <div className="mt-2 flex items-center justify-between pt-1 border-t border-grid-red/20">
                <span className="label text-[9px]">ORIGIN CONFIDENCE</span>
                <span className="font-mono text-sm font-semibold text-grid-red">
                  {Math.round(rootCause.root_cause_score * 100)}%
                </span>
              </div>
            </button>
          </div>
        )}

        {/* Why Explanation */}
        {hasStress && rootCause && prediction?.feature_contributions?.[rootCause.node_id] && (
          <div className="panel p-3">
            <div className="flex items-center gap-2 mb-2">
              <HelpCircle className="w-3.5 h-3.5 text-grid-cyan" />
              <span className="label text-[10px] text-grid-cyan font-bold">WHY {rootCause.node_id}? (XAI)</span>
            </div>
            <div className="space-y-1.5">
              {prediction.feature_contributions?.[rootCause.node_id]?.map((c, idx) => {
                const shades = ["#00E5FF", "#00B8CC", "#008899", "#006677", "#004455"];
                return (
                  <div key={c.feature}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-grid-text-secondary">{c.feature}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono text-grid-text-tertiary">{c.value}</span>
                        <span className="text-[10px] font-mono font-bold text-grid-cyan">
                          +{c.contribution_pct}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1 bg-grid-bg-primary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(100, c.contribution_pct * 2.5)}%`,
                          backgroundColor: shades[idx % shades.length]
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cascade Path */}
        {hasStress && prediction && Array.isArray(prediction.cascade_path) && prediction.cascade_path.length > 0 && (
          <div className="panel p-3">
            <div className="flex items-center gap-2 mb-2">
              <Route className="w-3.5 h-3.5 text-grid-red" />
              <span className="label text-[10px] text-grid-red font-bold">PREDICTED CASCADE PROPAGATION</span>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {prediction.cascade_path.map((step, idx) => (
                <div key={step.node_id} className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => selectNode(step.node_id)}
                    className={`px-2 py-1 rounded border text-center min-w-[44px] transition-colors cursor-pointer ${
                      idx === 0
                        ? "bg-grid-red/15 border-grid-red/40 text-grid-red font-bold"
                        : "bg-grid-yellow/10 border-grid-yellow/30 text-grid-yellow"
                    }`}
                  >
                    <div className="font-mono text-[10px]">{step.node_id}</div>
                    <div className="text-[8px] font-mono opacity-75">+{step.time_offset_hours}h</div>
                  </button>
                  {idx < prediction.cascade_path.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-grid-yellow shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Action */}
        {hasStress && rootCause && (
          <div className="panel p-3 border border-grid-cyan/30">
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="w-3.5 h-3.5 text-grid-cyan" />
              <span className="label text-[10px] text-grid-cyan font-bold">COUNTERFACTUAL INTERVENTION</span>
            </div>
            {!isMitigated ? (
              <>
                <div className="bg-grid-bg-primary rounded p-2.5 mb-2 text-[10px] text-grid-text-secondary border border-grid-border/40">
                  <div className="mb-1">
                    → Curtail <span className="font-mono text-grid-cyan font-bold">{rootCause.node_id}</span> loading by <span className="font-mono text-grid-cyan font-bold">12%</span>
                  </div>
                  <div>
                    → Redistribute surplus load to <span className="font-mono text-grid-cyan">T14</span> / <span className="font-mono text-grid-cyan">T19</span> tie-lines
                  </div>
                </div>
                <button
                  onClick={handleIntervention}
                  className="w-full py-2 rounded bg-grid-cyan/15 border border-grid-cyan/50 text-grid-cyan text-xs font-mono font-semibold hover:bg-grid-cyan/25 transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                >
                  <Zap className="w-3.5 h-3.5" />
                  EXECUTE COUNTERFACTUAL INTERVENTION
                </button>
              </>
            ) : (
              <div className="bg-grid-green/10 border border-grid-green/30 rounded p-2.5">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-4 h-4 text-grid-green" />
                  <span className="text-xs font-semibold text-grid-green">CASCADE RISK ELIMINATED</span>
                </div>
                {interventionResult && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-grid-red/10 rounded p-1.5 text-center border border-grid-red/20">
                      <div className="text-[8px] text-grid-text-tertiary">BEFORE</div>
                      <div className="font-mono text-base font-bold text-grid-red">
                        {interventionResult.original_cascade_risk_pct}%
                      </div>
                    </div>
                    <div className="bg-grid-green/10 rounded p-1.5 text-center border border-grid-green/20">
                      <div className="text-[8px] text-grid-text-tertiary">AFTER</div>
                      <div className="font-mono text-base font-bold text-grid-green">
                        {interventionResult.new_cascade_risk_pct}%
                      </div>
                    </div>
                  </div>
                )}
                <div className="mt-2 flex items-center justify-center gap-1 text-grid-green">
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span className="font-mono text-xs font-bold">
                    -{interventionResult?.risk_reduction_pct}% risk reduction
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
