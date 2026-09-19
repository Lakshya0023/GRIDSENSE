"""
GridSense API Automated Integration Tests
Verifies all REST endpoints, GNN model inference, causal root-cause ranking,
conformal uncertainty, and physics validation.
"""

import sys
import os
import pytest
from fastapi.testclient import TestClient

# Ensure root directory in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.main import app

client = TestClient(app)

def test_custom_dataset_upload_endpoint():
    payload = b"id,load_pct,voltage_pu,temperature_c,capacity_mva\nTX-1,82,0.96,65,120\nTX-2,45,1.01,40,80\n"
    response = client.post(
        "/api/datasets/custom",
        content=payload,
        headers={"X-Dataset-Filename": "operator-readings.csv"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["summary"]["row_count"] == 2
    assert data["summary"]["column_mapping"]["load_pct"] == "load_pct"
    assert data["grid_state"]["nodes"][0]["features"]["voltage_pu"] == 0.96

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["model_loaded"] is True
    assert "conformal_calibration_level" in data
    assert "gnn_architecture" in data

def test_grid_nodes_endpoint():
    response = client.get("/api/grid/nodes")
    assert response.status_code == 200
    nodes = response.json()
    assert isinstance(nodes, list)
    assert len(nodes) > 0
    first_node = nodes[0]
    assert "id" in first_node
    assert "type" in first_node
    assert "features" in first_node
    assert "position" in first_node

def test_grid_edges_endpoint():
    response = client.get("/api/grid/edges")
    assert response.status_code == 200
    edges = response.json()
    assert isinstance(edges, list)
    assert len(edges) > 0
    first_edge = edges[0]
    assert "id" in first_edge
    assert "source" in first_edge
    assert "target" in first_edge

def test_node_detail_endpoint():
    response = client.get("/api/grid/node/T17")
    assert response.status_code == 200
    data = response.json()
    assert "node" in data
    assert data["node"]["id"] == "T17"
    assert "connected_edges" in data

def test_grid_topology_endpoint():
    response = client.get("/api/grid/topology")
    assert response.status_code == 200
    grid = response.json()
    assert "nodes" in grid
    assert "edges" in grid
    assert "overall_health_pct" in grid
    assert "regional_health" in grid
    assert "total_load_mw" in grid

def test_simulate_cascade_endpoint():
    payload = {
        "initiating_node": "T17",
        "stress_multiplier": 1.85,
        "demand_stress_pct": 18.0,
        "ambient_temp_c": 36.0,
        "max_steps": 6
    }
    response = client.post("/api/simulate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "grid_state" in data
    assert "prediction" in data
    
    pred = data["prediction"]
    assert "node_risk" in pred
    assert "root_cause_ranking" in pred
    assert len(pred["root_cause_ranking"]) > 0
    assert pred["root_cause_ranking"][0]["node_id"] == "T17"
    assert "confidence_interval" in pred
    assert "lower" in pred["confidence_interval"]
    assert "upper" in pred["confidence_interval"]
    assert "cascade_path" in pred
    assert len(pred["cascade_path"]) > 0
    assert "physics_sanity_checks" in pred
    assert pred["physics_sanity_checks"]["powerflow_converged"] is True

def test_predict_raw_risk_endpoint():
    # Fetch baseline grid
    grid = client.get("/api/grid/topology").json()
    response = client.post("/api/predict", json=grid)
    assert response.status_code == 200
    data = response.json()
    assert "node_risk" in data
    assert "root_cause_ranking" in data

def test_intervention_endpoint():
    payload = {
        "initiating_node": "T17",
        "target_node": "T17",
        "load_shed_pct": 12.0,
        "load_reduction": 12.0,
        "stress_multiplier": 1.85
    }
    response = client.post("/api/intervention", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "original_cascade_risk_pct" in data
    assert "new_cascade_risk_pct" in data
    assert "risk_reduction_pct" in data
    assert data["risk_reduction_pct"] > 0
    assert data["new_cascade_risk_pct"] < data["original_cascade_risk_pct"]
    assert data["cascade_eliminated"] is True

def test_model_info_endpoint():
    response = client.get("/api/model/info")
    assert response.status_code == 200
    data = response.json()
    assert "architecture" in data
    assert "parameters" in data
    assert "evaluated_test_metrics" in data
    metrics = data["evaluated_test_metrics"]
    assert "roc_auc" in metrics
    assert "f1" in metrics
    assert "accuracy" in metrics
