"use client";
import { useGridStore } from "@/store/gridStore";
import { X, Activity, Gauge, Thermometer, Package } from "lucide-react";

export function NodeDetailPanel() {
  const selectedNodeId = useGridStore((s) => s.selectedNodeId);
  const gridState = useGridStore((s) => s.gridState);
  const selectNode = useGridStore((s) => s.selectNode);

  const node = gridState?.nodes.find((n) => n.id === selectedNodeId);
  if (!node) return null;

  return (
    <div className="absolute right-[340px] top-0 bottom-0 w-[280px] bg-grid-bg-secondary border-l border-grid-border z-20 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-mono text-xl font-bold text-grid-text-primary">{node.id}</div>
          <div className="text-xs text-grid-text-secondary uppercase">{node.type}</div>
        </div>
        <button onClick={() => selectNode(null)} className="p-1 rounded hover:bg-grid-bg-elevated"><X className="w-4 h-4" /></button>
      </div>
      <div className="space-y-3">
        <div className="bg-grid-bg-primary p-2.5 rounded">
          <div className="label mb-1">LOAD</div>
          <div className="font-mono text-sm text-grid-cyan">{node.features.load_pct}%</div>
        </div>
        <div className="bg-grid-bg-primary p-2.5 rounded">
          <div className="label mb-1">VOLTAGE</div>
          <div className="font-mono text-sm text-grid-cyan">{node.features.voltage_pu} pu</div>
        </div>
        <div className="bg-grid-bg-primary p-2.5 rounded">
          <div className="label mb-1">TEMP</div>
          <div className="font-mono text-sm text-grid-yellow">{node.features.temperature_c}°C</div>
        </div>
        <div className="bg-grid-bg-primary p-2.5 rounded">
          <div className="label mb-1">CAPACITY</div>
          <div className="font-mono text-sm text-grid-cyan">{node.features.capacity_mva} MVA</div>
        </div>
      </div>
    </div>
  );
}
