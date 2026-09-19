"""
GridSense FastAPI Application Server
Provides REST API endpoints and serves the enterprise dark-mode interactive frontend.
"""

import os
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .simulator import GridSimulator, global_simulator
from .gnn_engine import GNNEngine, global_gnn_engine
from .causal_uncertainty import CausalUncertaintyEngine, global_causal_engine
from .intervention import InterventionOptimizer, global_intervention_optimizer
from .scenarios import CANNED_SCENARIOS, get_canned_scenarios

app = FastAPI(
    title="GridSense AI API",
    description="Cascading Failure Prediction, Root-Cause Disambiguation, and What-If Mitigation for Power Grids.",
    version="1.0.0"
)

# Enable CORS for frontend flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request Models
class SimulateRequest(BaseModel):
    initiating_node: str = Field(default="T17", description="ID of asset receiving initial stress")
    stress_multiplier: float = Field(default=1.85, ge=1.0, le=3.5, description="Load multiplication factor")
    ambient_temp_c: float = Field(default=34.0, ge=10.0, le=55.0, description="Ambient temperature in deg C")
    max_steps: int = Field(default=6, ge=1, le=12, description="Max cascade simulation steps")


class InterveneRequest(BaseModel):
    initiating_node: str = Field(default="T17", description="Stressed asset ID")
    stress_multiplier: float = Field(default=1.85, ge=1.0, le=3.5)
    ambient_temp_c: float = Field(default=34.0, ge=10.0, le=55.0)
    load_shed_pct: float = Field(default=12.0, ge=0.0, le=50.0, description="Load reduction percentage")


@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {
        "status": "online",
        "system": "GridSense AI Core",
        "gnn_model_loaded": True,
        "conformal_calibration_level": "90% Coverage",
        "topology": "IEEE 33-Bus Feeder System"
    }


@app.get("/api/grid/topology")
def get_grid_topology():
    """Returns baseline healthy IEEE-33 grid state."""
    pf = global_simulator.solve_power_flow()
    grid_state = global_simulator.export_grid_state(pf)
    return grid_state


@app.post("/api/simulate")
def run_simulation(req: SimulateRequest):
    """
    Executes live physics power flow & cascade simulation, followed by
    GNN risk estimation, Granger root-cause ranking, and conformal uncertainty.
    """
    sim_res = global_simulator.simulate_cascade(
        initiating_node=req.initiating_node,
        stress_multiplier=req.stress_multiplier,
        ambient_temp_c=req.ambient_temp_c,
        max_steps=req.max_steps
    )

    grid_state = global_simulator.export_grid_state(
        power_flow_result=sim_res["final_power_flow"],
        tripped_nodes=set(sim_res["tripped_nodes"])
    )

    gnn_out = global_gnn_engine.predict_risk(grid_state)
    root_causes = global_causal_engine.rank_root_causes(
        node_risks=gnn_out["node_risk"],
        time_series=sim_res["time_series"],
        grid_state=grid_state,
        initiating_candidate=req.initiating_node
    )
    conf_intervals = global_causal_engine.compute_conformal_intervals(gnn_out["node_risk"])
    cascade_path = global_causal_engine.trace_cascade_path(
        initiating_node=req.initiating_node,
        node_risks=gnn_out["node_risk"],
        tripped_sequence=sim_res["cascade_sequence"]
    )
    physics_checks = global_causal_engine.evaluate_physics_sanity(grid_state)
    rec = global_intervention_optimizer.generate_recommendation(
        target_node=req.initiating_node,
        initial_risk=gnn_out["node_risk"].get(req.initiating_node, 0.86),
        node_risks=gnn_out["node_risk"]
    )

    return {
        "grid_state": grid_state,
        "model_output": {
            "node_risk": gnn_out["node_risk"],
            "time_to_critical_hours": gnn_out["time_to_critical_hours"],
            "root_cause_ranking": root_causes,
            "confidence_interval": conf_intervals,
            "conformal_coverage_pct": 90.0,
            "cascade_path": cascade_path,
            "cascade_risk_pct": gnn_out["cascade_risk_pct"],
            "physics_sanity_checks": physics_checks,
            "recommended_intervention": rec
        },
        "simulation_meta": {
            "initiating_node": req.initiating_node,
            "stress_multiplier": req.stress_multiplier,
            "tripped_nodes": sim_res["tripped_nodes"],
            "blackout_pct": sim_res["total_blackout_pct"],
            "time_series_steps": len(sim_res["time_series"])
        }
    }


@app.post("/api/predict")
def predict_from_state(grid_state: Dict[str, Any]):
    """Runs GNN and causal inference directly on an arbitrary grid_state JSON."""
    gnn_out = global_gnn_engine.predict_risk(grid_state)
    root_causes = global_causal_engine.rank_root_causes(
        node_risks=gnn_out["node_risk"],
        time_series=None,
        grid_state=grid_state
    )
    conf_intervals = global_causal_engine.compute_conformal_intervals(gnn_out["node_risk"])
    highest_node = max(gnn_out["node_risk"], key=gnn_out["node_risk"].get)
    cascade_path = global_causal_engine.trace_cascade_path(highest_node, gnn_out["node_risk"])
    physics_checks = global_causal_engine.evaluate_physics_sanity(grid_state)
    rec = global_intervention_optimizer.generate_recommendation(
        target_node=highest_node,
        initial_risk=gnn_out["node_risk"].get(highest_node, 0.5),
        node_risks=gnn_out["node_risk"]
    )

    return {
        "model_output": {
            "node_risk": gnn_out["node_risk"],
            "time_to_critical_hours": gnn_out["time_to_critical_hours"],
            "root_cause_ranking": root_causes,
            "confidence_interval": conf_intervals,
            "conformal_coverage_pct": 90.0,
            "cascade_path": cascade_path,
            "cascade_risk_pct": gnn_out["cascade_risk_pct"],
            "physics_sanity_checks": physics_checks,
            "recommended_intervention": rec
        }
    }


@app.post("/api/intervene")
def run_intervention(req: InterveneRequest):
    """
    Executes what-if load mitigation and power rerouting.
    Returns side-by-side Before vs. After state and metrics comparison.
    """
    res = global_intervention_optimizer.apply_intervention_and_evaluate(
        initiating_node=req.initiating_node,
        stress_multiplier=req.stress_multiplier,
        ambient_temp_c=req.ambient_temp_c,
        load_shed_pct=req.load_shed_pct
    )
    return res


@app.get("/api/scenarios")
def list_scenarios():
    """Returns pre-calibrated canned scenarios for demo presentations."""
    scenarios_summary = []
    for s_id, s_data in CANNED_SCENARIOS.items():
        scenarios_summary.append({
            "id": s_id,
            "title": s_data.get("title"),
            "description": s_data.get("description"),
            "pitch_step": s_data.get("pitch_step")
        })
    return scenarios_summary


@app.get("/api/scenarios/{scenario_id}")
def get_scenario_detail(scenario_id: str):
    """Fetches full pre-calibrated scenario data by ID."""
    if scenario_id not in CANNED_SCENARIOS:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return CANNED_SCENARIOS[scenario_id]


# Serve frontend static assets
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

    @app.get("/")
    def serve_frontend_root():
        return FileResponse(os.path.join(frontend_dir, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
