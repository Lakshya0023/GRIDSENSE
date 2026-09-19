"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  Zap, Shield, AlertTriangle, Brain, Target, Crosshair, HelpCircle, Route,
  Wrench, Check, ArrowDown, ArrowRight, Activity, Sliders, RotateCcw,
  Search, Filter, Layers, X, Book, Code, Cpu, Network, Award, Users, Globe,
  AlertOctagon, CheckCircle2, ChevronRight, MapPin, PlayCircle
} from "lucide-react";

// ── Geographic & Grid Data ──
const INDIA_BOUNDS = { minLon: 68.0, maxLon: 97.5, minLat: 6.5, maxLat: 37.0 };

interface GridAsset {
  id: string;
  type: "generator" | "substation" | "transformer" | "feeder" | "switch" | "load_center";
  label: string;
  state: string;
  region: "NR" | "WR" | "SR" | "ER" | "NER";
  lat: number;
  lon: number;
  baseLoad: number;
  baseVoltage: number;
  baseTemp: number;
  age: number;
  capacity: number;
}

const GRID_ASSETS: GridAsset[] = [
  // Northern Region
  { id: "G1", type: "generator", label: "Bhakra Nangal Hydro", state: "Punjab", region: "NR", lat: 31.41, lon: 76.44, baseLoad: 55, baseVoltage: 1.02, baseTemp: 45, age: 40, capacity: 1325 },
  { id: "G2", type: "generator", label: "Dadri Thermal", state: "UP", region: "NR", lat: 28.57, lon: 77.60, baseLoad: 68, baseVoltage: 1.01, baseTemp: 62, age: 15, capacity: 1820 },
  { id: "S1", type: "substation", label: "Delhi 400kV Sub", state: "Delhi", region: "NR", lat: 28.61, lon: 77.20, baseLoad: 72, baseVoltage: 1.0, baseTemp: 58, age: 18, capacity: 500 },
  { id: "S2", type: "substation", label: "Jaipur Grid Sub", state: "Rajasthan", region: "NR", lat: 26.91, lon: 75.79, baseLoad: 62, baseVoltage: 1.0, baseTemp: 55, age: 12, capacity: 400 },
  { id: "T1", type: "transformer", label: "Panipat Trans", state: "Haryana", region: "NR", lat: 29.39, lon: 76.96, baseLoad: 68, baseVoltage: 0.99, baseTemp: 60, age: 14, capacity: 315 },
  { id: "T5", type: "transformer", label: "Lucknow Trans", state: "UP", region: "NR", lat: 26.85, lon: 80.94, baseLoad: 58, baseVoltage: 1.01, baseTemp: 54, age: 8, capacity: 250 },

  // Western Region (T17 Critical)
  { id: "G3", type: "generator", label: "Tarapur Nuclear", state: "Maharashtra", region: "WR", lat: 19.83, lon: 72.66, baseLoad: 65, baseVoltage: 1.02, baseTemp: 48, age: 25, capacity: 1400 },
  { id: "G4", type: "generator", label: "Sardar Sarovar", state: "Gujarat", region: "WR", lat: 21.83, lon: 73.75, baseLoad: 50, baseVoltage: 1.03, baseTemp: 42, age: 20, capacity: 1450 },
  { id: "S3", type: "substation", label: "Mumbai Central Sub", state: "Maharashtra", region: "WR", lat: 19.07, lon: 72.87, baseLoad: 78, baseVoltage: 0.99, baseTemp: 62, age: 22, capacity: 600 },
  { id: "S4", type: "substation", label: "Pune Grid Sub", state: "Maharashtra", region: "WR", lat: 18.52, lon: 73.85, baseLoad: 65, baseVoltage: 1.0, baseTemp: 56, age: 15, capacity: 450 },
  { id: "T17", type: "transformer", label: "Nashik Trans T17", state: "Maharashtra", region: "WR", lat: 19.99, lon: 73.78, baseLoad: 78, baseVoltage: 0.97, baseTemp: 65, age: 12, capacity: 25 },
  { id: "F8", type: "feeder", label: "Feeder F8 Nashik-Pune", state: "Maharashtra", region: "WR", lat: 19.25, lon: 73.83, baseLoad: 55, baseVoltage: 0.98, baseTemp: 48, age: 11, capacity: 20 },
  { id: "T21", type: "transformer", label: "Pune Trans T21", state: "Maharashtra", region: "WR", lat: 18.52, lon: 73.86, baseLoad: 60, baseVoltage: 0.98, baseTemp: 53, age: 10, capacity: 30 },
  { id: "T3", type: "transformer", label: "Ahmedabad Trans", state: "Gujarat", region: "WR", lat: 23.03, lon: 72.58, baseLoad: 60, baseVoltage: 0.98, baseTemp: 57, age: 11, capacity: 280 },
  { id: "T14", type: "transformer", label: "Nagpur Trans T14", state: "Maharashtra", region: "WR", lat: 21.15, lon: 79.08, baseLoad: 48, baseVoltage: 1.01, baseTemp: 49, age: 6, capacity: 250 },
  { id: "T19", type: "transformer", label: "Aurangabad Trans T19", state: "Maharashtra", region: "WR", lat: 19.87, lon: 75.34, baseLoad: 52, baseVoltage: 1.0, baseTemp: 51, age: 7, capacity: 220 },

  // Southern Region
  { id: "G5", type: "generator", label: "Kudankulam Nuclear", state: "Tamil Nadu", region: "SR", lat: 8.17, lon: 77.71, baseLoad: 60, baseVoltage: 1.02, baseTemp: 46, age: 8, capacity: 2000 },
  { id: "G6", type: "generator", label: "Ramagundam Thermal", state: "Telangana", region: "SR", lat: 18.79, lon: 79.47, baseLoad: 70, baseVoltage: 1.01, baseTemp: 64, age: 30, capacity: 2600 },
  { id: "S5", type: "substation", label: "Chennai Grid Sub", state: "Tamil Nadu", region: "SR", lat: 13.08, lon: 80.27, baseLoad: 70, baseVoltage: 1.0, baseTemp: 58, age: 14, capacity: 500 },
  { id: "S6", type: "substation", label: "Bengaluru Grid Sub", state: "Karnataka", region: "SR", lat: 12.97, lon: 77.59, baseLoad: 75, baseVoltage: 0.99, baseTemp: 55, age: 12, capacity: 550 },
  { id: "S7", type: "substation", label: "Hyderabad Sub", state: "Telangana", region: "SR", lat: 17.38, lon: 78.48, baseLoad: 68, baseVoltage: 1.0, baseTemp: 60, age: 13, capacity: 480 },
  { id: "T6", type: "transformer", label: "Kochi Trans", state: "Kerala", region: "SR", lat: 9.93, lon: 76.27, baseLoad: 62, baseVoltage: 0.99, baseTemp: 56, age: 9, capacity: 200 },
  { id: "T7", type: "transformer", label: "Coimbatore Trans", state: "Tamil Nadu", region: "SR", lat: 11.01, lon: 76.96, baseLoad: 58, baseVoltage: 0.99, baseTemp: 55, age: 13, capacity: 180 },

  // Eastern Region
  { id: "G7", type: "generator", label: "Farakka Thermal", state: "West Bengal", region: "ER", lat: 24.80, lon: 87.90, baseLoad: 62, baseVoltage: 1.0, baseTemp: 60, age: 28, capacity: 2100 },
  { id: "S8", type: "substation", label: "Kolkata Grid Sub", state: "West Bengal", region: "ER", lat: 22.57, lon: 88.36, baseLoad: 72, baseVoltage: 0.99, baseTemp: 58, age: 20, capacity: 500 },
  { id: "S9", type: "substation", label: "Bhubaneswar Sub", state: "Odisha", region: "ER", lat: 20.29, lon: 85.82, baseLoad: 58, baseVoltage: 1.0, baseTemp: 54, age: 10, capacity: 400 },
  { id: "T8", type: "transformer", label: "Patna Trans", state: "Bihar", region: "ER", lat: 25.59, lon: 85.13, baseLoad: 45, baseVoltage: 1.01, baseTemp: 47, age: 5, capacity: 180 },
  { id: "T9", type: "transformer", label: "Ranchi Trans", state: "Jharkhand", region: "ER", lat: 23.34, lon: 85.30, baseLoad: 65, baseVoltage: 0.98, baseTemp: 59, age: 16, capacity: 220 },

  // North-Eastern Region
  { id: "G8", type: "generator", label: "Kameng Hydro", state: "Arunachal", region: "NER", lat: 27.10, lon: 92.60, baseLoad: 45, baseVoltage: 1.03, baseTemp: 40, age: 10, capacity: 600 },
  { id: "S10", type: "substation", label: "Guwahati Grid Sub", state: "Assam", region: "NER", lat: 26.14, lon: 91.74, baseLoad: 55, baseVoltage: 1.0, baseTemp: 52, age: 12, capacity: 350 },

  // Load Centers
  { id: "L1", type: "load_center", label: "Delhi Load Center", state: "Delhi", region: "NR", lat: 28.63, lon: 77.22, baseLoad: 82, baseVoltage: 0.98, baseTemp: 42, age: 10, capacity: 400 },
  { id: "L2", type: "load_center", label: "Mumbai Load Center", state: "Maharashtra", region: "WR", lat: 19.08, lon: 72.88, baseLoad: 85, baseVoltage: 0.97, baseTemp: 45, age: 15, capacity: 500 },
  { id: "L3", type: "load_center", label: "Bengaluru Load Center", state: "Karnataka", region: "SR", lat: 12.98, lon: 77.60, baseLoad: 78, baseVoltage: 0.98, baseTemp: 40, age: 12, capacity: 450 }
];

