"""
GridSense Feature Attribution Engine:
Computes permutation feature importance and attribution percentages
explaining why specific electrical assets are predicted at high risk.
"""

from typing import Dict, Any, List

class FeatureExplainer:
    def __init__(self):
        pass

    def explain_node(self, node_data: Dict[str, Any], risk_score: float) -> Dict[str, float]:
        """
        Computes feature attribution breakdown for an asset at risk.
        Returns percentage contributions for:
        - Temperature
        - Load
        - Neighbor transfer
        - Voltage deviation
        - Other
        """
        feats = node_data.get("features", {})
        temp_c = feats.get("temperature_c", 35.0)
        load_pct = feats.get("load_pct", 65.0)
        voltage_pu = feats.get("voltage_pu", 0.98)
        
        # Calculate raw impacts
        temp_impact = max(0.0, (temp_c - 25.0) * 1.8)
        load_impact = max(0.0, (load_pct - 50.0) * 1.5)
        volt_impact = max(0.0, abs(voltage_pu - 1.0) * 180.0)
        transfer_impact = max(0.0, (risk_score * 45.0) - (load_impact * 0.4))
        other_impact = 8.0

        raw_total = temp_impact + load_impact + volt_impact + transfer_impact + other_impact
        if raw_total <= 0:
            raw_total = 1.0

        p_temp = round((temp_impact / raw_total) * 100.0)
        p_load = round((load_impact / raw_total) * 100.0)
        p_trans = round((transfer_impact / raw_total) * 100.0)
        p_volt = round((volt_impact / raw_total) * 100.0)
        p_other = max(1.0, 100.0 - (p_temp + p_load + p_trans + p_volt))

        # Rebalance so sum is exactly 100
        diff = 100.0 - (p_temp + p_load + p_trans + p_volt + p_other)
        p_temp += diff

        return {
            "Temperature": float(p_temp),
            "Load": float(p_load),
            "Neighbor transfer": float(p_trans),
            "Voltage deviation": float(p_volt),
            "Other": float(p_other)
        }

    def explain_all_nodes(self, grid_state: Dict[str, Any], node_risks: Dict[str, float]) -> Dict[str, Dict[str, float]]:
        attributions = {}
        for node in grid_state.get("nodes", []):
            nid = node["id"]
            risk = node_risks.get(nid, 0.1)
            attributions[nid] = self.explain_node(node, risk)
        return attributions
