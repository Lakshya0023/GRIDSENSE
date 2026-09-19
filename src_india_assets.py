"""
GridSense Unified Maharashtra Grid Assets Provider
Constructs and validates the core Maharashtra power grid model with 3D topological scene coordinates,
real geographic coordinates, and electrical telemetry.
All nodes and transmission corridors are situated within Maharashtra state.
"""

from typing import Dict, List, Any

# Geographic Bounds of Maharashtra State
MAHARASHTRA_BOUNDS = {
    "minLon": 72.5,
    "maxLon": 81.0,
    "minLat": 15.6,
    "maxLat": 22.2
}

def lat_lon_to_scene(lat: float, lon: float) -> Dict[str, float]:
    """Map Maharashtra coordinates to 3D scene [-10, 10] box."""
    w, d = 20.0, 20.0
    x = ((lon - MAHARASHTRA_BOUNDS["minLon"]) / (MAHARASHTRA_BOUNDS["maxLon"] - MAHARASHTRA_BOUNDS["minLon"])) * w - (w / 2.0)
    z = -(((lat - MAHARASHTRA_BOUNDS["minLat"]) / (MAHARASHTRA_BOUNDS["maxLat"] - MAHARASHTRA_BOUNDS["minLat"])) * d - (d / 2.0))
    return {"x": round(x, 2), "y": 0.0, "z": round(z, 2)}

