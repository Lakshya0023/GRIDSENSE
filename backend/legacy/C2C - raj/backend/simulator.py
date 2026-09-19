"""
GridSense Physics Simulation Engine
Implements IEEE 33-Bus distribution network, power flow calculation,
multi-step cascading failure dynamics, and synthetic dataset generation.
"""

import math
import random
import copy
from datetime import datetime, timezone
from typing import Dict, List, Tuple, Any, Optional
import numpy as np
import networkx as nx


# IEEE 33-Bus standard network definitions (Baran and Wu standard benchmark)
# Format: (from_bus, to_bus, r_ohm, x_ohm, p_mw, q_mvar, capacity_mva)
IEEE_33_BRANCHES = [
    (1, 2, 0.0922, 0.0477, 0.100, 0.060, 12.0),
    (2, 3, 0.4930, 0.2511, 0.090, 0.040, 10.0),
    (3, 4, 0.3660, 0.1864, 0.120, 0.080, 8.0),
    (4, 5, 0.3811, 0.1941, 0.060, 0.030, 8.0),
    (5, 6, 0.8190, 0.7070, 0.060, 0.020, 6.0),
    (6, 7, 0.1872, 0.6188, 0.200, 0.100, 6.0),
    (7, 8, 0.7114, 0.2351, 0.200, 0.100, 5.0),
    (8, 9, 1.0300, 0.7400, 0.060, 0.020, 5.0),
    (9, 10, 1.0440, 0.7400, 0.060, 0.020, 4.0),
    (10, 11, 0.1966, 0.0650, 0.045, 0.030, 4.0),
    (11, 12, 0.3744, 0.1238, 0.060, 0.035, 4.0),
    (12, 13, 1.4680, 1.1550, 0.060, 0.035, 4.0),
    (13, 14, 0.5416, 0.7129, 0.120, 0.080, 3.5),
    (14, 15, 0.5910, 0.5260, 0.060, 0.010, 3.5),
    (15, 16, 0.7463, 0.5450, 0.060, 0.020, 3.5),
    (16, 17, 1.2890, 1.7210, 0.120, 0.090, 3.0),
    (17, 18, 0.7320, 0.5740, 0.090, 0.040, 3.0),
    # Branch 2 -> 19..22
    (2, 19, 0.1640, 0.1565, 0.090, 0.040, 6.0),
    (19, 20, 1.5042, 1.3554, 0.090, 0.040, 5.0),
    (20, 21, 0.4095, 0.4784, 0.090, 0.040, 4.0),
    (21, 22, 0.7089, 0.9373, 0.090, 0.040, 3.5),
    # Branch 3 -> 23..25
    (3, 23, 0.4512, 0.3083, 0.090, 0.050, 6.0),
    (23, 24, 0.8980, 0.7091, 0.420, 0.200, 5.0),
    (24, 25, 0.8960, 0.7011, 0.420, 0.200, 4.0),
    # Branch 6 -> 26..33
    (6, 26, 0.2030, 0.1034, 0.060, 0.025, 7.0),
    (26, 27, 0.2842, 0.1447, 0.060, 0.025, 6.0),
    (27, 28, 1.0590, 0.9337, 0.060, 0.020, 5.0),
    (28, 29, 0.8042, 0.7006, 0.120, 0.070, 4.0),
    (29, 30, 0.5075, 0.2585, 0.200, 0.600, 4.0),
    (30, 31, 0.9744, 0.9630, 0.150, 0.070, 3.5),
    (31, 32, 0.3105, 0.3619, 0.210, 0.100, 3.0),
    (32, 33, 0.3410, 0.5302, 0.060, 0.040, 3.0),
]

