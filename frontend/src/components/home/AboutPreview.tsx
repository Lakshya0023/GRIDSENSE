"use client";
import Link from "next/link";
import { ArrowRight, Network } from "lucide-react";
import { Reveal, RevealGroup, RevealItem, RevealText } from "@/components/motion/Reveal";

export function AboutPreview() {
  const items = [
    "Machine Learning",
    "Graph Neural Networks",
    "Grid Simulation",
    "Risk Prediction",
    "Root Cause Analysis",
    "Cascade Prediction",
  ];

  return (
    <section className="relative bg-gs-bg-secondary/55 py-24 border-y border-gs-border">
      <div className="container-official">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <Reveal kind="left" className="relative aspect-[4/3] rounded-lg overflow-hidden bg-gradient-to-br from-gs-bg-panel to-gs-bg-elevated border border-gs-border">
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(34, 211, 238,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238,0.15) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="relative inline-block">
                  <Network className="w-24 h-24 text-gs-cyan-400 mx-auto mb-4" />
                  <div className="absolute inset-0 rounded-full bg-gs-cyan-500/10 blur-2xl" />
                </div>
                <div className="text-gs-text-tertiary text-xs font-mono uppercase tracking-widest">
                  Grid Intelligence System
                </div>
              </div>
            </div>
          </Reveal>

          <div>
            <Reveal kind="wipe" className="inline-block text-xs font-semibold text-gs-cyan-400 uppercase tracking-widest mb-4">
              About GridSense
            </Reveal>
            <RevealText as="h2" text="Intelligence for the national grid." className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight text-institutional" />
            <Reveal as="p" delay={0.12} className="text-gs-text-secondary leading-relaxed mb-6">
              GridSense is an AI-powered grid intelligence platform designed to
              help electricity infrastructure operators understand, predict, and
              mitigate potential grid failures before they escalate into
              large-scale outages.
            </Reveal>
            <RevealGroup className="grid grid-cols-2 gap-2 mb-8" stagger={0.06} delay={0.1}>
              {items.map((item) => (
                <RevealItem
                  key={item}
                  kind="left"
                  className="flex items-center gap-2 text-sm text-gs-text-secondary"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-gs-cyan-500" />
                  {item}
                </RevealItem>
              ))}
            </RevealGroup>
            <Link
              href="/about"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gs-bg-panel hover:bg-gs-bg-elevated border border-gs-border hover:border-gs-cyan-500/50 text-white text-sm font-medium rounded-md transition-colors"
            >
              Learn More
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}