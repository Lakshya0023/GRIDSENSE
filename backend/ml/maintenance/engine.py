"""
GridSense Plant Predictive-Maintenance Inference Engine.

Adapted from the standalone `ml_models.py` PredictionEngine that shipped with the
separate Power Plant Predictive Maintenance service, which has been merged into
GridSense.  Only the inference half lives here — model *training* stays in
`scripts/train_maintenance_models.py`.

Three trained estimators, loaded from `backend/ml/trained_models/maintenance/`:

  * RUL        — Gradient Boosting Regressor, NASA PCoE bearing degradation
                 pattern, predicts remaining useful life of the generator brush.
  * Anomaly    — Isolation Forest (outlier score) + Random Forest (failure-type
                 classifier), Microsoft Azure PdM pattern.
  * Cascade    — XGBoost fault-type classifier plus a blackout-risk classifier,
                 electrical fault-detection pattern.

Differences from the original module, all deliberate:
  * Model paths are resolved absolutely, not relative to the process CWD.  The
    original used a bare `MODELS_DIR = "models"`, so it only loaded when uvicorn
    happened to be started from the repo root.
  * No training code and no import-time banner printing, so importing this from
    the API server is silent and cheap.
  * Loading is lazy and thread-safe: the first request pays the joblib cost, and
    a missing model degrades to `loaded = False` instead of raising at import.
"""

from __future__ import annotations

import os
import threading
import warnings
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import numpy as np

# The scalers were fitted on named DataFrame columns; we feed plain numpy arrays
# at inference. sklearn warns every single call, which would flood the server log
# once telemetry starts arriving at ~1 message/second. The ordering of our
# feature vectors matches training, so the warning carries no information here.
warnings.filterwarnings(
    "ignore",
    message="X does not have valid feature names",
    category=UserWarning,
)

# backend/ml/maintenance/engine.py -> backend/ml/trained_models/maintenance
_ML_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODELS_DIR = os.path.join(_ML_DIR, "trained_models", "maintenance")

# Alert thresholds, in hours of remaining useful life.
RUL_CRITICAL_HOURS = 6
RUL_WARNING_HOURS = 24

# Fault class -> operational grid impact.  Carried over verbatim from the
# standalone service so the merged UI reports identical numbers.
CASCADE_IMPACT: Dict[str, Dict[str, Any]] = {
    "NO":   {"sections": 0, "mw_loss": 0,   "action": "No action needed"},
    "LG":   {"sections": 1, "mw_loss": 15,  "action": "Monitor Phase A, check relay"},
    "LL":   {"sections": 2, "mw_loss": 40,  "action": "Isolate affected phases, reroute"},
    "LLG":  {"sections": 2, "mw_loss": 60,  "action": "Emergency isolation required"},
    "LLL":  {"sections": 3, "mw_loss": 120, "action": "Full 3-phase fault -- trip generator"},
    "LLLG": {"sections": 4, "mw_loss": 180, "action": "BLACKOUT RISK -- activate backup NOW"},
}

