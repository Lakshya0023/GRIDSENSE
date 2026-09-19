"""
Tests for GridSense Power System Simulation.
"""

import pytest
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from simulation.grid_loader import GridLoader
from simulation.cascade import CascadeSimulator

def test_grid_loader_ieee24():
    loader = GridLoader()
    net = loader.get_net("ieee24")
    assert net is not None
    assert len(net.bus) == 24
    
    graph_data = loader.to_graph_data(net, "ieee24")
    assert len(graph_data["nodes"]) == 24
    assert len(graph_data["edges"]) > 0
    assert any(n["id"] == "T17" for n in graph_data["nodes"])

def test_cascade_simulator():
    loader = GridLoader()
    sim = CascadeSimulator(loader)
    res = sim.simulate_cascade(
        grid_id="ieee24",
        initiating_node="T17",
        stress_multiplier=1.85,
        max_steps=4
    )
    assert res is not None
    assert "cascade_path" in res
    assert res["initiating_node"] == "T17"
    assert len(res["timeline"]) > 0
    assert res["final_risk_pct"] > 50.0
