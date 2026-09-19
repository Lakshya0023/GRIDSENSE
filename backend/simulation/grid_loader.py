"""
GridSense Grid Loader: converts Pandapower networks into 3D topological graphs
with realistic electrical attributes, geographic/topological layout, and asset classification.
"""

import math
from typing import Dict, Any, List, Optional
import pandapower as pp
import pandapower.networks as pn
import numpy as np

import json
import os
from pathlib import Path

# Calibrated 2D/3D layout coordinates for IEEE 24-bus RTS
# Standard IEEE RTS 1979/1996 topological layout normalized to 3D space
IEEE24_COORDS = {
    0: (-6.0, 0.0, -7.0),   # Bus 1
    1: (-4.0, 0.0, -7.0),   # Bus 2
    2: (-5.0, 0.0, -4.5),   # Bus 3
    3: (-7.0, 0.0, -2.5),   # Bus 4
    4: (-6.5, 0.0, -0.5),   # Bus 5
    5: (-5.0, 0.0, 0.0),    # Bus 6
    6: (-3.5, 0.0, -2.0),   # Bus 7
    7: (-2.0, 0.0, -4.5),   # Bus 8
    8: (-3.5, 0.0, -4.5),   # Bus 9
    9: (-3.5, 0.0, -6.0),   # Bus 10
    10: (-0.5, 1.5, -6.5),  # Bus 11 (230kV high voltage tier)
    11: (1.5, 1.5, -6.5),   # Bus 12
    12: (0.5, 1.5, -4.0),   # Bus 13
    13: (0.0, 1.5, -1.0),   # Bus 14
    14: (2.5, 1.5, 0.0),    # Bus 15
    15: (4.0, 1.5, 1.5),    # Bus 16
    16: (5.5, 1.5, 3.0),    # Bus 17 (Transformer T17 vicinity)
    17: (3.0, 1.5, 4.0),    # Bus 18
    18: (1.0, 1.5, 3.5),    # Bus 19
    19: (-1.0, 1.5, 3.0),   # Bus 20
    20: (4.5, 1.5, 5.5),    # Bus 21
    21: (6.0, 1.5, 6.0),    # Bus 22
    22: (-1.5, 1.5, 5.0),   # Bus 23
    23: (0.0, 1.5, 6.5),    # Bus 24
}

# Mapping between IEEE 24 RTS buses and 24 India National Grid assets
# T17 maps to DEL-TRAN-02 (Patparganj, Delhi)
# F8 maps to DEL-FEED-03
# T21 maps to MUM-TRAN-02
# S4 maps to DEL-SUBS-01
INDIA_BUS_MAP = {
    16: "DEL-TRAN-02",  # T17 (Patparganj, Delhi - Initiating asset)
    7:  "DEL-FEED-03",  # F8 (Preet Vihar, Delhi Feeder)
    3:  "DEL-SUBS-01",  # S4 (Harsh Vihar / Bamnauli 400kV Substation)
    0:  "DEL-GENE-04",  # Pragati Generation
    20: "MUM-TRAN-02",  # T21 (Mumbai Transformer)
    10: "MUM-SUBS-01",  # Mumbai Substation
    8:  "MUM-FEED-03",  # Mumbai Feeder
    1:  "MUM-GENE-04",  # Mumbai Generator
    11: "BEN-SUBS-01",  # Bengaluru Substation
    12: "BEN-TRAN-02",  # Bengaluru Transformer
    4:  "BEN-FEED-03",  # Bengaluru Feeder
    21: "BEN-GENE-04",  # Bengaluru Generator
    13: "CHE-SUBS-01",  # Chennai Substation
    14: "CHE-TRAN-02",  # Chennai Transformer
    5:  "CHE-FEED-03",  # Chennai Feeder
    22: "CHE-GENE-04",  # Chennai Generator
    18: "KOL-SUBS-01",  # Kolkata Substation
    19: "KOL-TRAN-02",  # Kolkata Transformer
    6:  "KOL-FEED-03",  # Kolkata Feeder
    17: "KOL-GENE-04",  # Kolkata Generator
    9:  "HYD-SUBS-01",  # Hyderabad Substation
    15: "HYD-TRAN-02",  # Hyderabad Transformer
    2:  "HYD-FEED-03",  # Hyderabad Feeder
    23: "HYD-GENE-04",  # Hyderabad Generator
}
INDIA_NAME_TO_BUS = {v: k for k, v in INDIA_BUS_MAP.items()}

