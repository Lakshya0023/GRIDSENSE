import pytest
from fastapi.testclient import TestClient
from backend.main import app
from simulation.grid_loader import GridLoader
from simulation.cascade import CascadeSimulator
from simulation.interventions import InterventionEngine

client = TestClient(app)

def test_india_grid_loader():
    loader = GridLoader()
    net = loader.get_net("india_demo_grid_v1")
    assert net is not None
    graph = loader.to_graph_data(net, "india_demo_grid_v1")
    assert len(graph["nodes"]) == 24
    assert len(graph["edges"]) == 23
    assert graph["grid_id"] == "india_demo_grid_v1"
    
    # Check that city coordinates are present
    delhi_tx = next((n for n in graph["nodes"] if n["id"] == "DEL-TRAN-02"), None)
    assert delhi_tx is not None
    assert delhi_tx["city"] == "Delhi"
    assert delhi_tx["lat"] == 28.6410
    assert delhi_tx["lon"] == 77.0685
    assert "Patparganj" in (delhi_tx.get("reference") or "")

def test_verified_substations_endpoint():
    res = client.get("/api/india/real-substations")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 10
    patparganj = next((s for s in data if s["name"] == "Patparganj"), None)
    assert patparganj is not None
    assert patparganj["city"] == "Delhi"
    assert "Delhi Transco" in patparganj["source"] or "DTL" in patparganj["source"]

def test_india_cascade_simulation():
    sim = CascadeSimulator()
    res = sim.simulate_cascade(
        grid_id="india_demo_grid_v1",
        initiating_node="DEL-TRAN-02",
        stress_multiplier=1.85,
        max_steps=4
    )
    assert res["initiating_node"] == "DEL-TRAN-02"
    assert len(res["cascade_path"]) >= 2
    assert "DEL-FEED-03" in res["cascade_path"] or "MUM-TRAN-02" in res["cascade_path"]
    assert res["final_risk_pct"] > 70.0

def test_india_what_if_intervention():
    engine = InterventionEngine()
    result = engine.apply_intervention(
        grid_id="india_demo_grid_v1",
        initiating_node="DEL-TRAN-02",
        stress_multiplier=1.85,
        action_type="reduce_load",
        target_node="DEL-TRAN-02",
        value_pct=15.0
    )
    assert result["risk_reduction"] > 40.0
    assert result["before"]["cascade_risk"] > result["after"]["cascade_risk"]
    assert result["physics_valid"] is True
