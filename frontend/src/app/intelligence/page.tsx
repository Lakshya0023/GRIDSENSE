"use client";
import { useEffect, useState } from "react";
import { useGridStore } from "@/store/gridStore";
import { DEMO_SCENARIOS } from "@/lib/mockData";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Brain, Target, GitBranch, TrendingUp, ShieldCheck, AlertOctagon } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatIst } from "@/lib/time";

export default function IntelligencePage() {
  const { prediction, gridState, setGridState, setPrediction } = useGridStore();
  const [source, setSource] = useState<"live" | "baseline">("baseline");
  const [updatedAt, setUpdatedAt] = useState("");

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const live = await api.getLiveGrid();
        if (!mounted) return;
        setGridState(live.grid_state);
        setPrediction(live.model_output);
        setSource("live");
        setUpdatedAt(`${formatIst(live.last_updated)} IST`);
      } catch {
        const scenario = DEMO_SCENARIOS.cascade_visualized();
        if (!mounted) return;
        setGridState(scenario.gridState);
        setPrediction(scenario.prediction);
        setSource("baseline");
        setUpdatedAt(`${formatIst()} IST`);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [setGridState, setPrediction]);

  const nodeRisks = prediction
    ? Object.entries(prediction.node_risk).sort((a, b) => b[1] - a[1]).slice(0, 10)
    : [];
  const criticalAssets = nodeRisks.filter(([, risk]) => risk >= 0.7).length;
  const confidence = prediction?.confidence_interval;
  const confidenceLabel = confidence ? `${confidence.lower}-${confidence.upper}%` : "Syncing";

  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen bg-gs-gray-50">
        {/* Page Header */}
        <section className="bg-white border-b border-gs-gray-200">
          <div className="container-official py-10">
            <div className="flex items-center gap-2 text-xs text-gs-gray-500 mb-3">
              <Link href="/" className="hover:text-gs-blue-600">Home</Link>
              <span>/</span>
              <span>Intelligence</span>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-4xl font-bold text-gs-gray-900 text-institutional">Grid Intelligence</h1><p className="text-gs-gray-600 mt-2">AI predictions, root cause analysis, and cascade forecasting.</p></div><span className={`rounded-full border px-3 py-1 font-mono text-[10px] font-bold ${source === "live" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-400" : "border-amber-400/40 bg-amber-400/10 text-amber-400"}`}>{source === "live" ? "LIVE MODEL STREAM" : "LOCAL BASELINE"} · {updatedAt || "SYNCING"}</span></div>
          </div>
        </section>

        <div className="container-official py-10 space-y-6">
          {/* Summary Cards */}
          <div className="grid md:grid-cols-4 gap-4">
            <SummaryCard icon={<Brain className="w-5 h-5" />} color="blue" label="Active Predictions" value={prediction?.root_cause_ranking.length ?? 0} />
            <SummaryCard icon={<AlertOctagon className="w-5 h-5" />} color="red" label="Critical Assets" value={criticalAssets} />
            <SummaryCard icon={<GitBranch className="w-5 h-5" />} color="amber" label="Cascade Risk" value={`${prediction?.cascade_risk_pct ?? 0}%`} />
            <SummaryCard icon={<ShieldCheck className="w-5 h-5" />} color="green" label="Model Confidence" value={confidenceLabel} />
          </div>

          {/* Predictions Table */}
          <div className="bg-white rounded-lg border border-gs-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gs-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gs-gray-900">Top Predicted Risks</h2>
                <p className="text-sm text-gs-gray-500">Assets ranked by AI-predicted failure probability</p>
              </div>
              <Link href="/map-explorer" className="text-xs text-gs-blue-600 font-medium hover:underline">
                View on Map →
              </Link>
            </div>
            <table className="w-full">
              <thead className="bg-gs-gray-50 border-b border-gs-gray-200">
                <tr className="text-left text-xs uppercase tracking-widest text-gs-gray-500">
                  <th className="px-6 py-3 font-semibold">Asset</th>
                  <th className="px-6 py-3 font-semibold">Type</th>
                  <th className="px-6 py-3 font-semibold">Risk Score</th>
                  <th className="px-6 py-3 font-semibold">Level</th>
                  <th className="px-6 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {nodeRisks.map(([id, risk]) => {
                  const level = risk > 0.7 ? "Critical" : risk > 0.4 ? "High" : risk > 0.2 ? "Warning" : "Healthy";
                  const badgeClass = risk > 0.7 ? "bg-red-100 text-red-700 border-red-200" :
                                     risk > 0.4 ? "bg-amber-100 text-amber-700 border-amber-200" :
                                     risk > 0.2 ? "bg-yellow-100 text-yellow-700 border-yellow-200" :
                                     "bg-green-100 text-green-700 border-green-200";
                  return (
                    <tr key={id} className="border-b border-gs-gray-100 hover:bg-gs-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-mono font-bold text-gs-gray-900">{id}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gs-gray-600">{gridState?.nodes.find((node) => node.id === id)?.type || "Grid asset"}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-32 h-1.5 bg-gs-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gs-blue-500 rounded-full" style={{ width: `${risk * 100}%` }} />
                          </div>
                          <span className="font-mono text-sm font-semibold text-gs-gray-900">{Math.round(risk * 100)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-medium ${badgeClass}`}>
                          {level}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/map-explorer?asset=${encodeURIComponent(id)}`} className="text-xs text-gs-blue-600 hover:underline">Locate →</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Root Cause Details */}
          {prediction && prediction.root_cause_ranking.length > 0 && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border border-gs-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-red-500" />
                  <h3 className="font-semibold text-gs-gray-900">Root Cause Attribution</h3>
                </div>
                <div className="space-y-3">
                  {prediction.root_cause_ranking.map((rc) => (
                    <div key={rc.node_id} className="p-4 bg-gs-gray-50 rounded-md border border-gs-gray-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-gs-gray-900">{rc.node_id}</span>
                        <span className="text-sm font-semibold text-red-600">{Math.round(rc.root_cause_score * 100)}%</span>
                      </div>
                      <div className="text-xs text-gs-gray-600">{rc.failure_mode}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gs-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <GitBranch className="w-5 h-5 text-amber-500" />
                  <h3 className="font-semibold text-gs-gray-900">Cascade Path Forecast</h3>
                </div>
                <div className="space-y-2">
                  {prediction.cascade_path.map((step, i) => (
                    <div key={step.node_id} className="flex items-center gap-3 p-3 bg-gs-gray-50 rounded-md border border-gs-gray-200">
                      <div className="w-7 h-7 rounded-full bg-gs-navy-900 text-white text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-mono font-semibold text-gs-gray-900 text-sm">{step.node_id}</div>
                        <div className="text-xs text-gs-gray-500">{step.failure_mode}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-mono text-gs-gray-600">+{step.time_offset_hours}h</div>
                        <div className="text-xs font-semibold text-red-600">{Math.round(step.risk_at_step * 100)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function SummaryCard({ icon, color, label, value }: { icon: React.ReactNode; color: string; label: string; value: string | number }) {
  const colorMap: Record<string, string> = {
    blue: "text-gs-blue-600 bg-gs-blue-50",
    red: "text-red-600 bg-red-50",
    amber: "text-amber-600 bg-amber-50",
    green: "text-green-600 bg-green-50",
  };
  return (
    <div className="bg-white rounded-lg border border-gs-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-widest text-gs-gray-500 font-semibold">{label}</span>
        <div className={`w-9 h-9 rounded-md flex items-center justify-center ${colorMap[color]}`}>{icon}</div>
      </div>
      <div className="text-2xl font-bold text-gs-gray-900 tabular-nums">{value}</div>
    </div>
  );
}
