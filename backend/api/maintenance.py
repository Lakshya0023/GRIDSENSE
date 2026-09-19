"""
GridSense plant predictive-maintenance API router.

Merged in from the standalone Power Plant Predictive Maintenance service, which
used to run its own FastAPI app on port 8000 and therefore could not run
alongside GridSense.  Everything now lives on the single GridSense server under
the `/api/pdm` prefix.

Why the prefix: the legacy service exposed `/api/health` and `/api/alerts`,
both of which already exist in GridSense with completely different response
shapes.  Namespacing avoids silently shadowing the grid endpoints.

The optional PostgreSQL / InfluxDB / Redis persistence layer from the legacy
server is intentionally not carried over.  It was inactive in practice: none of
those clients are installed, there is no local Docker, and every write path was
already wrapped in a "graceful if not available" guard.  The in-memory ring
buffers below are what the dashboard actually read from.
"""

from __future__ import annotations

import json
import os
import random
import threading
import time
from collections import deque
from datetime import datetime, timezone
from typing import Any, Deque, Dict, List

from fastapi import APIRouter, Query

from ml.maintenance.engine import maintenance_engine

router = APIRouter(prefix="/api/pdm", tags=["Predictive Maintenance"])

# ── MQTT configuration ───────────────────────────────────────────────────
MQTT_BROKER = os.getenv("MQTT_BROKER", "broker.hivemq.com")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
# Set MQTT_ENABLED=0 to keep the API fully offline (used by the test suite).
MQTT_ENABLED = os.getenv("MQTT_ENABLED", "1") not in ("0", "false", "False")

SUBSCRIBE_TOPICS = [
    ("powerplant/telemetry/full", 1),
    ("powerplant/alerts/#", 1),
    ("powerplant/grid/#", 1),
    ("powerplant/brush/#", 1),
]

# ── In-memory store ──────────────────────────────────────────────────────
_LOCK = threading.Lock()

_store: Dict[str, Any] = {
    "latest": {},
    "history": deque(maxlen=1000),
    "predictions": deque(maxlen=100),
    "cascade_events": deque(maxlen=50),
    "alerts": deque(maxlen=200),
    "connected": False,
    "message_count": 0,
    "last_error": None,
    "started": False,
}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _tail(buffer: Deque[Any], limit: int) -> List[Any]:
    items = list(buffer)
    return items[-limit:] if limit > 0 else items


# ── MQTT callbacks ───────────────────────────────────────────────────────
def _handle_telemetry(payload: Dict[str, Any]) -> None:
    """Store one telemetry packet and run the maintenance models over it."""
    prediction = maintenance_engine.full_prediction(payload)

    row = {
        "timestamp": payload.get("timestamp") or _utc_now_iso(),
        "temperature": payload.get("temperature"),
        "vibration": payload.get("vibration"),
        "current": payload.get("current"),
        "resistance": payload.get("resistance"),
        "health_score": payload.get("health_score"),
        "rul_hours": payload.get("rul_hours"),
        "phase": payload.get("phase"),
    }

    with _LOCK:
        _store["latest"] = payload
        _store["history"].append(row)
        _store["predictions"].append(prediction)

        if prediction.get("alert_level") in ("WARNING", "CRITICAL", "FAILURE"):
            _store["alerts"].append(
                {
                    "timestamp": _utc_now_iso(),
                    "level": prediction["alert_level"],
                    "message": prediction.get("summary"),
                    "rul_hours": prediction.get("rul_hours"),
                }
            )


def _on_connect(client, userdata, flags, reason_code, properties=None):  # noqa: ANN001
    with _LOCK:
        _store["connected"] = True
        _store["last_error"] = None
    print(f"[PdM/MQTT] Connected to {MQTT_BROKER}:{MQTT_PORT}")
    for topic, qos in SUBSCRIBE_TOPICS:
        client.subscribe(topic, qos)


def _on_disconnect(client, userdata, disconnect_flags, reason_code, properties=None):  # noqa: ANN001
    with _LOCK:
        _store["connected"] = False