# All assets reallocated within Maharashtra State
INDIA_RAW_NODES = [
    # ── Western Maharashtra & Konkan Generating Stations ──
    {"id": "G1", "type": "generator", "label": "Koyna Hydro Complex G1", "state": "Maharashtra", "region": "WR", "lat": 17.40, "lon": 73.75, "load": 58.0, "v": 1.02, "t": 44.0, "age": 35, "cap": 1960.0},
    {"id": "G2", "type": "generator", "label": "Chandrapur Super Thermal G2", "state": "Maharashtra", "region": "WR", "lat": 19.95, "lon": 79.30, "load": 72.0, "v": 1.01, "t": 63.0, "age": 22, "cap": 3340.0},
    {"id": "G3", "type": "generator", "label": "Tarapur Atomic Station G3", "state": "Maharashtra", "region": "WR", "lat": 19.83, "lon": 72.66, "load": 65.0, "v": 1.02, "t": 48.0, "age": 25, "cap": 1400.0},
    {"id": "G4", "type": "generator", "label": "Koradi Super Thermal G4", "state": "Maharashtra", "region": "WR", "lat": 21.25, "lon": 79.10, "load": 68.0, "v": 1.02, "t": 59.0, "age": 18, "cap": 2400.0},
    {"id": "G5", "type": "generator", "label": "Trombay Thermal G5", "state": "Maharashtra", "region": "WR", "lat": 19.01, "lon": 72.90, "load": 60.0, "v": 1.02, "t": 46.0, "age": 20, "cap": 1580.0},
    {"id": "G6", "type": "generator", "label": "Khaperkheda Thermal G6", "state": "Maharashtra", "region": "WR", "lat": 21.28, "lon": 79.12, "load": 66.0, "v": 1.01, "t": 61.0, "age": 19, "cap": 1340.0},
    {"id": "G7", "type": "generator", "label": "Bhusawal Deepnagar Thermal G7", "state": "Maharashtra", "region": "WR", "lat": 21.05, "lon": 75.80, "load": 62.0, "v": 1.00, "t": 58.0, "age": 16, "cap": 1420.0},
    {"id": "G8", "type": "generator", "label": "Parli Super Thermal G8", "state": "Maharashtra", "region": "WR", "lat": 18.85, "lon": 76.50, "load": 55.0, "v": 1.01, "t": 52.0, "age": 21, "cap": 1130.0},

    # ── Major Maharashtra Substations ──
    {"id": "S1", "type": "substation", "label": "Thane-Kalwa 400kV Sub S1", "state": "Maharashtra", "region": "WR", "lat": 19.20, "lon": 72.99, "load": 74.0, "v": 1.00, "t": 58.0, "age": 18, "cap": 600.0},
    {"id": "S2", "type": "substation", "label": "Chhatrapati Sambhajinagar Sub S2", "state": "Maharashtra", "region": "WR", "lat": 19.88, "lon": 75.34, "load": 64.0, "v": 1.00, "t": 54.0, "age": 14, "cap": 500.0},
    {"id": "S3", "type": "substation", "label": "Mumbai Central 400kV Sub S3", "state": "Maharashtra", "region": "WR", "lat": 19.07, "lon": 72.87, "load": 78.0, "v": 0.99, "t": 62.0, "age": 22, "cap": 750.0},
    {"id": "S4", "type": "substation", "label": "Pune 400kV Grid Sub S4", "state": "Maharashtra", "region": "WR", "lat": 18.52, "lon": 73.85, "load": 65.0, "v": 1.00, "t": 56.0, "age": 15, "cap": 650.0},
    {"id": "S5", "type": "substation", "label": "Solapur 400kV Grid Sub S5", "state": "Maharashtra", "region": "WR", "lat": 17.66, "lon": 75.91, "load": 62.0, "v": 1.00, "t": 55.0, "age": 12, "cap": 500.0},
    {"id": "S6", "type": "substation", "label": "Kolhapur 400kV Regional Sub S6", "state": "Maharashtra", "region": "WR", "lat": 16.70, "lon": 74.24, "load": 58.0, "v": 1.00, "t": 53.0, "age": 16, "cap": 450.0},
    {"id": "S7", "type": "substation", "label": "Wardha 765kV Super Grid Sub S7", "state": "Maharashtra", "region": "WR", "lat": 20.74, "lon": 78.60, "load": 70.0, "v": 1.01, "t": 60.0, "age": 11, "cap": 800.0},
    {"id": "S8", "type": "substation", "label": "Amravati 400kV Grid Sub S8", "state": "Maharashtra", "region": "WR", "lat": 20.93, "lon": 77.75, "load": 60.0, "v": 1.00, "t": 54.0, "age": 13, "cap": 500.0},
    {"id": "S9", "type": "substation", "label": "Nanded EHV Grid Sub S9", "state": "Maharashtra", "region": "WR", "lat": 19.15, "lon": 77.30, "load": 56.0, "v": 1.00, "t": 51.0, "age": 10, "cap": 400.0},
    {"id": "S10", "type": "substation", "label": "Nashik EHV Super Sub S10", "state": "Maharashtra", "region": "WR", "lat": 19.98, "lon": 73.81, "load": 68.0, "v": 0.99, "t": 57.0, "age": 12, "cap": 450.0},

    # ── Critical Stress & Cascade Assets (Nashik-Pune Corridor) ──
    {"id": "T17", "type": "transformer", "label": "Nashik Heavy Step-Down T17", "state": "Maharashtra", "region": "WR", "lat": 19.99, "lon": 73.78, "load": 78.0, "v": 0.97, "t": 65.0, "age": 12, "cap": 250.0},
    {"id": "F8", "type": "feeder", "label": "Feeder F8 Nashik-Pune Corridor", "state": "Maharashtra", "region": "WR", "lat": 19.25, "lon": 73.83, "load": 55.0, "v": 0.98, "t": 48.0, "age": 11, "cap": 200.0},

    # ── Key Maharashtra Step-Down Transformers ──
    {"id": "T1", "type": "transformer", "label": "Navi Mumbai Step-Down T1", "state": "Maharashtra", "region": "WR", "lat": 19.03, "lon": 73.02, "load": 68.0, "v": 0.99, "t": 59.0, "age": 14, "cap": 315.0},
    {"id": "T3", "type": "transformer", "label": "Kalyan Industrial Trans T3", "state": "Maharashtra", "region": "WR", "lat": 19.24, "lon": 73.13, "load": 62.0, "v": 0.98, "t": 57.0, "age": 11, "cap": 280.0},
    {"id": "T5", "type": "transformer", "label": "Ahmednagar Regional Trans T5", "state": "Maharashtra", "region": "WR", "lat": 19.09, "lon": 74.74, "load": 58.0, "v": 1.00, "t": 53.0, "age": 9, "cap": 250.0},
    {"id": "T6", "type": "transformer", "label": "Ratnagiri Coastal Trans T6", "state": "Maharashtra", "region": "WR", "lat": 16.99, "lon": 73.30, "load": 52.0, "v": 1.00, "t": 49.0, "age": 8, "cap": 200.0},
    {"id": "T7", "type": "transformer", "label": "Sangli Industrial Step-Down T7", "state": "Maharashtra", "region": "WR", "lat": 16.85, "lon": 74.57, "load": 58.0, "v": 0.99, "t": 54.0, "age": 13, "cap": 180.0},
    {"id": "T8", "type": "transformer", "label": "Akola Central Trans T8", "state": "Maharashtra", "region": "WR", "lat": 20.70, "lon": 77.00, "load": 54.0, "v": 1.00, "t": 52.0, "age": 7, "cap": 200.0},
    {"id": "T9", "type": "transformer", "label": "Latur Regional Trans T9", "state": "Maharashtra", "region": "WR", "lat": 18.40, "lon": 76.58, "load": 56.0, "v": 0.99, "t": 53.0, "age": 15, "cap": 220.0},
    {"id": "T14", "type": "transformer", "label": "Nagpur Interconnect T14", "state": "Maharashtra", "region": "WR", "lat": 21.15, "lon": 79.08, "load": 48.0, "v": 1.01, "t": 49.0, "age": 6, "cap": 250.0},
    {"id": "T19", "type": "transformer", "label": "Aurangabad Trans T19", "state": "Maharashtra", "region": "WR", "lat": 19.87, "lon": 75.34, "load": 52.0, "v": 1.00, "t": 51.0, "age": 7, "cap": 220.0},

    # ── Maharashtra High-Density Load Centers ──
    {"id": "L1", "type": "load_center", "label": "Pune Hinjewadi IT Load L1", "state": "Maharashtra", "region": "WR", "lat": 18.59, "lon": 73.74, "load": 82.0, "v": 0.98, "t": 42.0, "age": 10, "cap": 450.0},
    {"id": "L2", "type": "load_center", "label": "Mumbai Financial Load L2", "state": "Maharashtra", "region": "WR", "lat": 19.08, "lon": 72.88, "load": 86.0, "v": 0.97, "t": 45.0, "age": 15, "cap": 550.0},
    {"id": "L3", "type": "load_center", "label": "Nagpur MIHAN Industrial Load L3", "state": "Maharashtra", "region": "WR", "lat": 21.05, "lon": 79.05, "load": 75.0, "v": 0.99, "t": 41.0, "age": 8, "cap": 400.0},
]

