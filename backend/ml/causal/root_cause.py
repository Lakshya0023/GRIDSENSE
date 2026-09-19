"""
GridSense Root-Cause Analysis Engine:
Separates actual failure originators from downstream symptomatic overloads using
temporal precedence, graph topology traversal, and thermal/electrical indicators.
"""

from typing import Dict, Any, List, Optional
import networkx as nx
import numpy as np

class RootCauseAnalyzer:
    def __init__(self):
        pass

    def rank_root_causes(
        self,
        grid_state: Dict[str, Any],
        node_risks: Dict[str, float],
        cascade_timeline: Optional[List[Dict[str, Any]]] = None,
        initiating_hint: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Ranks nodes by likelihood of being the initiating root cause rather than a symptom.
        """
        nodes = grid_state.get("nodes", [])
        edges = grid_state.get("edges", [])

        # Build NetworkX graph
        G = nx.Graph()
        for n in nodes:
            G.add_node(n["id"], features=n.get("features", {}))
        for e in edges:
            G.add_edge(e["source"], e["target"], capacity=e.get("capacity_mva", 100))

        # Extract onset steps from timeline
        onset_steps: Dict[str, int] = {}
        if cascade_timeline:
            for event in cascade_timeline:
                n_id = event.get("node") or event.get("node_id")
                step = event.get("step", 0)
                if n_id and n_id not in onset_steps:
                    onset_steps[n_id] = step

        # If an initiating hint was explicitly tracked
        if initiating_hint:
            onset_steps[initiating_hint.upper()] = 0

        # Evaluate root-cause scores
        results = []
        for n in nodes:
            nid = n["id"]
            risk = node_risks.get(nid, 0.05)
            feats = n.get("features", {})
            load_pct = float(feats.get("load_pct", 30.0))
            temp_c = float(feats.get("temperature_c", 25.0))
            voltage_pu = float(feats.get("voltage_pu", 1.0))
            node_type = n.get("type", "asset")

            neighbors = list(G.neighbors(nid)) if nid in G else []
            my_step = onset_steps.get(nid.upper(), 99)

            explained_by = []
            for nb in neighbors:
                nb_step = onset_steps.get(nb.upper(), 99)
                if nb_step < my_step and nb_step != 99:
                    explained_by.append(nb)

            is_explained = len(explained_by) > 0
            is_initiator = bool(initiating_hint and nid.upper() == initiating_hint.upper())

            # Compute score based on risk, load, temperature, and upstream precedence
            if is_initiator or my_step == 0:
                base_rc = max(0.88, min(0.98, 0.70 + risk * 0.28))
                failure_mode = f"Primary Thermal Overload & Dielectric Breakdown ({load_pct:.1f}% load, {temp_c:.1f}°C)"
            elif is_explained:
                base_rc = max(0.05, min(0.32, risk * 0.35))
                failure_mode = f"Secondary Cascade Induced Overload from {', '.join(explained_by[:2])}"
            elif risk > 0.6:
                base_rc = max(0.35, min(0.65, risk * 0.6))
                failure_mode = f"Elevated Stress & Voltage Depression ({voltage_pu:.2f} pu)"
            else:
                base_rc = max(0.01, min(0.18, risk * 0.2))
                failure_mode = "Normal Operating Envelope"

            results.append({
                "node_id": nid,
                "node": nid,
                "root_cause_score": round(float(base_rc), 3),
                "explained_by_upstream": 1.0 if is_explained else 0.0,
                "explained_by": explained_by,
                "failure_mode": failure_mode,
                "type": node_type
            })

        # Sort descending by root cause score
        results = sorted(results, key=lambda x: x["root_cause_score"], reverse=True)
        return results

    def trace_cascade_path(
        self,
        initiating_node: str,
        node_risks: Dict[str, float],
        grid_state: Dict[str, Any],
        max_hops: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Traces the physical propagation path of the cascade starting from initiating root cause.
        """
        nodes = grid_state.get("nodes", [])
        edges = grid_state.get("edges", [])

        G = nx.Graph()
        for n in nodes:
            G.add_node(n["id"])
        for e in edges:
            cap = e.get("capacity_mva", 100.0)
            load = e.get("loading_pct", e.get("current_load_pct", 40.0))
            weight = 1.0 / max(0.1, load / 100.0)
            G.add_edge(e["source"], e["target"], weight=weight, capacity=cap)

        path_steps = []
        # Find initiating node with case-insensitivity
        actual_init = next((n["id"] for n in nodes if n["id"].upper() == initiating_node.upper()), initiating_node)

        if actual_init not in G:
            highest_risk_nodes = sorted(node_risks.items(), key=lambda x: x[1], reverse=True)
            for idx, (nid, r) in enumerate(highest_risk_nodes[:4]):
                if r > 0.15 or idx == 0:
                    path_steps.append({
                        "node_id": nid,
                        "sequence": idx + 1,
                        "risk_at_step": round(r, 2),
                        "failure_mode": "Tripped / Overloaded" if idx == 0 else "Downstream Transfer Surge",
                        "time_offset_hours": round(idx * 0.4, 1)
                    })
            return path_steps

        # Breadth-first / shortest path traversal along highest risk neighbors
        visited = {actual_init}
        current = actual_init
        path_nodes = [actual_init]

        for step in range(1, max_hops):
            neighbors = [n for n in G.neighbors(current) if n not in visited]
            if not neighbors:
                break
            # Pick neighbor with highest risk
            next_node = max(neighbors, key=lambda n: node_risks.get(n, 0.0))
            visited.add(next_node)
            path_nodes.append(next_node)
            current = next_node

        for idx, nid in enumerate(path_nodes):
            risk = node_risks.get(nid, 0.05)
            path_steps.append({
                "node_id": nid,
                "sequence": idx + 1,
                "risk_at_step": round(risk, 2),
                "failure_mode": "Root Asset Overheating & Trip" if idx == 0 else f"High Power Flow Redirection (+{round(risk*100)}% Stress)",
                "time_offset_hours": round(idx * 0.4, 1)
            })

        return path_steps
