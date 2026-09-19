"use client";

import { Activity, CircuitBoard, Gauge, Radio, ShieldAlert, Thermometer, TimerReset, Zap } from "lucide-react";
import { SensorTrendChart } from "./SensorTrendChart";
import { usePlantTelemetry } from "@/hooks/usePlantTelemetry";
import { CASCADE_SEQUENCE, alertTone, type PlantFeedSource } from "@/lib/plantTelemetry";

const SOURCE_COPY: Record<PlantFeedSource, { label: string; className: string }> = {
  mqtt: { label: "Live · HiveMQ WebSocket", className: "bg-green-50 text-green-700 border-green-200" },
  api: { label: "Live · via GridSense API", className: "bg-gs-blue-50 text-gs-blue-700 border-gs-blue-200" },
  offline: { label: "No plant feed", className: "bg-gs-gray-100 text-gs-gray-600 border-gs-gray-200" },
};

const TONE_STYLES = {
  critical: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  healthy: "border-green-200 bg-green-50 text-green-700",
} as const;

/**
 * Plant-level predictive maintenance, merged in from the standalone Power Plant
 * dashboard. Shows brush degradation, remaining useful life, the Azure-pattern
 * anomaly verdict, and the plant cascade narrative.
 */
export function PlantMaintenancePanel() {
  const feed = usePlantTelemetry();
  const { latest, prediction } = feed;

  const rul = prediction?.rul_hours ?? latest.rul_hours ?? null;
  const health = prediction?.health?.health_score ?? latest.health_score ?? null;
  const alertLevel = prediction?.alert_level ?? "HEALTHY";
  const tone = alertTone(alertLevel);
  const cascade = prediction?.cascade ?? null;

  // The simulator names the current stage; map it onto the physical sequence so
  // progress is positional, not just a label.
  const phase = latest.phase ?? null;
  const stageIndex = phase
    ? CASCADE_SEQUENCE.findIndex((step) => step.toLowerCase().startsWith(String(phase).toLowerCase().slice(0, 5)))
    : -1;

  const source = SOURCE_COPY[feed.source];

  return (
    <section className="rounded-xl border border-gs-gray-200 bg-white shadow-[0_18px_45px_rgba(0,0,0,.35)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gs-gray-200 p-5">
        <div>
          <div className="flex items-center gap-2">
            <CircuitBoard className="h-5 w-5 text-gs-blue-600" />
            <h2 className="font-bold text-gs-gray-900">Plant asset health — generator brush</h2>
          </div>
          <p className="mt-1 text-sm text-gs-gray-500">
            NASA-pattern RUL, Azure-pattern anomaly detection and plant cascade risk.
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${source.className}`}>
          <Radio className="h-3.5 w-3.5" />
          {source.label}
          {feed.messageCount > 0 && <span className="opacity-70">· {feed.messageCount} msgs</span>}
        </span>
      </header>

      <div className="p-5">
        {feed.source === "offline" && (
          <div className="mb-5 rounded-md border border-gs-gray-200 bg-gs-gray-50 px-4 py-3 text-sm text-gs-gray-600">
            No plant telemetry yet. Publish some with{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">python scripts/data_publisher.py</code>
            {feed.error && <span className="ml-1 text-gs-gray-500">({feed.error})</span>}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            icon={<TimerReset className="h-4 w-4" />}
            label="Remaining useful life"
            value={rul !== null ? `${rul} h` : "—"}
            hint={alertLevel}
            tone={tone}
          />
          <Stat
            icon={<Gauge className="h-4 w-4" />}
            label="Health score"
            value={health !== null ? `${health}%` : "—"}
            hint={prediction?.health?.is_anomaly ? "Anomaly detected" : "Within normal range"}
            tone={prediction?.health?.is_anomaly ? "warning" : "healthy"}
          />
          <Stat
            icon={<Thermometer className="h-4 w-4" />}
            label="Brush temperature"
            value={latest.temperature !== undefined ? `${Number(latest.temperature).toFixed(1)} °C` : "—"}
            hint={latest.vibration !== undefined ? `Vibration ${Number(latest.vibration).toFixed(2)} mm/s` : "—"}
            tone="healthy"
          />
          <Stat
            icon={<Zap className="h-4 w-4" />}
            label="Grid fault class"
            value={cascade?.fault_type ?? "—"}
            hint={cascade ? `Blackout risk ${(cascade.blackout_proba * 100).toFixed(1)}%` : "Awaiting model output"}
            tone={cascade?.blackout_risk ? "critical" : "healthy"}
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-gs-blue-600" />
              <h3 className="text-sm font-bold text-gs-gray-900">Degradation trend</h3>
              <span className="text-xs text-gs-gray-500">last {feed.history.length} readings</span>
            </div>
            <SensorTrendChart history={feed.history} />
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-gs-blue-600" />
              <h3 className="text-sm font-bold text-gs-gray-900">Cascade propagation</h3>
            </div>
            <ol className="space-y-1.5">
              {CASCADE_SEQUENCE.map((step, index) => {
                const reached = stageIndex >= 0 && index <= stageIndex;
                const current = index === stageIndex;
                return (
                  <li
                    key={step}
                    className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors ${
                      current
                        ? "border-red-300 bg-red-50 font-semibold text-red-700"
                        : reached
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-gs-gray-200 bg-white text-gs-gray-500"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        reached ? "bg-red-600 text-white" : "bg-gs-gray-200 text-gs-gray-600"
                      }`}
                    >
                      {index + 1}
                    </span>
                    {step}
                  </li>
                );
              })}
            </ol>

            {cascade && (
              <div className={`mt-4 rounded-md border px-3 py-3 text-sm ${TONE_STYLES[cascade.blackout_risk ? "critical" : "healthy"]}`}>
                <p className="font-semibold">{cascade.recommended_action}</p>
                <p className="mt-1 text-xs opacity-80">
                  {cascade.sections_affected} section(s) affected · est. {cascade.estimated_mw_loss} MW at risk
                </p>
              </div>
            )}
          </div>
        </div>

        <p className="mt-5 text-xs text-gs-gray-500">
          Plant telemetry is a simulated sensor feed published to the public HiveMQ broker. Model
          output is advisory; maintenance actions require operator approval.
        </p>
      </div>
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: keyof typeof TONE_STYLES;
}) {
  return (
    <div className="rounded-lg border border-gs-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 text-gs-gray-500">
        {icon}
        <p className="text-[11px] font-semibold uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-gs-gray-900">{value}</p>
      <span className={`mt-2 inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${TONE_STYLES[tone]}`}>
        {hint}
      </span>
    </div>
  );
}
