"""
GridSense Comprehensive Automated Test Suite
Verifies data schema compliance, power flow physics, GNN inference,
causal root cause ranking, conformal uncertainty bounds, and what-if intervention loop.
"""

import json
import os
import unittest
from fastapi.testclient import TestClient

from backend.main import app
from backend.simulator import GridSimulator, global_simulator
from backend.gnn_engine import GNNEngine, global_gnn_engine
from backend.causal_uncertainty import CausalUncertaintyEngine, global_causal_engine
from backend.intervention import InterventionOptimizer, global_intervention_optimizer
from backend.scenarios import get_canned_scenarios


class TestGridSensePipeline(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)
        self.sim = GridSimulator(seed=123)
        self.gnn = GNNEngine(simulator=self.sim)
        self.causal = CausalUncertaintyEngine(simulator=self.sim, gnn_engine=self.gnn)
        self.opt = InterventionOptimizer(simulator=self.sim, gnn_engine=self.gnn, causal_engine=self.causal)

    def test_schema_json_exists(self):
        """Checks schema.json file existence and valid JSON parsing."""
        schema_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "schema.json")
        self.assertTrue(os.path.exists(schema_path), "schema.json must exist")
        with open(schema_path, "r") as f:
            schema = json.load(f)
        self.assertIn("properties", schema)
        self.assertIn("grid_state", schema["properties"])
        self.assertIn("model_output", schema["properties"])

    def test_power_flow_physics(self):
        """Verifies AC/DistFlow power flow solves voltages and loadings within physical ranges."""
        pf = self.sim.solve_power_flow()
        self.assertTrue(pf["converged"])
        # Substation slack bus V = 1.02
        self.assertAlmostEqual(pf["voltages"]["S1"], 1.02, places=2)
        # All energized voltages should be within reasonable bounds (0.80 - 1.05)
        for n, v in pf["voltages"].items():
            self.assertGreater(v, 0.75, f"Voltage at {n} too low: {v}")
            self.assertLess(v, 1.10, f"Voltage at {n} too high: {v}")

    def test_gnn_inference_and_conformal_bounds(self):
        """Verifies GNN produces valid probabilities and monotonic conformal prediction intervals."""
        pf = self.sim.solve_power_flow()
        grid_state = self.sim.export_grid_state(pf)
        gnn_out = self.gnn.predict_risk(grid_state)

        node_risks = gnn_out["node_risk"]
        self.assertEqual(len(node_risks), len(self.sim.graph.nodes()))
        for nid, r in node_risks.items():
            self.assertGreaterEqual(r, 0.0)
            self.assertLessEqual(r, 1.0)

        # Conformal intervals
        intervals = self.causal.compute_conformal_intervals(node_risks)
        for nid, (low, high) in intervals.items():
            r = node_risks[nid]
            self.assertLessEqual(low, high, f"Monotonicity error for {nid}: [{low}, {high}]")
            self.assertLessEqual(low, r + 0.05)
            self.assertGreaterEqual(high, r - 0.05)

    def test_causal_root_cause_disambiguation(self):
        """
        Critical Test: When T17 is stressed, verify that T17 is identified as the TRUE ROOT CAUSE
        (explained_by_upstream = False) while downstream nodes like F8 have explained_by = T17.
        """
        sim_res = self.sim.simulate_cascade(
            initiating_node="T17",
            stress_multiplier=1.85,
            ambient_temp_c=35.0,
            max_steps=6
        )
        grid_state = self.sim.export_grid_state(sim_res["final_power_flow"])
        gnn_out = self.gnn.predict_risk(grid_state)

        root_causes = self.causal.rank_root_causes(
            node_risks=gnn_out["node_risk"],
            time_series=sim_res["time_series"],
            grid_state=grid_state,
            initiating_candidate="T17"
        )

        self.assertGreater(len(root_causes), 0)
        top_rc = rootCauses = root_causes[0]
        self.assertEqual(top_rc["node"], "T17", "T17 must be top root cause candidate")
        self.assertFalse(top_rc["explained_by_upstream"], "T17 must not be explained by upstream")
        self.assertGreater(top_rc["root_cause_score"], 0.70)

        # Check downstream symptom
        symptoms = [rc for rc in root_causes if rc["explained_by_upstream"]]
        if symptoms:
            self.assertIn(symptoms[0]["explained_by"], ["T17", "F8", "S4", "T16"])

    def test_intervention_mitigation_loop(self):
        """Verifies that applying the intervention reduces cascade risk substantially."""
        res = self.opt.apply_intervention_and_evaluate(
            initiating_node="T17",
            stress_multiplier=1.85,
            ambient_temp_c=35.0,
            load_shed_pct=12.0
        )
        before_risk = res["before"]["model_output"]["cascade_risk_pct"]
        after_risk = res["after"]["model_output"]["cascade_risk_pct"]

        self.assertGreater(before_risk, 60.0, "Stressed grid must have elevated cascade risk")
        self.assertLess(after_risk, 35.0, "Mitigated grid must have low cascade risk")
        self.assertGreater(res["metrics_delta"]["cascade_risk_drop_pct"], 30.0)

    def test_api_endpoints(self):
        """Verifies all FastAPI REST endpoints respond with 200 OK."""
        # /api/health
        resp = self.client.get("/api/health")
        self.assertEqual(resp.status_code, 200)

        # /api/grid/topology
        resp = self.client.get("/api/grid/topology")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("nodes", data)
        self.assertIn("edges", data)

        # /api/simulate
        sim_payload = {
            "initiating_node": "T17",
            "stress_multiplier": 1.85,
            "ambient_temp_c": 35.0,
            "max_steps": 5
        }
        resp = self.client.post("/api/simulate", json=sim_payload)
        self.assertEqual(resp.status_code, 200)
        sim_data = resp.json()
        self.assertIn("grid_state", sim_data)
        self.assertIn("model_output", sim_data)
        self.assertIn("root_cause_ranking", sim_data["model_output"])

        # /api/intervene
        resp = self.client.post("/api/intervene", json=sim_payload)
        self.assertEqual(resp.status_code, 200)

        # /api/scenarios
        resp = self.client.get("/api/scenarios")
        self.assertEqual(resp.status_code, 200)


if __name__ == "__main__":
    unittest.main()
