# GridSense — Predict · Explain · Prevent

> GridSense is a power-grid cascading-failure analysis platform that **predicts** where failures start, how they **propagate** across the transmission network, disambiguates the **true root cause** from downstream symptoms using Graph Neural Networks and temporal precedence, and evaluates **counterfactual interventions** to halt blackouts.

![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.11+-brightgreen)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![PyTorch](https://img.shields.io/badge/PyTorch-2.x-EE4C2C)
![Three.js](https://img.shields.io/badge/Three.js-3D%20Map-00E5FF)

---

## Architecture

```
Power Grid SCADA / Topology (India 20k National Dataset)
  │
  ├──► Graph Construction (14 Node Features + 3 Edge Physical Attributes)
  │      ↓
  ├──► 3-Layer Multi-Head Graph Attention Network (GAT in PyTorch)
  │      ├─► Failure Risk Probability Head [0, 1]
  │      ├─► Time-to-Critical Regression Head (hours/steps)
  │      └─► Peak Loading Regression Head (%)
  │      ↓
  ├──► Temporal Root-Cause Hierarchy (Upstream Precedence Disambiguation)
  │      ↓
  ├──► Split-Conformal Prediction Uncertainty (Rigorous 90% Confidence Intervals)
  │      ↓
  ├──► Kirchhoff & Thermal Physics Constraint Validation
  │      ↓
  ├──► Counterfactual What-If Intervention Optimizer (Load Curtailment & Redispatch)
  │      ↓
  └──► Interactive 3D Digital Twin Map & Intelligence Console (Next.js + Three.js)
```

| Layer | Tech | Purpose |
|-------|------|---------|
| **Backend API** | FastAPI, Pydantic v2, Uvicorn | High-performance async REST API on `http://localhost:8000` |
| **GNN Risk Model** | PyTorch (3-Layer GAT) | Multi-task node-level risk probability & time-to-critical |
| **Root Cause** | Temporal precedence & graph traversal | Distinguish true originator from downstream overload symptoms |
| **Uncertainty** | Split-conformal prediction | Finite-sample distribution-free 90% confidence intervals |
| **Physics Validation** | Kirchhoff & Pandapower AC/DC checks | Verify power balance, thermal limits, and voltage feasibility |
| **Intervention** | Counterfactual what-if engine | Compute minimal load shedding/rerouting to halt cascade |
| **Frontend UI** | Next.js 16, React 19, Three.js, Zustand | Interactive 3D explore grid map on `http://localhost:3000` |

---

## Dataset Description

The application is powered by the authoritative **India Cascade Dataset**:
- `dataset/node_samples.csv`: 158,923 node training samples across 5,000 cascade scenarios.
- `dataset/edges.csv`: 168,757 scenario subgraph edges (`capacity_mva`, `reactance_pu`, `length_km`).
- `dataset/scenarios.csv`: 5,000 simulated cascade events across India (heatwaves, line outages, transformer overloads, cascade emergencies).
- `dataset/india_national_nodes.csv`: 22,753 grid assets with real geographic coordinates across 20,000 Indian cities.
- `dataset/india_national_edges.csv`: 23,337 transmission lines (765kV, 400kV, 220kV, 132kV, 33kV).

### Node Features (14 Dimensions)
1. `f_load_pct`: Operating loading percentage
2. `f_temp_c`: Dynamic conductor/transformer core temperature in °C
3. `f_voltage_pu_proxy`: Per-unit voltage proxy
4. `f_capacity_mva`: Rated asset capacity in MVA
5. `f_age_years`: Asset service age in years
6. `f_demand_mw`: Real power demand in MW
7. `f_gen_mw`: Generation dispatch in MW
8. `f_degree`: Graph topological degree
9. `f_ambient_c`: Ambient air temperature
10. `f_headroom_pct`: Remaining capacity headroom %
11. `f_stress_multiplier`: External demand stress multiplier
12. `f_load_multiplier`: Grid load factor
13. `f_weather_factor`: Weather severity multiplier
14. `f_hops_from_initiator`: Topological distance from initiating stress

---

## Model Performance & Evaluation Results

Evaluated on 200 held-out test scenarios (6,872 nodes) from the India dataset:

| Metric | Evaluated Value | Description |
|--------|-----------------|-------------|
| **ROC-AUC** | **0.9887** | Discrimination ability between failing and secure assets |
| **F1 Score** | **0.8392** | Harmonic mean of precision and recall |
| **Precision** | **0.8204** | Accuracy of positive cascade alerts |
| **Recall** | **0.8589** | Proportion of actual cascade failures detected |
| **Accuracy** | **0.9847** | Overall node classification accuracy |
| **TTC MAE** | **0.1758** | Time-to-critical regression mean absolute error |

Checkpoint saved: `models/gridsense_gnn.pt`  
Normalization stats: `models/feature_norm.json`  
Evaluation metrics: `results/metrics.json`

---

## Quick Start & Running the Project

### Prerequisites
- **Python 3.11+**
- **Node.js 18+** and npm

### 1. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 2. (Optional) Retrain the GNN Model
```bash
python scripts/train.py
```

### 3. Install Frontend Dependencies
```bash
npm install
```

### 4. Launch Backend (Port 8000)
```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
- API Root: `http://localhost:8000`
- Interactive Swagger API Docs: `http://localhost:8000/docs`

### 5. Launch Frontend (Port 3000)
```bash
npm run dev -- --port 3000
```
- Main Application / Map Explorer: `http://localhost:3000` or `http://localhost:3000/map-explorer`
- Operational Dashboard: `http://localhost:3000/dashboard`

---

## API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Backend status, model load status, conformal coverage |
| `GET` | `/api/grid/nodes` | List all grid assets with geo-coordinates and telemetry |
| `GET` | `/api/grid/edges` | List all grid transmission/distribution lines |
| `GET` | `/api/grid/node/{node_id}` | Detailed telemetry and connected branches for a specific node |
| `GET` | `/api/grid/topology` | Full baseline healthy grid state (`GridState`) |
| `POST` | `/api/simulate` | Run cascade stress simulation, GNN inference, and root cause ranking |
| `POST` | `/api/predict` | Direct GNN inference on arbitrary grid state |
| `POST` | `/api/intervention` | Evaluate counterfactual what-if load curtailment / redistribution |
| `POST` | `/api/datasets/custom` | Validate a custom CSV and return a model-ready grid state |
| `GET` | `/api/scenarios` | List available cascade scenarios from dataset |

### Custom datasets

Open **Custom Data** at `http://localhost:3000/custom-data` to upload a CSV from the browser. The required measurements are `load_pct` (or `load`) and either `voltage_pu` or `voltage_kv`. Optional fields include `id`, `temperature_c`, `capacity_mva`, `type`, `region`, `state`, `lat`, and `lon`. The upload page previews the mapped fields and can run the existing risk model on the normalized data.

```csv
id,load_pct,voltage_pu,temperature_c,capacity_mva
TX-01,82,0.96,65,120
TX-02,45,1.01,40,80
```
| `GET` | `/api/scenarios/{id}` | Fetch scenario details |
| `GET` | `/api/model/info` | GNN architecture details and evaluated test metrics |

---

## Example API Usage

### 1. Run Cascade Stress Simulation
```bash
curl -X POST "http://localhost:8000/api/simulate" \
  -H "Content-Type: application/json" \
  -d '{"initiating_node": "T17", "demand_stress_pct": 18.0, "ambient_temp_c": 36.0}'
```

**Example Response:**
```json
{
  "grid_state": {
    "timestamp": "2026-09-07T11:42:54.320248",
    "grid_id": "india_national_grid",
    "nodes": [...],
    "edges": [...],
    "overall_health_pct": 10.9
  },
  "prediction": {
    "node_risk": {"T17": 0.99, "F8": 0.42, "T21": 0.38, "S4": 0.25},
    "root_cause_ranking": [
      {
        "node_id": "T17",
        "root_cause_score": 0.977,
        "explained_by_upstream": 0.0,
        "explained_by": [],
        "failure_mode": "Primary Thermal Overload & Dielectric Breakdown (95.6% load, 80.7°C)"
      }
    ],
    "confidence_interval": {"lower": 93.0, "upper": 100.0},
    "cascade_path": [
      {"node_id": "T17", "sequence": 1, "risk_at_step": 0.99, "time_offset_hours": 0.0},
      {"node_id": "F8", "sequence": 2, "risk_at_step": 0.42, "time_offset_hours": 0.4}
    ],
    "cascade_risk_pct": 99.0,
    "physics_sanity_checks": {
      "power_balance_ok": true,
      "voltage_constraints_ok": true,
      "thermal_constraints_ok": false,
      "powerflow_converged": true
    }
  }
}
```

### 2. Apply Counterfactual Intervention
```bash
curl -X POST "http://localhost:8000/api/intervention" \
  -H "Content-Type: application/json" \
  -d '{"initiating_node": "T17", "load_shed_pct": 12.0}'
```

---

## Running Automated Tests

Run the full backend integration test suite:
```bash
python -m pytest tests/test_api_endpoints.py -v
```

---

## License

MIT
