/**
 * Plant predictive-maintenance telemetry contract.
 *
 * Carried over from the standalone `dashboard.html`, which subscribed to the
 * HiveMQ broker directly over WebSocket. Same broker, same topics, same payload
 * shape — now typed and consumed by React instead of imperative DOM updates.
 */

export const PLANT_BROKER_URL = "wss://broker.hivemq.com:8884/mqtt";

export const PLANT_TOPICS = [
  "powerplant/telemetry/full",
  "powerplant/alerts/#",
  "powerplant/grid/#",
  "powerplant/brush/#",
] as const;

/** Rolling window length for the trend chart, matching the original dashboard. */
export const MAX_HISTORY = 60;

export type PlantPhase = string;

export type PlantTelemetry = {
  timestamp?: string;
  temperature?: number;
  vibration?: number;
  current?: number;
  resistance?: number;
  voltage_a?: number;
  voltage_b?: number;
  voltage_c?: number;
  health_score?: number;
  rul_hours?: number;
  wear_pct?: number;
  phase?: PlantPhase;
  source?: string;
};

export type PlantCascadePrediction = {
  fault_type: string;
  fault_proba: number;
  blackout_risk: boolean;
  blackout_proba: number;
  sections_affected: number;
  estimated_mw_loss: number;
  recommended_action: string;
};

export type PlantHealthPrediction = {
  health_score: number;
  is_anomaly: boolean;
  failure_type: string;
  confidence: number;
};

export type PlantPrediction = {
  timestamp?: string;
  models_loaded?: boolean;
  rul_hours: number | null;
  health: PlantHealthPrediction | null;
  cascade: PlantCascadePrediction | null;
  alert_level: "HEALTHY" | "WARNING" | "CRITICAL" | "FAILURE" | string;
  summary?: string;
};

export type PlantCascadeEvent = {
  cascade_step?: number;
  event?: string;
  component?: string;
  severity?: string;
  failure_mode?: string;
  [key: string]: unknown;
};

export type PlantAlert = {
  timestamp: string;
  level: string;
  message: string;
  rul_hours: number | null;
};

export type PlantHistoryPoint = {
  label: string;
  temperature: number;
  vibration: number;
  health: number;
};

/** Where the panel's data came from, so the UI can be honest about it. */
export type PlantFeedSource = "mqtt" | "api" | "offline";

/**
 * The plant cascade narrative the simulator walks through. Order matters — it is
 * the physical propagation sequence, so the index doubles as progress.
 */
export const CASCADE_SEQUENCE = [
  "Brush wear",
  "Excitation loss",
  "Generator trip",
  "Phase A fault",
  "Phase B fault",
  "Relay operation",
  "Section 3 blackout",
  "Recovery",
] as const;

export function alertTone(level: string): "critical" | "warning" | "healthy" {
  if (level === "CRITICAL" || level === "FAILURE") return "critical";
  if (level === "WARNING") return "warning";
  return "healthy";
}