def _on_message(client, userdata, msg):  # noqa: ANN001
    with _LOCK:
        _store["message_count"] += 1
    try:
        payload = json.loads(msg.payload.decode())
    except Exception as exc:  # noqa: BLE001
        print(f"[PdM/MQTT] Parse error on {msg.topic}: {exc}")
        return

    try:
        if msg.topic == "powerplant/telemetry/full":
            _handle_telemetry(payload)
        elif msg.topic == "powerplant/grid/cascade_event":
            with _LOCK:
                _store["cascade_events"].append(payload)
    except Exception as exc:  # noqa: BLE001 - a bad packet must not kill the loop
        print(f"[PdM/MQTT] Handler error on {msg.topic}: {exc}")


def _mqtt_loop() -> None:
    import paho.mqtt.client as mqtt

    client_id = f"gridsense_pdm_{random.randint(1000, 9999)}"

    # paho-mqtt 2.x requires an explicit callback API version.  The legacy
    # service called mqtt.Client(client_id=...), which raises outright on
    # paho-mqtt >= 2.0 - the merged service would never have connected.
    try:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id)
    except AttributeError:  # paho-mqtt 1.x
        client = mqtt.Client(client_id=client_id)

    client.on_connect = _on_connect
    client.on_disconnect = _on_disconnect
    client.on_message = _on_message

    while True:
        try:
            client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
            client.loop_forever()
        except Exception as exc:  # noqa: BLE001
            with _LOCK:
                _store["connected"] = False
                _store["last_error"] = str(exc)
            print(f"[PdM/MQTT] Connection failed: {exc}. Retrying in 5s...")
            time.sleep(5)


def start_mqtt_subscriber() -> bool:
    """Start the background MQTT subscriber once. Safe to call repeatedly."""
    with _LOCK:
        if _store["started"]:
            return False
        if not MQTT_ENABLED:
            print("[PdM/MQTT] Disabled via MQTT_ENABLED=0; REST endpoints still served.")
            return False
        _store["started"] = True

    threading.Thread(target=_mqtt_loop, name="pdm-mqtt", daemon=True).start()
    print(f"[PdM/MQTT] Subscriber thread started -> {MQTT_BROKER}:{MQTT_PORT}")
    return True


# ── Routes ───────────────────────────────────────────────────────────────
@router.get("/status")
def pdm_status() -> Dict[str, Any]:
    """Connection state of the plant telemetry feed and the model bundle."""
    with _LOCK:
        connected = _store["connected"]
        messages = _store["message_count"]
        last_error = _store["last_error"]
        buffered = len(_store["history"])
    return {
        "service": "GridSense Plant Predictive Maintenance",
        "mqtt": {
            "enabled": MQTT_ENABLED,
            "connected": connected,
            "broker": f"{MQTT_BROKER}:{MQTT_PORT}",
            "topics": [topic for topic, _ in SUBSCRIBE_TOPICS],
            "messages_received": messages,
            "last_error": last_error,
        },
        "models": maintenance_engine.status(),
        "buffered_readings": buffered,
        "timestamp": _utc_now_iso(),
    }


@router.get("/live")
def pdm_live() -> Dict[str, Any]:
    """Most recent telemetry packet plus the model output computed for it."""
    with _LOCK:
        latest = dict(_store["latest"])
        predictions = list(_store["predictions"])
        connected = _store["connected"]
    return {
        "sensors": latest,
        "prediction": predictions[-1] if predictions else {},
        "connected": connected,
        "source": "memory",
        "timestamp": _utc_now_iso(),
    }


@router.get("/history")
def pdm_history(limit: int = Query(200, ge=1, le=1000)) -> Dict[str, Any]:
    """Rolling telemetry history for the trend charts."""
    with _LOCK:
        data = _tail(_store["history"], limit)
        total = len(_store["history"])
    return {"data": data, "total": total, "source": "memory"}


@router.get("/health")
def pdm_health() -> Dict[str, Any]:
    """Flattened plant condition summary — the panel header reads this."""
    with _LOCK:
        latest = dict(_store["latest"])
        predictions = list(_store["predictions"])
        connected = _store["connected"]

    last = predictions[-1] if predictions else {}
    cascade = last.get("cascade") or {}
    health = last.get("health") or {}

    return {
        "health_score": latest.get("health_score", 100),
        "rul_hours": latest.get("rul_hours", 999),
        "phase": latest.get("phase", "HEALTHY"),
        "alert_level": last.get("alert_level", "HEALTHY"),
        "blackout_risk": cascade.get("blackout_risk", False),
        "blackout_proba": cascade.get("blackout_proba", 0),
        "fault_type": cascade.get("fault_type", "NO"),
        "sections_affected": cascade.get("sections_affected", 0),
        "mw_loss": cascade.get("estimated_mw_loss", 0),
        "action": cascade.get("recommended_action", "No action needed"),
        "is_anomaly": health.get("is_anomaly", False),
        "failure_type": health.get("failure_type", "none"),
        "connected": connected,
        "timestamp": _utc_now_iso(),
    }


