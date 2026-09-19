import type { GridState, GridNode, PredictionResult, InterventionResult, SimulationConfig } from "./types";
import { buildHealthyScenario, buildStressScenario, buildMitigatedScenario } from "./mockData";
import { reportMockFallback, reportLiveData } from "./dataSource";

// Use the Next proxy by default so every local frontend port has one coherent
// API origin.  An explicit deployment URL can still override this.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

export const api = {
  async uploadCustomDataset(file: File): Promise<{ grid_state: GridState; summary: { filename: string; row_count: number; edge_count: number; column_mapping: Record<string, string | null>; note: string } }> {
    const res = await fetch(`${API_BASE_URL}/api/datasets/custom`, {
      method: "POST",
      headers: { "Content-Type": "text/csv", "X-Dataset-Filename": file.name },
      body: file,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || `HTTP error ${res.status}`);
    return data;
  },

  async checkHealth(): Promise<{ status: string; model_loaded: boolean; system?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/health`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      reportLiveData("/api/health");
      return await res.json();
    } catch (e) {
      reportMockFallback("/api/health", e);
      return { status: "offline", model_loaded: false };
    }
  },

  async getGridState(): Promise<GridState> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/grid/topology`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      reportLiveData("/api/grid/topology");
      return data;
    } catch (e) {
      reportMockFallback("/api/grid/topology", e);
      return buildHealthyScenario().gridState;
    }
  },

  async getLiveGrid(): Promise<{ grid_state: GridState; model_output: PredictionResult; last_updated: string }> {
    const res = await fetch(`${API_BASE_URL}/api/live/grid`);
    if (!res.ok) throw new Error(`Live grid unavailable (HTTP ${res.status})`);
    return res.json();
  },

  async predict(state: GridState): Promise<PredictionResult> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      reportLiveData("/api/predict");
      return data;
    } catch (e) {
      reportMockFallback("/api/predict", e);
      return buildStressScenario(18).prediction;
    }
  },

  async simulate(
    config: SimulationConfig,
    initiatingNode: string = "T17"
  ): Promise<{ gridState: GridState; prediction: PredictionResult }> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initiating_node: initiatingNode,
          demand_stress_pct: config.demand_stress_pct,
          stress_multiplier: 1.0 + (config.demand_stress_pct / 100.0) * 1.25,
          ambient_temp_c: 34.0 + (config.temperature_delta_c || 0),
          disabled_nodes: config.disabled_nodes || []
        }),
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      reportLiveData("/api/simulate");
      return data;
    } catch (e) {
      reportMockFallback("/api/simulate", e);
      return buildStressScenario(config.demand_stress_pct);
    }
  },

  async intervene(nodeId: string, loadReduction: number): Promise<InterventionResult> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/intervention`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initiating_node: nodeId,
          target_node: nodeId,
          load_shed_pct: loadReduction,
          load_reduction: loadReduction,
        }),
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      reportLiveData("/api/intervention");
      return data;
    } catch (e) {
      reportMockFallback("/api/intervention", e);
      return buildMitigatedScenario(loadReduction).intervention;
    }
  },

  async getModelInfo(): Promise<unknown> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/model/info`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn("Failed to fetch /api/model/info:", e);
      return null;
    }
  }
  ,
  async getLiveTransformers(limit = 12): Promise<{ timestamp: string; source: string; transformers: LiveTransformer[] }> {
    const res = await fetch(`${API_BASE_URL}/api/realtime/transformers?limit=${limit}`);
    if (!res.ok) throw new Error(`Live telemetry unavailable (HTTP ${res.status})`);
    return res.json();
  },

  async getScenarios(limit = 24): Promise<ScenarioSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/scenarios?limit=${limit}`);
    if (!res.ok) throw new Error(`Scenarios unavailable (HTTP ${res.status})`);
    return res.json();
  },

  async getCities(query: string): Promise<CityResult[]> {
    const res = await fetch(`${API_BASE_URL}/api/cities?q=${encodeURIComponent(query)}&limit=8`);
    if (!res.ok) throw new Error(`City search unavailable (HTTP ${res.status})`);
    return res.json();
  },

  async syncAlerts(): Promise<{ alerts: PersistedAlert[] }> {
    const res = await fetch(`${API_BASE_URL}/api/alerts/sync`, { method: "POST" });
    if (!res.ok) throw new Error(`Alert sync unavailable (HTTP ${res.status})`);
    return res.json();
  },

  async transitionAlert(assetId: string, workflowState: AlertWorkflowState): Promise<PersistedAlert> {
    const res = await fetch(`${API_BASE_URL}/api/alerts/${encodeURIComponent(assetId)}/transition`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workflow_state: workflowState }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || `Alert update failed (HTTP ${res.status})`);
    return data;
  },

  async updateGridNode(nodeId: string, changes: Partial<Pick<GridNode["features"], "load_pct" | "voltage_pu" | "temperature_c">>): Promise<{ node: GridNode; warning: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/admin/grid/nodes/${encodeURIComponent(nodeId)}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || `Node update failed (HTTP ${res.status})`);
    return data;
  }
};

export type LiveTransformer = { asset_id: string; city: string; state: string; voltage_kv: number; load_pct: number; voltage_pu: number; temperature_c: number; risk_pct: number; status: string };
export type ScenarioSummary = { id: string; title: string; description: string; pitch_step: number };
export type CityResult = { city?: string; state?: string; [key: string]: unknown };
export type AlertWorkflowState = "New" | "Acknowledged" | "Assigned" | "Resolved";
export type PersistedAlert = { asset_id: string; workflow_state: AlertWorkflowState; owner: string | null; telemetry: LiveTransformer; created_at: string; updated_at: string; events: { at: string; type: string; message: string }[] };
