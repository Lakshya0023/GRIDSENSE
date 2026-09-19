"use client";

import type { PlantHistoryPoint } from "@/lib/plantTelemetry";

/**
 * Native SVG trend chart: temperature, vibration, and health score.
 * Zero-dependency, lightweight, and resilient.
 */
export function SensorTrendChart({ history }: { history: PlantHistoryPoint[] }) {
  if (!history || history.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900/40 px-6 text-center">
        <p className="text-sm text-slate-400">
          Waiting for plant telemetry. Start the simulator with{" "}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-slate-200">
            python scripts/data_publisher.py
          </code>
        </p>
      </div>
    );
  }

  const width = 600;
  const height = 220;
  const padding = { top: 20, right: 35, bottom: 30, left: 45 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Compute scales
  const maxVal = Math.max(100, ...history.map((p) => Math.max(p.temperature || 0, (p.vibration || 0) * 10, p.health || 0)));
  const n = history.length;

  const getX = (index: number) => padding.left + (n > 1 ? (index / (n - 1)) * chartW : chartW / 2);
  const getY = (val: number) => padding.top + chartH - (val / maxVal) * chartH;

  const tempPath = history.map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(p.temperature).toFixed(1)}`).join(" ");
  const vibPath = history.map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(p.vibration * 10).toFixed(1)}`).join(" ");
  const healthPath = history.map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(p.health).toFixed(1)}`).join(" ");

  return (
    <div className="flex flex-col h-64 justify-between bg-slate-950/60 p-3 rounded-lg border border-slate-800">
      {/* Legend */}
      <div className="flex items-center gap-5 text-xs text-slate-400 px-2">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Temp (°C)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Vibration (mm/s ×10)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Health Score (%)
        </span>
      </div>

      {/* SVG Chart */}
      <div className="flex-1 w-full relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#2E2E2E" strokeDasharray="3 3" />
                <text x={padding.left - 6} y={y + 3} textAnchor="end" fill="#A8A8A6" fontSize="9" fontFamily="monospace">
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Series Lines */}
          <path d={tempPath} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
          <path d={vibPath} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
          <path d={healthPath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />

          {/* Points */}
          {history.map((p, i) => (
            <g key={i}>
              <circle cx={getX(i)} cy={getY(p.temperature)} r="2.5" fill="#ef4444" />
              <circle cx={getX(i)} cy={getY(p.vibration * 10)} r="2.5" fill="#f59e0b" />
              <circle cx={getX(i)} cy={getY(p.health)} r="2.5" fill="#10b981" />
            </g>
          ))}
        </svg>
      </div>

      {/* X Labels */}
      <div className="flex justify-between text-[10px] font-mono text-slate-500 px-8">
        <span>{history[0]?.label || ""}</span>
        {history.length > 2 && <span>{history[Math.floor(history.length / 2)]?.label || ""}</span>}
        <span>{history[history.length - 1]?.label || ""}</span>
      </div>
    </div>
  );
}
