"use client";
import { useEffect } from "react";
import { useGridStore } from "@/store/gridStore";
import { api } from "@/lib/api";
import { Navbar } from "@/components/layout/Navbar";
import { GridScene } from "@/components/grid/GridScene";
import { IntelligencePanel } from "@/components/dashboard/IntelligencePanel";
import { NodeDetailPanel } from "@/components/dashboard/NodeDetailPanel";
import { Legend } from "@/components/dashboard/Legend";
import { WhatIfSimulator } from "@/components/dashboard/WhatIfSimulator";
import { DemoControls } from "@/components/dashboard/DemoControls";
import { SimulationBanner } from "@/components/dashboard/SimulationBanner";
import { LiveTelemetryUpdater } from "@/components/dashboard/LiveTelemetryUpdater";

export default function DashboardPage() {
  const { setGridState, setPrediction, showNodeDetail, isDemoMode, setProcessing } = useGridStore();

  useEffect(() => {
    document.body.classList.add("dark-mode");
    return () => document.body.classList.remove("dark-mode");
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadInitialGrid() {
      setProcessing(true, "grid_state");
      try {
        const state = await api.getGridState();
        if (isMounted) {
          setGridState(state);
          setPrediction(null);
        }
      } catch (e) {
        console.error("Failed to load initial grid:", e);
      } finally {
        if (isMounted) setProcessing(false);
      }
    }
    loadInitialGrid();
    return () => {
      isMounted = false;
    };
  }, [setGridState, setPrediction, setProcessing]);

  return (
    <>
      <Navbar variant="dark" />
      <LiveTelemetryUpdater />
      <main className="pt-16 h-screen w-screen flex flex-col bg-gs-navy-950 overflow-hidden">
        <SimulationBanner />
        <div className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 relative">
            <GridScene />
            <Legend />
            <WhatIfSimulator />
          </div>
          <IntelligencePanel />
          {showNodeDetail && <NodeDetailPanel />}
        </div>
        {isDemoMode && <DemoControls />}
      </main>
    </>
  );
}
