import type { GridState, GridNode, GridEdge, PredictionResult, InterventionResult, NodeStatus, RegionId } from "./types";
import { INDIA_GRID_ASSETS, INDIA_GRID_EDGES, latLonToScene, IndiaGridAsset } from "./indiaGeo";

function buildNode(asset: IndiaGridAsset, overrides?: Partial<GridNode>): GridNode {
  const [x, y, z] = latLonToScene(asset.lat, asset.lon);
  return {
    id: asset.id,
    type: asset.type,
    label: asset.label,
    state: asset.state,
    region: asset.region as RegionId,
    lat: asset.lat,
    lon: asset.lon,
    position: { x, y, z },
    features: {
      load_pct: asset.baseLoad,
      voltage_pu: asset.baseVoltage,
      temperature_c: asset.baseTemp,
      age_years: asset.age,
      capacity_mva: asset.capacity,
    },
    status: "healthy",
    risk_score: 0.05,
    is_root_cause: false,
    is_in_cascade: false,
    ...overrides,
  };
}

function calculateRegionalHealth(nodes: GridNode[]): Record<RegionId, number> {
  const regions: RegionId[] = ["NR", "WR", "SR", "ER", "NER"];
  const result: Record<RegionId, number> = { NR: 100, WR: 100, SR: 100, ER: 100, NER: 100 };
  regions.forEach((r) => {
    const regionNodes = nodes.filter((n) => n.region === r);
    if (regionNodes.length === 0) return;
    const avgRisk = regionNodes.reduce((s, n) => s + n.risk_score, 0) / regionNodes.length;
    result[r] = Math.round((1 - avgRisk) * 100 * 10) / 10;
  });
  return result;
}

export function buildHealthyScenario(): { gridState: GridState; prediction: PredictionResult } {
  const nodes = INDIA_GRID_ASSETS.map((a) => buildNode(a));
  const edges: GridEdge[] = INDIA_GRID_EDGES.map((def, i) => ({
    id: `E${i}`,
    source: def.source,
    target: def.target,
    type: def.type as any,
    capacity_mva: def.capacity,
    current_load_pct: 40 + (i % 20),
    status: "normal",
    is_cascade_path: false,
  }));

  return {
    gridState: {
      timestamp: new Date().toISOString(),
      nodes,
      edges,
      overall_health_pct: 98.7,
      total_load_mw: 18420,
      total_capacity_mw: 26800,
      regional_health: calculateRegionalHealth(nodes),
    },
    prediction: {
      node_risk: Object.fromEntries(nodes.map((n) => [n.id, 0.03])),
      root_cause_ranking: [],
      confidence_interval: { lower: 95, upper: 99 },
      cascade_path: [],
      cascade_risk_pct: 3,
      prediction_window_hours: 24,
      feature_contributions: {},
    },
  };
}

export function buildStressScenario(stressPct: number = 18): { gridState: GridState; prediction: PredictionResult } {
  const mult = 1 + stressPct / 100;
  const nodes = INDIA_GRID_ASSETS.map((asset) => {
    const isT17 = asset.id === "T17";
    const isNearT17 = ["F8", "T3", "S3"].includes(asset.id);
    const loadInc = isT17 ? mult * 1.15 : isNearT17 ? mult * 1.05 : mult;
    const tempInc = isT17 ? mult * 1.2 : isNearT17 ? mult * 1.08 : mult * 1.02;
    const load = Math.min(asset.baseLoad * loadInc, 99);
    const temp = asset.baseTemp * tempInc;
    const voltage = asset.baseVoltage - (load > 80 ? 0.04 : load > 70 ? 0.02 : 0);

    let status: NodeStatus = "healthy";
    let risk = 0.05;
    if (isT17) {
      status = load > 85 ? "critical" : "high_risk";
      risk = Math.min(0.5 + stressPct / 100, 0.91);
    } else if (isNearT17) {
      status = load > 75 ? "warning" : "healthy";
      risk = 0.15 + stressPct / 200;
    }

    return buildNode(asset, {
      features: {
        load_pct: Math.round(load * 10) / 10,
        voltage_pu: Math.round(voltage * 100) / 100,
        temperature_c: Math.round(temp * 10) / 10,
        age_years: asset.age,
        capacity_mva: asset.capacity,
      },
      status,
      risk_score: Math.round(risk * 100) / 100,
    });
  });

  const edges: GridEdge[] = INDIA_GRID_EDGES.map((def, i) => {
    const isPath = (def.source === "T17" && def.target === "F8") ||
                   (def.source === "F8" && def.target === "T21") ||
                   (def.source === "T21" && def.target === "S4");
    return {
      id: `E${i}`,
      source: def.source,
      target: def.target,
      type: def.type as any,
      capacity_mva: def.capacity,
      current_load_pct: Math.min((40 + (i % 20)) * mult, 95),
      status: isPath ? "stressed" : "normal",
      is_cascade_path: isPath,
    };
  });

  return {
    gridState: {
      timestamp: new Date().toISOString(),
      nodes,
      edges,
      overall_health_pct: Math.max(98.7 - stressPct * 1.5, 60),
      total_load_mw: Math.round(18420 * mult),
      total_capacity_mw: 26800,
      regional_health: calculateRegionalHealth(nodes),
    },
    prediction: {
      node_risk: Object.fromEntries(nodes.map((n) => [n.id, n.risk_score])),
      root_cause_ranking: [
        { node_id: "T17", root_cause_score: 0.91, explained_by_upstream: 0.12, explained_by: ["S3"], failure_mode: "Thermal Overload" },
        { node_id: "T3", root_cause_score: 0.34, explained_by_upstream: 0.45, explained_by: ["S3", "T17"], failure_mode: "Voltage Sag" },
      ],
      confidence_interval: { lower: 82, upper: 93 },
      cascade_path: [
        { node_id: "T17", sequence: 0, risk_at_step: 0.91, failure_mode: "Thermal Overload", time_offset_hours: 0 },
        { node_id: "F8", sequence: 1, risk_at_step: 0.72, failure_mode: "Overload Transfer", time_offset_hours: 1.5 },
        { node_id: "T21", sequence: 2, risk_at_step: 0.65, failure_mode: "Cascading Load", time_offset_hours: 3 },
        { node_id: "S4", sequence: 3, risk_at_step: 0.58, failure_mode: "Substation Overload", time_offset_hours: 5 },
      ],
      cascade_risk_pct: 86,
      prediction_window_hours: 6,
      feature_contributions: {
        T17: [
          { feature: "Temperature Increase", contribution_pct: 31, direction: "increase", value: "+14°C" },
          { feature: "Load Growth", contribution_pct: 27, direction: "increase", value: "84.2%" },
          { feature: "Neighbor Transfer", contribution_pct: 21, direction: "increase", value: "+18.2 MVA" },
          { feature: "Asset Age", contribution_pct: 14, direction: "increase", value: "12 yrs" },
          { feature: "Voltage Deviation", contribution_pct: 7, direction: "decrease", value: "0.97 pu" },
        ],
      },
    },
  };
}

