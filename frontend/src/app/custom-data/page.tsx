"use client";

import { ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, LoaderCircle, MapPinned, Network, ShieldAlert, TableProperties } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { api } from "@/lib/api";
import { saveCustomGrid } from "@/lib/customGrid";
import { useGridStore } from "@/store/gridStore";
import type { GridState } from "@/lib/types";
import { startRouteVeil } from "@/components/motion/RouteVeil";

type DatasetSummary = { filename: string; row_count: number; edge_count: number; column_mapping: Record<string, string | null>; note: string };

export default function CustomDataPage() {
  const router = useRouter();
  const setGridState = useGridStore((state) => state.setGridState);
  const [summary, setSummary] = useState<DatasetSummary | null>(null);
  const [grid, setGrid] = useState<GridState | null>(null);
  const [risk, setRisk] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(null); setRisk(null);
    try {
      const uploaded = await api.uploadCustomDataset(file);
      const mapReadyGrid = saveCustomGrid(uploaded.grid_state);
      setGrid(mapReadyGrid); setGridState(mapReadyGrid); setSummary(uploaded.summary);
    } catch (err) {
      setGrid(null); setSummary(null);
      setError(err instanceof Error ? err.message : "The dataset could not be uploaded.");
    } finally { setBusy(false); }
  }

  async function analyze() {
    if (!grid) return;
    setBusy(true); setError(null);
    try { setRisk((await api.predict(grid)).cascade_risk_pct); }
    catch (err) { setError(err instanceof Error ? err.message : "Analysis failed."); }
    finally { setBusy(false); }
  }

  return <><Navbar />
    <main className="min-h-screen bg-gs-gray-50 pt-24 pb-14">
      <div className="container-official max-w-5xl">
        <div className="mb-9">
          <p className="text-sm font-semibold uppercase tracking-widest text-gs-blue-600">Bring your own telemetry</p>
          <h1 className="mt-2 text-3xl font-bold text-gs-gray-900">Analyze a custom grid dataset</h1>
          <p className="mt-3 max-w-3xl text-gs-gray-600">Upload operational readings from your grid. GridSense maps voltage, load, temperature and capacity fields to a model-ready network, then lets you run a risk assessment.</p>
        </div>

        <section className="rounded-xl border border-gs-gray-200 bg-white p-6 shadow-sm">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gs-blue-200 bg-gs-blue-50 px-6 py-10 text-center hover:border-gs-blue-400">
            <FileUp className="mb-3 h-9 w-9 text-gs-blue-600" />
            <span className="font-semibold text-gs-gray-900">Choose a CSV dataset</span>
            <span className="mt-1 text-sm text-gs-gray-600">CSV only, up to 5 MB and 5,000 rows</span>
            <input className="sr-only" type="file" accept=".csv,text/csv" onChange={upload} />
          </label>
          <div className="mt-5 grid gap-4 text-sm text-gs-gray-600 md:grid-cols-2">
            <div><strong className="text-gs-gray-900">Required:</strong> <code>load_pct</code> (or <code>load</code>) and <code>voltage_pu</code> (or <code>voltage_kv</code>).</div>
            <div><strong className="text-gs-gray-900">Map placement:</strong> include <code>lat</code> and <code>lon</code> for the correct geographic position. <code>id</code>, <code>temperature_c</code>, <code>capacity_mva</code>, <code>type</code>, and region are optional.</div>
          </div>
        </section>

        {busy && <div className="mt-6 flex items-center gap-2 text-sm text-gs-blue-700"><LoaderCircle className="h-4 w-4 animate-spin" /> Processing your dataset…</div>}
        {error && <div className="mt-6 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><ShieldAlert className="h-5 w-5 shrink-0" />{error}</div>}

        {summary && grid && <section className="mt-7 rounded-xl border border-gs-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><h2 className="text-xl font-bold text-gs-gray-900">{summary.filename}</h2><p className="mt-1 text-sm text-gs-gray-600">{summary.note}</p></div>
            <div className="flex gap-2"><button onClick={analyze} disabled={busy} className="rounded-md bg-gs-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gs-blue-700 disabled:opacity-50">Run risk analysis</button><button onClick={() => { startRouteVeil("/map-explorer"); router.push("/map-explorer?source=custom"); }} className="inline-flex items-center gap-1.5 rounded-md border border-gs-blue-600 px-4 py-2 text-sm font-semibold text-gs-blue-700 hover:bg-gs-blue-50"><MapPinned className="h-4 w-4" />View in Live GIS</button></div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Metric icon={<TableProperties className="h-5 w-5" />} label="Assets" value={summary.row_count} />
            <Metric icon={<Network className="h-5 w-5" />} label="Generated links" value={summary.edge_count} />
            <Metric icon={<ShieldAlert className="h-5 w-5" />} label="Cascade risk" value={risk === null ? "Ready" : `${risk}%`} />
          </div>
          <h3 className="mt-7 text-sm font-semibold text-gs-gray-900">Detected column mapping</h3>
          <div className="mt-3 flex flex-wrap gap-2">{Object.entries(summary.column_mapping).filter(([, value]) => value).map(([field, value]) => <span key={field} className="rounded bg-gs-gray-100 px-2 py-1 font-mono text-xs text-gs-gray-700">{field} ← {value}</span>)}</div>
          <div className="mt-6 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-gs-gray-500"><tr><th className="pb-2">Asset</th><th className="pb-2">Load</th><th className="pb-2">Voltage</th><th className="pb-2">Temperature</th></tr></thead><tbody>{grid.nodes.slice(0, 8).map(node => <tr key={node.id} className="border-b border-gs-gray-100 text-gs-gray-800"><td className="py-2 font-medium">{node.id}</td><td>{node.features.load_pct}%</td><td>{node.features.voltage_pu} pu</td><td>{node.features.temperature_c} °C</td></tr>)}</tbody></table></div>
        </section>}
      </div>
    </main>
  </>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return <div className="rounded-lg bg-gs-gray-50 p-4"><div className="flex items-center gap-2 text-gs-blue-600">{icon}<span className="text-xs font-semibold uppercase tracking-wide text-gs-gray-500">{label}</span></div><div className="mt-2 text-2xl font-bold text-gs-gray-900">{value}</div></div>;
}
