"""
Tests for GridSense GNN Model & Inference.
"""

import os
import sys
import torch
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from ml.models.gnn import GridSenseGNN
from ml.inference.predict import RiskPredictor

def test_gnn_forward_pass():
    model = GridSenseGNN(in_channels=3, hidden_channels=32, edge_dim=4, heads=2)
    x = torch.randn(24, 3)
    edge_index = torch.tensor([[0, 1, 1, 2], [1, 0, 2, 1]], dtype=torch.long)
    edge_attr = torch.randn(4, 4)
    
    out = model(x, edge_index, edge_attr)
    assert "risk_prob" in out
    assert "time_to_critical" in out
    assert out["risk_prob"].shape == (24,)
    assert (out["risk_prob"] >= 0.0).all() and (out["risk_prob"] <= 1.0).all()

def test_risk_predictor():
    predictor = RiskPredictor()
    dummy_state = {
        "nodes": [
            {"id": "T17", "features": {"load_pct": 95.0, "voltage_pu": 0.96, "temperature_c": 75.0, "capacity_mva": 25.0}},
            {"id": "F8", "features": {"load_pct": 82.0, "voltage_pu": 0.98, "temperature_c": 50.0, "capacity_mva": 15.0}}
        ],
        "edges": [
            {"source": "T17", "target": "F8", "capacity_mva": 15.0, "loading_pct": 85.0}
        ]
    }
    preds = predictor.predict(dummy_state)
    assert "node_risk" in preds
    assert "T17" in preds["node_risk"]
    assert "F8" in preds["node_risk"]
