"""
GridSense Pydantic Data Models and API Schemas
Defines request/response contracts for GridSense REST API.
"""

from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field

# ── Base Electrical & Spatial Types ──

class NodeFeatures(BaseModel):
    load_pct: float = Field(default=35.0, description="Operating loading percentage")
    voltage_pu: float = Field(default=1.0, description="Per-unit voltage")
    temperature_c: float = Field(default=35.0, description="Operating temperature in Celsius")
    age_years: float = Field(default=12.0, description="Asset age in years")
    capacity_mva: float = Field(default=100.0, description="Nominal capacity in MVA")
    demand_mw: Optional[float] = 0.0
    gen_mw: Optional[float] = 0.0
    p_mw: Optional[float] = 0.0
    q_mvar: Optional[float] = 0.0
    is_tripped: Optional[bool] = False

class NodePosition(BaseModel):
    x: float
    y: float
    z: float

class GridNodeSchema(BaseModel):
    id: str
    type: str = Field(default="transformer", description="substation | transformer | feeder | generator | load_center | bus")
    label: Optional[str] = None
    name: Optional[str] = None
    state: Optional[str] = "-"
    city: Optional[str] = None
    region: Optional[str] = "NR"
    lat: Optional[float] = None
    lon: Optional[float] = None
    features: NodeFeatures
    position: Optional[NodePosition] = None
    status: Optional[str] = "healthy"
    risk_score: Optional[float] = 0.05
    is_root_cause: Optional[bool] = False
    is_in_cascade: Optional[bool] = False
    reference: Optional[str] = None

class GridEdgeSchema(BaseModel):
    id: str
    source: str
    target: str
    type: Optional[str] = "transmission"
    capacity_mva: float = 100.0
    current_load_pct: Optional[float] = 40.0
    loading_pct: Optional[float] = 40.0
    status: Optional[str] = "normal"
    is_cascade_path: Optional[bool] = False
    p_from_mw: Optional[float] = 0.0
    q_from_mvar: Optional[float] = 0.0
    reactance_pu: Optional[float] = 0.1
    length_km: Optional[float] = 10.0
    is_tripped: Optional[bool] = False

class GridStateSchema(BaseModel):
    timestamp: Optional[str] = None
    grid_id: Optional[str] = "india_national_grid"
    nodes: List[GridNodeSchema]
    edges: List[GridEdgeSchema]
    overall_health_pct: Optional[float] = 98.5
    total_load_mw: Optional[float] = 18420.0
    total_capacity_mw: Optional[float] = 26800.0
    regional_health: Optional[Dict[str, float]] = None

# ── ML Prediction & Causal Schemas ──

class RootCauseEntrySchema(BaseModel):
    node_id: str
    node: Optional[str] = None
    root_cause_score: float
    explained_by_upstream: float = 0.0
    explained_by: List[str] = []
    failure_mode: str
    type: Optional[str] = None

class ConfidenceIntervalSchema(BaseModel):
    lower: float
    upper: float

class CascadeStepSchema(BaseModel):
    node_id: str
    sequence: int
    risk_at_step: float
    failure_mode: str
    time_offset_hours: float

class FeatureContributionSchema(BaseModel):
    feature: str
    contribution_pct: float
    direction: str = "increase"
    value: str

class PhysicsSanitySchema(BaseModel):
    power_balance_ok: bool = True
    voltage_constraints_ok: bool = True
    thermal_constraints_ok: bool = True
    powerflow_converged: bool = True
    total_generation_mw: float = 0.0
    total_load_mw: float = 0.0
    total_losses_mw: float = 0.0
    mismatch_mw: float = 0.0

class InterventionActionSchema(BaseModel):
    type: str = "load_reduction"
    target_node: str
    parameter: str = "load_pct"
    value: float = 12.0
    description: str

class InterventionResultSchema(BaseModel):
    original_cascade_risk_pct: float
    new_cascade_risk_pct: float
    risk_reduction_pct: float
    actions_applied: List[InterventionActionSchema] = []
    new_node_risk: Dict[str, float] = {}
    cascade_eliminated: bool = True
    new_cascade_path: List[CascadeStepSchema] = []
    physics_valid: bool = True
    curtailed_mw: Optional[float] = 0.0
    narrative: Optional[str] = None

class PredictionResultSchema(BaseModel):
    node_risk: Dict[str, float]
    time_to_critical_hours: Optional[Dict[str, float]] = None
    root_cause_ranking: List[RootCauseEntrySchema] = []
    confidence_interval: ConfidenceIntervalSchema
    cascade_path: List[CascadeStepSchema] = []
    cascade_risk_pct: float
    prediction_window_hours: int = 24
    feature_contributions: Dict[str, List[FeatureContributionSchema]] = {}
    physics_sanity_checks: Optional[PhysicsSanitySchema] = None
    recommended_intervention: Optional[Dict[str, Any]] = None

# ── API Requests ──

class SimulateRequest(BaseModel):
    initiating_node: Optional[str] = Field(default="T17", description="Asset receiving initial stress or failure")
    stress_multiplier: Optional[float] = Field(default=1.85, ge=1.0, le=4.0, description="Load multiplication factor")
    demand_stress_pct: Optional[float] = Field(default=18.0, ge=0.0, le=50.0, description="Demand stress percentage")
    ambient_temp_c: Optional[float] = Field(default=34.0, ge=10.0, le=60.0, description="Ambient temperature in C")
    max_steps: Optional[int] = Field(default=6, ge=1, le=12, description="Max cascade simulation steps")
    grid_id: Optional[str] = "india_national_grid"
    disabled_nodes: Optional[List[str]] = []

class InterveneRequest(BaseModel):
    initiating_node: Optional[str] = Field(default="T17", description="Stressed asset ID")
    target_node: Optional[str] = Field(default=None, description="Target asset for intervention")
    stress_multiplier: Optional[float] = Field(default=1.85, ge=1.0, le=4.0)
    load_shed_pct: Optional[float] = Field(default=12.0, ge=0.0, le=60.0, description="Load reduction percentage")
    load_reduction: Optional[float] = Field(default=12.0, ge=0.0, le=60.0)
    ambient_temp_c: Optional[float] = Field(default=34.0, ge=10.0, le=60.0)
    grid_id: Optional[str] = "india_national_grid"