const GRID_EDGES = [
  { source: "G1", target: "S1" }, { source: "G2", target: "S1" }, { source: "S1", target: "T1" },
  { source: "S1", target: "L1" }, { source: "S2", target: "T5" }, { source: "S1", target: "S2" },
  { source: "G3", target: "S3" }, { source: "G4", target: "S3" }, { source: "S3", target: "T17" },
  { source: "S3", target: "T3" }, { source: "S3", target: "L2" }, { source: "T17", target: "F8" },
  { source: "F8", target: "T21" }, { source: "T21", target: "S4" }, { source: "T17", target: "T14" },
  { source: "T17", target: "T19" }, { source: "S4", target: "T14" },
  { source: "G5", target: "S5" }, { source: "G6", target: "S7" }, { source: "S5", target: "T7" },
  { source: "S6", target: "L3" }, { source: "S6", target: "T6" }, { source: "S7", target: "S6" },
  { source: "S5", target: "S6" }, { source: "G7", target: "S8" }, { source: "S8", target: "T8" },
  { source: "S8", target: "T9" }, { source: "S9", target: "S8" }, { source: "G8", target: "S10" },
  { source: "S1", target: "S3" }, { source: "S3", target: "S7" }, { source: "S1", target: "S8" },
  { source: "S8", target: "S10" }, { source: "S3", target: "S9" }
];

