"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { Reveal, RevealGroup, RevealText } from "@/components/motion/Reveal";

const REGIONS = [
  { id: "NR", name: "Northern Region", health: 97.4, assets: 124, risk: 8, cx: 44, cy: 22, color: "#22D3EE" },
  { id: "WR", name: "Western Region", health: 82.1, assets: 168, risk: 34, cx: 32, cy: 52, color: "#D69E2E" },
  { id: "SR", name: "Southern Region", health: 96.8, assets: 142, risk: 12, cx: 46, cy: 78, color: "#38A169" },
  { id: "ER", name: "Eastern Region", health: 94.5, assets: 98, risk: 15, cx: 68, cy: 44, color: "#38A169" },
  { id: "NER", name: "North-Eastern Region", health: 99.1, assets: 42, risk: 4, cx: 82, cy: 34, color: "#38A169" },
];

export function GridPreview() {
  const [hovered, setHovered] = useState<string | null>("WR");

  const active = REGIONS.find((r) => r.id === hovered) ?? REGIONS[0];

  return (
    <section className="relative bg-gs-bg-primary/45 py-24 border-y border-gs-border">
      <div className="container-official">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <Reveal kind="wipe" className="inline-block text-xs font-semibold text-gs-cyan-400 uppercase tracking-widest mb-4">
            Live Preview
          </Reveal>
          <RevealText as="h2" text="Explore the Grid" className="text-4xl md:text-5xl font-bold text-white mb-4 text-institutional" />
          <Reveal as="p" delay={0.14} className="text-gs-text-secondary leading-relaxed">
            Hover a region to preview its health, then open the full interactive
            grid model in Map Explorer.
          </Reveal>
        </div>

        <RevealGroup className="grid lg:grid-cols-3 gap-6 items-stretch" stagger={0.14}>
          {/* Interactive India SVG */}
          <div className="lg:col-span-2 bg-gs-bg-panel border border-gs-border rounded-lg p-6 relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(34, 211, 238,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238,0.3) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />

            <div className="relative aspect-[4/3]">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {/* India outline (simplified) */}
                <path
                  d="M 45,12 L 55,10 L 68,14 L 78,18 L 85,26 L 88,34 L 82,44 L 78,52 L 72,60 L 68,68 L 60,74 L 52,82 L 46,88 L 40,84 L 32,74 L 26,64 L 22,54 L 20,44 L 24,34 L 30,26 L 36,20 L 42,14 Z"
                  fill="rgba(34, 211, 238, 0.06)"
                  stroke="rgba(34, 211, 238, 0.4)"
                  strokeWidth="0.3"
                />

                {/* Connection lines */}
                {REGIONS.map((r1, i) =>
                  REGIONS.slice(i + 1).map((r2) => (
                    <line
                      key={`${r1.id}-${r2.id}`}
                      x1={r1.cx}
                      y1={r1.cy}
                      x2={r2.cx}
                      y2={r2.cy}
                      stroke="rgba(34, 211, 238, 0.15)"
                      strokeWidth="0.15"
                    />
                  ))
                )}

                {/* Region nodes */}
                {REGIONS.map((r) => {
                  const isActive = hovered === r.id;
                  return (
                    <g
                      key={r.id}
                      onMouseEnter={() => setHovered(r.id)}
                      className="cursor-pointer"
                    >
                      {isActive && (
                        <circle
                          cx={r.cx}
                          cy={r.cy}
                          r="4.5"
                          fill={r.color}
                          opacity="0.15"
                        />
                      )}
                      <circle
                        cx={r.cx}
                        cy={r.cy}
                        r={isActive ? "2" : "1.5"}
                        fill={r.color}
                        className="transition-all"
                      />
                      <circle
                        cx={r.cx}
                        cy={r.cy}
                        r={isActive ? "3" : "2.2"}
                        fill="none"
                        stroke={r.color}
                        strokeWidth="0.3"
                        opacity="0.6"
                        className="transition-all"
                      />
                      <text
                        x={r.cx}
                        y={r.cy - 4}
                        textAnchor="middle"
                        fontSize="2.2"
                        fill={isActive ? "#F2F2F0" : "#A8A8A6"}
                        className="transition-all font-mono font-bold pointer-events-none"
                      >
                        {r.id}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Status ticker */}
              <div className="absolute bottom-2 left-2 flex items-center gap-2 text-[10px] font-mono text-gs-text-tertiary">
                <div className="w-1.5 h-1.5 rounded-full bg-gs-green-500 animate-pulse-dot" />
                LIVE PREVIEW · REGIONAL GRID
              </div>
            </div>
          </div>

          {/* Region details panel */}
          <div className="bg-gs-bg-panel border border-gs-border rounded-lg p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div
                className="text-xs font-mono tracking-widest"
                style={{ color: active.color }}
              >
                {active.id}
              </div>
              <div className="text-[10px] font-mono uppercase text-gs-text-muted">
                Region Snapshot
              </div>
            </div>

            <h3 className="text-2xl font-bold text-white mb-1">
              {active.name}
            </h3>
            <p className="text-xs text-gs-text-tertiary uppercase tracking-widest mb-6">
              Regional Grid Status
            </p>

            <div className="space-y-4 flex-1">
              <MetricRow
                label="Grid Health"
                value={`${active.health}%`}
                color={
                  active.health > 95
                    ? "green"
                    : active.health > 85
                    ? "amber"
                    : "red"
                }
                bar={active.health}
              />
              <MetricRow
                label="Active Assets"
                value={`${active.assets}`}
                color="cyan"
              />
              <MetricRow
                label="Regional Risk"
                value={`${active.risk}%`}
                color={
                  active.risk < 15 ? "green" : active.risk < 30 ? "amber" : "red"
                }
                bar={active.risk}
              />
            </div>

            <Link
              href="/map-explorer"
              className="mt-6 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gs-cyan-500 hover:bg-gs-cyan-400 text-gs-bg-primary font-semibold text-sm rounded-md transition-colors"
            >
              <MapPin className="w-4 h-4" />
              Open Map Explorer
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </RevealGroup>
      </div>
    </section>
  );
}

function MetricRow({
  label,
  value,
  color,
  bar,
}: {
  label: string;
  value: string;
  color: "green" | "amber" | "red" | "cyan";
  bar?: number;
}) {
  const colorMap = {
    green: "#38A169",
    amber: "#D69E2E",
    red: "#E05252",
    cyan: "#22D3EE",
  };
  const c = colorMap[color];
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gs-text-secondary uppercase tracking-widest">
          {label}
        </span>
        <span
          className="font-mono text-sm font-bold tabular-nums"
          style={{ color: c }}
        >
          {value}
        </span>
      </div>
      {bar !== undefined && (
        <div className="h-1 bg-gs-bg-primary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(bar, 100)}%`, backgroundColor: c }}
          />
        </div>
      )}
    </div>
  );
}