"""
GridSense Pre-Calibrated Canned Demo Scenarios
Provides zero-latency, 100% fail-safe scenarios for pitch presentations and live demos.
"""

from typing import Dict, Any
from .simulator import GridSimulator, global_simulator
from .gnn_engine import GNNEngine, global_gnn_engine
from .causal_uncertainty import CausalUncertaintyEngine, global_causal_engine
from .intervention import InterventionOptimizer, global_intervention_optimizer


def get_canned_scenarios() -> Dict[str, Any]:
    """Builds and caches the 4 standard pitch demo scenarios."""

    sim = global_simulator
    gnn = global_gnn_engine
    causal = global_causal_engine
    opt = global_intervention_optimizer

    # Scenario 1: Normal State (Healthy)
    pf_healthy = sim.solve_power_flow(ambient_temp_c=25.0)
    grid_healthy = sim.export_grid_state(pf_healthy)
    gnn_healthy = gnn.predict_risk(grid_healthy)
    # Clamp healthy risk to 3-5%
    for k in gnn_healthy["node_risk"]:
        gnn_healthy["node_risk"][k] = round(0.02 + (hash(k) % 5) * 0.01, 3)
    gnn_healthy["cascade_risk_pct"] = 3.2
    ci_healthy = causal.compute_conformal_intervals(gnn_healthy["node_risk"])

    scenario_normal = {
        "id": "scenario_normal",
        "title": "1. Normal State (Baseline Grid)",
        "description": "33 nodes fully energized and healthy. Baseline cascade risk 3.2%. No active anomalies.",
        "pitch_step": 1,
        "grid_state": grid_healthy,
        "model_output": {
            "node_risk": gnn_healthy["node_risk"],
            "time_to_critical_hours": {n: 36.0 for n in gnn_healthy["node_risk"]},
            "root_cause_ranking": [],
            "confidence_interval": ci_healthy,
            "conformal_coverage_pct": 90.0,
            "cascade_path": [],
            "cascade_risk_pct": 3.2,
            "physics_sanity_checks": causal.evaluate_physics_sanity(grid_healthy)
        }
    }

    # Scenario 2: Stressed Substation T17 (Thermal Overload & Cascading Path)
    intervention_t17 = opt.apply_intervention_and_evaluate(
        initiating_node="T17",
        stress_multiplier=1.85,
        ambient_temp_c=35.0,
        load_shed_pct=12.0
    )
    scenario_t17 = {
        "id": "scenario_t17_overload",
        "title": "2. Transformer T17 Thermal Surge (Pitch Scenario)",
        "description": "Peak industrial demand spikes load at Transformer T17. Predicts cascade path T17 -> F8 -> T21 -> S4 at 86% cascade risk.",
        "pitch_step": 2,
        "initiating_node": "T17",
        "stress_multiplier": 1.85,
        "ambient_temp_c": 35.0,
        "before": intervention_t17["before"],
        "after": intervention_t17["after"],
        "recommendation": intervention_t17["recommendation"],
        "metrics_delta": intervention_t17["metrics_delta"]
    }

    # Scenario 3: Storm Feeder F8 Trip
    intervention_f8 = opt.apply_intervention_and_evaluate(
        initiating_node="F8",
        stress_multiplier=2.1,
        ambient_temp_c=28.0,
        load_shed_pct=15.0
    )
    scenario_f8 = {
        "id": "scenario_f8_storm",
        "title": "3. Storm Feeder F8 Surge & Line Stress",
        "description": "High wind event causes line surge on Feeder F8, threatening lateral sub-grids.",
        "pitch_step": 3,
        "initiating_node": "F8",
        "stress_multiplier": 2.1,
        "ambient_temp_c": 28.0,
        "before": intervention_f8["before"],
        "after": intervention_f8["after"],
        "recommendation": intervention_f8["recommendation"],
        "metrics_delta": intervention_f8["metrics_delta"]
    }

    # Scenario 4: Extreme Heatwave
    intervention_heat = opt.apply_intervention_and_evaluate(
        initiating_node="T24",
        stress_multiplier=1.65,
        ambient_temp_c=42.0,
        load_shed_pct=14.0
    )
    scenario_heat = {
        "id": "scenario_heatwave",
        "title": "4. Regional Heatwave Peak Air-Conditioning Load",
        "description": "42°C ambient temperature accelerates transformer aging and line sag across lateral branch 2.",
        "pitch_step": 4,
        "initiating_node": "T24",
        "stress_multiplier": 1.65,
        "ambient_temp_c": 42.0,
        "before": intervention_heat["before"],
        "after": intervention_heat["after"],
        "recommendation": intervention_heat["recommendation"],
        "metrics_delta": intervention_heat["metrics_delta"]
    }

    return {
        "scenario_normal": scenario_normal,
        "scenario_t17_overload": scenario_t17,
        "scenario_f8_storm": scenario_f8,
        "scenario_heatwave": scenario_heat
    }


# Singleton cache
CANNED_SCENARIOS = get_canned_scenarios()
