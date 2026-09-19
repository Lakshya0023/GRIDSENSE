"""
Tests for the predictive-maintenance endpoints merged into the GridSense API.

These cover the two things the merge had to guarantee: the plant models are
reachable from the same server that serves the grid GNN, and the merge did not
shadow any existing GridSense route.
"""

import os
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.main import app

client = TestClient(app)


def test_pdm_status_reports_models_and_broker():
    response = client.get("/api/pdm/status")
    assert response.status_code == 200
    body = response.json()
    assert body["service"] == "GridSense Plant Predictive Maintenance"
    assert body["models"]["loaded"] is True
    assert body["models"]["model_count"] == 10
    # Disabled by conftest so the suite never touches the network.
    assert body["mqtt"]["enabled"] is False


def test_rul_endpoint_returns_a_real_prediction():
    """NASA-bearing-pattern remaining useful life, exposed on the GridSense server."""
    response = client.get("/api/pdm/rul", params={"vibration": 6.5, "temperature": 110})
    assert response.status_code == 200
    body = response.json()
    assert body["models_loaded"] is True
    assert isinstance(body["rul_hours"], float)
    assert body["rul_hours"] >= 0
    assert body["alert_level"] in {"HEALTHY", "WARNING", "CRITICAL"}


def test_anomaly_endpoint_returns_azure_pattern_verdict():
    response = client.get("/api/pdm/anomaly", params={"vibration": 55, "volt": 190})
    assert response.status_code == 200
    result = response.json()["result"]
    assert 0 <= result["health_score"] <= 100
    assert isinstance(result["is_anomaly"], bool)
    assert 0 <= result["confidence"] <= 1


def test_simulate_runs_all_three_maintenance_models():
    response = client.get("/api/pdm/simulate", params={"temperature": 95, "vibration": 5.0})
    assert response.status_code == 200
    body = response.json()
    assert body["rul_hours"] is not None
    assert body["health"] is not None
    cascade = body["cascade"]
    assert cascade is not None
    assert "fault_type" in cascade
    assert cascade["sections_affected"] >= 0


def test_live_and_history_are_served_even_with_no_telemetry():
    """With the broker disabled the buffers are empty, but must still respond."""
    live = client.get("/api/pdm/live")
    assert live.status_code == 200
    assert live.json()["connected"] is False

    history = client.get("/api/pdm/history", params={"limit": 10})
    assert history.status_code == 200
    assert history.json()["data"] == []


def test_merge_did_not_shadow_gridsense_routes():
    """`/api/health` and `/api/alerts` must still be the grid endpoints."""
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["system"] == "GridSense Power-Grid Cascade AI"

    # The plant equivalent lives under the namespace and is a different shape.
    plant_health = client.get("/api/pdm/health")
    assert plant_health.status_code == 200
    assert "alert_level" in plant_health.json()


def test_model_info_serves_the_real_evaluated_metrics():
    """Regression test for the METRICS_JSON path bug.

    The endpoint used to fall through to a hardcoded fallback (ROC-AUC 0.912)
    because it looked in backend/results instead of backend/ml/results.
    """
    response = client.get("/api/model/info")
    assert response.status_code == 200
    metrics = response.json()["evaluated_test_metrics"]
    assert metrics["roc_auc"] == 0.9887
    assert metrics["f1"] == 0.8392
    # Only the real metrics.json carries the evaluation provenance fields.
    assert metrics["total_evaluated_nodes"] == 6872