export default function AllInOneGridSense() {
  const [activeTab, setActiveTab] = useState<"home" | "explorer" | "intelligence" | "analytics" | "alerts" | "about" | "docs">("explorer");
  const [demoPhase, setDemoPhase] = useState<"healthy" | "stress" | "predict" | "cascade" | "mitigated">("healthy");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("T17");
  const [stressVal, setStressVal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const isStressed = demoPhase === "stress" || demoPhase === "predict" || demoPhase === "cascade";
  const isMitigated = demoPhase === "mitigated";

  const selectedAsset = useMemo(() => GRID_ASSETS.find((a) => a.id === selectedNodeId), [selectedNodeId]);

  return (
    <div className="min-h-screen bg-gs-bg-primary text-gs-text-primary flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="h-16 bg-gs-bg-secondary border-b border-gs-border flex items-center justify-between px-6 shrink-0 z-40">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab("home")}>
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-gs-blue-500 to-gs-cyan-400 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              GridSense All-in-One
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gs-cyan-500/10 border border-gs-cyan-500/30 text-gs-cyan-400 font-mono">v2.1 Unified</span>
            </div>
            <div className="text-[9px] font-mono text-gs-text-tertiary uppercase tracking-widest">National Grid Intelligence</div>
          </div>
        </div>

        <nav className="flex items-center gap-2 text-xs">
          {(["home", "explorer", "intelligence", "analytics", "alerts", "about", "docs"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md font-medium capitalize transition-colors ${
                activeTab === tab ? "bg-gs-cyan-500/15 text-gs-cyan-400 border border-gs-cyan-500/40" : "text-gs-text-secondary hover:text-white"
              }`}
            >
              {tab === "explorer" ? "3D Grid Explorer" : tab}
            </button>
          ))}
        </nav>
      </header>

      {/* Main Body */}
      <main className="flex-1 flex overflow-hidden">
        {activeTab === "explorer" && (
          <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden relative">
            {/* KPI Bar */}
            <div className="h-12 bg-gs-bg-secondary border-b border-gs-border flex items-center px-6 justify-between text-xs shrink-0">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-gs-green-500" />
                  <span className="text-gs-text-tertiary">HEALTH:</span>
                  <span className={`font-mono font-bold ${isStressed ? "text-gs-amber-500" : isMitigated ? "text-gs-cyan-400" : "text-gs-green-500"}`}>
                    {isStressed ? "78.4%" : isMitigated ? "94.2%" : "98.7%"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-gs-red-500" />
                  <span className="text-gs-text-tertiary">CASCADE RISK:</span>
                  <span className={`font-mono font-bold ${isStressed ? "text-gs-red-500" : isMitigated ? "text-gs-green-500" : "text-gs-green-500"}`}>
                    {isStressed ? "86%" : isMitigated ? "18%" : "3%"}
                  </span>
                </div>
              </div>

              {/* Demo Mode Switcher */}
              <div className="flex items-center gap-2 bg-gs-bg-panel px-3 py-1 rounded border border-gs-border font-mono text-[11px]">
                <PlayCircle className="w-3.5 h-3.5 text-gs-cyan-400" />
                <span className="text-gs-cyan-400 mr-2 uppercase">Scenario:</span>
                {(["healthy", "stress", "predict", "cascade", "mitigated"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setDemoPhase(p)}
                    className={`px-2 py-0.5 rounded capitalize ${demoPhase === p ? "bg-gs-cyan-500/20 text-gs-cyan-400 border border-gs-cyan-500" : "text-gs-text-tertiary hover:text-white"}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid & Map Workspace */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left: Interactive 2D/3D Grid Map View */}
              <div className="flex-1 p-6 overflow-y-auto relative bg-gs-bg-primary">
                <div className="max-w-4xl mx-auto space-y-6">
                  <div className="panel p-6">
                    <div className="flex items-center justify-between mb-4 border-b border-gs-border pb-3">
                      <div>
                        <h2 className="text-lg font-bold text-white">India National Grid Topology Map</h2>
                        <p className="text-xs text-gs-text-tertiary">Interactive multi-regional geospatial asset layout</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Filter asset ID..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="px-3 py-1 bg-gs-bg-primary border border-gs-border rounded text-xs text-white focus:outline-none focus:border-gs-cyan-500"
                        />
                      </div>
                    </div>

                    {/* Interactive Grid Nodes Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {GRID_ASSETS.filter((a) => !searchQuery || a.id.toLowerCase().includes(searchQuery.toLowerCase()) || a.label.toLowerCase().includes(searchQuery.toLowerCase())).map((asset) => {
                        const isSelected = selectedNodeId === asset.id;
                        const isRoot = asset.id === "T17" && isStressed;
                        const isAffected = ["F8", "T21", "S4"].includes(asset.id) && isStressed;
                        return (
                          <div
                            key={asset.id}
                            onClick={() => setSelectedNodeId(asset.id)}
                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                              isSelected
                                ? "border-gs-cyan-500 bg-gs-cyan-500/10 shadow-lg"
                                : isRoot
                                ? "border-gs-red-500 bg-gs-red-500/15 animate-pulse"
                                : isAffected
                                ? "border-gs-amber-500 bg-gs-amber-500/10"
                                : "border-gs-border bg-gs-bg-secondary hover:border-gs-border-light"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={`font-mono font-bold text-sm ${isRoot ? "text-gs-red-500" : isSelected ? "text-gs-cyan-400" : "text-white"}`}>
                                {asset.id}
                              </span>
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-gs-bg-primary text-gs-text-tertiary uppercase">
                                {asset.region}
                              </span>
                            </div>
                            <div className="text-xs font-medium text-gs-text-secondary truncate">{asset.label}</div>
                            <div className="text-[10px] text-gs-text-tertiary uppercase mt-1">{asset.type} · {asset.state}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* What-If Simulation Controls */}
                  <div className="panel p-5 space-y-4">
                    <div className="flex items-center gap-2 border-b border-gs-border pb-2">
                      <Sliders className="w-4 h-4 text-gs-cyan-400" />
                      <h3 className="text-sm font-bold text-white">What-If Dispatch Simulation Parameters</h3>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gs-text-secondary">Grid Demand Stress Delta</span>
                          <span className="font-mono text-gs-amber-500 font-bold">{stressVal}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="30"
                          value={stressVal}
                          onChange={(e) => {
                            setStressVal(Number(e.target.value));
                            if (Number(e.target.value) > 0) setDemoPhase("stress");
                            else setDemoPhase("healthy");
                          }}
                          className="w-full accent-gs-amber-500"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => { setDemoPhase("stress"); setStressVal(18); }}
                          className="flex-1 py-2 bg-gs-amber-500/20 border border-gs-amber-500/40 text-gs-amber-500 text-xs font-mono font-bold rounded hover:bg-gs-amber-500/30"
                        >
                          Inject 18% Heatwave Stress
                        </button>
                        <button
                          onClick={() => { setDemoPhase("healthy"); setStressVal(0); }}
                          className="py-2 px-4 bg-gs-bg-elevated border border-gs-border text-gs-text-secondary text-xs font-mono rounded hover:text-white"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Real-time AI Intelligence & Telemetry Inspector */}
              <div className="w-[380px] bg-gs-bg-secondary border-l border-gs-border p-4 space-y-4 overflow-y-auto shrink-0">
                {/* AI Prediction */}
                <div className="panel p-4 border-gs-purple-500/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-gs-purple-500" />
                    <span className="text-xs font-bold text-white uppercase">GraphSAGE Causal Engine</span>
                  </div>
                  <div className="bg-gs-bg-primary p-3 rounded text-xs space-y-1">
                    <div className="text-gs-text-tertiary">PREDICTED RISK NODE:</div>
                    <div className="font-mono font-bold text-base text-gs-red-500">{isStressed ? "T17 (Nashik Trans)" : "SYSTEM NOMINAL"}</div>
                    <div className="text-gs-text-secondary">{isStressed ? "Severe Thermal Overload (Risk: 91%)" : "No critical contingencies detected"}</div>
                  </div>
                </div>

                {/* Node Detail */}
                {selectedAsset && (
                  <div className="panel p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-gs-border pb-2">
                      <div>
                        <div className="font-mono text-base font-bold text-white">{selectedAsset.id}</div>
                        <div className="text-xs text-gs-text-secondary">{selectedAsset.label}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-gs-bg-primary text-[10px] font-mono text-gs-cyan-400 uppercase">
                        {selectedAsset.region}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="bg-gs-bg-primary p-2 rounded">
                        <div className="text-[9px] text-gs-text-tertiary">BASE LOAD</div>
                        <div className="text-gs-cyan-400 font-bold">{selectedAsset.baseLoad}%</div>
                      </div>
                      <div className="bg-gs-bg-primary p-2 rounded">
                        <div className="text-[9px] text-gs-text-tertiary">VOLTAGE</div>
                        <div className="text-gs-cyan-400 font-bold">{selectedAsset.baseVoltage} pu</div>
                      </div>
                      <div className="bg-gs-bg-primary p-2 rounded">
                        <div className="text-[9px] text-gs-text-tertiary">TEMPERATURE</div>
                        <div className="text-gs-amber-500 font-bold">{selectedAsset.baseTemp}°C</div>
                      </div>
                      <div className="bg-gs-bg-primary p-2 rounded">
                        <div className="text-[9px] text-gs-text-tertiary">CAPACITY</div>
                        <div className="text-white font-bold">{selectedAsset.capacity} MVA</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recommended Mitigation Button */}
                {isStressed && (
                  <div className="panel p-4 border-gs-cyan-500/40 space-y-2">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-gs-cyan-400" />
                      Recommended Mitigation
                    </div>
                    <p className="text-xs text-gs-text-secondary">Reduce T17 load by 12% and re-route power to tie-lines T14 and T19.</p>
                    <button
                      onClick={() => setDemoPhase("mitigated")}
                      className="w-full py-2 bg-gs-cyan-500 hover:bg-gs-cyan-400 text-black font-semibold text-xs rounded transition-colors"
                    >
                      Execute Dispatch Mitigation
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Intelligence */}
        {activeTab === "intelligence" && (
          <div className="flex-1 p-8 overflow-y-auto max-w-5xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold text-white">Grid Intelligence &amp; Model Predictions</h1>
            <div className="panel p-6">
              <h2 className="text-lg font-bold text-white mb-4">Multi-Hop Cascade Sequence</h2>
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 bg-gs-red-500/10 border border-gs-red-500/30 rounded flex justify-between">
                  <span>1. Root Fault: T17 (Nashik Trans)</span>
                  <span className="text-gs-red-500 font-bold">Offset +0.0h (Risk: 91%)</span>
                </div>
                <div className="p-3 bg-gs-amber-500/10 border border-gs-amber-500/30 rounded flex justify-between">
                  <span>2. Overload Spillover: F8 (Feeder Nashik-Pune)</span>
                  <span className="text-gs-amber-500 font-bold">Offset +1.5h (Risk: 72%)</span>
                </div>
                <div className="p-3 bg-gs-amber-500/10 border border-gs-amber-500/30 rounded flex justify-between">
                  <span>3. Downstream Surge: T21 (Pune Trans)</span>
                  <span className="text-gs-amber-500 font-bold">Offset +3.0h (Risk: 65%)</span>
                </div>
                <div className="p-3 bg-gs-amber-500/10 border border-gs-amber-500/30 rounded flex justify-between">
                  <span>4. Substation Collapse: S4 (Pune Substation)</span>
                  <span className="text-gs-amber-500 font-bold">Offset +5.0h (Risk: 58%)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Other Tab Views Fallback */}
        {activeTab !== "explorer" && activeTab !== "intelligence" && (
          <div className="flex-1 p-8 overflow-y-auto max-w-4xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold text-white capitalize">{activeTab} View</h1>
            <p className="text-gs-text-secondary leading-relaxed">
              This unified single-file release integrates all pages, telemetry, GNN models, and simulation pipelines into one cohesive application.
            </p>
            <button onClick={() => setActiveTab("explorer")} className="px-6 py-2.5 bg-gs-cyan-500 text-black font-semibold rounded text-sm">
              Return to 3D Grid Explorer
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