# All connections strictly within Maharashtra State
INDIA_RAW_EDGES = [
    # ── Mumbai & Konkan Power Distribution ──
    {"source": "G3", "target": "S1", "type": "transmission", "capacity": 900.0},
    {"source": "G5", "target": "S3", "type": "transmission", "capacity": 950.0},
    {"source": "S1", "target": "S3", "type": "transmission", "capacity": 850.0},
    {"source": "S1", "target": "T1", "type": "distribution", "capacity": 400.0},
    {"source": "S1", "target": "T3", "type": "distribution", "capacity": 400.0},
    {"source": "S3", "target": "L2", "type": "distribution", "capacity": 550.0},
    {"source": "S3", "target": "T6", "type": "transmission", "capacity": 300.0},

    # ── Western Maharashtra Cascade Path (T17 -> F8 -> S4) ──
    {"source": "S3", "target": "T17", "type": "distribution", "capacity": 350.0},
    {"source": "S10", "target": "T17", "type": "distribution", "capacity": 350.0},
    {"source": "T17", "target": "F8", "type": "feeder", "capacity": 200.0},
    {"source": "F8", "target": "S4", "type": "feeder", "capacity": 200.0},
    {"source": "S4", "target": "L1", "type": "distribution", "capacity": 450.0},
    {"source": "G1", "target": "S4", "type": "transmission", "capacity": 950.0},
    {"source": "G1", "target": "S6", "type": "transmission", "capacity": 850.0},
    {"source": "S6", "target": "T7", "type": "distribution", "capacity": 250.0},
    {"source": "S4", "target": "S5", "type": "transmission", "capacity": 500.0},
    {"source": "S5", "target": "T9", "type": "distribution", "capacity": 300.0},

    # ── North Maharashtra & Khandesh Links ──
    {"source": "T17", "target": "T5", "type": "tie", "capacity": 250.0},
    {"source": "T5", "target": "S2", "type": "distribution", "capacity": 300.0},
    {"source": "G7", "target": "S10", "type": "transmission", "capacity": 850.0},
    {"source": "G7", "target": "T8", "type": "distribution", "capacity": 350.0},

    # ── Marathwada Corridors ──
    {"source": "T17", "target": "T19", "type": "tie", "capacity": 200.0},
    {"source": "S2", "target": "T19", "type": "distribution", "capacity": 280.0},
    {"source": "S2", "target": "G8", "type": "transmission", "capacity": 600.0},
    {"source": "G8", "target": "S9", "type": "transmission", "capacity": 650.0},
    {"source": "S9", "target": "T9", "type": "distribution", "capacity": 250.0},

    # ── Vidarbha Power Generation & Distribution ──
    {"source": "G2", "target": "S7", "type": "transmission", "capacity": 1200.0},
    {"source": "G4", "target": "T14", "type": "transmission", "capacity": 900.0},
    {"source": "G6", "target": "T14", "type": "transmission", "capacity": 800.0},
    {"source": "T14", "target": "L3", "type": "distribution", "capacity": 400.0},
    {"source": "S7", "target": "T14", "type": "transmission", "capacity": 700.0},
    {"source": "S7", "target": "S8", "type": "transmission", "capacity": 600.0},
    {"source": "S8", "target": "T8", "type": "distribution", "capacity": 300.0},
    {"source": "T17", "target": "T14", "type": "tie", "capacity": 250.0},

    # ── Maharashtra State High-Voltage 400kV/765kV Backbone Ring ──
    {"source": "S3", "target": "S4", "type": "transmission", "capacity": 900.0},
    {"source": "S4", "target": "S2", "type": "transmission", "capacity": 700.0},
    {"source": "S2", "target": "S9", "type": "transmission", "capacity": 600.0},
    {"source": "S9", "target": "S7", "type": "transmission", "capacity": 650.0},
    {"source": "S7", "target": "S8", "type": "transmission", "capacity": 700.0},
    {"source": "S8", "target": "S2", "type": "transmission", "capacity": 600.0},
    {"source": "S5", "target": "S6", "type": "transmission", "capacity": 550.0},
    {"source": "S1", "target": "S10", "type": "transmission", "capacity": 700.0},
]