export function buildMitigatedScenario(loadReductionPct: number = 12): { gridState: GridState; prediction: PredictionResult; intervention: InterventionResult } {
  const stressed = buildStressScenario(18);
  const nodes = stressed.gridState.nodes.map((node) => {
    if (node.id === "T17") {
      return {
        ...node,
        features: { ...node.features, load_pct: Math.max(node.features.load_pct - loadReductionPct, 50), temperature_c: node.features.temperature_c - 10 },
        status: "warning" as NodeStatus,
        risk_score: 0.25,
        is_root_cause: false,
      };
    }
    if (["F8", "T21", "S4"].includes(node.id)) {
      return { ...node, status: "healthy" as NodeStatus, risk_score: 0.08, is_in_cascade: false };
    }
    return node;
  });

  const edges = stressed.gridState.edges.map((e) => ({ ...e, status: "normal" as const, is_cascade_path: false }));

  return {
    gridState: {
      ...stressed.gridState,
      nodes,
      edges,
      overall_health_pct: 92.4,
      regional_health: calculateRegionalHealth(nodes),
    },
    prediction: { ...stressed.prediction, cascade_risk_pct: 18, cascade_path: [] },
    intervention: {
      original_cascade_risk_pct: 86,
      new_cascade_risk_pct: 18,
      risk_reduction_pct: 68,
      actions_applied: [
        { type: "load_reduction", target_node: "T17", parameter: "load_pct", value: loadReductionPct, description: `Reduce T17 load by ${loadReductionPct}%` },
        { type: "load_redistribution", target_node: "T14", parameter: "load_pct", value: 4, description: "Redistribute to T14" },
        { type: "load_redistribution", target_node: "T19", parameter: "load_pct", value: 4, description: "Redistribute to T19" },
      ],
      new_node_risk: Object.fromEntries(nodes.map((n) => [n.id, n.risk_score])),
      cascade_eliminated: true,
      new_cascade_path: [],
    },
  };
}

export const DEMO_SCENARIOS = {
  healthy: () => buildHealthyScenario(),
  stress_applied: () => buildStressScenario(18),
  predicting: () => buildStressScenario(18),
  root_cause_found: () => {
    const s = buildStressScenario(18);
    const t = s.gridState.nodes.find((n) => n.id === "T17");
    if (t) { t.is_root_cause = true; t.status = "root_cause"; }
    return s;
  },
  cascade_visualized: () => {
    const s = buildStressScenario(18);
    const path = ["T17", "F8", "T21", "S4"];
    s.gridState.nodes.forEach((n) => {
      if (n.id === "T17") { n.is_root_cause = true; n.status = "root_cause"; }
      else if (path.includes(n.id)) { n.is_in_cascade = true; n.status = "affected"; }
    });
    return s;
  },
  intervention_applied: () => buildMitigatedScenario(12),
  mitigated: () => buildMitigatedScenario(12),
};