_MODEL_FILES = {
    "rul_model": "rul_model.pkl",
    "rul_scaler": "rul_scaler.pkl",
    "anomaly_iso": "anomaly_iso.pkl",
    "anomaly_rf": "anomaly_rf.pkl",
    "anomaly_scaler": "anomaly_scaler.pkl",
    "anomaly_le": "anomaly_le.pkl",
    "cascade_fault": "cascade_fault.pkl",
    "cascade_blk": "cascade_blackout.pkl",
    "cascade_scaler": "cascade_scaler.pkl",
    "cascade_le": "cascade_le.pkl",
}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class MaintenancePredictionEngine:
    """Unified inference interface over the three maintenance models."""

    def __init__(self, models_dir: str = MODELS_DIR, eager: bool = False):
        self.models_dir = models_dir
        self.loaded = False
        self.load_error: Optional[str] = None
        self._models: Dict[str, Any] = {}
        self._lock = threading.Lock()
        self._attempted = False
        if eager:
            self._ensure_loaded()

    # ── loading ──────────────────────────────────────────────────────────
    def _ensure_loaded(self) -> bool:
        if self.loaded:
            return True
        with self._lock:
            if self.loaded:
                return True
            # Only try once; a missing model directory should not cost a joblib
            # probe on every single MQTT message.
            if self._attempted:
                return False
            self._attempted = True
            try:
                import joblib  # imported lazily so the API boots without it

                for attr, filename in _MODEL_FILES.items():
                    path = os.path.join(self.models_dir, filename)
                    self._models[attr] = joblib.load(path)
                self.loaded = True
                self.load_error = None
                print(f"[PdM] Loaded {len(self._models)} maintenance models from {self.models_dir}")
            except Exception as exc:  # noqa: BLE001 - degrade, never crash the API
                self.load_error = str(exc)
                self._models.clear()
                print(f"[PdM] Maintenance models unavailable: {exc}")
            return self.loaded

    def status(self) -> Dict[str, Any]:
        self._ensure_loaded()
        return {
            "loaded": self.loaded,
            "models_dir": self.models_dir,
            "model_count": len(self._models),
            "error": self.load_error,
        }

    # ── individual heads ─────────────────────────────────────────────────
    def predict_rul(
        self,
        vibration_rms: float,
        temperature: float,
        kurtosis: float = 3.0,
        rms_accel: float = 0.2,
        resistance: float = 0.02,
    ) -> Optional[float]:
        """Remaining useful life of the generator brush, in hours."""
        if not self._ensure_loaded():
            return None
        features = np.array([[vibration_rms, temperature, kurtosis, rms_accel, resistance]])
        scaled = self._models["rul_scaler"].transform(features)
        rul_cycles = max(0, self._models["rul_model"].predict(scaled)[0])
        # 1 cycle ~ 0.1 hour in the plant model this was trained against.
        return round(float(rul_cycles) * 0.1, 1)

    def predict_health(
        self,
        volt: float,
        rotate: float,
        pressure: float,
        vibration: float,
        age_years: float = 5.0,
    ) -> Optional[Dict[str, Any]]:
        """Azure-PdM style health score, anomaly flag and failure-type class."""
        if not self._ensure_loaded():
            return None
        features = np.array([[volt, rotate, pressure, vibration, age_years]])
        scaled = self._models["anomaly_scaler"].transform(features)

        iso = self._models["anomaly_iso"]
        iso_score = iso.decision_function(features)[0]
        is_anomaly = iso.predict(features)[0] == -1
        health = min(100.0, max(0.0, (float(iso_score) + 0.5) * 100.0))

        failure_proba = self._models["anomaly_rf"].predict_proba(scaled)[0]
        failure_type = self._models["anomaly_le"].classes_[int(np.argmax(failure_proba))]

        return {
            "health_score": round(health, 1),
            "is_anomaly": bool(is_anomaly),
            "failure_type": str(failure_type),
            "confidence": round(float(np.max(failure_proba)), 3),
        }

    def predict_cascade(
        self, Va: float, Vb: float, Vc: float, Ia: float, Ib: float, Ic: float
    ) -> Optional[Dict[str, Any]]:
        """Electrical fault classification and downstream blackout risk."""
        if not self._ensure_loaded():
            return None
        features = np.array([[Va, Vb, Vc, Ia, Ib, Ic]])
        scaled = self._models["cascade_scaler"].transform(features)

        fault_idx = self._models["cascade_fault"].predict(scaled)[0]
        fault_type = str(self._models["cascade_le"].classes_[int(fault_idx)])
        fault_proba = float(np.max(self._models["cascade_fault"].predict_proba(scaled)))

        blackout_risk = int(self._models["cascade_blk"].predict(scaled)[0])
        blackout_proba = float(self._models["cascade_blk"].predict_proba(scaled)[0][1])

        impact = CASCADE_IMPACT.get(fault_type, CASCADE_IMPACT["NO"])
        return {
            "fault_type": fault_type,
            "fault_proba": round(fault_proba, 3),
            "blackout_risk": bool(blackout_risk),
            "blackout_proba": round(blackout_proba, 3),
            "sections_affected": impact["sections"],
            "estimated_mw_loss": impact["mw_loss"],
            "recommended_action": impact["action"],
        }

    # ── combined ─────────────────────────────────────────────────────────
    def full_prediction(self, sensor_data: Dict[str, Any]) -> Dict[str, Any]:
        """Run all three heads over one telemetry packet."""
        rul = self.predict_rul(
            vibration_rms=sensor_data.get("vibration", 0.5),
            temperature=sensor_data.get("temperature", 45),
            resistance=sensor_data.get("resistance", 0.02),
        )
        health = self.predict_health(
            volt=sensor_data.get("voltage_a", 170),
            rotate=sensor_data.get("current", 450),
            pressure=100,
            vibration=sensor_data.get("vibration", 40),
        )
        cascade = self.predict_cascade(
            Va=sensor_data.get("voltage_a", 11000),
            Vb=sensor_data.get("voltage_b", 11000),
            Vc=sensor_data.get("voltage_c", 11000),
            Ia=sensor_data.get("current", 500),
            Ib=sensor_data.get("current", 500),
            Ic=sensor_data.get("current", 500),
        )

        alert_level = "HEALTHY"
        if rul is not None and rul < RUL_CRITICAL_HOURS:
            alert_level = "CRITICAL"
        elif rul is not None and rul < RUL_WARNING_HOURS:
            alert_level = "WARNING"

        return {
            "timestamp": _utc_now_iso(),
            "models_loaded": self.loaded,
            "rul_hours": rul,
            "health": health,
            "cascade": cascade,
            "alert_level": alert_level,
            "summary": (
                f"Brush failure in {rul if rul is not None else 'n/a'}h | "
                f"Health: {health['health_score'] if health else 'N/A'}% | "
                f"Grid: {cascade['fault_type'] if cascade else 'N/A'}"
            ),
        }


# Module-level singleton shared by the API router and the MQTT subscriber.
maintenance_engine = MaintenancePredictionEngine()
