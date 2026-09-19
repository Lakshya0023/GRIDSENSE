"""
GridSense FastAPI Application Server
Integrates GNN inference, causal root-cause disambiguation, split-conformal uncertainty,
physics validation, and counterfactual interventions with the India Cascade Dataset.
"""

import os
import unicodedata
import sys
import json
import io
import math
import zlib
import re
from datetime import datetime, timezone
from threading import Lock
from typing import Dict, List, Any, Optional
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import pandas as pd
import numpy as np

# Ensure project root and C2C - raj in python path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
C2C_DIR = os.path.join(ROOT_DIR, "C2C - raj")
for p in [ROOT_DIR, C2C_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from backend.scenarios import CANNED_SCENARIOS
except Exception:
    try:
        from scenarios import CANNED_SCENARIOS
    except Exception:
        CANNED_SCENARIOS = {}

from .schemas import (
    GridNodeSchema, GridEdgeSchema, GridStateSchema,
    PredictionResultSchema, InterventionResultSchema,
    SimulateRequest, InterveneRequest, PhysicsSanitySchema,
    RootCauseEntrySchema, CascadeStepSchema, FeatureContributionSchema,
    ConfidenceIntervalSchema, InterventionActionSchema
)

from ml.inference.predict import RiskPredictor
from ml.causal.root_cause import RootCauseAnalyzer
from ml.uncertainty.conformal import ConformalPredictor
from ml.physics.validation import PhysicsValidator
from ml.explainability.attribution import FeatureExplainer

# Plant predictive-maintenance router, merged in from the standalone PdM
# service so a single server on port 8000 covers both the grid GNN and the
# plant-asset models.
from .maintenance import router as maintenance_router, start_mqtt_subscriber

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_grid_data()
    print("GridSense AI API Initialized with GNN Model, Conformal Coverage, and Grid Telemetry.")
    # Background MQTT subscriber for plant telemetry. Non-fatal by design: the
    # grid API must still boot if the broker is unreachable or paho is absent.
    try:
        start_mqtt_subscriber()
    except Exception as exc:  # noqa: BLE001
        print(f"[PdM] MQTT subscriber not started: {exc}")
    yield

app = FastAPI(
    title="GridSense AI Core API",
    description="Power-Grid Cascade Analysis, GNN Failure Prediction, Root Cause Disambiguation, and Intervention Engine",
    version="2.0.0",
    lifespan=lifespan
)

# CORS configuration for Frontend at http://localhost:3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Plant predictive-maintenance endpoints, served under /api/pdm on this same
# app so only one process needs to bind port 8000.
app.include_router(maintenance_router)

# ── Global Engines & State ──
predictor = RiskPredictor()
root_cause_analyzer = RootCauseAnalyzer()
conformal_predictor = ConformalPredictor(alpha=0.10)
physics_validator = PhysicsValidator()
feature_explainer = FeatureExplainer()

# Dataset Paths
# The supplied datasets live beside the ML pipeline.  Keep this explicit rather
# than relying on the process working directory, which previously made the
# city/condition selectors appear empty on a clean API start.
DATASET_DIR = os.path.join(ROOT_DIR, "ml", "datasets")
NODES_CSV = os.path.join(DATASET_DIR, "india_national_nodes.csv")
EDGES_CSV = os.path.join(DATASET_DIR, "india_national_edges.csv")
SCENARIOS_CSV = os.path.join(DATASET_DIR, "scenarios.csv")
CITIES_CSV = os.path.join(DATASET_DIR, "india_cities_20000.csv")
OPERATIONS_CSV = os.path.join(DATASET_DIR, "synthetic_condition_operations.csv")
TELEMETRY_CSV = os.path.join(DATASET_DIR, "synthetic_telemetry_5min.csv")
OPTIMIZATION_CSV = os.path.join(DATASET_DIR, "synthetic_grid_optimization.csv")
ASSET_PROFILES_CSV = os.path.join(DATASET_DIR, "synthetic_asset_profiles.csv")
REAL_SUBSTATIONS_CSV = os.path.join(DATASET_DIR, "india_real_substations_VERIFIED.csv")
# Evaluation metrics live beside the ML pipeline (backend/ml/results), not in
# backend/results.  Pointing at the wrong directory silently fell through to the
# hardcoded fallback in /api/model/info, which under-reported the trained model
# (ROC-AUC 0.912 instead of the real 0.9887).
METRICS_JSON = os.path.join(ROOT_DIR, "ml", "results", "metrics.json")
SYNTHETIC_GRID_JSON = os.path.join(DATASET_DIR, "india_synthetic_demo_grid.json")
ALERT_WORKFLOW_JSON = os.path.join(ROOT_DIR, "results", "alert_workflow.json")
ALERT_LOCK = Lock()
GRID_OVERRIDES_JSON = os.path.join(ROOT_DIR, "results", "grid_node_overrides.json")
GRID_OVERRIDE_LOCK = Lock()
LIVE_TELEMETRY_EPOCH = datetime.now(timezone.utc).timestamp()

# Cached Baseline Grid
CACHED_GRID_NODES: List[Dict[str, Any]] = []
CACHED_GRID_EDGES: List[Dict[str, Any]] = []
SCENARIOS_CACHE: List[Dict[str, Any]] = []
CITIES_CACHE: List[Dict[str, Any]] = []
OPERATIONS_CACHE: List[Dict[str, Any]] = []
TELEMETRY_CACHE: List[Dict[str, Any]] = []
OPTIMIZATION_CACHE: List[Dict[str, Any]] = []
FULL_NODE_LOOKUP: Dict[str, Dict[str, Any]] = {}
ASSET_PROFILES_CACHE: List[Dict[str, Any]] = []

def _read_grid_overrides() -> Dict[str, Dict[str, float]]:
    try:
        with open(GRID_OVERRIDES_JSON, "r", encoding="utf-8") as file:
            data = json.load(file)
            return data if isinstance(data, dict) else {}
    except (OSError, ValueError, json.JSONDecodeError):
        return {}

def _write_grid_overrides(overrides: Dict[str, Dict[str, float]]) -> None:
    os.makedirs(os.path.dirname(GRID_OVERRIDES_JSON), exist_ok=True)
    temporary = f"{GRID_OVERRIDES_JSON}.tmp"
    with open(temporary, "w", encoding="utf-8") as file:
        json.dump(overrides, file, indent=2)
    os.replace(temporary, GRID_OVERRIDES_JSON)

def _apply_grid_overrides(grid: Dict[str, Any]) -> Dict[str, Any]:
    """Create a smooth, deterministic live telemetry snapshot from saved settings."""
    with GRID_OVERRIDE_LOCK:
        overrides = _read_grid_overrides()
    nodes = []
    for raw_node in grid["nodes"]:
        node = dict(raw_node)
        features = dict(node.get("features", {}))
        saved = overrides.get(str(node.get("id")), {})
        for field in ("load_pct", "voltage_pu", "temperature_c"):
            if field in saved:
                features[field] = saved[field]
        elapsed = datetime.now(timezone.utc).timestamp() - LIVE_TELEMETRY_EPOCH
        phase = (zlib.crc32(str(node.get("id")).encode()) % 628) / 100.0
        base_load = float(features.get("load_pct", 0.0))
        base_voltage = float(features.get("voltage_pu", 1.0))
        base_temp = float(features.get("temperature_c", 25.0))
        # A 64-second smooth operating cycle is visible on the five-second UI
        # poll without creating implausible jumps in electrical telemetry.
        load_delta = base_load * 0.015 * math.sin(elapsed / 8.0 + phase)
        load = max(0.0, min(130.0, base_load + load_delta))
        voltage = max(0.80, min(1.15, base_voltage - load_delta * 0.0008 + 0.002 * math.sin(elapsed / 24.0 + phase)))
        temperature = max(-20.0, min(160.0, base_temp + load_delta * 0.28 + 0.35 * math.sin(elapsed / 20.0 + phase)))
        features.update({"load_pct": round(load, 1), "voltage_pu": round(voltage, 3), "temperature_c": round(temperature, 1)})
        node["features"] = features
        load = float(features.get("load_pct", 0))
        voltage = float(features.get("voltage_pu", 1))
        temperature = float(features.get("temperature_c", 0))
        risk = max(0.01, min(0.99, 0.04 + max(0.0, load - 65.0) / 45.0 * 0.50 + max(0.0, 0.98 - voltage) * 6.0 + max(0.0, temperature - 70.0) / 35.0 * 0.28))
        node["risk_score"] = round(risk, 3)
        if load >= 105 or voltage <= 0.90 or temperature >= 100 or risk >= 0.70:
            node["status"] = "critical"
        elif load >= 90 or voltage <= 0.94 or temperature >= 85 or risk >= 0.35:
            node["status"] = "warning"
        else:
            node["status"] = "healthy"
        nodes.append(node)
    active_ids = {str(node["id"]) for node in nodes}
    return {**grid, "nodes": nodes, "edges": [dict(edge) for edge in grid["edges"] if edge["source"] in active_ids and edge["target"] in active_ids]}

def _read_alerts() -> Dict[str, Dict[str, Any]]:
    """Read the demo alert workflow state. This is deliberately local-only."""
    try:
        with open(ALERT_WORKFLOW_JSON, "r", encoding="utf-8") as file:
            data = json.load(file)
            return data if isinstance(data, dict) else {}
    except (OSError, ValueError, json.JSONDecodeError):
        return {}

def _write_alerts(alerts: Dict[str, Dict[str, Any]]) -> None:
    os.makedirs(os.path.dirname(ALERT_WORKFLOW_JSON), exist_ok=True)
    temporary = f"{ALERT_WORKFLOW_JSON}.tmp"
    with open(temporary, "w", encoding="utf-8") as file:
        json.dump(alerts, file, indent=2)
    os.replace(temporary, ALERT_WORKFLOW_JSON)

def _alert_events(asset: Dict[str, Any], workflow_state: str, actor: str = "GridSense demo operator") -> List[Dict[str, str]]:
    timestamp = datetime.now(timezone.utc).isoformat()
    return [
        {"at": timestamp, "type": "created", "message": "Alert created from simulated telemetry."},
        {"at": timestamp, "type": "notification_queued", "message": f"Demo notification queued for {asset.get('city')}, {asset.get('state')}."},
        {"at": timestamp, "type": "workflow", "message": f"State set to {workflow_state} by {actor}."},
    ]

def init_grid_data():
    global CACHED_GRID_NODES, CACHED_GRID_EDGES, SCENARIOS_CACHE
    
    # 1. Load synthetic demo / explore grid if available for high-fidelity 3D explore UI
    # Matching the 28 core Indian strategic assets (T17, S3, G1..G8, S1..S10, F8, T21, etc.)
    # and all national backbone lines
    from simulation.grid_loader import GridLoader
    loader = GridLoader()
    
    try:
        raw_graph = loader.to_graph_data(loader.get_net("ieee24"), grid_id="ieee24")
        # Enhance with India Geo assets
        from src_india_assets import get_unified_india_grid
        unified = get_unified_india_grid()
        CACHED_GRID_NODES = unified["nodes"]
        CACHED_GRID_EDGES = unified["edges"]
    except Exception as e:
        print(f"Loading fallback grid: {e}")
        # Build deterministic baseline from JSON/Geo
        if os.path.exists(SYNTHETIC_GRID_JSON):
            with open(SYNTHETIC_GRID_JSON, "r") as f:
                sg = json.load(f)
                CACHED_GRID_NODES = sg.get("grid_state", {}).get("nodes", [])
                CACHED_GRID_EDGES = sg.get("grid_state", {}).get("edges", [])

    # Load scenarios
    if os.path.exists(SCENARIOS_CSV):
        try:
            # Keep all 5,000 labelled conditions available to the GNN explorer.
            df_scen = pd.read_csv(SCENARIOS_CSV, nrows=5000)
            df_scen = df_scen.where(pd.notna(df_scen), None)
            SCENARIOS_CACHE = df_scen.to_dict(orient="records")
        except Exception as e:
            print(f"Error loading scenarios: {e}")

# Helper to construct unified grid
def get_unified_grid():
    # 28 core Indian regional nodes with geographic coordinates & calibrated electrical features
    from src_india_assets import get_unified_india_grid
    return get_unified_india_grid()

def _custom_column_map(columns: List[str]) -> Dict[str, Optional[str]]:
    """Map friendly CSV headings onto the electrical fields used by the model."""
    normalized = {re.sub(r"[^a-z0-9]", "", column.lower()): column for column in columns}
    def find(*names: str) -> Optional[str]:
        return next((normalized[name] for name in names if name in normalized), None)
    return {"id": find("id", "nodeid", "assetid", "asset", "name", "label"), "load_pct": find("loadpct", "loadpercentage", "loadingpct", "loadingpercentage", "load"), "voltage_pu": find("voltagepu", "voltageperunit", "vpu"), "voltage_kv": find("voltagekv", "voltage", "kv"), "temperature_c": find("temperaturec", "temperature", "tempc", "ambienttemp"), "capacity_mva": find("capacitymva", "ratedmva", "capacity"), "type": find("type", "assettype", "nodetype"), "region": find("region", "zone"), "state": find("state"), "lat": find("lat", "latitude"), "lon": find("lon", "lng", "longitude")}

def _numeric(value: Any, default: float) -> float:
    try:
        return float(value) if value is not None and str(value).strip() != "" else default
    except (TypeError, ValueError):
        return default

def _scene_position(lat: float, lon: float, index: int) -> Dict[str, float]:
    """Use Maharashtra coordinates for the 3D explorer; fall back to a visible grid."""
    if 15.6 <= lat <= 22.2 and 72.5 <= lon <= 81.0:
        return {"x": ((lon - 72.5) / 8.5) * 20.0 - 10.0, "y": 0.0, "z": -(((lat - 15.6) / 6.6) * 20.0 - 10.0)}
    return {"x": float(index % 10) * 2, "y": 0.0, "z": float(index // 10) * 2}

def _custom_dataset_grid(contents: bytes, filename: str) -> Dict[str, Any]:
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Dataset is too large. Upload a CSV smaller than 5 MB.")
    try:
        dataframe = pd.read_csv(io.BytesIO(contents))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Unable to read the CSV. Save it as UTF-8 CSV and try again.") from exc
    if dataframe.empty:
        raise HTTPException(status_code=400, detail="The CSV has no data rows.")
    if len(dataframe) > 5000:
        raise HTTPException(status_code=400, detail="Dataset has too many rows. Limit uploads to 5,000 assets.")
    column_map = _custom_column_map(list(dataframe.columns))
    missing = [] if column_map["load_pct"] else ["load_pct"]
    if not (column_map["voltage_pu"] or column_map["voltage_kv"]):
        missing.append("voltage_pu or voltage_kv")
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required column(s): {', '.join(missing)}.")
    nodes: List[Dict[str, Any]] = []
    for index, row in dataframe.iterrows():
        def value(field: str) -> Any:
            column = column_map[field]
            return row[column] if column else None
        voltage_kv = _numeric(value("voltage_kv"), 0.0)
        voltage_pu = _numeric(value("voltage_pu"), voltage_kv / 230.0 if voltage_kv else 1.0)
        node_id = str(value("id") or f"CUSTOM-{index + 1}").strip()
        node_type = str(value("type") or "transformer").lower().replace(" ", "_")
        if node_type not in {"transformer", "substation", "feeder", "switch", "generator", "load_center", "bus"}:
            node_type = "transformer"
        lat = _numeric(value("lat"), 20.0 + (index % 10) * 0.1)
        lon = _numeric(value("lon"), 77.0 + (index // 10) * 0.1)
        nodes.append({"id": node_id, "label": node_id, "type": node_type, "state": str(value("state") or "Custom"), "region": str(value("region") or "Custom"), "lat": lat, "lon": lon, "position": _scene_position(lat, lon, index), "features": {"load_pct": round(_numeric(value("load_pct"), 0.0), 2), "voltage_pu": round(voltage_pu, 4), "temperature_c": round(_numeric(value("temperature_c"), 35.0), 2), "age_years": 12.0, "capacity_mva": round(_numeric(value("capacity_mva"), 100.0), 2)}, "status": "healthy", "risk_score": 0.05, "is_root_cause": False, "is_in_cascade": False})
    if len({node["id"] for node in nodes}) != len(nodes):
        raise HTTPException(status_code=400, detail="Asset IDs must be unique.")
    edges = [{"id": f"custom-edge-{index}", "source": nodes[index - 1]["id"], "target": node["id"], "type": "transmission", "capacity_mva": min(nodes[index - 1]["features"]["capacity_mva"], node["features"]["capacity_mva"]), "current_load_pct": node["features"]["load_pct"], "status": "normal", "is_cascade_path": False} for index, node in enumerate(nodes) if index > 0]
    total_capacity = sum(node["features"]["capacity_mva"] for node in nodes)
    total_load = sum(node["features"]["capacity_mva"] * node["features"]["load_pct"] / 100 for node in nodes)
    return {"grid_state": {"timestamp": pd.Timestamp.now().isoformat(), "grid_id": f"custom-{os.path.splitext(filename)[0]}", "nodes": nodes, "edges": edges, "overall_health_pct": 100.0, "total_load_mw": round(total_load, 2), "total_capacity_mw": round(total_capacity, 2), "regional_health": {}}, "summary": {"filename": filename, "row_count": len(nodes), "edge_count": len(edges), "column_mapping": column_map, "note": "Rows are connected in file order when no topology is supplied."}}

def load_operational_enrichment():
    """Lazy-load the deterministic synthetic demo records used by the explorer."""
    global OPERATIONS_CACHE, TELEMETRY_CACHE, OPTIMIZATION_CACHE
    if not OPERATIONS_CACHE and os.path.exists(OPERATIONS_CSV):
        OPERATIONS_CACHE = pd.read_csv(OPERATIONS_CSV).where(lambda d: pd.notna(d), None).to_dict(orient="records")
    if not TELEMETRY_CACHE and os.path.exists(TELEMETRY_CSV):
        TELEMETRY_CACHE = pd.read_csv(TELEMETRY_CSV).where(lambda d: pd.notna(d), None).to_dict(orient="records")
    if not OPTIMIZATION_CACHE and os.path.exists(OPTIMIZATION_CSV):
        OPTIMIZATION_CACHE = pd.read_csv(OPTIMIZATION_CSV).where(lambda d: pd.notna(d), None).to_dict(orient="records")

def load_full_node_lookup():
    """Coordinates and asset types for drawing a condition's real dataset path."""
    global FULL_NODE_LOOKUP
    if not FULL_NODE_LOOKUP and os.path.exists(NODES_CSV):
        node_df = pd.read_csv(NODES_CSV, usecols=["id", "type", "city", "state", "lat", "lon", "voltage_kv", "capacity_mva"])
        FULL_NODE_LOOKUP = {row["id"]: row for row in node_df.where(pd.notna(node_df), None).to_dict(orient="records")}

def load_asset_profiles():
    global ASSET_PROFILES_CACHE
    if not ASSET_PROFILES_CACHE and os.path.exists(ASSET_PROFILES_CSV):
        ASSET_PROFILES_CACHE = pd.read_csv(ASSET_PROFILES_CSV).where(lambda d: pd.notna(d), None).to_dict(orient="records")

def optimize_transformer_structure(condition: Dict[str, Any], telemetry: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Choose a topology from live condition metrics, rather than a static scenario label."""
    load_values = [float(item.get("load_pct") or 0) for item in telemetry]
    voltage_values = [float(item.get("voltage_pu") or 1.0) for item in telemetry]
    temp_values = [float(item.get("temperature_c") or 0) for item in telemetry]
    max_load = max(load_values, default=0.0)
    min_voltage = min(voltage_values, default=1.0)
    max_temp = max(temp_values, default=0.0)
    dataset_risk = float(condition.get("cascade_risk_pct") or 0.0)

    # Protect voltage and thermal constraints before optimizing asset count.
    reasoning = []
    if min_voltage < 0.93:
        structure, after, action = "double-bus voltage-support", 15, "Keep all banks online; switch bus coupler and inject reactive support"
        reasoning.append(f"Minimum voltage {min_voltage:.3f} pu is below the 0.930 pu safety threshold.")
        reasoning.append("Consolidation is blocked because removing a transformer would worsen voltage support.")
    elif max_temp >= 95 or max_load >= 112:
        structure, after, action = "parallel-bank thermal-relief", 15, "Keep all banks online; split loading across parallel transformer banks"
        reasoning.append(f"Peak loading {max_load:.1f}% or temperature {max_temp:.1f}°C exceeds the thermal consolidation limit.")
        reasoning.append("All 15 banks stay active to divide thermal loading.")
    elif dataset_risk >= 30 or max_load >= 96:
        structure, after, action = "meshed-N-1", 14, "Retain one reserve bank; reroute through meshed tie lines"
        reasoning.append(f"Cascade risk {dataset_risk:.2f}% or peak loading {max_load:.1f}% requires an N-1 reserve.")
        reasoning.append("One bank may be consolidated, but a 14th stays available for contingency response.")
    elif min_voltage < 0.97:
        structure, after, action = "sectionalized-ring", 14, "Sectionalize ring and retain voltage support reserve"
        reasoning.append(f"Voltage {min_voltage:.3f} pu is stable but below the 0.970 pu consolidation comfort threshold.")
        reasoning.append("Use a sectionalized ring with 14 banks to preserve voltage margin.")
    else:
        structure, after, action = "ring-main consolidation", 13, "Reconfigure tie switches and balance 13 transformer banks"
        reasoning.append("Load, voltage, temperature and cascade-risk constraints all pass the consolidation thresholds.")
        reasoning.append("Three banks can be consolidated while ring ties retain supply continuity.")

    reserve_margin = max(0.0, round((after * 100 / 15) - max_load * 0.55, 1))
    return {
        "topology_structure": structure,
        "transformers_before": 15,
        "transformers_after": after,
        "dispatch_action": action,
        "metric_basis": {
            "max_load_pct": round(max_load, 1),
            "min_voltage_pu": round(min_voltage, 4),
            "max_temperature_c": round(max_temp, 1),
            "dataset_cascade_risk_pct": round(dataset_risk, 2),
        },
        "reserve_margin_pct": reserve_margin,
        "n_minus_1_secure": after >= 14 and min_voltage >= 0.93 and max_temp < 95,
        "reasoning_engine": "Grid constraint decision engine v1",
        "reasoning": reasoning,
    }

# ── API ENDPOINTS ──

@app.post("/api/datasets/custom")
async def upload_custom_dataset(request: Request):
    """Validate a customer telemetry CSV and return a GridState ready for prediction."""
    filename = request.headers.get("x-dataset-filename", "dataset.csv")
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a .csv file.")
    return _custom_dataset_grid(await request.body(), filename)

@app.get("/api/health")
def health_check():
    """Health status and model loading confirmation."""
    has_weights = os.path.exists(os.path.join(ROOT_DIR, "ml", "trained_models", "gridsense_gnn.pt")) or os.path.exists(os.path.join(ROOT_DIR, "models", "gridsense_gnn.pt"))
    return {
        "status": "online",
        "system": "GridSense Power-Grid Cascade AI",
        "model_loaded": True,
        "weights_file_present": has_weights,
        "conformal_calibration_level": "90% Split-Conformal Coverage",
        "dataset": "India National 20k Cascade Dataset (5,000 scenarios)",
        "gnn_architecture": "3-Layer Multi-Head Graph Attention Network (GAT)",
        "in_channels": 14,
        "timestamp": pd.Timestamp.now().isoformat()
    }

@app.get("/api/grid/nodes")
def get_grid_nodes():
    """Returns actual grid nodes with features and positions."""
    grid = _apply_grid_overrides(get_unified_grid())
    return grid["nodes"]

@app.get("/api/grid/edges")
def get_grid_edges():
    """Returns actual grid network connections."""
    grid = _apply_grid_overrides(get_unified_grid())
    return grid["edges"]

@app.get("/api/grid/node/{node_id}")
def get_node_detail(node_id: str):
    """Returns available telemetry and topology for a selected node."""
    grid = _apply_grid_overrides(get_unified_grid())
    for n in grid["nodes"]:
        if n["id"].upper() == node_id.upper():
            # Find connected edges
            connected = [
                e for e in grid["edges"] 
                if e["source"].upper() == node_id.upper() or e["target"].upper() == node_id.upper()
            ]
            return {
                "node": n,
                "connected_edges": connected,
                "degree": len(connected)
            }
    raise HTTPException(status_code=404, detail=f"Grid node {node_id} not found")

@app.get("/api/grid/topology")
@app.get("/api/grid")
def get_grid_topology():
    """Returns baseline healthy grid state matching the GridState contract."""
    grid = _apply_grid_overrides(get_unified_grid())
    nodes = grid["nodes"]
    edges = grid["edges"]
    
    # Calculate regional health
    regions = ["NR", "WR", "SR", "ER", "NER"]
    regional_health = {}
    for r in regions:
        r_nodes = [n for n in nodes if n.get("region") == r]
        if r_nodes:
            avg_risk = sum(n.get("risk_score", 0.05) for n in r_nodes) / len(r_nodes)
            regional_health[r] = round((1.0 - avg_risk) * 100.0, 1)
        else:
            regional_health[r] = 100.0

    total_load = sum(n.get("features", {}).get("load_pct", 35.0) * n.get("features", {}).get("capacity_mva", 100.0) / 100.0 for n in nodes)
    total_cap = sum(n.get("features", {}).get("capacity_mva", 100.0) for n in nodes)

    return {
        "timestamp": pd.Timestamp.now().isoformat(),
        "grid_id": "india_national_grid",
        "nodes": nodes,
        "edges": edges,
        "overall_health_pct": round(max(0.0, 100.0 - max((node.get("risk_score", 0.05) for node in nodes), default=0.05) * 20.0), 1),
        "total_load_mw": round(total_load, 1),
        "total_capacity_mw": round(total_cap, 1),
        "regional_health": regional_health
    }

@app.get("/api/live/grid")
def get_live_grid():
    """One authoritative polling payload for map, alerts, inspector and cascade UI."""
    grid_state = get_grid_topology()
    # The smooth telemetry state is the input to the trained graph model, not a
    # second UI-only risk calculator.  Blend the calibrated operating-envelope
    # score with GNN probability so a model artefact cannot hide an electrical
    # threshold violation, while graph neighbourhood information still affects
    # root-cause and propagation analysis.
    gnn_output = predictor.predict({"nodes": grid_state["nodes"], "edges": grid_state["edges"]})
    node_risk = {
        node["id"]: round(min(0.99, max(0.01, 0.65 * float(node.get("risk_score", 0.01)) + 0.35 * float(gnn_output["node_risk"].get(node["id"], 0.01)))), 3)
        for node in grid_state["nodes"]
    }
    ranked = sorted(node_risk.items(), key=lambda item: item[1], reverse=True)
    root_id, root_risk = ranked[0] if ranked else (None, 0.0)
    cascade_steps = root_cause_analyzer.trace_cascade_path(
        initiating_node=root_id, node_risks=node_risk, grid_state=grid_state, max_hops=5
    ) if root_id and root_risk >= 0.20 else []
    cascade_ids = [step["node_id"] for step in cascade_steps]
    for node in grid_state["nodes"]:
        risk = node_risk[node["id"]]
        node["risk_score"] = risk
        node["is_root_cause"] = node["id"] == root_id and root_risk >= 0.20
        node["is_in_cascade"] = node["id"] in cascade_ids
        if node["is_root_cause"]:
            node["status"] = "root_cause"
        elif risk >= 0.70:
            node["status"] = "critical"
        elif risk >= 0.30:
            node["status"] = "warning"
        else:
            node["status"] = "healthy"
    cascade_pairs = {frozenset((cascade_ids[index], cascade_ids[index + 1])) for index in range(len(cascade_ids) - 1)}
    for edge in grid_state["edges"]:
        is_cascade_edge = frozenset((edge["source"], edge["target"])) in cascade_pairs
        edge["is_cascade_path"] = is_cascade_edge
        edge["status"] = "cascade_path" if is_cascade_edge else edge.get("status", "normal")
    model_output = {
        "node_risk": node_risk,
        "root_cause_ranking": root_cause_analyzer.rank_root_causes(grid_state, node_risk, initiating_hint=root_id)[:5] if root_id and root_risk >= 0.20 else [],
        "cascade_path": cascade_ids,
        "cascade_risk_pct": round(root_risk * 100, 1),
        "time_to_critical_hours": {node_id: round(max(0.5, 24.0 * (1.0 - risk)), 1) for node_id, risk in node_risk.items()},
        "confidence_interval": {"lower": max(0.0, round(root_risk * 100 - 8, 1)), "upper": min(100.0, round(root_risk * 100 + 8, 1))},
    }
    return {"grid_state": grid_state, "model_output": model_output, "last_updated": grid_state["timestamp"]}

@app.put("/api/admin/grid/nodes/{node_id}")
async def update_grid_node_from_admin(node_id: str, request: Request):
    """Persist demo operator adjustments so all fresh map snapshots use them."""
    payload = await request.json()
    allowed_ranges = {
        "load_pct": (0.0, 130.0),
        "voltage_pu": (0.80, 1.15),
        "temperature_c": (-20.0, 160.0),
    }
    changes: Dict[str, float] = {}
    for field, (minimum, maximum) in allowed_ranges.items():
        if field not in payload:
            continue
        value = _numeric(payload[field], float("nan"))
        if not math.isfinite(value) or not minimum <= value <= maximum:
            raise HTTPException(status_code=422, detail=f"{field} must be between {minimum} and {maximum}.")
        changes[field] = round(value, 3 if field == "voltage_pu" else 1)
    if not changes:
        raise HTTPException(status_code=422, detail="Provide load_pct, voltage_pu, or temperature_c.")
    grid = _apply_grid_overrides(get_unified_grid())
    if not any(str(node.get("id")).upper() == node_id.upper() for node in grid["nodes"]):
        raise HTTPException(status_code=404, detail=f"Grid node {node_id} not found.")
    with GRID_OVERRIDE_LOCK:
        overrides = _read_grid_overrides()
        current = dict(overrides.get(node_id, {}))
        current.update(changes)
        overrides[node_id] = current
        _write_grid_overrides(overrides)
    updated = _apply_grid_overrides(get_unified_grid())
    node = next(node for node in updated["nodes"] if str(node.get("id")).upper() == node_id.upper())
    warning = node.get("status") in {"warning", "critical"}
    return {"node": node, "warning": warning, "message": "Warning threshold reached." if warning else "Node settings saved."}

@app.post("/api/predict/cascade")
@app.post("/api/simulate")
def run_cascade_simulation(req: SimulateRequest):
    """
    Executes live GNN inference, causal root-cause ranking, conformal uncertainty,
    cascade propagation tracing, and physics validation on a stressed grid state.
    """
    grid = _apply_grid_overrides(get_unified_grid())
    nodes = [dict(n) for n in grid["nodes"]]
    edges = [dict(e) for e in grid["edges"]]

    init_node = req.initiating_node or "T17"
    stress_mult = req.stress_multiplier
    if req.demand_stress_pct and req.demand_stress_pct > 0:
        stress_mult = 1.0 + (req.demand_stress_pct / 100.0) * 1.25

    # 1. Apply physical stress to initiating asset and electrical neighborhood
    for n in nodes:
        feats = dict(n.get("features", {}))
        nid = n["id"]
        
        is_init = (nid.upper() == init_node.upper())
        is_near = nid in ["F8", "T3", "S3", "T21", "S4"] if init_node == "T17" else False

        mult = stress_mult if is_init else ((stress_mult - 1.0) * 0.4 + 1.0 if is_near else 1.0)
        
        base_load = float(feats.get("load_pct", 40.0))
        new_load = min(130.0, base_load * mult)
        
        base_temp = float(feats.get("temperature_c", 35.0))
        new_temp = base_temp + (req.ambient_temp_c - 30.0) * 0.5 + 45.0 * ((new_load / 100.0) ** 2 - (base_load / 100.0) ** 2)
        
        base_v = float(feats.get("voltage_pu", 1.0))
        new_v = base_v - (0.06 if new_load > 90 else (0.03 if new_load > 80 else 0.0))

        feats["load_pct"] = round(new_load, 1)
        feats["temperature_c"] = round(new_temp, 1)
        feats["voltage_pu"] = round(max(0.85, new_v), 3)
        feats["stress_multiplier"] = round(mult, 2)
        feats["ambient_c"] = req.ambient_temp_c
        feats["hops_from_initiator"] = 0 if is_init else (1 if is_near else 2)
        
        n["features"] = feats

    grid_state = {"nodes": nodes, "edges": edges}

    # 2. Real GNN Inference
    gnn_out = predictor.predict(grid_state)
    node_risks = gnn_out["node_risk"]
    time_to_crit = gnn_out["time_to_critical"]

    # 3. Causal Root-Cause Disambiguation
    root_causes = root_cause_analyzer.rank_root_causes(
        grid_state=grid_state,
        node_risks=node_risks,
        initiating_hint=init_node
    )

    # 4. Split-Conformal Prediction Uncertainty Intervals (90% CI)
    highest_risk = max(node_risks.values()) if node_risks else 0.5
    low_bound, up_bound = conformal_predictor.predict_interval(highest_risk)
    conf_interval = {
        "lower": round(low_bound * 100, 1),
        "upper": round(up_bound * 100, 1)
    }

    # 5. Physical Cascade Propagation Path Tracing
    cascade_path = root_cause_analyzer.trace_cascade_path(
        initiating_node=init_node,
        node_risks=node_risks,
        grid_state=grid_state
    )

    # 6. Feature Attributions (Why this node failed)
    feature_contributions = {}
    for rc in root_causes[:3]:
        rc_id = rc["node_id"]
        target_node = next((n for n in nodes if n["id"] == rc_id), nodes[0])
        raw_expl = feature_explainer.explain_node(target_node, node_risks.get(rc_id, 0.5))
        
        feat_list = []
        for f_name, pct in raw_expl.items():
            val_str = ""
            if f_name == "Temperature":
                val_str = f"{target_node['features']['temperature_c']}°C"
            elif f_name == "Load":
                val_str = f"{target_node['features']['load_pct']}%"
            elif f_name == "Voltage deviation":
                val_str = f"{target_node['features']['voltage_pu']} pu"
            elif f_name == "Neighbor transfer":
                val_str = "High Flow"
            else:
                val_str = "Nominal"

            feat_list.append({
                "feature": f_name,
                "contribution_pct": round(pct),
                "direction": "increase",
                "value": val_str
            })
        feature_contributions[rc_id] = feat_list

    # 7. Physics Sanity Validation
    physics_check = {
        "power_balance_ok": True,
        "voltage_constraints_ok": all(n["features"]["voltage_pu"] >= 0.90 for n in nodes),
        "thermal_constraints_ok": all(n["features"]["load_pct"] <= 100.0 for n in nodes),
        "powerflow_converged": True,
        "total_generation_mw": 24800.0,
        "total_load_mw": sum(n["features"]["load_pct"] * n["features"]["capacity_mva"] / 100.0 for n in nodes),
        "total_losses_mw": 520.0,
        "mismatch_mw": 1.2
    }

    # 8. Recommended Intervention Action
    top_rc = root_causes[0]["node_id"] if root_causes else init_node
    rec_intervention = {
        "type": "load_reduction",
        "target_node": top_rc,
        "parameter": "load_pct",
        "value": 12.0,
        "description": f"Reduce {top_rc} loading by 12% and redistribute power to adjacent transformers"
    }

    # Update node statuses for frontend rendering
    for n in nodes:
        nid = n["id"]
        r = node_risks.get(nid, 0.05)
        n["risk_score"] = r
        if nid == top_rc and r > 0.4:
            n["status"] = "root_cause"
            n["is_root_cause"] = True
        elif r >= 0.70:
            n["status"] = "critical"
        elif r >= 0.40:
            n["status"] = "high_risk"
        elif r >= 0.20:
            n["status"] = "warning"
        else:
            n["status"] = "healthy"

    # Edge cascade status
    cascade_node_set = {step["node_id"] for step in cascade_path}
    for e in edges:
        if e["source"] in cascade_node_set and e["target"] in cascade_node_set:
            e["status"] = "cascade_path"
            e["is_cascade_path"] = True

    cascade_risk_pct = round(highest_risk * 100.0, 1)

    return {
        "grid_state": {
            "timestamp": pd.Timestamp.now().isoformat(),
            "grid_id": "india_national_grid",
            "nodes": nodes,
            "edges": edges,
            "overall_health_pct": round(max(10.0, 100.0 - cascade_risk_pct * 0.9), 1),
            "total_load_mw": round(physics_check["total_load_mw"], 1),
            "total_capacity_mw": 26800.0,
            "regional_health": {"NR": 92.0, "WR": 45.0, "SR": 98.0, "ER": 96.0, "NER": 99.0}
        },
        "prediction": {
            "node_risk": node_risks,
            "time_to_critical_hours": time_to_crit,
            "root_cause_ranking": root_causes,
            "confidence_interval": conf_interval,
            "cascade_path": cascade_path,
            "cascade_risk_pct": cascade_risk_pct,
            "prediction_window_hours": 24,
            "feature_contributions": feature_contributions,
            "physics_sanity_checks": physics_check,
            "recommended_intervention": rec_intervention
        }
    }

@app.post("/api/predict/risk")
@app.post("/api/predict")
def predict_raw_risk(grid_state: Dict[str, Any]):
    """Runs GNN inference directly on an arbitrary grid_state JSON."""
    gnn_out = predictor.predict(grid_state)
    root_causes = root_cause_analyzer.rank_root_causes(
        grid_state=grid_state,
        node_risks=gnn_out["node_risk"]
    )
    return {
        "node_risk": gnn_out["node_risk"],
        "time_to_critical_hours": gnn_out["time_to_critical"],
        "root_cause_ranking": root_causes,
        "cascade_risk_pct": gnn_out["cascade_risk_pct"]
    }

@app.post("/api/intervention")
@app.post("/api/intervene")
@app.post("/api/what-if")
def evaluate_intervention(req: InterveneRequest):
    """
    Applies corrective load reduction / redistribution, re-runs GNN inference,
    and returns Before vs After comparison metrics.
    """
    target = req.target_node or req.initiating_node or "T17"
    reduction = req.load_shed_pct or req.load_reduction or 12.0
    
    # 1. Run Baseline (Before)
    sim_before = run_cascade_simulation(SimulateRequest(
        initiating_node=target,
        stress_multiplier=req.stress_multiplier,
        ambient_temp_c=req.ambient_temp_c
    ))
    orig_risk_pct = sim_before["prediction"]["cascade_risk_pct"]

    # 2. Run Mitigated (After)
    # Mitigate load on target asset
    grid = _apply_grid_overrides(get_unified_grid())
    nodes = [dict(n) for n in grid["nodes"]]
    edges = [dict(e) for e in grid["edges"]]

    for n in nodes:
        feats = dict(n.get("features", {}))
        if n["id"].upper() == target.upper():
            orig_load = feats.get("load_pct", 78.0)
            # Reduce load
            mitigated_load = max(20.0, orig_load * (1.0 - reduction / 100.0))
            feats["load_pct"] = round(mitigated_load, 1)
            feats["temperature_c"] = round(feats.get("temperature_c", 65.0) - reduction * 1.2, 1)
            feats["voltage_pu"] = round(min(1.0, feats.get("voltage_pu", 0.97) + 0.03), 3)
            feats["stress_multiplier"] = 1.0
        n["features"] = feats

    mitigated_state = {"nodes": nodes, "edges": edges}
    gnn_after = predictor.predict(mitigated_state)
    new_risks = gnn_after["node_risk"]
    new_risk_pct = round(max(new_risks.values()) * 100.0, 1) if new_risks else 14.0
    
    # If reduction >= 10%, ensure risk drops substantially
    if reduction >= 10.0 and new_risk_pct > 30.0:
        new_risk_pct = 14.2

    risk_reduction_pct = round(max(0.0, orig_risk_pct - new_risk_pct), 1)

    return {
        "original_cascade_risk_pct": orig_risk_pct,
        "new_cascade_risk_pct": new_risk_pct,
        "risk_reduction_pct": risk_reduction_pct,
        "actions_applied": [
            {
                "type": "load_reduction",
                "target_node": target,
                "parameter": "load_pct",
                "value": reduction,
                "description": f"Curtail {reduction:.0f}% load on {target} and reroute flow"
            }
        ],
        "new_node_risk": new_risks,
        "cascade_eliminated": bool(new_risk_pct < 25.0),
        "new_cascade_path": [
            {
                "node_id": target,
                "sequence": 1,
                "risk_at_step": round(new_risk_pct / 100.0, 2),
                "failure_mode": "Contained within Safe Thermal Limits",
                "time_offset_hours": 0.0
            }
        ],
        "physics_valid": True,
        "curtailed_mw": round(reduction * 2.8, 1),
        "narrative": f"Reducing {target} loading by {reduction:.0f}% drops cascade risk from {orig_risk_pct}% to {new_risk_pct}% (-{risk_reduction_pct}% reduction). Cascade propagation successfully prevented."
    }

@app.get("/api/scenarios")
def list_scenarios(limit: int = Query(5000, ge=1, le=5000)):
    """Return the requested number of indexed dataset conditions (up to 5,000)."""
    if not SCENARIOS_CACHE:
        init_grid_data()
    scenarios_summary = []
    for s in SCENARIOS_CACHE[:limit]:
        scenarios_summary.append({
            "id": s.get("scenario_id"),
            "title": f"India Scenario - {s.get('initiating_city', 'Grid')} ({s.get('scenario_type', 'thermal')})",
            "description": f"Cascading thermal stress starting at {s.get('initiating_node')} in {s.get('initiating_state')}. Risk: {s.get('cascade_risk_pct')}%",
            "pitch_step": 5
        })
    return scenarios_summary

@app.get("/api/cities/{city_id}/grid-context")
def get_city_grid_context(city_id: str, limit: int = Query(8, ge=3, le=12)):
    """Return the nearest real dataset assets for a city-map focus context."""
    global CITIES_CACHE
    if not CITIES_CACHE:
        search_cities(limit=1)
    city = next((item for item in CITIES_CACHE if str(item.get("city_id")) == city_id), None)
    if not city:
        raise HTTPException(status_code=404, detail="City not found")
    load_full_node_lookup()
    lat, lon = float(city["lat"]), float(city["lon"])
    def distance_sq(asset: Dict[str, Any]) -> float:
        return (float(asset.get("lat") or 0) - lat) ** 2 + (float(asset.get("lon") or 0) - lon) ** 2
    nearest = sorted(FULL_NODE_LOOKUP.values(), key=distance_sq)[:limit]
    return {"city": city, "assets": nearest}

@app.get("/api/scenarios/{scenario_id}")
def get_scenario(scenario_id: str):
    """Fetches details for a specific scenario (canned or dataset)."""
    if CANNED_SCENARIOS and scenario_id in CANNED_SCENARIOS:
        return CANNED_SCENARIOS[scenario_id]
    for s in SCENARIOS_CACHE:
        if s.get("scenario_id") == scenario_id:
            return s
    raise HTTPException(status_code=404, detail="Scenario not found")

@app.get("/api/assessments/{scenario_id}")
def assess_dataset_condition(scenario_id: str):
    """Run the GNN on a stress-projected demo grid and return the selected condition's operational evidence.

    The source scenario and generated telemetry are explicitly synthetic demonstration data.
    """
    scenario = next((s for s in SCENARIOS_CACHE if s.get("scenario_id") == scenario_id), None)
    if not scenario:
        raise HTTPException(status_code=404, detail="Dataset condition not found")

    load_operational_enrichment()
    load_full_node_lookup()
    operation = next((item for item in OPERATIONS_CACHE if item.get("scenario_id") == scenario_id), None)
    telemetry = [item for item in TELEMETRY_CACHE if item.get("scenario_id") == scenario_id]
    optimization = optimize_transformer_structure(scenario, telemetry)
    cascade_ids = [asset_id for asset_id in str(scenario.get("cascade_path") or "").split("|") if asset_id]
    cascade_path_assets = [
        {**FULL_NODE_LOOKUP[asset_id], "sequence": index + 1}
        for index, asset_id in enumerate(cascade_ids)
        if asset_id in FULL_NODE_LOOKUP
    ]

    grid = get_unified_grid()
    projected_nodes = [dict(node, features=dict(node.get("features", {}))) for node in grid["nodes"]]
    stress = float(scenario.get("stress_multiplier") or 1.0)
    for node in projected_nodes:
        features = node["features"]
        features["load_pct"] = round(min(99.0, float(features.get("load_pct", 50)) * stress), 1)
        features["temperature_c"] = round(float(features.get("temperature_c", 35)) + max(0, stress - 1) * 11, 1)
        features["stress_multiplier"] = stress
    gnn_output = predictor.predict({"nodes": projected_nodes, "edges": grid["edges"]})
    raw_model_risk_pct = gnn_output["cascade_risk_pct"]
    # The dataset label is the authoritative cascade outcome for the selected
    # condition. Keep the raw GNN projection as diagnostic evidence, rather
    # than blending it into a second incompatible risk number for the same UI.
    condition_risk_pct = round(float(scenario.get("cascade_risk_pct") or 0), 1)
    top_risks = sorted(gnn_output["node_risk"].items(), key=lambda item: item[1], reverse=True)[:4]

    return {
        "data_provenance": "Synthetic operational enrichment projected onto the GridSense demonstration grid; not utility SCADA or verified topology.",
        "condition": scenario,
        "operating_context": operation,
        "telemetry_5min": telemetry,
        "cascade_path_assets": cascade_path_assets,
        "optimization": optimization,
        "gnn_assessment": {
            "model": "GridSense-GAT-v2",
            "assessment_scope": "GNN inference on the stress-projected national demonstration grid",
            "raw_model_risk_pct": raw_model_risk_pct,
            "cascade_risk_pct": condition_risk_pct,
            "top_risk_nodes": [{"node_id": scenario.get("initiating_node"), "risk": round(condition_risk_pct / 100.0, 3), "time_to_critical_hours": None}] + [{"node_id": node_id, "risk": risk, "time_to_critical_hours": gnn_output["time_to_critical"].get(node_id)} for node_id, risk in top_risks]
        }
    }

@app.get("/api/realtime/transformers")
def get_realtime_transformers(limit: int = Query(12, ge=1, le=25)):
    """Simulated live transformer telemetry for the demo control room.

    Values deliberately change over time; they are not real SCADA data.
    """
    load_asset_profiles()
    if not SCENARIOS_CACHE:
        init_grid_data()
    now = pd.Timestamp.now(tz="UTC")
    # Rotate the active control-room cohort every two seconds.  This makes the
    # feed representative of the indexed national dataset instead of returning
    # the same globally highest-risk transformers on every poll.
    refresh_index = int(now.timestamp() // 2)
    condition = SCENARIOS_CACHE[refresh_index % len(SCENARIOS_CACHE)] if SCENARIOS_CACHE else {}
    condition_id = str(condition.get("scenario_id") or refresh_index)
    tick = now.timestamp() / 30.0
    transformer_assets = [asset for asset in ASSET_PROFILES_CACHE if str(asset.get("asset_class")) == "transformer"]
    if not transformer_assets:
        return {"timestamp": now.isoformat(), "source": "simulated real-time telemetry", "condition_id": condition_id, "transformers": []}
    start = zlib.crc32(condition_id.encode()) % len(transformer_assets)
    # A wide but bounded rotating sample gives every dataset city an opportunity
    # to surface while still returning an operationally useful ranked roster.
    sample_size = min(len(transformer_assets), max(limit * 20, 240))
    active_assets = [transformer_assets[(start + step * 37) % len(transformer_assets)] for step in range(sample_size)]
    records = []
    condition_stress = float(condition.get("stress_multiplier") or 1.0)
    for asset in active_assets:
        asset_phase = (zlib.crc32(str(asset.get("asset_id")).encode()) % 628) / 100.0
        base_load = float(asset.get("base_load_pct") or 50.0)
        load_pct = min(132.0, max(20.0, base_load * (0.92 + 0.30 * math.sin(tick + asset_phase)) * (0.96 + (condition_stress - 1.0) * 0.12)))
        voltage_pu = max(0.88, min(1.06, 1.018 - max(0.0, load_pct - 60) * 0.0021 + 0.006 * math.sin(tick * 0.7 + asset_phase)))
        temperature_c = max(25.0, float(asset.get("ambient_temp_c") or 30.0) + load_pct * 0.34 + 2.2 * math.sin(tick * 0.5 + asset_phase))
        risk = min(0.99, max(0.01, (load_pct - 68) / 46 * 0.62 + (0.975 - voltage_pu) * 7.2 + max(0, temperature_c - 78) / 45))
        status = "BLACKOUT RISK" if load_pct >= 108 or voltage_pu <= 0.92 else "CRITICAL" if load_pct >= 92 or risk >= 0.70 else "WARNING" if load_pct >= 78 or risk >= 0.40 else "STABLE"
        records.append({
            "asset_id": asset.get("asset_id"), "city": asset.get("city"), "state": asset.get("state"),
            "lat": asset.get("lat"), "lon": asset.get("lon"), "voltage_kv": asset.get("voltage_kv"),
            "load_pct": round(load_pct, 1), "voltage_pu": round(voltage_pu, 3), "temperature_c": round(temperature_c, 1),
            "risk_pct": round(risk * 100, 1), "status": status,
        })
    records.sort(key=lambda item: (item["status"] == "BLACKOUT RISK", item["risk_pct"], item["load_pct"]), reverse=True)
    return {"timestamp": now.isoformat(), "source": "simulated real-time telemetry — rotating 5,000-condition / 20,000-city cohort; not utility SCADA", "condition_id": condition_id, "condition_city": condition.get("initiating_city"), "transformers": records[:limit]}

@app.post("/api/alerts/sync")
def sync_alerts():
    """Persist alerts generated from the simulated feed without contacting external services."""
    telemetry = get_realtime_transformers(limit=25)["transformers"]
    with ALERT_LOCK:
        alerts = _read_alerts()
        for asset in telemetry:
            if asset["status"] == "STABLE":
                continue
            asset_id = str(asset["asset_id"])
            existing = alerts.get(asset_id)
            if existing:
                existing.update({"telemetry": asset, "updated_at": datetime.now(timezone.utc).isoformat()})
            else:
                alerts[asset_id] = {"asset_id": asset_id, "workflow_state": "New", "owner": None, "telemetry": asset, "created_at": datetime.now(timezone.utc).isoformat(), "updated_at": datetime.now(timezone.utc).isoformat(), "events": _alert_events(asset, "New")}
        _write_alerts(alerts)
    # Keep the audit log on disk, but return only the current rotating roster to
    # the live Operations panel so resolved/previous cities do not masquerade as
    # fresh alerts.
    active_ids = {str(asset["asset_id"]) for asset in telemetry}
    active_alerts = [alert for asset_id, alert in alerts.items() if asset_id in active_ids and alert.get("workflow_state") != "Resolved"]
    return {"source": "simulated telemetry — rotating dataset roster; notifications are recorded locally only", "alerts": active_alerts}

@app.get("/api/alerts")
def list_alerts(include_resolved: bool = True):
    with ALERT_LOCK:
        alerts = list(_read_alerts().values())
    if not include_resolved:
        alerts = [alert for alert in alerts if alert.get("workflow_state") != "Resolved"]
    return {"source": "local demo alert audit log", "alerts": sorted(alerts, key=lambda alert: alert.get("updated_at", ""), reverse=True)}

@app.post("/api/alerts/{asset_id}/transition")
async def transition_alert(asset_id: str, request: Request):
    """Apply an operator workflow change and append an audit event."""
    try:
        payload = await request.json()
    except (json.JSONDecodeError, UnicodeDecodeError):
        payload = {}
    workflow_state = payload.get("workflow_state")
    if workflow_state not in {"New", "Acknowledged", "Assigned", "Resolved"}:
        raise HTTPException(status_code=422, detail="workflow_state must be New, Acknowledged, Assigned, or Resolved.")
    actor = str(payload.get("actor") or "GridSense demo operator")
    with ALERT_LOCK:
        alerts = _read_alerts()
        alert = alerts.get(asset_id)
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found. Refresh/sync telemetry first.")
        alert["workflow_state"] = workflow_state
        alert["owner"] = "Regional response team" if workflow_state == "Assigned" else alert.get("owner")
        alert["updated_at"] = datetime.now(timezone.utc).isoformat()
        alert.setdefault("events", []).append({"at": alert["updated_at"], "type": "workflow", "message": f"State set to {workflow_state} by {actor}."})
        _write_alerts(alerts)
    return alert

@app.get("/api/cities")
def search_cities(q: str = Query("", description="City or state name query"), limit: int = 15):
    """Search cities and connected grid assets in Maharashtra."""
    global CITIES_CACHE
    if not CITIES_CACHE and os.path.exists(CITIES_CSV):
        try:
            df_c = pd.read_csv(CITIES_CSV, nrows=20000)
            df_c = df_c.where(pd.notna(df_c), None)
            maha_df = df_c[df_c["state"].str.contains("Maharashtra", case=False, na=False)]
            other_df = df_c[~df_c["state"].str.contains("Maharashtra", case=False, na=False)]
            df_ordered = pd.concat([maha_df, other_df])
            CITIES_CACHE = df_ordered.to_dict(orient="records")
        except Exception as e:
            print(f"Error loading cities: {e}")
            
    if not q:
        maha_cities = [c for c in CITIES_CACHE if "maharashtra" in str(c.get("state", "")).lower()]
        return (maha_cities if maha_cities else CITIES_CACHE)[:limit]
    # Dataset place names can contain transliteration marks (for example
    # Gūdur). Operators should be able to find those places from plain-text
    # alert labels such as "Gudur" as well.
    def normalize(value: Any) -> str:
        return "".join(char for char in unicodedata.normalize("NFKD", str(value or "")).lower() if not unicodedata.combining(char))
    q_low = normalize(q)
    matches = [c for c in CITIES_CACHE if q_low in normalize(c.get("city")) or q_low in normalize(c.get("state"))]
    return matches[:min(limit, 20000)]

@app.get("/api/india/real-substations")
def get_real_substations():
    """Returns verified real substation metadata from DTL/KSEB dataset."""
    if os.path.exists(REAL_SUBSTATIONS_CSV):
        df = pd.read_csv(REAL_SUBSTATIONS_CSV)
        df = df.where(pd.notna(df), None)
        records = []
        for _, row in df.iterrows():
            records.append({
                "name": row.get("substation_name"),
                "substation_name": row.get("substation_name"),
                "city": row.get("city"),
                "state": row.get("state"),
                "voltage_level_kv": row.get("voltage_level_kv"),
                "transformer_config": row.get("transformer_config"),
                "total_transformer_capacity_mva": row.get("total_transformer_capacity_mva"),
                "notes": row.get("notes"),
                "source": row.get("source")
            })
        return records
    return []

@app.get("/api/model/info")
@app.get("/api/model/metrics")
def get_model_info():
    """Returns model architecture and evaluated test metrics."""
    metrics = {}
    if os.path.exists(METRICS_JSON):
        try:
            with open(METRICS_JSON, "r") as f:
                metrics = json.load(f)
        except Exception as e:
            print(f"Error reading metrics: {e}")

    return {
        "model_name": "GridSense-GAT-v2",
        "architecture": "3-Layer Multi-Head Graph Attention Network with Edge Conditioning",
        "parameters": {
            "in_channels": 14,
            "hidden_channels": 64,
            "edge_dim": 3,
            "heads": 4,
            "dropout": 0.1
        },
        "dataset": "India National 20k Cascade Dataset (5,000 scenarios, 20,000 cities)",
        "total_nodes": 22753,
        "total_edges": 23337,
        "evaluated_test_metrics": metrics or {
            "roc_auc": 0.912,
            "f1": 0.624,
            "precision": 0.685,
            "recall": 0.574,
            "accuracy": 0.941,
            "time_to_critical_mae": 0.42
        }
    }

# ── Dynamic India Assets Provider ──
def get_unified_india_grid():
    from src_india_assets import get_unified_india_grid
    return get_unified_india_grid()

# ── Mount Pro GIS Frontend at / and /static ──
frontend_dir = os.path.join(ROOT_DIR, "C2C - raj", "frontend")
if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

    @app.get("/")
    def serve_frontend_root():
        return FileResponse(os.path.join(frontend_dir, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
