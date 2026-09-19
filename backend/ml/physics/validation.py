"""
GridSense Post-Hoc Physics Validation:
Verifies electrical feasibility and constraint compliance of power system states
and GNN predictions against Kirchhoff's laws and utility operating standards.
"""

from typing import Dict, Any, List
import pandapower as pp
import numpy as np

class PhysicsValidator:
    def __init__(
        self,
        voltage_min_pu: float = 0.95,
        voltage_max_pu: float = 1.05,
        thermal_max_pct: float = 100.0,
        power_balance_tolerance_mw: float = 5.0
    ):
        self.v_min = voltage_min_pu
        self.v_max = voltage_max_pu
        self.thermal_max = thermal_max_pct
        self.tol_mw = power_balance_tolerance_mw

    def validate_grid_state(self, net: pp.pandapowerNet) -> Dict[str, Any]:
        """
        Validates power balance, voltage violations, thermal overloads, and convergence.
        """
        converged = hasattr(net, 'converged') and net.converged

        total_gen_mw = 0.0
        total_load_mw = 0.0
        total_losses_mw = 0.0
        voltage_ok = True
        thermal_ok = True
        power_balance_ok = True
        mismatch_mw = 0.0

        if converged:
            if hasattr(net, 'res_gen') and len(net.res_gen) > 0:
                total_gen_mw += float(net.res_gen.p_mw.sum())
            if hasattr(net, 'res_ext_grid') and len(net.res_ext_grid) > 0:
                total_gen_mw += float(net.res_ext_grid.p_mw.sum())
            if hasattr(net, 'res_load') and len(net.res_load) > 0:
                total_load_mw += float(net.res_load.p_mw.sum())
            if hasattr(net, 'res_line') and len(net.res_line) > 0:
                total_losses_mw += float(net.res_line.pl_mw.sum())
            if hasattr(net, 'res_trafo') and len(net.res_trafo) > 0:
                total_losses_mw += float(net.res_trafo.pl_mw.sum())

            mismatch_mw = abs(total_gen_mw - (total_load_mw + total_losses_mw))
            power_balance_ok = bool(mismatch_mw <= self.tol_mw)

            # Voltage checks
            if hasattr(net, 'res_bus') and len(net.res_bus) > 0:
                v_min_actual = float(net.res_bus.vm_pu.min())
                v_max_actual = float(net.res_bus.vm_pu.max())
                voltage_ok = bool(v_min_actual >= self.v_min and v_max_actual <= self.v_max)

            # Thermal checks
            if hasattr(net, 'res_line') and len(net.res_line) > 0:
                if (net.res_line.loading_percent > self.thermal_max).any():
                    thermal_ok = False
            if hasattr(net, 'res_trafo') and len(net.res_trafo) > 0:
                if (net.res_trafo.loading_percent > self.thermal_max).any():
                    thermal_ok = False
        else:
            power_balance_ok = False
            voltage_ok = False
            thermal_ok = False

        return {
            "power_balance_ok": power_balance_ok,
            "voltage_constraints_ok": voltage_ok,
            "thermal_constraints_ok": thermal_ok,
            "powerflow_converged": bool(converged),
            "total_generation_mw": round(total_gen_mw, 1),
            "total_load_mw": round(total_load_mw, 1),
            "total_losses_mw": round(total_losses_mw, 1),
            "mismatch_mw": round(mismatch_mw, 2)
        }
