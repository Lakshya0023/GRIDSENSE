"""
GridSense Predefined & Authoritative Scenarios:
Loads scenarios from the authoritative C:\\GridSense\\C2C\\dataset\\scenarios.csv
and provides calibrated benchmarks and live simulation parameters.
"""

import os
import pandas as pd
from typing import Dict, Any, List, Optional
from pathlib import Path

DATASET_DIR = Path(__file__).resolve().parent.parent / "ml" / "datasets"
if not DATASET_DIR.exists():
    DATASET_DIR = Path(__file__).resolve().parent.parent / "dataset"
SCENARIOS_CSV = DATASET_DIR / "scenarios.csv"

# In-memory cache for fast lookup
_SCENARIO_CACHE: Dict[str, Dict[str, Any]] = {}
_SCENARIO_LIST: List[Dict[str, Any]] = []

def _load_authoritative_scenarios():
    global _SCENARIO_CACHE, _SCENARIO_LIST
    if _SCENARIO_CACHE:
        return

    if SCENARIOS_CSV.exists():
        try:
            df = pd.read_csv(SCENARIOS_CSV, encoding='utf-8')
            for _, r in df.iterrows():
                scen_id = str(r['scenario_id']).strip()
                item = {
                    "id": scen_id,
                    "name": f"{r['scenario_type'].replace('_', ' ').title()}: {r.get('initiating_city', 'City')} ({scen_id})",
                    "scenario_type": str(r.get('scenario_type', 'cascade_emergency')),
                    "description": f"Cascade scenario initiated at {r.get('initiating_node', 'N/A')} ({r.get('initiating_type', 'node')}) in {r.get('initiating_city', '')}, {r.get('initiating_state', '')}. Stress: x{r.get('stress_multiplier', 1.0):.2f}. Cascade size: {r.get('cascade_size', 0)} assets, Population affected: {int(r.get('population_affected', 0)):,}.",
                    "initiating_node": str(r.get('initiating_node', 'IN-WR-HUB')),
                    "initiating_city": str(r.get('initiating_city', '')),
                    "initiating_state": str(r.get('initiating_state', '')),
                    "stress_multiplier": float(r.get('stress_multiplier', 1.5)),
                    "load_multiplier": float(r.get('load_multiplier', 1.0)),
                    "weather_factor": float(r.get('weather_factor', 1.0)),
                    "ambient_temp_c": round(30.0 + float(r.get('weather_factor', 1.0) - 1.0) * 80.0, 1),
                    "base_risk_pct": round(float(r.get('cascade_risk_pct', 5.0)), 1),
                    "cascade_path": str(r.get('cascade_path', '')).split("->") if pd.notna(r.get('cascade_path')) else [],
                    "population_affected": int(r.get('population_affected', 0)),
                    "split": str(r.get('split', 'train'))
                }
                _SCENARIO_CACHE[scen_id] = item
                _SCENARIO_CACHE[scen_id.lower()] = item
        except Exception as e:
            print(f"Error loading scenarios.csv: {e}")

    # Built-in representative high-impact scenarios mapping to dataset types
    canonical_presets = {
        "cascade_emergency": {
            "id": "cascade_emergency",
            "name": "Cascade Emergency: Delhi National Backbone",
            "scenario_type": "cascade_emergency",
            "description": "Imminent cascading blackout: transformer thermal breach rapidly propagating across regional interconnect corridors.",
            "initiating_node": "DEL-TRAN-02",
            "initiating_city": "Delhi",
            "initiating_state": "Delhi",
            "stress_multiplier": 1.95,
            "ambient_temp_c": 38.5,
            "base_risk_pct": 88.4,
            "cascade_path": ["DEL-TRAN-02", "DEL-FEED-03", "DEL-SUBS-01", "MUM-TRAN-02"],
            "population_affected": 18500000
        },
        "heatwave": {
            "id": "heatwave",
            "name": "Extreme Heatwave & Cooling Surge",
            "scenario_type": "heatwave",
            "description": "Regional summer heatwave pushing grid ambient temperatures to 44°C and elevating cooling demand by +38%.",
            "initiating_node": "MUM-TRAN-02",
            "initiating_city": "Mumbai",
            "initiating_state": "Maharashtra",
            "stress_multiplier": 1.75,
            "ambient_temp_c": 44.0,
            "base_risk_pct": 74.2,
            "cascade_path": ["MUM-TRAN-02", "MUM-FEED-03", "MUM-SUBS-01"],
            "population_affected": 12400000
        },
        "transformer_overload": {
            "id": "transformer_overload",
            "name": "Transformer Overload (Critical Hub)",
            "scenario_type": "transformer_overload",
            "description": "Severe thermal loading on main step-up transformer causing secondary line congestion.",
            "initiating_node": "T17",
            "initiating_city": "Delhi NCR",
            "initiating_state": "Delhi",
            "stress_multiplier": 1.82,
            "ambient_temp_c": 34.0,
            "base_risk_pct": 82.0,
            "cascade_path": ["T17", "F8", "T21", "S4"],
            "population_affected": 6500000
        },
        "line_outage": {
            "id": "line_outage",
            "name": "Transmission Corridor Outage (N-1)",
            "scenario_type": "line_outage",
            "description": "Unexpected branch trip redistributing bulk flow onto parallel sub-transmission paths.",
            "initiating_node": "DEL-FEED-03",
            "initiating_city": "Delhi",
            "initiating_state": "Delhi",
            "stress_multiplier": 1.45,
            "ambient_temp_c": 31.0,
            "base_risk_pct": 68.5,
            "cascade_path": ["DEL-FEED-03", "DEL-SUBS-01"],
            "population_affected": 4200000
        },
        "high_demand": {
            "id": "high_demand",
            "name": "Peak Industrial Demand Peak",
            "scenario_type": "high_demand",
            "description": "Simultaneous peak manufacturing load across Western & Northern grids.",
            "initiating_node": "BEN-TRAN-02",
            "initiating_city": "Bengaluru",
            "initiating_state": "Karnataka",
            "stress_multiplier": 1.35,
            "ambient_temp_c": 32.0,
            "base_risk_pct": 59.0,
            "cascade_path": ["BEN-TRAN-02", "BEN-FEED-03"],
            "population_affected": 3100000
        },
        "normal": {
            "id": "normal",
            "name": "Normal Operation (Secure N-0)",
            "scenario_type": "normal_operation",
            "description": "Grid operating securely within standard voltage and thermal limits across all tiers.",
            "initiating_node": "DEL-SUBS-01",
            "initiating_city": "Delhi",
            "initiating_state": "Delhi",
            "stress_multiplier": 1.0,
            "ambient_temp_c": 28.0,
            "base_risk_pct": 3.2,
            "cascade_path": [],
            "population_affected": 0
        }
    }

    for k, v in canonical_presets.items():
        _SCENARIO_CACHE[k] = v

    # Build public list: presets first, then first 20 representative scenarios from CSV
    _SCENARIO_LIST = [
        {"id": v["id"], "name": v["name"], "description": v["description"], "initiating_node": v["initiating_node"], "base_risk_pct": v["base_risk_pct"]}
        for v in canonical_presets.values()
    ]

    csv_count = 0
    for scen_id, v in _SCENARIO_CACHE.items():
        if scen_id.startswith("IND-") and csv_count < 25:
            _SCENARIO_LIST.append({
                "id": v["id"],
                "name": v["name"],
                "description": v["description"],
                "initiating_node": v["initiating_node"],
                "base_risk_pct": v["base_risk_pct"]
            })
            csv_count += 1

def get_scenario_list() -> List[Dict[str, Any]]:
    _load_authoritative_scenarios()
    return _SCENARIO_LIST

def get_scenario(scenario_id: str) -> Dict[str, Any]:
    _load_authoritative_scenarios()
    scen_key = scenario_id.strip().lower()
    if scen_key in _SCENARIO_CACHE:
        return _SCENARIO_CACHE[scen_key]
    if scenario_id in _SCENARIO_CACHE:
        return _SCENARIO_CACHE[scenario_id]
    return _SCENARIO_CACHE.get("cascade_emergency", {})