# Coordinates layout for 2D visual representation (x, y normalized 0-100)
NODE_POSITIONS = {
    1: (8, 48),    # Primary Substation S1
    2: (15, 48),   3: (22, 48),   4: (29, 48),   5: (36, 48),
    6: (43, 48),   7: (50, 48),   8: (57, 48),   9: (64, 48),
    10: (71, 48),  11: (78, 48),  12: (84, 48),  13: (89, 48),
    14: (93, 48),  15: (96, 48),  16: (98, 54),  17: (97, 62),
    18: (95, 70),
    # Lateral 1 (branch 2)
    19: (15, 64),  20: (15, 76),  21: (15, 86),  22: (20, 92),
    # Lateral 2 (branch 3)
    23: (22, 32),  24: (22, 20),  25: (28, 12),
    # Lateral 3 (branch 6)
    26: (43, 34),  27: (43, 20),  28: (50, 16),  29: (58, 16),
    30: (66, 16),  31: (74, 16),  32: (82, 16),  33: (90, 16),
}


def get_node_name(bus_id: int) -> str:
    """Format human-readable ID matching industry and demo pitch."""
    if bus_id == 1:
        return "S1"
    elif bus_id == 4:
        return "S4"
    elif bus_id in [17, 21, 14, 19, 24, 30]:
        return f"T{bus_id}"
    elif bus_id % 2 == 0:
        return f"F{bus_id}"
    else:
        return f"T{bus_id}"


def get_node_type(bus_id: int) -> str:
    if bus_id in [1, 4]:
        return "substation"
    elif bus_id in [17, 21, 14, 19, 24, 30]:
        return "transformer"
    elif bus_id % 2 == 0:
        return "feeder_node"
    else:
        return "load_bus"


