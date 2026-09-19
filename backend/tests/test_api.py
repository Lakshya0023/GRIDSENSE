"""
Tests for GridSense FastAPI Endpoints.
"""

import os
import sys
from fastapi.testclient import TestClient
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.main import app

client = TestClient(app)

def test_health():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] in ["online", "healthy"]

def test_get_grid():
    resp = client.get("/api/grid?grid_id=ieee24")
    assert resp.status_code == 200
    data = resp.json()
    assert "nodes" in data
    assert "edges" in data
    assert len(data["nodes"]) >= 24

def test_get_scenarios():
    resp = client.get("/api/scenarios")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 5

def test_simulate_emergency():
    payload = {
        "grid_id": "ieee24",
        "initiating_node": "T17",
        "stress_multiplier": 1.85,
        "max_steps": 4
    }
    resp = client.post("/api/simulate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "grid_state" in data
    assert "prediction" in data
    
    out = data["prediction"]
    assert "T17" in out["node_risk"]
    assert out["node_risk"]["T17"] >= 0.80
    assert len(out["root_cause_ranking"]) > 0
    assert out["root_cause_ranking"][0]["node_id"] == "T17"
    assert "cascade_path" in out
    assert "confidence_interval" in out

def test_what_if():
    payload = {
        "grid_id": "ieee24",
        "initiating_node": "T17",
        "target_node": "T17",
        "stress_multiplier": 1.85,
        "load_shed_pct": 12.0
    }
    resp = client.post("/api/what-if", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["risk_reduction_pct"] > 40.0
    assert data["new_cascade_risk_pct"] < data["original_cascade_risk_pct"]
    assert data["physics_valid"] is True
