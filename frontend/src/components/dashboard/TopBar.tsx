"use client";
import { useGridStore } from "@/store/gridStore";
import { Zap, Network, Shield, AlertTriangle, Brain, Activity, MapPin } from "lucide-react";

export function TopBar() {
  const { gridState, prediction, isProcessing, demoPhase, interventionResult } = useGridStore();
  const nodeCount = gridState?.nodes.length ?? 0;
  const edgeCount = gridState?.edges.length ?? 0;
  const criticalCount = gridState?.nodes.filter((n) => n.status === "critical" || n.status === "root_cause").length ?? 0;
  const activePredictions = prediction?.root_cause_ranking.length ?? 0;
  const cascadeRisk = interventionResult ? interventionResult.new_cascade_risk_pct : prediction?.cascade_risk_pct ?? 3;
  const health = gridState?.overall_health_pct ?? 100;

  return (
    <header className="bg-grid-bg-secondary border-b border-grid-border shrink-0 z-50">
      {/* Top Row — Brand & Status */}
      <div className="h-11 flex items-center px-4 gap-6 border-b border-grid-border/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-gradient-to-br from-grid-cyan/30 to-grid-purple/20 flex items-center justify-center border border-grid-cyan/30">
            <Zap className="w-4 h-4 text-grid-cyan" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-wide text-grid-text-primary">GRIDSENSE</div>
            <div className="text-[9px] font-mono text-grid-cyan uppercase tracking-widest">India National Grid</div>
          </div>
        </div>

        <div className="w-px h-8 bg-grid-border" />

        <div className="flex items-center gap-4">
          <StatusPill dotColor={demoPhase === "healthy" ? "#39FF88" : "#FFD166"} label="GRID" value={demoPhase === "healthy" ? "OPERATIONAL" : "STRESSED"} />
          <StatusPill dotColor={isProcessing ? "#B56CFF" : "#00E5FF"} label="AI" value={isProcessing ? "ANALYZING" : "ONLINE"} pulse={isProcessing} />
          <StatusPill dotColor="#00E5FF" label="MODE" value="SIMULATION" />
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-3 text-[10px] font-mono text-grid-text-secondary">
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-grid-cyan" />
            <span>{nodeCount} ASSETS</span>
          </div>
          <span className="text-grid-border">|</span>
          <span>{edgeCount} LINES</span>
          <span className="text-grid-border">|</span>
          <span className={criticalCount > 0 ? "text-grid-red font-bold" : "text-grid-green"}>{criticalCount} CRITICAL</span>
        </div>

        <div className="px-2 py-0.5 rounded bg-grid-purple/10 border border-grid-purple/30">
          <span className="text-[9px] font-mono text-grid-purple">MODEL: GraphSAGE-v2.1</span>
        </div>
      </div>

      {/* Bottom Row — KPI cards */}
      <div className="h-14 flex items-center px-4 gap-2">
        <KpiCard icon={<Shield className="w-3.5 h-3.5" />} label="GRID HEALTH" value={`${health.toFixed(1)}%`} color={health > 90 ? "green" : health > 70 ? "yellow" : "red"} />
        <KpiCard icon={<AlertTriangle className="w-3.5 h-3.5" />} label="CASCADE RISK" value={`${cascadeRisk}%`} color={cascadeRisk < 20 ? "green" : cascadeRisk < 50 ? "yellow" : "red"} />
        <KpiCard icon={<Zap className="w-3.5 h-3.5" />} label="CRITICAL ASSETS" value={`${criticalCount}`} color={criticalCount === 0 ? "green" : "red"} />
        <KpiCard icon={<Brain className="w-3.5 h-3.5" />} label="AI PREDICTIONS" value={`${activePredictions}`} color={activePredictions === 0 ? "green" : "purple"} />

        {/* Regional Risk */}
        <div className="ml-auto flex items-center gap-1.5">
          {gridState && Object.entries(gridState.regional_health).map(([region, h]) => (
            <RegionalIndicator key={region} region={region} health={h} />
          ))}
        </div>
      </div>
    </header>
  );
}

function StatusPill({ dotColor, label, value, pulse }: { dotColor: string; label: string; value: string; pulse?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
        {pulse && <div className="absolute inset-0 rounded-full animate-ping" style={{ backgroundColor: dotColor, opacity: 0.6 }} />}
      </div>
      <span className="text-[9px] font-medium uppercase tracking-widest text-grid-text-tertiary">{label}</span>
      <span className="text-[10px] font-mono font-semibold" style={{ color: dotColor }}>{value}</span>
    </div>
  );
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: "green" | "yellow" | "red" | "purple" | "cyan" }) {
  const colorMap = { green: "#39FF88", yellow: "#FFD166", red: "#FF3B5C", purple: "#B56CFF", cyan: "#00E5FF" };
  const c = colorMap[color];
  return (
    <div className="panel px-3 py-1.5 min-w-[120px]" style={{ borderColor: `${c}30` }}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span style={{ color: c }}>{icon}</span>
        <span className="text-[8px] font-medium uppercase tracking-widest text-grid-text-tertiary">{label}</span>
      </div>
      <div className="font-mono text-base font-bold tabular-nums" style={{ color: c }}>{value}</div>
    </div>
  );
}

function RegionalIndicator({ region, health }: { region: string; health: number }) {
  const color = health > 90 ? "#39FF88" : health > 70 ? "#FFD166" : "#FF3B5C";
  return (
    <div className="flex flex-col items-center px-2 py-1 rounded bg-grid-bg-panel border border-grid-border">
      <span className="text-[8px] font-mono text-grid-text-tertiary">{region}</span>
      <span className="text-[10px] font-mono font-bold" style={{ color }}>{health.toFixed(0)}%</span>
    </div>
  );
}
