"""
GridSense GNN Inference Engine:
Loads trained PyTorch GNN model and performs real-time failure risk inference
based on the authoritative India Cascade Dataset.
"""

import os
import json
from typing import Dict, Any, Tuple, Optional
import torch
import numpy as np
from ml.models.gnn import GridSenseGNN

FEATURE_COLS = [
    'f_load_pct', 'f_temp_c', 'f_voltage_pu_proxy', 'f_capacity_mva', 'f_age_years',
    'f_demand_mw', 'f_gen_mw', 'f_degree', 'f_ambient_c', 'f_headroom_pct',
    'f_stress_multiplier', 'f_load_multiplier', 'f_weather_factor', 'f_hops_from_initiator'
]

class RiskPredictor:
    def __init__(self, model_path: Optional[str] = None, norm_path: Optional[str] = None):
        self.device = torch.device("cpu")
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        if model_path is None:
            # Releases package model artefacts under ml/trained_models; keep the
            # historical models directory as a compatible development fallback.
            packaged_model = os.path.join(base_dir, "ml", "trained_models", "gridsense_gnn.pt")
            model_path = packaged_model if os.path.exists(packaged_model) else os.path.join(base_dir, "models", "gridsense_gnn.pt")
        if norm_path is None:
            packaged_norm = os.path.join(base_dir, "ml", "trained_models", "feature_norm.json")
            norm_path = packaged_norm if os.path.exists(packaged_norm) else os.path.join(base_dir, "models", "feature_norm.json")

        self.in_channels = len(FEATURE_COLS)
        self.model = GridSenseGNN(
            in_channels=self.in_channels,
            hidden_channels=64,
            edge_dim=3,
            heads=4,
            dropout=0.0
        )

        self.feat_mean = np.zeros(self.in_channels)
        self.feat_std = np.ones(self.in_channels)

        if os.path.exists(norm_path):
            try:
                with open(norm_path, 'r') as f:
                    nd = json.load(f)
                    self.feat_mean = np.array(nd.get("mean", self.feat_mean))
                    self.feat_std = np.array(nd.get("std", self.feat_std))
            except Exception as e:
                print(f"Notice: using default normalization: {e}")

        if os.path.exists(model_path):
            try:
                state = torch.load(model_path, map_location=self.device, weights_only=False)
                self.model.load_state_dict(state)
                print(f"Loaded trained GNN weights from {model_path}")
            except Exception as e:
                print(f"Warning: could not load model weights ({e}). Running initialized model.")
        else:
            print(f"Notice: Model checkpoint {model_path} not found. Running initialized model.")
        
        self.model.eval()

    def predict(self, grid_state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Takes grid_state dict, constructs graph tensors, and computes node risk probabilities.
        """
        nodes = grid_state.get("nodes", [])
        edges = grid_state.get("edges", [])

        if not nodes:
            return {"node_risk": {}, "time_to_critical": {}, "predicted_failures": [], "cascade_risk_pct": 0.0}

        node_id_to_idx = {n["id"]: idx for idx, n in enumerate(nodes)}
        num_nodes = len(nodes)

        # Build feature matrix matching FEATURE_COLS
        x_list = []
        for n in nodes:
            feats = n.get("features", {})
            f_vals = [
                float(feats.get("load_pct", 35.0)),
                float(feats.get("temperature_c", 35.0)),
                float(feats.get("voltage_pu", 1.0)),
                float(feats.get("capacity_mva", 100.0)),
                float(feats.get("age_years", 10.0)),
                float(feats.get("demand_mw", 25.0)),
                float(feats.get("gen_mw", 0.0)),
                float(feats.get("degree", 2)),
                float(feats.get("ambient_c", 32.0)),
                float(feats.get("headroom_pct", max(0.0, 100.0 - float(feats.get("load_pct", 35.0))))),
                float(feats.get("stress_multiplier", 1.0)),
                float(feats.get("load_multiplier", 1.0)),
                float(feats.get("weather_factor", 1.0)),
                float(feats.get("hops_from_initiator", 0))
            ]
            x_list.append(f_vals)

        raw_x = np.array(x_list)
        norm_x = (raw_x - self.feat_mean) / self.feat_std
        x = torch.tensor(norm_x, dtype=torch.float32, device=self.device)

        # Edges
        edge_indices = []
        edge_attrs = []
        for e in edges:
            src = e.get("source")
            tgt = e.get("target")
            if src in node_id_to_idx and tgt in node_id_to_idx:
                u = node_id_to_idx[src]
                v = node_id_to_idx[tgt]
                # Bi-directional
                edge_indices.append([u, v])
                edge_indices.append([v, u])
                cap = float(e.get("capacity_mva", 100.0)) / 1000.0
                reac = float(e.get("reactance_pu", 0.1))
                length = float(e.get("length_km", 10.0)) / 100.0
                attr = [cap, reac, length]
                edge_attrs.append(attr)
                edge_attrs.append(attr)

        if edge_indices:
            edge_index = torch.tensor(edge_indices, dtype=torch.long, device=self.device).t().contiguous()
            edge_attr = torch.tensor(edge_attrs, dtype=torch.float32, device=self.device)
        else:
            edge_index = torch.empty((2, 0), dtype=torch.long, device=self.device)
            edge_attr = None

        with torch.no_grad():
            out = self.model(x, edge_index, edge_attr)
            raw_probs = out["risk_prob"].cpu().numpy()
            raw_times = out["time_to_critical"].cpu().numpy()

        node_risks = {}
        time_to_crit = {}
        predicted_failures = []

        for idx, n in enumerate(nodes):
            nid = n["id"]
            model_prob = float(raw_probs[idx]) if raw_probs.ndim > 0 else float(raw_probs)
            pred_time = float(raw_times[idx]) if raw_times.ndim > 0 else float(raw_times)

            risk = round(min(0.99, max(0.01, model_prob)), 3)
            ttc = round(max(0.5, pred_time), 1)

            node_risks[nid] = risk
            time_to_crit[nid] = ttc

            if risk >= 0.70:
                predicted_failures.append(nid)

        max_risk = max(node_risks.values()) if node_risks else 0.0
        cascade_risk_pct = round(max_risk * 100.0, 1)

        return {
            "node_risk": node_risks,
            "time_to_critical": time_to_crit,
            "predicted_failures": predicted_failures,
            "cascade_risk_pct": cascade_risk_pct
        }
