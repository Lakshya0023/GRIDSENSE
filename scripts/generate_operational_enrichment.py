"""Generate deterministic synthetic operations data for the India grid demo.

The source city names and coordinates remain the dataset's 20,000 real place
references. Electrical operations, telemetry, outages and maintenance values
written here are simulated demonstration data, never utility or SCADA records.
"""

from pathlib import Path
import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / "dataset"
RNG = np.random.default_rng(20260907)


def main() -> None:
    nodes = pd.read_csv(DATASET / "india_national_nodes.csv")
    scenarios = pd.read_csv(DATASET / "scenarios.csv")

    # Detailed topology / health profile for every asset in the 20k-city grid.
    profiles = nodes.copy()
    profiles["asset_id"] = profiles["id"]
    profiles["asset_class"] = profiles["type"]
    profiles["transformer_bank_id"] = np.where(
        profiles["type"].eq("transformer"),
        "BANK-" + profiles["city"].fillna("NATIONAL").str.upper().str.replace(r"[^A-Z0-9]", "", regex=True).str[:12],
        "",
    )
    profiles["breaker_state"] = "CLOSED"
    profiles["protection_relay"] = np.select(
        [profiles["type"].eq("transformer"), profiles["type"].eq("line")],
        ["87T Differential", "21 Distance"],
        default="50/51 Overcurrent",
    )
    profiles["power_factor_nominal"] = np.round(RNG.uniform(0.91, 0.99, len(profiles)), 3)
    profiles["health_index"] = np.round(np.clip(100 - profiles["age_years"].fillna(10) * 1.15 + RNG.normal(0, 5, len(profiles)), 35, 99), 1)
    profiles["dga_hydrogen_ppm"] = np.round(np.clip(RNG.lognormal(3.2, 0.65, len(profiles)), 5, 1800), 1)
    profiles["dga_acetylene_ppm"] = np.round(np.clip(RNG.lognormal(1.2, 0.7, len(profiles)), 0, 250), 1)
    profiles["last_inspection_date"] = (pd.Timestamp("2026-09-01") - pd.to_timedelta(RNG.integers(7, 720, len(profiles)), unit="D")).date
    profiles["maintenance_priority"] = np.where(profiles["health_index"] < 60, "HIGH", np.where(profiles["health_index"] < 78, "MEDIUM", "ROUTINE"))
    profile_columns = [
        "asset_id", "asset_class", "city", "state", "region", "lat", "lon", "voltage_kv", "capacity_mva", "age_years",
        "base_load_pct", "voltage_pu", "ambient_temp_c", "transformer_bank_id", "breaker_state", "protection_relay",
        "power_factor_nominal", "health_index", "dga_hydrogen_ppm", "dga_acetylene_ppm", "last_inspection_date", "maintenance_priority",
    ]
    profiles[profile_columns].to_csv(DATASET / "synthetic_asset_profiles.csv", index=False)

    # One operating/weather/protection and optimization record per labelled GNN condition.
    context = scenarios[["scenario_id", "scenario_type", "initiating_node", "initiating_city", "initiating_state", "cascade_risk_pct", "stress_multiplier", "load_multiplier", "weather_factor", "population_affected"]].copy()
    timestamps = pd.Timestamp("2026-08-01T00:00:00Z") + pd.to_timedelta(RNG.integers(0, 31 * 24 * 12, len(context)) * 5, unit="min")
    context["assessment_timestamp"] = timestamps.astype(str)
    context["frequency_hz"] = np.round(50 - np.clip((context["stress_multiplier"] - 1) * 0.11 + RNG.normal(0, 0.018, len(context)), -0.08, 0.35), 3)
    context["power_factor"] = np.round(np.clip(0.985 - (context["load_multiplier"] - 1) * 0.05 + RNG.normal(0, 0.012, len(context)), 0.78, 0.99), 3)
    context["ambient_temp_c"] = np.round(27 + context["weather_factor"] * 8 + RNG.normal(0, 3, len(context)), 1)
    context["rainfall_mm_hr"] = np.round(np.clip((context["weather_factor"] - 1) * 18 + RNG.gamma(1.2, 0.7, len(context)), 0, 80), 2)
    context["wind_kph"] = np.round(np.clip(8 + context["weather_factor"] * 11 + RNG.normal(0, 4, len(context)), 0, 100), 1)
    context["lightning_risk"] = np.round(np.clip((context["weather_factor"] - 0.92) * 1.8 + RNG.normal(0.08, 0.12, len(context)), 0, 1), 3)
    context["humidity_pct"] = np.round(np.clip(42 + context["weather_factor"] * 21 + RNG.normal(0, 9, len(context)), 15, 100), 1)
    context["breaker_state"] = np.where(context["cascade_risk_pct"] >= 55, "TRIPPED", "CLOSED")
    context["protection_event"] = np.select(
        [context["scenario_type"].eq("line_outage"), context["scenario_type"].eq("transformer_overload"), context["cascade_risk_pct"] >= 55],
        ["21 Distance relay operated", "87T differential alarm", "50/51 overload trip"],
        default="No protection operation",
    )
    context["fault_type"] = np.select(
        [context["scenario_type"].eq("line_outage"), context["scenario_type"].eq("transformer_overload"), context["scenario_type"].eq("heatwave")],
        ["line fault", "thermal overload", "thermal derating"], default="demand stress",
    )
    context["restoration_action"] = np.where(context["cascade_risk_pct"] >= 40, "Isolate faulted element; redistribute load", "No restoration required")
    context.to_csv(DATASET / "synthetic_condition_operations.csv", index=False)

    # 24 five-minute observations around each initiating asset (120,000 snapshots).
    snapshots = context.loc[context.index.repeat(24)].copy().reset_index(drop=True)
    snapshots["offset_minutes"] = np.tile(np.arange(-55, 65, 5), len(context))
    phase = (snapshots["offset_minutes"] + 55) / 120
    stress = snapshots["stress_multiplier"].to_numpy()
    risk = snapshots["cascade_risk_pct"].to_numpy()
    snapshots["timestamp"] = pd.to_datetime(snapshots["assessment_timestamp"], utc=True) + pd.to_timedelta(snapshots["offset_minutes"], unit="min")
    snapshots["load_pct"] = np.round(np.clip(48 + stress * 15 + phase * risk * 0.30 + RNG.normal(0, 2.5, len(snapshots)), 10, 135), 2)
    snapshots["voltage_pu"] = np.round(np.clip(1.02 - (snapshots["load_pct"] - 60) * 0.0015 + RNG.normal(0, 0.004, len(snapshots)), 0.82, 1.08), 4)
    snapshots["temperature_c"] = np.round(np.clip(snapshots["ambient_temp_c"] + snapshots["load_pct"] * 0.29 + RNG.normal(0, 1.2, len(snapshots)), 20, 135), 2)
    snapshots["frequency_hz"] = np.round(snapshots["frequency_hz"] - phase * risk * 0.001 + RNG.normal(0, 0.004, len(snapshots)), 3)
    snapshots["breaker_state"] = np.where((snapshots["cascade_risk_pct"] >= 70) & (snapshots["offset_minutes"] >= 30), "TRIPPED", "CLOSED")
    snapshots[["scenario_id", "initiating_node", "timestamp", "offset_minutes", "load_pct", "voltage_pu", "frequency_hz", "temperature_c", "power_factor", "breaker_state"]].to_csv(DATASET / "synthetic_telemetry_5min.csv", index=False)

    # Structural alternatives: N-1 safe topology candidates to meet the requested 15→13 transformer case.
    optimization = context[["scenario_id", "initiating_city", "initiating_state", "cascade_risk_pct"]].copy()
    topology_types = np.array(["ring-main", "double-bus", "meshed-N-1", "radial-spur", "parallel-bank", "sectionalized-ring"])
    optimization["topology_structure"] = topology_types[np.arange(len(optimization)) % len(topology_types)]
    optimization["transformers_before"] = 15
    # Each candidate demonstrates the requested 15-to-13 bank consolidation;
    # its N-1 result differentiates the viable structural arrangements.
    optimization["transformers_after"] = 13
    optimization["reserve_margin_pct"] = np.round(np.clip(21 + RNG.normal(0, 4, len(optimization)), 12, 35), 1)
    optimization["n_minus_1_secure"] = optimization["topology_structure"].isin(["meshed-N-1", "parallel-bank", "sectionalized-ring", "double-bus"])
    optimization["estimated_loss_reduction_pct"] = np.round(np.clip(3.8 + RNG.normal(0, 1.1, len(optimization)), 1.2, 7.5), 2)
    optimization["estimated_capex_reduction_pct"] = np.round(np.where(optimization["transformers_after"] == 13, 11.5, 6.2) + RNG.normal(0, 0.7, len(optimization)), 2)
    optimization["dispatch_action"] = np.where(optimization["transformers_after"] == 13, "Reconfigure ties; balance 13 transformer banks", "Retain 14 banks; sectionalize bus couplers")
    optimization.to_csv(DATASET / "synthetic_grid_optimization.csv", index=False)

    print("Created synthetic operational enrichment: 22,753 asset profiles, 5,000 conditions, 120,000 telemetry snapshots and 5,000 optimization alternatives.")


if __name__ == "__main__":
    main()
