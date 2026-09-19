export type NodeType = "transformer" | "substation" | "feeder" | "switch" | "generator" | "load_center";
export type NodeStatus = "healthy" | "warning" | "high_risk" | "critical" | "root_cause" | "affected";
export type EdgeType = "transmission" | "distribution" | "feeder" | "tie";
export type EdgeStatus = "normal" | "stressed" | "critical" | "cascade_path";
export type RegionId = "NR" | "WR" | "SR" | "ER" | "NER";

export interface NodeFeatures {
  load_pct: number;
  voltage_pu: number;
  temperature_c: number;
  age_years: number;
  capacity_mva: number;
}

export interface GridNode {
  id: string;
  type: NodeType;
  label: string;
  state: string;
  region: RegionId;
  lat: number;
  lon: number;
  features: NodeFeatures;
  position: { x: number; y: number; z: number };
  status: NodeStatus;
  risk_score: number;
  is_root_cause: boolean;
  is_in_cascade: boolean;
}

export interface GridEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  capacity_mva: number;
  current_load_pct: number;
  status: EdgeStatus;
  is_cascade_path: boolean;
}

export interface GridState {
  timestamp: string;
  grid_id?: string;
  nodes: GridNode[];
  edges: GridEdge[];
  overall_health_pct: number;
  total_load_mw: number;
  total_capacity_mw: number;
  regional_health: Record<RegionId, number>;
}

export interface RootCauseEntry {
  node_id: string;
  root_cause_score: number;
  explained_by_upstream: number;
  explained_by: string[];
  failure_mode: string;
  type?: string;
}

export interface FeatureContribution {
  feature: string;
  contribution_pct: number;
  direction: "increase" | "decrease";
  value: string;
}

export interface ConfidenceInterval { lower: number; upper: number; }

export interface CascadeStep {
  node_id: string;
  sequence: number;
  risk_at_step: number;
  failure_mode: string;
  time_offset_hours: number;
}

export interface PredictionResult {
  node_risk: Record<string, number>;
  root_cause_ranking: RootCauseEntry[];
  confidence_interval: ConfidenceInterval;
  cascade_path: CascadeStep[];
  cascade_risk_pct: number;
  prediction_window_hours: number;
  feature_contributions: Record<string, FeatureContribution[]>;
}

export interface InterventionAction {
  type: "load_reduction" | "load_redistribution" | "switch_open" | "reroute";
  target_node: string;
  parameter: string;
  value: number;
  description: string;
}

export interface InterventionResult {
  original_cascade_risk_pct: number;
  new_cascade_risk_pct: number;
  risk_reduction_pct: number;
  actions_applied: InterventionAction[];
  new_node_risk: Record<string, number>;
  cascade_eliminated: boolean;
  new_cascade_path: CascadeStep[];
}

export type DemoPhase =
  | "healthy" | "stress_applied" | "predicting"
  | "root_cause_found" | "cascade_visualized"
  | "intervention_applied" | "mitigated";

export type ProcessingStep =
  | "grid_state" | "simulation" | "gnn"
  | "risk_prediction" | "root_cause_analysis" | "intervention";

export interface SimulationConfig {
  demand_stress_pct: number;
  temperature_delta_c: number;
  load_multiplier: number;
  disabled_nodes: string[];
}

export interface CameraState {
  target: [number, number, number] | null;
  zoom: number;
  autoRotate: boolean;
  followCascade: boolean;
}