class GridSimulator:
    """Physics-based power flow and cascading failure simulator."""

    def __init__(self, seed: Optional[int] = 42):
        if seed is not None:
            random.seed(seed)
            np.random.seed(seed)
        self.graph = nx.Graph()
        self.bus_specs: Dict[int, Dict[str, Any]] = {}
        self.branch_specs: List[Dict[str, Any]] = []
        self._build_topology()

    def _build_topology(self):
        """Construct the IEEE 33-bus base model."""
        self.graph.clear()
        self.bus_specs.clear()
        self.branch_specs.clear()

        # Build buses
        for bus_id in range(1, 34):
            pos = NODE_POSITIONS.get(bus_id, (50, 50))
            name = get_node_name(bus_id)
            node_type = get_node_type(bus_id)
            base_p = 0.0 if bus_id == 1 else 0.12
            base_q = 0.0 if bus_id == 1 else 0.06
            
            # Base nominal ratings scaled to local load demand
            if bus_id == 1:
                capacity_mva = 15.0
                age = 8
            elif node_type == "substation":
                capacity_mva = 8.0
                age = 10
            elif node_type == "transformer":
                # Transformer sized 25-35% above base peak demand
                base_s = math.sqrt(base_p**2 + base_q**2)
                capacity_mva = max(0.20, round(base_s * 1.35, 3))
                age = 14 if bus_id == 17 else random.randint(6, 16)
            else:
                base_s = math.sqrt(base_p**2 + base_q**2)
                capacity_mva = max(0.20, round(base_s * 1.35, 3))
                age = random.randint(4, 15)

            self.bus_specs[bus_id] = {
                "id": name,
                "bus_num": bus_id,
                "type": node_type,
                "capacity_mva": capacity_mva,
                "age_years": age,
                "p_mw": base_p,
                "q_mvar": base_q,
                "x": pos[0],
                "y": pos[1]
            }
            self.graph.add_node(name, **self.bus_specs[bus_id])

        # Build branches
        for idx, (f, t, r, x, p, q, cap) in enumerate(IEEE_33_BRANCHES):
            # Update load for the target bus
            self.bus_specs[t]["p_mw"] = p
            self.bus_specs[t]["q_mvar"] = q
            base_s = math.sqrt(p**2 + q**2)
            cap_mva = max(0.18, round(base_s * 1.35, 3))
            self.bus_specs[t]["capacity_mva"] = cap_mva

            u_name = get_node_name(f)
            v_name = get_node_name(t)
            self.graph.nodes[v_name]["capacity_mva"] = cap_mva
            self.graph.nodes[v_name]["p_mw"] = p
            self.graph.nodes[v_name]["q_mvar"] = q
            edge_id = f"E_{u_name}_{v_name}"

            branch_info = {
                "id": edge_id,
                "source": u_name,
                "target": v_name,
                "from_bus": f,
                "to_bus": t,
                "r_ohm": r,
                "x_ohm": x,
                "capacity_mva": cap,
                "type": "substation_feed" if f == 1 else ("transformer_tap" if "T" in v_name else "feeder")
            }
            self.branch_specs.append(branch_info)
            self.graph.add_edge(u_name, v_name, **branch_info)

    def solve_power_flow(self,
                         bus_loads: Optional[Dict[str, Tuple[float, float]]] = None,
                         tripped_nodes: Optional[set] = None,
                         tripped_edges: Optional[set] = None,
                         ambient_temp_c: float = 28.0) -> Dict[str, Any]:
        """
        Calculates AC/DistFlow power flow voltages, line flows, loadings, and temperatures.
        Implements Forward-Backward Sweep distribution power flow.
        """
        if tripped_nodes is None:
            tripped_nodes = set()
        if tripped_edges is None:
            tripped_edges = set()

        active_nodes = [n for n in self.graph.nodes() if n not in tripped_nodes]
        active_edges = [(u, v) for u, v in self.graph.edges() 
                        if (u, v) not in tripped_edges and (v, u) not in tripped_edges
                        and u not in tripped_nodes and v not in tripped_nodes]

        sub_g = nx.Graph()
        sub_g.add_nodes_from(active_nodes)
        sub_g.add_edges_from(active_edges)

        # Base voltages in p.u. (Substation S1 is slack bus V=1.00 pu)
        voltages: Dict[str, float] = {n: 1.00 for n in self.graph.nodes()}
        loadings: Dict[str, float] = {n: 0.0 for n in self.graph.nodes()}
        temperatures: Dict[str, float] = {n: ambient_temp_c for n in self.graph.nodes()}
        active_mw: Dict[str, float] = {n: 0.0 for n in self.graph.nodes()}
        reactive_mvar: Dict[str, float] = {n: 0.0 for n in self.graph.nodes()}
        edge_flows: Dict[str, Dict[str, float]] = {}

        # If primary substation S1 is tripped or disconnected, entire downstream is unenergized
        if "S1" in tripped_nodes:
            for n in self.graph.nodes():
                voltages[n] = 0.0
                loadings[n] = 0.0
                temperatures[n] = ambient_temp_c
            return {
                "voltages": voltages, "loadings": loadings, "temperatures": temperatures,
                "active_mw": active_mw, "reactive_mvar": reactive_mvar, "edge_flows": edge_flows,
                "converged": True, "total_losses_mw": 0.0
            }

        # Find connected components with slack bus S1
        if "S1" in sub_g:
            energized_nodes = set(nx.node_connected_component(sub_g, "S1"))
        else:
            energized_nodes = set()

        for n in self.graph.nodes():
            if n not in energized_nodes:
                voltages[n] = 0.0
                loadings[n] = 0.0

        # Radial Tree Flow calculation
        # 1. Downstream load aggregation (Backward sweep)
        tree = nx.bfs_tree(sub_g, "S1") if "S1" in energized_nodes else nx.DiGraph()
        topo_order = list(reversed(list(nx.topological_sort(tree)))) if len(tree) > 0 else []

        bus_p = {}
        bus_q = {}
        for n in self.graph.nodes():
            if n in energized_nodes:
                if bus_loads and n in bus_loads:
                    p, q = bus_loads[n]
                else:
                    bus_num = self.graph.nodes[n]["bus_num"]
                    p = self.bus_specs[bus_num]["p_mw"]
                    q = self.bus_specs[bus_num]["q_mvar"]
                bus_p[n] = p
                bus_q[n] = q
                active_mw[n] = round(p, 4)
                reactive_mvar[n] = round(q, 4)
            else:
                bus_p[n] = 0.0
                bus_q[n] = 0.0

        accum_p = copy.deepcopy(bus_p)
        accum_q = copy.deepcopy(bus_q)

        # Backward sweep: sum power upstream
        for u in topo_order:
            parents = list(tree.predecessors(u))
            if parents:
                parent = parents[0]
                accum_p[parent] += accum_p[u]
                accum_q[parent] += accum_q[u]

        # Forward sweep: voltage drops and line currents
        total_loss_mw = 0.0
        s_base_mva = 10.0
        v_base_kv = 12.66  # Base kV
        z_base = (v_base_kv ** 2) / s_base_mva  # Z_base = 16.0275 Ohms

        # BFS order from S1 downstream
        bfs_order = list(nx.topological_sort(tree)) if len(tree) > 0 else []
        voltages["S1"] = 1.02  # Substation slight boost

        for u in bfs_order:
            for v in tree.successors(u):
                edge_data = self.graph.get_edge_data(u, v)
                r_pu = edge_data["r_ohm"] / z_base
                x_pu = edge_data["x_ohm"] / z_base
                cap_mva = edge_data["capacity_mva"]

                p_flow = accum_p[v]
                q_flow = accum_q[v]
                s_flow = math.sqrt(p_flow**2 + q_flow**2)

                # Linearized AC voltage drop formula using per-unit power
                p_flow_pu = p_flow / s_base_mva
                q_flow_pu = q_flow / s_base_mva
                v_u = voltages[u]
                delta_v = (p_flow_pu * r_pu + q_flow_pu * x_pu) / max(v_u, 0.5)
                v_v = max(0.85, v_u - delta_v)
                voltages[v] = round(v_v, 4)

                # Line loading %
                line_loading_pct = (s_flow / max(cap_mva, 0.1)) * 100.0
                loss = ((s_flow / s_base_mva) ** 2 / max(v_u**2, 0.5)) * r_pu * s_base_mva  # MW loss
                total_loss_mw += loss

                edge_id = edge_data["id"]
                edge_flows[edge_id] = {
                    "source": u,
                    "target": v,
                    "flow_mva": round(s_flow, 3),
                    "loading_pct": round(line_loading_pct, 1),
                    "loss_mw": round(loss, 4),
                    "status": "CLOSED"
                }

        # Node loadings and thermal calculation
        for n in self.graph.nodes():
            if n in energized_nodes:
                cap_node = self.graph.nodes[n]["capacity_mva"]
                # Inflow or through-flow at node
                s_node = math.sqrt(accum_p.get(n, 0)**2 + accum_q.get(n, 0)**2) if n in tree else 0.0
                # If leaf, use local load
                if s_node == 0:
                    s_node = math.sqrt(bus_p.get(n, 0)**2 + bus_q.get(n, 0)**2)

                load_pct = min(250.0, (s_node / max(cap_node, 0.1)) * 100.0)
                # If node is S1, base it on total grid demand
                if n == "S1":
                    total_grid_mva = math.sqrt(accum_p.get("S1", 0)**2 + accum_q.get("S1", 0)**2)
                    load_pct = (total_grid_mva / cap_node) * 100.0

                loadings[n] = round(load_pct, 1)

                # IEEE thermal rise model (ambient + heating * loading^1.6)
                temp_rise = 45.0 * ((load_pct / 100.0) ** 1.6)
                node_temp = ambient_temp_c + temp_rise
                temperatures[n] = round(node_temp, 1)
            else:
                loadings[n] = 0.0
                temperatures[n] = ambient_temp_c

        return {
            "voltages": voltages,
            "loadings": loadings,
            "temperatures": temperatures,
            "active_mw": active_mw,
            "reactive_mvar": reactive_mvar,
            "edge_flows": edge_flows,
            "converged": True,
            "total_losses_mw": round(total_loss_mw, 4)
        }

    def simulate_cascade(self,
                         initiating_node: str = "T17",
                         stress_multiplier: float = 1.85,
                         ambient_temp_c: float = 34.0,
                         max_steps: int = 8) -> Dict[str, Any]:
        """
        Executes dynamic multi-step cascading failure simulation.
        Records time series matrix, sequence of trips, and final system health.
        """
        tripped_nodes = set()
        tripped_edges = set()
        cascade_sequence = []
        time_series_records = []

        # Prepare base load dictionary
        current_loads: Dict[str, Tuple[float, float]] = {}
        for n in self.graph.nodes():
            bus_num = self.graph.nodes[n]["bus_num"]
            p = self.bus_specs[bus_num]["p_mw"]
            q = self.bus_specs[bus_num]["q_mvar"]
            current_loads[n] = (p, q)

        # Timestep 0: Apply stress to initiating node
        init_p, init_q = current_loads.get(initiating_node, (0.2, 0.1))
        current_loads[initiating_node] = (init_p * stress_multiplier, init_q * stress_multiplier)

        for step in range(max_steps):
            pf = self.solve_power_flow(
                bus_loads=current_loads,
                tripped_nodes=tripped_nodes,
                tripped_edges=tripped_edges,
                ambient_temp_c=ambient_temp_c
            )

            # Record step state
            step_record = {
                "step": step,
                "timestamp_offset_min": step * 15,
                "voltages": copy.deepcopy(pf["voltages"]),
                "loadings": copy.deepcopy(pf["loadings"]),
                "temperatures": copy.deepcopy(pf["temperatures"]),
                "tripped_nodes": list(tripped_nodes),
                "active_trips_this_step": []
            }

            # Evaluate trip conditions:
            # 1. Thermal limit breach: Temp > 92 C or Load > 135%
            # 2. Severe voltage collapse: V < 0.82 pu
            new_trips = []
            for n in self.graph.nodes():
                if n in tripped_nodes:
                    continue
                load = pf["loadings"].get(n, 0)
                temp = pf["temperatures"].get(n, ambient_temp_c)
                volt = pf["voltages"].get(n, 1.0)

                # Initiating node trips first if heavily stressed
                if n == initiating_node and (load >= 110.0 or temp >= 78.0) and step >= 1:
                    new_trips.append((n, f"Initiating asset thermal overload: {load}% load, {temp}°C"))
                elif load >= 130.0 or temp >= 95.0:
                    new_trips.append((n, f"Cascading thermal trip: {load}% load, {temp}°C"))
                elif volt > 0.0 and volt < 0.80:
                    new_trips.append((n, f"Under-voltage trip: {volt} p.u."))

            # Trip candidates
            if new_trips:
                for tripped_n, reason in new_trips:
                    tripped_nodes.add(tripped_n)
                    cascade_sequence.append(tripped_n)
                    step_record["active_trips_this_step"].append({"node": tripped_n, "reason": reason})

                # Power redistribution: shed and redirect load to adjacent neighbors
                for tripped_n, _ in new_trips:
                    neighbors = [nbr for nbr in self.graph.neighbors(tripped_n) if nbr not in tripped_nodes]
                    if neighbors:
                        shed_p, shed_q = current_loads.get(tripped_n, (0, 0))
                        transfer_p = (shed_p * 0.45) / len(neighbors)
                        transfer_q = (shed_q * 0.45) / len(neighbors)
                        for nbr in neighbors:
                            nbr_p, nbr_q = current_loads[nbr]
                            current_loads[nbr] = (nbr_p + transfer_p, nbr_q + transfer_q)
                    current_loads[tripped_n] = (0.0, 0.0)

            time_series_records.append(step_record)

            # If no new trips or blackout, terminate simulation loop
            if not new_trips and step > 1:
                break
            if len(tripped_nodes) >= len(self.graph.nodes()) * 0.7:
                break

        # Final power flow
        final_pf = self.solve_power_flow(
            bus_loads=current_loads,
            tripped_nodes=tripped_nodes,
            tripped_edges=tripped_edges,
            ambient_temp_c=ambient_temp_c
        )

        return {
            "initiating_node": initiating_node,
            "stress_multiplier": stress_multiplier,
            "ambient_temp_c": ambient_temp_c,
            "cascade_sequence": cascade_sequence,
            "tripped_nodes": list(tripped_nodes),
            "time_series": time_series_records,
            "final_power_flow": final_pf,
            "cascade_occurred": len(cascade_sequence) > 1,
            "total_blackout_pct": round((len(tripped_nodes) / len(self.graph.nodes())) * 100.0, 1)
        }

    def export_grid_state(self,
                          power_flow_result: Optional[Dict[str, Any]] = None,
                          tripped_nodes: Optional[set] = None) -> Dict[str, Any]:
        """Formats grid topology and state strictly conforming to schema.json."""
        if power_flow_result is None:
            power_flow_result = self.solve_power_flow()
        if tripped_nodes is None:
            tripped_nodes = set()

        nodes_list = []
        for n, data in self.graph.nodes(data=True):
            bus_id = data["bus_num"]
            volt = power_flow_result["voltages"].get(n, 1.0)
            load = power_flow_result["loadings"].get(n, 0.0)
            temp = power_flow_result["temperatures"].get(n, 28.0)
            p_mw = power_flow_result["active_mw"].get(n, data.get("p_mw", 0.1))
            q_mvar = power_flow_result["reactive_mvar"].get(n, data.get("q_mvar", 0.05))

            if n in tripped_nodes:
                status = "TRIPPED"
            elif load > 105.0 or temp > 85.0:
                status = "OVERLOADED"
            else:
                status = "ONLINE"

            nodes_list.append({
                "id": n,
                "type": data["type"],
                "features": {
                    "load_pct": round(load, 1),
                    "voltage_pu": round(volt, 3),
                    "temperature_c": round(temp, 1),
                    "age_years": data["age_years"],
                    "capacity_mva": data["capacity_mva"],
                    "active_power_mw": round(p_mw, 3),
                    "reactive_power_mvar": round(q_mvar, 3)
                },
                "status": status,
                "x": data["x"],
                "y": data["y"]
            })

        edges_list = []
        for u, v, data in self.graph.edges(data=True):
            edge_id = data["id"]
            flow_info = power_flow_result["edge_flows"].get(edge_id, {})
            loading_pct = flow_info.get("loading_pct", 0.0)
            flow_mw = flow_info.get("flow_mva", 0.0)

            if u in tripped_nodes or v in tripped_nodes:
                edge_status = "TRIPPED"
            else:
                edge_status = "CLOSED"

            edges_list.append({
                "id": edge_id,
                "source": u,
                "target": v,
                "type": data["type"],
                "capacity_mva": data["capacity_mva"],
                "loading_pct": round(loading_pct, 1),
                "flow_mw": round(flow_mw, 3),
                "impedance_pu": round(math.sqrt(data["r_ohm"]**2 + data["x_ohm"]**2), 4),
                "status": edge_status
            })

        # System health status
        tripped_count = len(tripped_nodes)
        if tripped_count >= 3:
            sys_status = "CRITICAL_CASCADE"
        elif tripped_count > 0 or any(node["status"] == "OVERLOADED" for node in nodes_list):
            sys_status = "ALERT"
        else:
            sys_status = "HEALTHY"

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "topology_name": "IEEE 33-Bus Feeder System",
            "system_status": sys_status,
            "nodes": nodes_list,
            "edges": edges_list
        }

    def generate_training_dataset(self, n_runs: int = 250) -> List[Dict[str, Any]]:
        """Generates synthetic dataset of cascade trajectories for GNN and Conformal calibration."""
        dataset = []
        candidate_initiators = [n for n in self.graph.nodes() if n != "S1"]

        for run_id in range(n_runs):
            init_node = random.choice(candidate_initiators)
            stress = random.uniform(1.1, 2.5)
            temp = random.uniform(22.0, 42.0)

            sim_result = self.simulate_cascade(
                initiating_node=init_node,
                stress_multiplier=stress,
                ambient_temp_c=temp,
                max_steps=6
            )
            dataset.append(sim_result)
        return dataset


# Singleton global instance
global_simulator = GridSimulator(seed=42)
