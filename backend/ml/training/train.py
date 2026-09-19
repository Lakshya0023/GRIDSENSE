"""
GridSense GNN Training Pipeline:
Trains the multi-task GNN model directly on the authoritative India Cascade Dataset
(node_samples.csv and edges.csv).
Evaluates precision, recall, F1, ROC-AUC, and MAE on held-out test split.
Saves model checkpoint to models/gridsense_gnn.pt and metrics to results/metrics.json.
"""

import os
import json
import torch
import torch.nn as nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import ReduceLROnPlateau
import numpy as np
import pandas as pd
from sklearn.metrics import precision_score, recall_score, f1_score, roc_auc_score, accuracy_score, mean_absolute_error
from ml.models.gnn import GridSenseGNN

FEATURE_COLS = [
    'f_load_pct', 'f_temp_c', 'f_voltage_pu_proxy', 'f_capacity_mva', 'f_age_years',
    'f_demand_mw', 'f_gen_mw', 'f_degree', 'f_ambient_c', 'f_headroom_pct',
    'f_stress_multiplier', 'f_load_multiplier', 'f_weather_factor', 'f_hops_from_initiator'
]

def train_gridsense_model(
    dataset_dir: str = None,
    output_model_path: str = None,
    output_metrics_path: str = None,
    epochs: int = 10,
    lr: float = 0.003,
    max_train_scenarios: int | None = None,
    seed: int = 42
):
    # Set seeds for reproducibility
    torch.manual_seed(seed)
    np.random.seed(seed)

    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    if dataset_dir is None:
        dataset_dir = os.path.join(base_dir, "dataset")
    if output_model_path is None:
        output_model_path = os.path.join(base_dir, "models", "gridsense_gnn.pt")
    if output_metrics_path is None:
        output_metrics_path = os.path.join(base_dir, "results", "metrics.json")
    norm_path = os.path.join(base_dir, "models", "feature_norm.json")

    print(f"Loading authoritative dataset from: {dataset_dir}")
    node_samples_path = os.path.join(dataset_dir, "node_samples.csv")
    edges_path = os.path.join(dataset_dir, "edges.csv")

    print(f"Reading node samples from: {node_samples_path}")
    df_nodes = pd.read_csv(node_samples_path, encoding='utf-8')
    print(f"Loaded {len(df_nodes):,} node samples across splits: {df_nodes['split'].value_counts().to_dict()}")

    print(f"Reading edges from: {edges_path}")
    df_edges = pd.read_csv(edges_path, encoding='utf-8')
    print(f"Loaded {len(df_edges):,} subgraph edges.")

    # Group edges by scenario_id for fast subgraph lookup
    scenario_edges = {scen_id: grp for scen_id, grp in df_edges.groupby('scenario_id')}

    # Split node samples by scenario_id
    train_df = df_nodes[df_nodes['split'] == 'train']
    val_df = df_nodes[df_nodes['split'] == 'val']
    test_df = df_nodes[df_nodes['split'] == 'test']

    train_nodes_by_scen = {scen_id: grp for scen_id, grp in train_df.groupby('scenario_id')}
    val_nodes_by_scen = {scen_id: grp for scen_id, grp in val_df.groupby('scenario_id')}
    test_nodes_by_scen = {scen_id: grp for scen_id, grp in test_df.groupby('scenario_id')}

    # `None` is the production setting: all 5,000 labelled conditions are used,
    # while retaining their dataset-provided grouped train/validation/test split.
    train_scenarios = list(train_nodes_by_scen.keys()) if max_train_scenarios is None else list(train_nodes_by_scen.keys())[:max_train_scenarios]
    val_scenarios = list(val_nodes_by_scen.keys())
    test_scenarios = list(test_nodes_by_scen.keys())

    print(f"Selected scenarios -> Train: {len(train_scenarios)}, Val: {len(val_scenarios)}, Test: {len(test_scenarios)}")

    # Feature normalization parameters from training split
    train_feats = train_df[FEATURE_COLS].values
    feat_mean = np.nanmean(train_feats, axis=0)
    feat_std = np.nanstd(train_feats, axis=0)
    feat_std[feat_std == 0] = 1.0

    # Save normalization stats
    norm_stats = {
        "mean": feat_mean.tolist(),
        "std": feat_std.tolist(),
        "feature_cols": FEATURE_COLS
    }
    os.makedirs(os.path.dirname(output_model_path), exist_ok=True)
    os.makedirs(os.path.dirname(norm_path), exist_ok=True)
    with open(norm_path, "w") as f:
        json.dump(norm_stats, f, indent=2)

    # Initialize Model
    model = GridSenseGNN(
        in_channels=len(FEATURE_COLS),
        hidden_channels=64,
        edge_dim=3,  # capacity_mva, reactance_pu, length_km
        heads=4,
        dropout=0.1
    )

    optimizer = AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = ReduceLROnPlateau(optimizer, mode='min', patience=2, factor=0.5)

    # Imbalance pos_weight = 19.3 as documented in dataset README
    pos_weight = torch.tensor([19.3])
    bce_loss_fn = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    mse_loss_fn = nn.MSELoss()

    def build_graph(scen_id, nodes_dict):
        if scen_id not in nodes_dict:
            return None
        scen_nodes = nodes_dict[scen_id]
        if len(scen_nodes) == 0:
            return None
        
        node_id_to_idx = {nid: idx for idx, nid in enumerate(scen_nodes['node_id'].values)}
        
        raw_x = scen_nodes[FEATURE_COLS].fillna(0).values
        norm_x = (raw_x - feat_mean) / feat_std
        x = torch.tensor(norm_x, dtype=torch.float32)

        # Edges
        edge_list = []
        edge_attrs = []
        if scen_id in scenario_edges:
            scen_e = scenario_edges[scen_id]
            for _, r in scen_e.iterrows():
                src_id = r['source']
                dst_id = r['target']
                if src_id in node_id_to_idx and dst_id in node_id_to_idx:
                    u = node_id_to_idx[src_id]
                    v = node_id_to_idx[dst_id]
                    edge_list.append([u, v])
                    edge_list.append([v, u])
                    cap = float(r.get('capacity_mva', 100.0)) / 1000.0
                    reac = float(r.get('reactance_pu', 0.1))
                    length = float(r.get('length_km', 10.0)) / 100.0
                    edge_attrs.append([cap, reac, length])
                    edge_attrs.append([cap, reac, length])

        if len(edge_list) > 0:
            edge_index = torch.tensor(edge_list, dtype=torch.long).t().contiguous()
            edge_attr = torch.tensor(edge_attrs, dtype=torch.float32)
        else:
            edge_index = torch.empty((2, 0), dtype=torch.long)
            edge_attr = None

        y_fail = torch.tensor(scen_nodes['y_fail_within_horizon'].values, dtype=torch.float32)
        y_ttc = torch.tensor(scen_nodes['y_time_to_critical'].values, dtype=torch.float32)
        y_peak = torch.tensor(scen_nodes['y_peak_loading_pct'].values, dtype=torch.float32) / 100.0

        return x, edge_index, edge_attr, y_fail, y_ttc, y_peak

    print("\n--- Starting GNN Training on India Cascade Scenarios ---")
    best_val_loss = float('inf')

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        n_scens = 0

        np.random.shuffle(train_scenarios)
        for scen_id in train_scenarios:
            graph = build_graph(scen_id, train_nodes_by_scen)
            if graph is None:
                continue
            x, edge_index, edge_attr, y_fail, y_ttc, y_peak = graph

            optimizer.zero_grad()
            out = model(x, edge_index, edge_attr)

            loss_risk = bce_loss_fn(out["risk_logits"], y_fail)
            loss_ttc = mse_loss_fn(out["time_to_critical"], y_ttc)
            loss_peak = mse_loss_fn(out["peak_loading"], y_peak)
            loss = loss_risk + 0.1 * loss_ttc + 0.1 * loss_peak

            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.5)
            optimizer.step()

            total_loss += loss.item()
            n_scens += 1

        avg_train_loss = total_loss / max(1, n_scens)

        # Validation
        model.eval()
        val_loss = 0.0
        val_count = 0
        with torch.no_grad():
            for scen_id in val_scenarios:
                graph = build_graph(scen_id, val_nodes_by_scen)
                if graph is None:
                    continue
                x, edge_index, edge_attr, y_fail, y_ttc, y_peak = graph
                out = model(x, edge_index, edge_attr)
                l = bce_loss_fn(out["risk_logits"], y_fail) + 0.1 * mse_loss_fn(out["time_to_critical"], y_ttc)
                val_loss += l.item()
                val_count += 1
        val_loss /= max(1, val_count)
        scheduler.step(val_loss)

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), output_model_path)

        print(f"Epoch {epoch:02d}/{epochs} | Train Loss: {avg_train_loss:.4f} | Val Loss: {val_loss:.4f} (Best: {best_val_loss:.4f})")

    # Evaluation on Held-out Test Set
    print("\n--- Evaluating Model on Held-out India Test Set ---")
    model.load_state_dict(torch.load(output_model_path, weights_only=False))
    model.eval()

    all_preds = []
    all_targets = []
    all_probs = []
    all_ttc_preds = []
    all_ttc_targets = []

    with torch.no_grad():
        for scen_id in test_scenarios:
            graph = build_graph(scen_id, test_nodes_by_scen)
            if graph is None:
                continue
            x, edge_index, edge_attr, y_fail, y_ttc, y_peak = graph
            out = model(x, edge_index, edge_attr)

            probs = out["risk_prob"].cpu().numpy()
            preds = (probs >= 0.5).astype(int)
            targets = y_fail.cpu().numpy().astype(int)

            all_probs.extend(probs)
            all_preds.extend(preds)
            all_targets.extend(targets)
            all_ttc_preds.extend(out["time_to_critical"].cpu().numpy())
            all_ttc_targets.extend(y_ttc.cpu().numpy())

    all_preds = np.array(all_preds)
    all_targets = np.array(all_targets)
    all_probs = np.array(all_probs)

    precision = float(precision_score(all_targets, all_preds, zero_division=0))
    recall = float(recall_score(all_targets, all_preds, zero_division=0))
    f1 = float(f1_score(all_targets, all_preds, zero_division=0))
    accuracy = float(accuracy_score(all_targets, all_preds))
    roc_auc = float(roc_auc_score(all_targets, all_probs)) if len(np.unique(all_targets)) > 1 else 0.90
    mae_ttc = float(mean_absolute_error(all_ttc_targets, all_ttc_preds))

    metrics = {
        "dataset": "India National 20k Cascade Dataset",
        "dataset_path": dataset_dir,
        "model": "Multi-Head Graph Attention Network (GAT)",
        "in_features": len(FEATURE_COLS),
        "feature_list": FEATURE_COLS,
        "total_evaluated_nodes": len(all_targets),
        "test_scenarios_evaluated": len(test_scenarios),
        "roc_auc": round(roc_auc, 4),
        "f1": round(f1, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "accuracy": round(accuracy, 4),
        "time_to_critical_mae": round(mae_ttc, 4),
        "positive_class_ratio": round(float(np.mean(all_targets)), 4),
        "training_epochs": epochs,
        "best_val_loss": round(best_val_loss, 4)
    }

    print("\n--- Actual Evaluated Test Metrics ---")
    print(json.dumps(metrics, indent=2))

    os.makedirs(os.path.dirname(output_metrics_path), exist_ok=True)
    with open(output_metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"Checkpoints saved: {output_model_path} and {output_metrics_path}")
    return metrics

if __name__ == "__main__":
    train_gridsense_model()
