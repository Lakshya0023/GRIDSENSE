"use client";
import { useState, useEffect, useRef } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { GridScene } from "@/components/grid/GridScene";
import { IntelligencePanel } from "@/components/dashboard/IntelligencePanel";
import { NodeDetailPanel } from "@/components/dashboard/NodeDetailPanel";
import { Legend } from "@/components/dashboard/Legend";
import { WhatIfSimulator } from "@/components/dashboard/WhatIfSimulator";
import { useGridStore } from "@/store/gridStore";
import { api } from "@/lib/api";
import { getCustomGrid } from "@/lib/customGrid";
import { Map, Layers, Radio, ExternalLink } from "lucide-react";
import { LiveTelemetryUpdater } from "@/components/dashboard/LiveTelemetryUpdater";

export default function MapExplorerPage() {
  const [viewMode, setViewMode] = useState<"gis" | "3d">("gis");
  const [customDatasetName, setCustomDatasetName] = useState<string | null>(null);
  const [gisUrl] = useState("/gis/index.html");
  const gisFrame = useRef<HTMLIFrameElement>(null);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const { showNodeDetail, setGridState, setPrediction, setProcessing } = useGridStore();

  useEffect(() => {
    let isMounted = true;
    async function loadGrid() {
      setProcessing(true, "grid_state");
      try {
        const customGrid = getCustomGrid();
        if (customGrid) {
          if (isMounted) {
            setGridState(customGrid);
            setPrediction(null);
            setCustomDatasetName((customGrid.grid_id || "custom-grid").replace(/^custom-/, ""));
            setViewMode("gis");
          }
          return;
        }
        const state = await api.getGridState();
        if (isMounted) {
          setGridState(state);
          setPrediction(null);
        }
      } catch (e) {
        console.error("Failed to fetch grid state:", e);
      } finally {
        if (isMounted) setProcessing(false);
      }
    }
    loadGrid();
    return () => {
      isMounted = false;
    };
  }, [setGridState, setPrediction, setProcessing]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSelectedAsset(params.get("asset"));
    setSelectedCity(params.get("city"));
    setSelectedState(params.get("state"));
  }, []);

  useEffect(() => {
    const syncMapTheme = () => {
      const theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
      gisFrame.current?.contentWindow?.postMessage({ type: "gridsense-theme", theme }, window.location.origin);
    };
    const observer = new MutationObserver(syncMapTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    syncMapTheme();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!selectedAsset && !selectedCity) return;
    const focusContext = () => {
      if (selectedCity) gisFrame.current?.contentWindow?.postMessage({ type: "gridsense-focus-city", city: selectedCity, state: selectedState }, window.location.origin);
      if (selectedAsset) gisFrame.current?.contentWindow?.postMessage({ type: "gridsense-focus-asset", assetId: selectedAsset }, window.location.origin);
    };
    focusContext();
    const retry = window.setTimeout(focusContext, 1100);
    return () => window.clearTimeout(retry);
  }, [selectedAsset, selectedCity, selectedState]);

  return (
    <>
      <Navbar variant="dark" />
      <LiveTelemetryUpdater />
      <main className="gs-workspace min-h-[100dvh] pt-16 w-full flex flex-col overflow-hidden">
        {/* Top Control Bar with Mode Switcher */}
        <div className="shrink-0 bg-gs-bg-secondary border-b border-gs-border px-4 py-2 flex items-center justify-between z-30 shadow-md">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-2.5 py-1 rounded-md bg-gs-bg-primary border border-gs-border">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[11px] font-mono text-emerald-400 font-bold">AI CORE: ONLINE</span>
            </div>
            <div className="hidden sm:flex items-center space-x-1.5 text-xs text-gs-text-secondary font-semibold">
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              <span>{customDatasetName ? `Dataset: ${customDatasetName}` : "National Grid Map Explorer & ML Intelligence"}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* View Switcher Tabs */}
            <div className="flex bg-gs-bg-primary p-0.5 rounded-lg border border-gs-border">
              <button
                onClick={() => setViewMode("gis")}
                className={`flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  viewMode === "gis"
                    ? "bg-gs-cyan-500 text-gs-bg-primary shadow"
                    : "text-gs-text-tertiary hover:text-gs-text-primary"
                }`}
              >
                <Map className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Live GIS Map</span>
              </button>
              <button
                onClick={() => setViewMode("3d")}
                className={`flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  viewMode === "3d"
                    ? "bg-gs-cyan-500 text-gs-bg-primary shadow"
                    : "text-gs-text-tertiary hover:text-gs-text-primary"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ML Risk Analytics</span>
              </button>
            </div>

            {/* Direct Link to Standalone Backend GIS */}
            <a
              href="/gis/index.html"
              target="_blank"
              rel="noreferrer"
              className="hidden md:flex items-center space-x-1 px-2.5 py-1 text-xs font-mono bg-gs-bg-elevated hover:bg-gs-bg-overlay text-gs-cyan-300 rounded border border-gs-border transition"
              title="Open the complete GIS explorer in a separate tab"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Full Screen</span>
            </a>
          </div>
        </div>

        {/* Dynamic Display Area */}
        {viewMode === "gis" ? (
          <div className="flex-1 w-full h-full relative bg-gs-bg-primary overflow-hidden">
            <iframe
              ref={gisFrame}
              src={gisUrl}
              onLoad={() => {
                const theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
                gisFrame.current?.contentWindow?.postMessage({ type: "gridsense-theme", theme }, window.location.origin);
                if (selectedCity) gisFrame.current?.contentWindow?.postMessage({ type: "gridsense-focus-city", city: selectedCity, state: selectedState }, window.location.origin);
                if (selectedAsset) gisFrame.current?.contentWindow?.postMessage({ type: "gridsense-focus-asset", assetId: selectedAsset }, window.location.origin);
              }}
              className="w-full h-full border-0 absolute inset-0"
              title="GridSense Pro GIS SCADA Telemetry & GNN Resiliency Explorer"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
            />
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden relative">
            <div className="flex-1 relative">
              <GridScene />
              <Legend />
              <WhatIfSimulator />
            </div>
            <IntelligencePanel />
            {showNodeDetail && <NodeDetailPanel />}
          </div>
        )}
      </main>
    </>
  );
}
