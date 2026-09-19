# GridSense — India Cascade Dataset (CSV)

5,000 cascading-failure scenarios simulated on a 22,753-node synthetic India grid
covering **20,000 real Indian cities and towns**. Seed 42, fully reproducible.

## Provenance — read before using

**Real:** city name, state, latitude, longitude, population for 20,000 Indian
places (GeoNames `IN` dump, CC BY 4.0). A few Delhi/Kerala substation display
labels from Delhi Transco Ltd and KSEB public documents.

**Synthetic:** the topology and *every* electrical value — capacity, reactance,
resistance, demand, generation, loading, temperature, asset age — is generated
from population heuristics with seed 42. **Not** any real utility's network. No
SCADA data of any kind.

**Simulated, not fabricated:** every label comes from running an actual DC
power-flow cascading-failure simulation. Nothing is hand-written or sampled from
a made-up distribution.

## Files

| file | rows | what it is |
|---|---|---|
| `india_cities_20000.csv` | 20,000 | real city reference: name, state, lat/lon, population |
| `india_national_nodes.csv` | 22,753 | grid assets: substations, transformers, feeders, generators |
| `india_national_edges.csv` | 23,337 | branches: 765/400/220/132/33 kV, reactance, rating, length |
| `scenarios.csv` | 5,000 | one row per scenario — conditions + cascade outcome |
| `node_samples.csv` | 158,923 | GNN training rows: node features + labels |
| `cascade_steps.csv` | 351,834 | per-step time series (input to root-cause layer) |
| `edges.csv` | 168,757 | per-scenario `edge_index` subgraph |

Each scenario exports the 3-hop electrical neighbourhood (≤260 nodes) around the
initiating asset — the region a message-passing GNN can actually see. A full
5000 × 22753 table would be 114M mostly-untouched rows.

## Grid

4 voltage tiers mirroring Indian practice: 765 kV national backbone ring across
5 regional hubs (NR/WR/SR/ER/NER) → 400 kV state hubs → 220/132 kV city
substations in a k-NN mesh → 33 kV transformers/feeders in larger cities.
Total demand 254 GW, generation 309 GW. Ratings are calibrated from the solved
peak base case so the N-0 case is secure — without that, the grid would start
in violation and every scenario would look like a blackout.

## Physics

DC load flow `B·θ = P`, branch flow `f = Δθ/x`, sparse per-island solve with
generation re-dispatch and proportional load shedding, thermal overload tripping
with hysteresis, conductor heating ∝ (overload %)². ~85 ms per cascade.

`voltage_pu_proxy` is a loading-derived approximation — DC power flow has **no**
voltage solution. Named that way so it can't be mistaken for an AC result.

## Labels (`node_samples.csv`)

- `y_fail_within_horizon` — node fails within **3 simulation steps** of the
  observation snapshot. Steps, not hours: this simulation has no wall-clock scale.
- `y_time_to_critical` — first failure step, censored at 5 if it never fails.
- `y_peak_loading_pct` — max loading reached (regression target).
- `y_stressed` — peak loading exceeded the 80% watch threshold.
- `is_initiating_node` — ground-truth root cause, for scoring the root-cause layer.

Positive rate **4.92%** → use `pos_weight ≈ 19.3` in `BCEWithLogitsLoss`.

Input features are the `f_*` columns, observed at step 0 before any trip.

## Splits

Grouped by initiating **state** so no state appears in two splits — prevents the
model memorising local topology. train 3,926 / val 525 / test 549.

## Scenario mix (mean cascade size)

| type | n | mean size | mean risk % |
|---|---|---|---|
| transformer_overload | 1,082 | 2.5 | 0.10 |
| line_outage | 925 | 1.9 | 0.07 |
| high_demand | 883 | 11.1 | 6.68 |
| cascade_emergency | 875 | 144.5 | 12.14 |
| heatwave | 620 | 17.1 | 7.05 |
| normal_operation | 615 | 0.0 | 0.00 |

44.3% of scenarios produce at least one failure; the largest reaches 1,547
failed assets and 109M people affected. Normal operation correctly produces
almost nothing — a good sanity check that the simulator isn't just noise.

## Reproduce

```
python build_india_cities.py      # GeoNames -> 20,000 city table
python build_national_grid.py     # -> 22.7k-node grid
python generate_scenarios.py --n 5000
python export_csv.py
```

## Known limitations

- DC (not AC) power flow: no reactive power, no true voltage collapse.
- Protection is an overload/hysteresis rule, not real relay coordination.
- Topology is a population-driven heuristic, not the actual Indian grid.
- `line_outage` and `transformer_overload` scenarios are mild by construction —
  the deep cascades live in `cascade_emergency` and `heatwave`.
