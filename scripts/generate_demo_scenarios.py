"""
Generate deterministic demo scenario files for offline fallback.
"""

import os
import sys
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

scenario_configs = [
    {"id": "normal", "node": "T17", "stress": 1.0, "steps": 2},
    {"id": "transformer_overload", "node": "T17", "stress": 1.82, "steps": 4},
    {"id": "line_outage", "node": "B14", "stress": 1.45, "steps": 4},
    {"id": "high_demand", "node": "B18", "stress": 1.35, "steps": 4},
    {"id": "cascade_emergency", "node": "T17", "stress": 1.95, "steps": 5}
]

out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "demo_scenarios"))
os.makedirs(out_dir, exist_ok=True)

for sc in scenario_configs:
    print(f"Generating deterministic demo scenario: {sc['id']}...")
    payload = {
        "grid_id": "ieee24",
        "initiating_node": sc["node"],
        "stress_multiplier": sc["stress"],
        "max_steps": sc["steps"]
    }
    resp = client.post("/api/simulate", json=payload)
    if resp.status_code == 200:
        data = resp.json()
        target_file = os.path.join(out_dir, f"{sc['id']}.json")
        with open(target_file, "w") as f:
            json.dump(data, f, indent=2)
        print(f" Saved to {target_file}")
    else:
        print(f" Failed: {resp.status_code} {resp.text}")

print("All deterministic demo scenarios generated successfully!")