@router.get("/alerts")
def pdm_alerts(limit: int = Query(50, ge=1, le=200)) -> Dict[str, Any]:
    """Maintenance alerts raised from RUL thresholds."""
    with _LOCK:
        return {"alerts": _tail(_store["alerts"], limit), "source": "memory"}


@router.get("/cascade")
def pdm_cascade() -> Dict[str, Any]:
    """Plant-level cascade events: brush -> excitation -> generator -> blackout."""
    with _LOCK:
        return {"events": list(_store["cascade_events"]), "source": "memory"}


@router.get("/predictions")
def pdm_predictions(limit: int = Query(50, ge=1, le=100)) -> Dict[str, Any]:
    """Recent full model outputs."""
    with _LOCK:
        return {"data": _tail(_store["predictions"], limit), "source": "memory"}


@router.get("/rul")
def pdm_rul(
    vibration: float = Query(2.5, description="Vibration RMS (mm/s)"),
    temperature: float = Query(75.0, description="Brush temperature (deg C)"),
    kurtosis: float = Query(3.0),
    rms_accel: float = Query(0.2),
    resistance: float = Query(0.02, description="Brush contact resistance (ohm)"),
) -> Dict[str, Any]:
    """NASA-bearing-pattern remaining-useful-life inference, exposed directly."""
    hours = maintenance_engine.predict_rul(
        vibration_rms=vibration,
        temperature=temperature,
        kurtosis=kurtosis,
        rms_accel=rms_accel,
        resistance=resistance,
    )
    level = "HEALTHY"
    if hours is not None and hours < 6:
        level = "CRITICAL"
    elif hours is not None and hours < 24:
        level = "WARNING"
    return {
        "model": "GradientBoostingRegressor (NASA PCoE bearing degradation pattern)",
        "rul_hours": hours,
        "alert_level": level,
        "models_loaded": maintenance_engine.loaded,
        "inputs": {
            "vibration": vibration,
            "temperature": temperature,
            "kurtosis": kurtosis,
            "rms_accel": rms_accel,
            "resistance": resistance,
        },
        "timestamp": _utc_now_iso(),
    }


@router.get("/anomaly")
def pdm_anomaly(
    volt: float = Query(170.0, description="Terminal voltage"),
    rotate: float = Query(450.0, description="Rotation / current proxy"),
    pressure: float = Query(100.0),
    vibration: float = Query(40.0),
    age_years: float = Query(5.0),
) -> Dict[str, Any]:
    """Azure-PdM-pattern anomaly detection and failure-type classification."""
    result = maintenance_engine.predict_health(
        volt=volt, rotate=rotate, pressure=pressure, vibration=vibration, age_years=age_years
    )
    return {
        "model": "IsolationForest + RandomForest (Microsoft Azure PdM pattern)",
        "result": result,
        "models_loaded": maintenance_engine.loaded,
        "inputs": {
            "volt": volt,
            "rotate": rotate,
            "pressure": pressure,
            "vibration": vibration,
            "age_years": age_years,
        },
        "timestamp": _utc_now_iso(),
    }


@router.get("/simulate")
def pdm_simulate(
    temperature: float = 75.0,
    vibration: float = 2.5,
    current: float = 140.0,
    resistance: float = 0.12,
    voltage_a: float = 10500.0,
    voltage_b: float = 10800.0,
    voltage_c: float = 11000.0,
) -> Dict[str, Any]:
    """Run all three maintenance models over an arbitrary sensor vector."""
    return maintenance_engine.full_prediction(
        {
            "temperature": temperature,
            "vibration": vibration,
            "current": current,
            "resistance": resistance,
            "voltage_a": voltage_a,
            "voltage_b": voltage_b,
            "voltage_c": voltage_c,
        }
    )
