"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, BellRing, CheckCircle2, ClipboardList, FileDown, MapPinned, Radio, Search, ShieldCheck, Siren, Users, Wrench } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { api, type AlertWorkflowState, type LiveTransformer, type PersistedAlert, type ScenarioSummary } from "@/lib/api";
import { formatIst } from "@/lib/time";
import { PlantMaintenancePanel } from "@/components/maintenance/PlantMaintenancePanel";

export default function OperationsPage() {
  const [assets, setAssets] = useState<LiveTransformer[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [alerts, setAlerts] = useState<PersistedAlert[]>([]);
  const [query, setQuery] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [telemetry, scenarioData, alertData] = await Promise.all([api.getLiveTransformers(12), api.getScenarios(8), api.syncAlerts()]);
      setAssets(telemetry.transformers); setScenarios(scenarioData); setUpdatedAt(`${formatIst(telemetry.timestamp)} IST`);
      setAlerts(alertData.alerts);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Live feed could not be reached."); }
    finally { setLoading(false); }
  };
  useEffect(() => { const initial = window.setTimeout(() => void refresh(), 0); const id = window.setInterval(() => void refresh(), 2000); return () => { window.clearTimeout(initial); window.clearInterval(id); }; }, []);
  const visibleAssets = useMemo(() => assets.filter((asset) => `${asset.asset_id} ${asset.city} ${asset.state}`.toLowerCase().includes(query.toLowerCase())), [assets, query]);
  const transition = async (assetId: string, workflowState: AlertWorkflowState) => {
    try { const updated = await api.transitionAlert(assetId, workflowState); setAlerts((items) => items.map((item) => item.asset_id === assetId ? updated : item)); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Alert update failed."); }
  };
  const exportBrief = () => {
    const content = ["GridSense operational brief", `Generated: ${formatIst()} IST`, "", ...alerts.map((a) => `${a.workflow_state} | ${a.asset_id} | ${a.telemetry.city}, ${a.telemetry.state} | risk ${a.telemetry.risk_pct}% | ${a.telemetry.status}`)].join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type: "text/plain" })); link.download = "gridsense-operational-brief.txt"; link.click(); URL.revokeObjectURL(link.href);
  };
  const critical = alerts.filter((alert) => ["CRITICAL", "BLACKOUT RISK"].includes(alert.telemetry.status)).length;

  return <><Navbar /><main className="min-h-screen bg-gs-gray-50 pt-24 pb-14"><div className="container-official">
    <div className="flex flex-wrap items-start justify-between gap-5 mb-8"><div><p className="text-xs font-bold tracking-[.2em] text-gs-blue-600">OPERATIONS COMMAND CENTER</p><h1 className="mt-2 text-4xl font-bold text-gs-gray-900">Act before disruption.</h1><p className="mt-2 max-w-3xl text-gs-gray-600">Live operational view, alert workflow, scenario planning and asset-health decisions in one workspace.</p></div><div className="flex gap-2"><button onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-md border border-gs-gray-300 bg-white px-4 py-2 text-sm font-semibold"><Radio className="h-4 w-4 text-gs-blue-600" />{loading ? "Refreshing…" : "Refresh feed"}</button><button onClick={exportBrief} className="inline-flex items-center gap-2 rounded-md bg-gs-blue-600 px-4 py-2 text-sm font-semibold text-white"><FileDown className="h-4 w-4" />Export brief</button></div></div>
    <div className="mb-5 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><Siren className="h-4 w-4 shrink-0" />Telemetry and recommendations are simulated demonstration data. Human approval is required before operational action.</div>
    {notice && <div className="mb-5 rounded-md bg-red-50 p-3 text-sm text-red-700">{notice}</div>}
    <div className="grid gap-4 md:grid-cols-4 mb-7"><Metric icon={<Siren />} label="Critical assets" value={critical} tone="red" /><Metric icon={<BellRing />} label="Open alerts" value={alerts.filter((a) => a.workflow_state !== "Resolved").length} tone="amber" /><Metric icon={<Activity />} label="Monitored assets" value={assets.length} tone="blue" /><Metric icon={<ShieldCheck />} label="Secure coverage" value="90% CI" tone="green" /></div>
    <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
      <section className="rounded-xl border border-gs-gray-200 bg-white overflow-hidden shadow-[0_18px_45px_rgba(0,0,0,.35)]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-gs-gray-200 p-5"><div><h2 className="font-bold text-gs-gray-900">Live asset queue</h2><p className="text-sm text-gs-gray-500">Updated {updatedAt || "—"}; auto-refreshes every 2 seconds.</p></div><label className="flex items-center gap-2 rounded border border-gs-gray-300 px-3 py-2 text-sm"><Search className="h-4 w-4 text-gs-gray-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="City or asset" className="w-36 outline-none" /></label></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gs-gray-50 text-xs uppercase tracking-wide text-gs-gray-500"><tr><th className="p-4">Asset</th><th className="p-4">Condition</th><th className="p-4">Risk</th><th className="p-4">Workflow</th></tr></thead><tbody>{visibleAssets.map((asset) => { const alert = alerts.find((item) => item.asset_id === asset.asset_id); const mapHref = `/map-explorer?asset=${encodeURIComponent(asset.asset_id)}&city=${encodeURIComponent(asset.city)}&state=${encodeURIComponent(asset.state)}`; return <tr key={asset.asset_id} className="border-t border-gs-gray-100 transition-colors hover:bg-gs-blue-50/40"><td className="p-4"><Link href={mapHref} className="font-mono font-bold text-gs-gray-900 hover:text-gs-cyan-400">{asset.asset_id}</Link><p className="text-xs text-gs-gray-500">{asset.city}, {asset.state} · {asset.voltage_kv} kV</p><Link href={mapHref} className="mt-1 inline-flex text-[11px] font-semibold text-gs-blue-600 hover:underline">Locate nearest grid station →</Link></td><td className="p-4"><p>{asset.load_pct}% load · {asset.temperature_c}°C</p><p className="text-xs text-gs-gray-500">{asset.voltage_pu} pu</p></td><td className="p-4"><Risk risk={asset.risk_pct} status={asset.status} /></td><td className="p-4">{alert ? <div className="flex flex-wrap gap-1"><span className="rounded bg-gs-gray-100 px-2 py-1 text-xs font-semibold">{alert.workflow_state}</span>{alert.workflow_state === "New" && <button onClick={() => void transition(asset.asset_id, "Acknowledged")} className="text-xs text-gs-blue-600">Acknowledge</button>}{alert.workflow_state === "Acknowledged" && <button onClick={() => void transition(asset.asset_id, "Assigned")} className="text-xs text-gs-blue-600">Assign</button>}{alert.workflow_state === "Assigned" && <button onClick={() => void transition(asset.asset_id, "Resolved")} className="text-xs text-green-700">Resolve</button>}</div> : <span className="text-xs text-green-700">No active alert</span>}</td></tr>; })}</tbody></table></div></section>
      <aside className="space-y-6"><section className="rounded-xl border border-gs-gray-200 bg-white p-5"><div className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-gs-blue-600" /><h2 className="font-bold text-gs-gray-900">Scenario library</h2></div><div className="mt-4 space-y-3">{scenarios.slice(0, 4).map((scenario) => <div key={scenario.id} className="rounded-lg border border-gs-gray-200 p-3"><p className="font-semibold text-sm text-gs-gray-900">{scenario.title}</p><p className="mt-1 line-clamp-2 text-xs text-gs-gray-600">{scenario.description}</p><Link href={`/dashboard?scenario=${encodeURIComponent(scenario.id)}`} className="mt-2 inline-block text-xs font-semibold text-gs-blue-600">Open in simulator →</Link></div>)}</div></section>
      <section className="rounded-xl border border-gs-gray-200 bg-white p-5"><div className="flex items-center gap-2"><Wrench className="h-5 w-5 text-gs-blue-600" /><h2 className="font-bold text-gs-gray-900">Response guardrails</h2></div><ul className="mt-3 space-y-3 text-sm text-gs-gray-600"><li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />Counterfactual plans need operator approval.</li><li className="flex gap-2"><Users className="h-4 w-4 shrink-0 text-gs-blue-600" />Assignments and notes are tracked by alert state.</li><li className="flex gap-2"><MapPinned className="h-4 w-4 shrink-0 text-gs-blue-600" />Use Map Explorer for topology context.</li></ul><Link href="/dashboard" className="mt-4 inline-flex rounded bg-gs-blue-600 px-3 py-2 text-sm font-semibold text-white">Run what-if simulation</Link></section></aside>
    </div>
    <div className="mt-6">
      <PlantMaintenancePanel />
    </div>
  </div></main></>;
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone: string }) { const colors: Record<string, string> = { red: "text-red-600 bg-red-50", amber: "text-amber-600 bg-amber-50", blue: "text-gs-blue-600 bg-gs-blue-50", green: "text-green-600 bg-green-50" }; return <div className="rounded-xl border border-gs-gray-200 bg-white p-5"><div className={`flex h-9 w-9 items-center justify-center rounded ${colors[tone]}`}>{icon}</div><p className="mt-3 text-2xl font-bold text-gs-gray-900">{value}</p><p className="text-xs uppercase tracking-wider text-gs-gray-500">{label}</p></div>; }
function Risk({ risk, status }: { risk: number; status: string }) { const color = risk >= 70 ? "text-red-700 bg-red-50" : risk >= 40 ? "text-amber-700 bg-amber-50" : "text-gs-blue-700 bg-gs-blue-50"; return <span className={`inline-flex rounded px-2 py-1 text-xs font-bold ${color}`}>{risk}% · {status}</span>; }
