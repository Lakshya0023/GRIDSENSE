"""
Entrypoint script to train the GridSense GNN model locally on the complete India Cascade Dataset.
"""

import os
import sys

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from ml.training.train import train_gridsense_model

if __name__ == "__main__":
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    dataset_dir = os.path.join(base_dir, "dataset")
    output_model = os.path.join(base_dir, "models", "gridsense_gnn.pt")
    output_metrics = os.path.join(base_dir, "results", "metrics.json")
    
    print(f"Executing GridSense Training Script on Authoritative Dataset: {dataset_dir}...")
    train_gridsense_model(
        dataset_dir=dataset_dir,
        output_model_path=output_model,
        output_metrics_path=output_metrics,
        epochs=8,
        # Preserve the grouped train/validation/test split while using all 5,000 conditions.
        max_train_scenarios=None
    )
