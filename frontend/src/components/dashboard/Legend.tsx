"use client";

export function Legend() {
  return (
    <div className="absolute top-4 left-4 z-10 panel p-3 backdrop-blur-md bg-grid-bg-panel/80">
      <div className="label mb-2">LEGEND</div>
      <div className="space-y-1.5">
        <LegendItem color="#39FF88" label="Healthy" />
        <LegendItem color="#FFD166" label="Warning" />
        <LegendItem color="#FF3B5C" label="Critical / Root" />
        <LegendItem color="#00E5FF" label="Selected" />
      </div>
      <div className="mt-2 pt-2 border-t border-grid-border">
        <div className="label mb-1.5">ASSETS</div>
        <div className="space-y-1 text-[9px] font-mono text-grid-text-secondary">
          <div>◉ Generator</div>
          <div>▣ Substation</div>
          <div>⚙ Transformer</div>
          <div>◈ Load Center</div>
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
      <span className="text-grid-text-secondary">{label}</span>
    </div>
  );
}
