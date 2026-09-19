"use client";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AlertOctagon, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const ALERTS = [
  { level: "critical", asset: "Transformer T17", risk: "91%", window: "~6 hours", cause: "Thermal overload", desc: "Predicted failure due to sustained thermal overload combined with load growth and voltage sag." },
  { level: "high", asset: "Substation S4", risk: "62%", window: "~5 hours", cause: "Downstream of T17", desc: "Related to cascade path T17 → F8 → T21 → S4. Elevated risk from upstream propagation." },
  { level: "warning", asset: "Feeder F8", risk: "72%", window: "~1.5 hours", cause: "Overload transfer", desc: "Increased loading due to redistribution from upstream transformer T17." },
  { level: "resolved", asset: "Substation S3", risk: "18%", window: "Resolved", cause: "Load rebalanced", desc: "Intervention applied. Load successfully redistributed to T14 and T19." },
];

const CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string; }> = {
  critical: { icon: <AlertOctagon className="w-5 h-5" />, color: "red", label: "Critical" },
  high: { icon: <AlertTriangle className="w-5 h-5" />, color: "amber", label: "High Risk" },
  warning: { icon: <Info className="w-5 h-5" />, color: "yellow", label: "Warning" },
  resolved: { icon: <CheckCircle2 className="w-5 h-5" />, color: "green", label: "Resolved" },
};

export default function AlertsPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen bg-gs-gray-50">
        <section className="bg-white border-b border-gs-gray-200">
          <div className="container-official py-10">
            <div className="flex items-center gap-2 text-xs text-gs-gray-500 mb-3">
              <Link href="/" className="hover:text-gs-blue-600">Home</Link>
              <span>/</span>
              <span>Alerts</span>
            </div>
            <h1 className="text-4xl font-bold text-gs-gray-900 text-institutional">Grid Alerts</h1>
            <p className="text-gs-gray-600 mt-2">Active predictions and system risk notifications.</p>
          </div>
        </section>

        <div className="container-official py-10 space-y-3">
          {ALERTS.map((a, i) => (
            <AlertRow key={i} alert={a} />
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}

function AlertRow({ alert }: { alert: any }) {
  const cfg = CONFIG[alert.level];
  const colorMap: Record<string, string> = {
    red: "text-red-600 bg-red-50 border-red-200",
    amber: "text-amber-600 bg-amber-50 border-amber-200",
    yellow: "text-yellow-700 bg-yellow-50 border-yellow-200",
    green: "text-green-600 bg-green-50 border-green-200",
  };
  return (
    <div className="bg-white rounded-lg border border-gs-gray-200 p-5 hover:border-gs-blue-300 transition-colors">
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${colorMap[cfg.color]}`}>
          {cfg.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest rounded border ${colorMap[cfg.color]}`}>
              {cfg.label}
            </span>
            <span className="text-xs text-gs-gray-500 font-mono">{alert.window}</span>
          </div>
          <h3 className="font-semibold text-gs-gray-900 mb-1">{alert.asset}</h3>
          <p className="text-sm text-gs-gray-600 mb-3">{alert.desc}</p>
          <div className="flex items-center gap-6 text-xs">
            <div>
              <span className="text-gs-gray-500">Risk: </span>
              <span className="font-mono font-bold text-gs-gray-900">{alert.risk}</span>
            </div>
            <div>
              <span className="text-gs-gray-500">Cause: </span>
              <span className="font-medium text-gs-gray-900">{alert.cause}</span>
            </div>
          </div>
        </div>
        <Link href="/map-explorer" className="shrink-0 text-xs font-medium text-gs-blue-600 hover:underline">
          View on Map →
        </Link>
      </div>
    </div>
  );
}