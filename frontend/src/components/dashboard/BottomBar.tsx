"use client";
import { useGridStore } from "@/store/gridStore";
import { Activity, Gauge, Thermometer, Zap } from "lucide-react";

export function BottomBar() {
  const gridState = useGridStore((s) => s.gridState);
  if (!gridState) return null;

  return (
    <div className="mx-3 mb-3">
      <div className="bg-grid-bg-panel/90 backdrop-blur-sm border border-grid-border rounded-lg px-4 py-2.5 flex items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-grid-cyan" />
          <div><div className="label">AVG LOAD</div><div className="font-mono text-sm text-grid-cyan">64.5%</div></div>
        </div>
        <div className="flex items-center gap-2">
          <Gauge className="w-3.5 h-3.5 text-grid-cyan" />
          <div><div className="label">VOLTAGE</div><div className="font-mono text-sm text-grid-cyan">0.992 pu</div></div>
        </div>
        <div className="flex items-center gap-2">
          <Thermometer className="w-3.5 h-3.5 text-grid-cyan" />
          <div><div className="label">MAX TEMP</div><div className="font-mono text-sm text-grid-yellow">65.0°C</div></div>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-grid-cyan" />
          <div><div className="label">POWER</div><div className="font-mono text-sm text-grid-cyan">{gridState.total_load_mw} MW</div></div>
        </div>
      </div>
    </div>
  );
}