def get_unified_india_grid() -> Dict[str, Any]:
    nodes = []
    for raw in INDIA_RAW_NODES:
        pos = lat_lon_to_scene(raw["lat"], raw["lon"])
        nodes.append({
            "id": raw["id"],
            "type": raw["type"],
            "label": raw["label"],
            "name": raw["label"],
            "state": raw["state"],
            "region": raw["region"],
            "lat": raw["lat"],
            "lon": raw["lon"],
            "position": pos,
            "features": {
                "load_pct": raw["load"],
                "voltage_pu": raw["v"],
                "temperature_c": raw["t"],
                "age_years": raw["age"],
                "capacity_mva": raw["cap"],
                "demand_mw": raw["cap"] * (raw["load"] / 100.0) * 0.8 if raw["type"] != "generator" else 0.0,
                "gen_mw": raw["cap"] * (raw["load"] / 100.0) if raw["type"] == "generator" else 0.0,
                "p_mw": raw["cap"] * (raw["load"] / 100.0),
                "q_mvar": raw["cap"] * (raw["load"] / 100.0) * 0.3,
                "is_tripped": False
            },
            "status": "healthy",
            "risk_score": 0.04,
            "is_root_cause": False,
            "is_in_cascade": False
        })

    edges = []
    for i, e in enumerate(INDIA_RAW_EDGES):
        edges.append({
            "id": f"E{i}",
            "source": e["source"],
            "target": e["target"],
            "type": e["type"],
            "capacity_mva": e["capacity"],
            "current_load_pct": 42.0 + (i % 15),
            "loading_pct": 42.0 + (i % 15),
            "status": "normal",
            "is_cascade_path": False,
            "length_km": 15.0 + (i * 4.5),
            "reactance_pu": 0.08,
            "is_tripped": False
        })

    return {
        "nodes": nodes,
        "edges": edges
    }
