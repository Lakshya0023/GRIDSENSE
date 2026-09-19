"use client";
import { useState } from "react";
import { Reveal, RevealText } from "@/components/motion/Reveal";
import {
  Database,
  Network,
  Brain,
  Target,
  GitBranch,
  ShieldCheck,
} from "lucide-react";

const STEPS = [
  { n: "01", icon: <Database className="w-5 h-5" />, title: "Grid Data", short: "Collect", desc: "Real-time telemetry from substations, transformers, and transmission corridors is ingested into the platform." },
  { n: "02", icon: <Network className="w-5 h-5" />, title: "Grid Topology", short: "Model", desc: "The physical grid is represented as an interactive spatial and topological model." },
  { n: "03", icon: <Brain className="w-5 h-5" />, title: "AI Prediction", short: "Analyze", desc: "Graph Neural Network identifies assets with elevated failure probability across the network." },
  { n: "04", icon: <Target className="w-5 h-5" />, title: "Root Cause", short: "Attribute", desc: "Separate the initiating asset from downstream symptoms through causal attribution." },
  { n: "05", icon: <GitBranch className="w-5 h-5" />, title: "Cascade Analysis", short: "Trace", desc: "Predict how a single failure may propagate across regions and time horizons." },
  { n: "06", icon: <ShieldCheck className="w-5 h-5" />, title: "Intervention", short: "Mitigate", desc: "Simulate corrective actions and measure their expected impact before applying." },
];

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const step = STEPS[active];

  return (
    <section className="relative bg-gs-bg-secondary/55 py-24">
      <div className="container-official">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <Reveal kind="wipe" className="inline-block text-xs font-semibold text-gs-cyan-400 uppercase tracking-widest mb-4">
            The Pipeline
          </Reveal>
          <RevealText as="h2" text="How GridSense Works" className="text-4xl md:text-5xl font-bold text-white mb-4 text-institutional" />
          <Reveal as="p" delay={0.14} className="text-gs-text-secondary leading-relaxed">
            Six connected stages that transform raw grid data into actionable
            intervention.
          </Reveal>
        </div>

        <Reveal kind="scale" className="grid lg:grid-cols-12 gap-6" duration={0.75}>
          {/* Steps list */}
          <div className="lg:col-span-5 space-y-1.5">
            {STEPS.map((s, i) => {
              const isActive = i === active;
              return (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  onMouseEnter={() => setActive(i)}
                  className={`w-full text-left p-4 rounded-md border transition-all ${
                    isActive
                      ? "bg-gs-bg-elevated border-gs-cyan-500/50 shadow-lg"
                      : "bg-gs-bg-panel border-gs-border hover:border-gs-border-light"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-md flex items-center justify-center transition-colors ${
                        isActive
                          ? "bg-gs-cyan-500/15 text-gs-cyan-400"
                          : "bg-gs-bg-primary text-gs-text-tertiary"
                      }`}
                    >
                      {s.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-mono tracking-widest ${
                            isActive ? "text-gs-cyan-400" : "text-gs-text-muted"
                          }`}
                        >
                          {s.n}
                        </span>
                        <span
                          className={`text-[10px] font-mono uppercase tracking-widest ${
                            isActive ? "text-gs-cyan-400" : "text-gs-text-muted"
                          }`}
                        >
                          {s.short}
                        </span>
                      </div>
                      <div
                        className={`text-sm font-semibold ${
                          isActive ? "text-white" : "text-gs-text-secondary"
                        }`}
                      >
                        {s.title}
                      </div>
                    </div>
                    <div
                      className={`w-1 h-8 rounded-full transition-all ${
                        isActive ? "bg-gs-cyan-500" : "bg-transparent"
                      }`}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Illustration panel */}
          <div className="lg:col-span-7">
            <div className="bg-gs-bg-panel border border-gs-border rounded-lg p-8 min-h-[400px] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-md bg-gs-cyan-500/15 text-gs-cyan-400 flex items-center justify-center">
                    {step.icon}
                  </div>
                  <div>
                    <div className="text-xs font-mono text-gs-cyan-400 tracking-widest">
                      STEP {step.n}
                    </div>
                    <h3 className="text-2xl font-bold text-white">
                      {step.title}
                    </h3>
                  </div>
                </div>
                <p className="text-gs-text-secondary text-base leading-relaxed">
                  {step.desc}
                </p>
              </div>

              {/* Pipeline visualization */}
              <div className="mt-8 pt-6 border-t border-gs-border">
                <div className="flex items-center gap-1">
                  {STEPS.map((_, i) => (
                    <div key={i} className="flex-1 flex items-center gap-1">
                      <div
                        className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                          i <= active ? "bg-gs-cyan-500" : "bg-gs-border"
                        }`}
                      />
                      {i < STEPS.length - 1 && (
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            i < active ? "bg-gs-cyan-500" : "bg-gs-border"
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-gs-text-muted">
                  <span>Data Ingestion</span>
                  <span>Grid Mitigation</span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}