class GridLoader:
    def __init__(self):
        self._cached_nets: Dict[str, pp.pandapowerNet] = {}

    def get_net(self, grid_id: str = "ieee24") -> pp.pandapowerNet:
        """Returns a cloned pandapower network instance for the given grid_id."""
        grid_id = grid_id.lower()
        if grid_id not in self._cached_nets:
            if grid_id == "ieee24" or grid_id.startswith("india"):
                net = pn.case24_ieee_rts()
            elif grid_id == "ieee39":
                net = pn.case39()
            elif grid_id == "ieee118":
                net = pn.case118()
            else:
                raise ValueError(f"Unsupported grid_id: {grid_id}. Supported: ieee24, ieee39, ieee118, india_demo_grid_v1")
            self._cached_nets[grid_id] = net
        
        import copy
        # Deep copy network so modifications during simulation don't contaminate the base
        return copy.deepcopy(self._cached_nets[grid_id])

    def solve_power_flow(self, net: pp.pandapowerNet) -> bool:
        """Runs AC power flow, falling back to DC if AC does not converge."""
        try:
            pp.runpp(net, numba=False, max_iteration=50, tolerance_mva=1e-3)
            return True
        except Exception:
            try:
                pp.rundcpp(net, numba=False)
                return True
            except Exception:
                return False

    def to_graph_data(self, net: pp.pandapowerNet, grid_id: str = "ieee24") -> Dict[str, Any]:
        """Converts pandapower network into GridSense schema-compliant dictionary."""
        converged = self.solve_power_flow(net)
        
        nodes = []
        edges = []
        
        # Map buses to node objects
        for idx, row in net.bus.iterrows():
            bus_id = int(idx)
            vn_kv = float(row.vn_kv)
            
            # Look up power flow results
            vm_pu = float(net.res_bus.vm_pu.at[bus_id]) if (converged and bus_id in net.res_bus.index and not np.isnan(net.res_bus.vm_pu.at[bus_id])) else 1.0
            p_mw = float(net.res_bus.p_mw.at[bus_id]) if (converged and bus_id in net.res_bus.index and not np.isnan(net.res_bus.p_mw.at[bus_id])) else 0.0
            q_mvar = float(net.res_bus.q_mvar.at[bus_id]) if (converged and bus_id in net.res_bus.index and not np.isnan(net.res_bus.q_mvar.at[bus_id])) else 0.0

            # Determine asset name and coordinates
            # Pre-compute asset type from electrical topology
            is_trafo = len(net.trafo[(net.trafo.hv_bus == bus_id) | (net.trafo.lv_bus == bus_id)]) > 0 if hasattr(net, 'trafo') else False
            is_gen = (len(net.gen[net.gen.bus == bus_id]) > 0 or len(net.ext_grid[net.ext_grid.bus == bus_id]) > 0) if hasattr(net, 'gen') else False
            is_load = len(net.load[net.load.bus == bus_id]) > 0 if hasattr(net, 'load') else False
            if vn_kv >= 200:
                node_type = "substation"
            elif is_trafo:
                node_type = "transformer"
            elif is_gen:
                node_type = "generator"
            elif is_load:
                node_type = "feeder"
            else:
                node_type = "bus"

            node_name = f"B{bus_id+1}"
            is_india = grid_id.startswith("india")
            node_city = None
            node_lat = None
            node_lon = None
            real_ref = None

            if is_india and bus_id in INDIA_BUS_MAP:
                node_name = INDIA_BUS_MAP[bus_id]
                # Pre-calibrated coordinates for Indian nodes from synthetic dataset
                india_geo = {
                    "DEL-SUBS-01": (28.6557, 77.0665, "Delhi", "substation", "Bamnauli / Harsh Vihar 400kV (DTL)"),
                    "DEL-TRAN-02": (28.6410, 77.0685, "Delhi", "transformer", "Patparganj 220/66kV 500MVA (DTL)"),
                    "DEL-FEED-03": (28.6787, 77.2694, "Delhi", "feeder", "Preet Vihar 220/33kV 100MVA (DTL)"),
                    "DEL-GENE-04": (28.6915, 77.1069, "Delhi", "generator", "Pragati 154MW Gas Turbine (DTL)"),
                    "MUM-SUBS-01": (18.9567, 72.8417, "Mumbai", "substation", "Mumbai Central 400kV Substation"),
                    "MUM-TRAN-02": (19.0869, 73.0196, "Mumbai", "transformer", "Navi Mumbai Step-up Transformer"),
                    "MUM-FEED-03": (19.0992, 72.9391, "Mumbai", "feeder", "Thane Feeder Corridor"),
                    "MUM-GENE-04": (19.1859, 72.8417, "Mumbai", "generator", "Trombay Generation Hub"),
                    "BEN-SUBS-01": (13.0227, 77.6551, "Bengaluru", "substation", "Bengaluru Tech Hub 220kV"),
                    "BEN-TRAN-02": (12.8706, 77.5584, "Bengaluru", "transformer", "Electronic City Transformer"),
                    "BEN-FEED-03": (13.0745, 77.6774, "Bengaluru", "feeder", "Whitefield Industrial Feeder"),
                    "BEN-GENE-04": (12.8849, 77.7275, "Bengaluru", "generator", "Karnataka Solar/Thermal Co-gen"),
                    "CHE-SUBS-01": (12.9756, 80.1626, "Chennai", "substation", "Chennai Port 230kV Substation"),
                    "CHE-TRAN-02": (13.0413, 80.4199, "Chennai", "transformer", "Guindy Power Transformer"),
                    "CHE-FEED-03": (12.9786, 80.1687, "Chennai", "feeder", "Coromandel Coastal Feeder"),
                    "CHE-GENE-04": (13.0914, 80.4120, "Chennai", "generator", "Ennore Generation Station"),
                    "KOL-SUBS-01": (22.6532, 88.3160, "Kolkata", "substation", "Kolkata Eastern Hub 220kV"),
                    "KOL-TRAN-02": (22.7142, 88.4425, "Kolkata", "transformer", "Salt Lake Transformer Substation"),
                    "KOL-FEED-03": (22.4685, 88.4427, "Kolkata", "feeder", "Howrah Feeder"),
                    "KOL-GENE-04": (22.5692, 88.2475, "Kolkata", "generator", "Budge Budge Thermal Station"),
                    "HYD-SUBS-01": (17.3073, 78.5069, "Hyderabad", "substation", "Hyderabad Central 400kV"),
                    "HYD-TRAN-02": (17.2735, 78.4793, "Hyderabad", "transformer", "HITEC City Step-Down Transformer"),
                    "HYD-FEED-03": (17.5137, 78.5633, "Hyderabad", "feeder", "Secunderabad Feeder"),
                    "HYD-GENE-04": (17.3664, 78.4920, "Hyderabad", "generator", "Ramagundam Regional Feed"),
                }
                lat, lon, city, n_type, ref = india_geo.get(node_name, (20.59, 78.96, "India", "bus", ""))
                node_lat = lat
                node_lon = lon
                node_city = city
                node_type = n_type
                real_ref = ref
                # Map lat/lon to 3D positions: (Lon-E/W, Height, -Lat-N/S)
                pos = ((lon - 78.96) * 1.35, 1.2 if node_type in ['substation', 'transformer'] else 0.0, -(lat - 20.59) * 1.35)
            elif grid_id == "ieee24" and bus_id in IEEE24_COORDS:
                pos = IEEE24_COORDS[bus_id]
                # Assign realistic asset name
                if bus_id == 16:
                    node_name = "T17"
                    node_type = "transformer"
                elif bus_id == 20:
                    node_name = "T21"
                    node_type = "transformer"
                elif bus_id == 7:
                    node_name = "F8"
                    node_type = "load"
                elif bus_id == 3:
                    node_name = "S4"
                    node_type = "substation"
                elif node_type == "transformer":
                    node_name = f"T{bus_id+1}"
                elif node_type == "generator":
                    node_name = f"G{bus_id+1}"
                elif node_type == "substation":
                    node_name = f"S{bus_id+1}"
                else:
                    node_name = f"B{bus_id+1}"

            else:
                # Procedural circular arrangement if coordinates not pre-defined
                angle = (2 * math.pi * bus_id) / len(net.bus)
                radius = 6.0 + (bus_id % 3) * 1.5
                y_elev = 1.5 if vn_kv > 200 else 0.0
                pos = (radius * math.cos(angle), y_elev, radius * math.sin(angle))
                if node_type == "transformer":
                    node_name = f"T{bus_id+1}"
                elif node_type == "generator":
                    node_name = f"G{bus_id+1}"
                elif node_type == "substation":
                    node_name = f"S{bus_id+1}"
                else:
                    node_name = f"B{bus_id+1}"


            # Calculate load percentage and dynamic temperature
            connected_loads = net.load[net.load.bus == bus_id]
            load_mva = math.sqrt(connected_loads.p_mw.sum()**2 + connected_loads.q_mvar.sum()**2) if len(connected_loads) > 0 else abs(p_mw)
            capacity_mva = float(vn_kv * 4.0) if vn_kv > 0 else 100.0
            load_pct = min(150.0, max(5.0, (load_mva / capacity_mva) * 100.0))
            
            # IEEE thermal dynamics model: T_c = T_ambient + 45 * (I / I_rated)^2
            ambient_temp = 28.0
            temperature_c = ambient_temp + 42.0 * ((load_pct / 100.0) ** 2)

            is_tripped = not bool(row.in_service)

            nodes.append({
                "id": node_name,
                "bus_id": bus_id,
                "name": f"{node_name} ({vn_kv:.0f}kV)" if not is_india else f"{node_name} ({node_city})",
                "type": node_type,
                "city": node_city,
                "lat": node_lat,
                "lon": node_lon,
                "reference": real_ref,
                "position": {"x": round(pos[0], 2), "y": round(pos[1], 2), "z": round(pos[2], 2)},
                "features": {
                    "load_pct": round(load_pct, 1),
                    "voltage_pu": round(vm_pu, 3),
                    "temperature_c": round(temperature_c, 1),
                    "age_years": 12 + (bus_id % 15),
                    "capacity_mva": round(capacity_mva, 1),
                    "p_mw": round(p_mw, 2),
                    "q_mvar": round(q_mvar, 2),
                    "is_tripped": is_tripped
                }
            })

        # Bus id to node name map
        bus_to_name = {n["bus_id"]: n["id"] for n in nodes}

        # If India grid, load synthetic edge definitions and compute dynamic loading
        if is_india:
            json_path = Path(__file__).resolve().parent.parent / "ml" / "datasets" / "india_synthetic_demo_grid.json"
            if not json_path.exists():
                json_path = Path(__file__).resolve().parent.parent / "dataset" / "india_synthetic_demo_grid.json"
            if json_path.exists():
                try:
                    with open(json_path, "r", encoding="utf-8") as f:
                        india_data = json.load(f)
                    raw_edges = india_data.get("grid_state", {}).get("edges", [])
                    for idx, e in enumerate(raw_edges):
                        src = e.get("source")
                        tgt = e.get("target")
                        e_type = e.get("type", "feeder")
                        cap = float(e.get("capacity_mva", 50))
                        
                        # Find corresponding loading from power flow or calculate from terminal nodes
                        src_node = next((n for n in nodes if n["id"] == src), None)
                        tgt_node = next((n for n in nodes if n["id"] == tgt), None)
                        avg_loading = 42.0
                        is_e_tripped = False
                        if src_node and tgt_node:
                            avg_loading = (src_node["features"]["load_pct"] + tgt_node["features"]["load_pct"]) / 2.0
                            is_e_tripped = src_node["features"]["is_tripped"] or tgt_node["features"]["is_tripped"]

                        edges.append({
                            "id": f"IN-E{idx+1}",
                            "source": src,
                            "target": tgt,
                            "type": e_type,
                            "capacity_mva": round(cap, 1),
                            "loading_pct": round(avg_loading, 1),
                            "p_from_mw": round(cap * (avg_loading / 100.0) * 0.85, 2),
                            "q_from_mvar": round(cap * (avg_loading / 100.0) * 0.25, 2),
                            "r_ohm": 0.02,
                            "x_ohm": 0.09,
                            "is_tripped": is_e_tripped
                        })
                    return {
                        "timestamp": "2026-09-06T12:00:00Z",
                        "grid_id": grid_id,
                        "nodes": nodes,
                        "edges": edges
                    }
                except Exception:
                    pass

        # Map lines to edges
        for idx, row in net.line.iterrows():
            from_bus = int(row.from_bus)
            to_bus = int(row.to_bus)
            if from_bus not in bus_to_name or to_bus not in bus_to_name:
                continue

            capacity_mva = float(row.max_i_ka * net.bus.at[from_bus, 'vn_kv'] * math.sqrt(3)) if 'max_i_ka' in row else 175.0
            loading_pct = float(net.res_line.loading_percent.at[idx]) if (converged and idx in net.res_line.index and not np.isnan(net.res_line.loading_percent.at[idx])) else 35.0
            p_from_mw = float(net.res_line.p_from_mw.at[idx]) if (converged and idx in net.res_line.index and not np.isnan(net.res_line.p_from_mw.at[idx])) else 0.0
            q_from_mvar = float(net.res_line.q_from_mvar.at[idx]) if (converged and idx in net.res_line.index and not np.isnan(net.res_line.q_from_mvar.at[idx])) else 0.0

            edges.append({
                "id": f"L{idx+1}",
                "source": bus_to_name[from_bus],
                "target": bus_to_name[to_bus],
                "type": "line",
                "capacity_mva": round(capacity_mva, 1),
                "loading_pct": round(loading_pct, 1),
                "p_from_mw": round(p_from_mw, 2),
                "q_from_mvar": round(q_from_mvar, 2),
                "r_ohm": round(float(row.r_ohm_per_km * row.length_km), 4),
                "x_ohm": round(float(row.x_ohm_per_km * row.length_km), 4),
                "is_tripped": not bool(row.in_service)
            })

        # Map transformers to edges
        for idx, row in net.trafo.iterrows():
            hv_bus = int(row.hv_bus)
            lv_bus = int(row.lv_bus)
            if hv_bus not in bus_to_name or lv_bus not in bus_to_name:
                continue

            capacity_mva = float(row.sn_mva) if 'sn_mva' in row else 200.0
            loading_pct = float(net.res_trafo.loading_percent.at[idx]) if (converged and idx in net.res_trafo.index and not np.isnan(net.res_trafo.loading_percent.at[idx])) else 45.0
            p_from_mw = float(net.res_trafo.p_hv_mw.at[idx]) if (converged and idx in net.res_trafo.index and not np.isnan(net.res_trafo.p_hv_mw.at[idx])) else 0.0
            q_from_mvar = float(net.res_trafo.q_hv_mvar.at[idx]) if (converged and idx in net.res_trafo.index and not np.isnan(net.res_trafo.q_hv_mvar.at[idx])) else 0.0

            edges.append({
                "id": f"TR{idx+1}",
                "source": bus_to_name[hv_bus],
                "target": bus_to_name[lv_bus],
                "type": "trafo",
                "capacity_mva": round(capacity_mva, 1),
                "loading_pct": round(loading_pct, 1),
                "p_from_mw": round(p_from_mw, 2),
                "q_from_mvar": round(q_from_mvar, 2),
                "r_ohm": 0.01,
                "x_ohm": 0.08,
                "is_tripped": not bool(row.in_service)
            })

        return {
            "timestamp": "2026-09-06T12:00:00Z",
            "grid_id": grid_id,
            "nodes": nodes,
            "edges": edges
        }
