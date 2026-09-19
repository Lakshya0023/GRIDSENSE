"""
Tests for GridSense Temporal Root-Cause Analysis.
"""

import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from ml.causal.root_cause import RootCauseAnalyzer

def test_root_cause_ranking():
    analyzer = RootCauseAnalyzer()
    dummy_state = {
        "nodes": [
            {"id": "T17", "features": {"load_pct": 110.0, "temperature_c": 82.0}},
            {"id": "F8", "features": {"load_pct": 95.0, "temperature_c": 55.0}},
            {"id": "T21", "features": {"load_pct": 85.0, "temperature_c": 45.0}}
        ],
        "edges": [
            {"source": "T17", "target": "F8"},
            {"source": "F8", "target": "T21"}
        ]
    }
    node_risks = {"T17": 0.89, "F8": 0.72, "T21": 0.65}
    timeline = [
        {"step": 0, "node": "T17", "event": "Overload on T17"},
        {"step": 1, "node": "F8", "event": "Trip on F8"},
        {"step": 2, "node": "T21", "event": "Trip on T21"}
    ]

    ranking = analyzer.rank_root_causes(dummy_state, node_risks, timeline, initiating_hint="T17")
    assert len(ranking) == 3
    
    # T17 should be highest ranked root cause and NOT explained by upstream
    assert ranking[0]["node"] == "T17"
    assert ranking[0]["explained_by_upstream"] == 0.0
    assert ranking[0]["root_cause_score"] > 0.80

    # F8 should be explained by T17
    f8_entry = next(r for r in ranking if r["node"] == "F8")
    assert f8_entry["explained_by_upstream"] == 1.0
    assert f8_entry["explained_by"] == ["T17"]
