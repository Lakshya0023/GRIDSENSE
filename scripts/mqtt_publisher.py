"""
=============================================================
  POWER PLANT BRUSH WEAR -- MQTT LIVE DATA PUBLISHER
  Simulates real power plant sensor data using patterns
  derived from NASA PCoE + Azure datasets
  Publishes to: broker.hivemq.com:1883
=============================================================
"""

import paho.mqtt.client as mqtt
import json
import time
import random
import math
import threading
from datetime import datetime

# ─── MQTT CONFIG (from HiveMQ dashboard screenshot) ───────
BROKER   = "broker.hivemq.com"
PORT     = 1883
CLIENT_ID = f"powerplant_publisher_{random.randint(1000,9999)}"

# ─── MQTT TOPICS ──────────────────────────────────────────
TOPICS = {
    "temperature"  : "powerplant/brush/temperature",
    "vibration"    : "powerplant/brush/vibration",
    "current"      : "powerplant/brush/current",
    "resistance"   : "powerplant/brush/resistance",
    "voltage_a"    : "powerplant/grid/voltage_phaseA",
    "voltage_b"    : "powerplant/grid/voltage_phaseB",
    "voltage_c"    : "powerplant/grid/voltage_phaseC",
    "health_score" : "powerplant/alerts/health_score",
    "rul_hours"    : "powerplant/alerts/rul_hours",
    "alert_level"  : "powerplant/alerts/level",
    "fault_status" : "powerplant/grid/fault_status",
    "cascade"      : "powerplant/grid/cascade_event",
}

# ─── DEGRADATION STATE (simulates brush wear lifecycle) ───
class BrushDegradationSimulator:
    """
    Simulates a brush degradation lifecycle based on
    NASA IMS Bearing dataset patterns:
      Phase 0: Healthy      (0-60% wear)
      Phase 1: Warning      (60-80% wear)
      Phase 2: Critical     (80-95% wear)
      Phase 3: Failure      (95-100% wear)
    """
    def __init__(self):
        self.wear_pct      = 0.0    # 0% = new, 100% = failed
        self.wear_rate     = 0.03   # % per cycle (realistic)
        self.cycle         = 0
        self.failure_mode  = None
        self.cascade_active = False
        self.cascade_step  = 0

        # Baseline values (healthy)
        self.BASE = {
            "temperature": 45.0,   # °C
            "vibration"  : 0.5,    # mm/s
            "current"    : 120.0,  # Ampere
            "resistance" : 0.02,   # Ohm (low = good contact)
            "voltage_a"  : 11000,  # V (11kV line)
            "voltage_b"  : 11000,
            "voltage_c"  : 11000,
        }

    def get_wear_multiplier(self):
        """Exponential degradation curve (NASA pattern)"""
        w = self.wear_pct / 100.0
        return 1 + (math.exp(3 * w) - 1) / (math.e**3 - 1) * 4

    def get_phase(self):
        if self.wear_pct < 60:   return 0, "HEALTHY"
        if self.wear_pct < 80:   return 1, "WARNING"
        if self.wear_pct < 95:   return 2, "CRITICAL"
        return 3, "FAILURE"

    def get_health_score(self):
        return max(0, round(100 - self.wear_pct, 1))

    def get_rul_hours(self):
        remaining_wear = 100 - self.wear_pct
        hours = remaining_wear / self.wear_rate * 0.1
        return max(0, round(hours, 1))

    def step(self):
        """Advance one simulation step"""
        self.cycle += 1

        # Accelerate wear in warning+ phase (realistic)
        phase_num, _ = self.get_phase()
        if phase_num == 1:
            self.wear_rate = 0.06
        elif phase_num == 2:
            self.wear_rate = 0.15
        elif phase_num == 3:
            self.wear_rate = 0.0   # Already failed

        if self.wear_pct < 100:
            self.wear_pct = min(100, self.wear_pct + self.wear_rate)

        # Trigger cascade at failure
        if self.wear_pct >= 95 and not self.cascade_active:
            self.cascade_active = True
            self.cascade_step = 0
            self.failure_mode = random.choice([
                "BRUSH_CONTACT_LOSS",
                "EXCITATION_FAILURE",
                "THERMAL_RUNAWAY"
            ])

        if self.cascade_active:
            self.cascade_step += 1

    def get_sensor_readings(self):
        """Generate realistic sensor values based on wear level"""
        mult = self.get_wear_multiplier()
        noise = lambda x: x * random.uniform(0.98, 1.02)

        phase_num, phase_name = self.get_phase()

        temp       = noise(self.BASE["temperature"] * mult)
        vibration  = noise(self.BASE["vibration"]   * mult)
        current    = noise(self.BASE["current"]      * (1 + (mult - 1) * 0.3))
        resistance = noise(self.BASE["resistance"]   * mult * mult)

        # Grid voltages -- stable until failure cascade
        if self.cascade_active:
            step = self.cascade_step
            sag = max(0, 1 - step * 0.04)   # voltage sag per step
            va = noise(self.BASE["voltage_a"] * sag)
            vb = noise(self.BASE["voltage_b"] * max(0.7, sag - 0.1))
            vc = noise(self.BASE["voltage_c"] * max(0.6, sag - 0.2))
        else:
            va = noise(self.BASE["voltage_a"])
            vb = noise(self.BASE["voltage_b"])
            vc = noise(self.BASE["voltage_c"])

        return {
            "temperature"  : round(temp, 2),
            "vibration"    : round(vibration, 4),
            "current"      : round(current, 2),
            "resistance"   : round(resistance, 5),
            "voltage_a"    : round(va, 1),
            "voltage_b"    : round(vb, 1),
            "voltage_c"    : round(vc, 1),
            "health_score" : self.get_health_score(),
            "rul_hours"    : self.get_rul_hours(),
            "wear_pct"     : round(self.wear_pct, 2),
            "phase"        : phase_name,
            "alert_level"  : phase_name,
            "timestamp"    : datetime.utcnow().isoformat() + "Z",
            "cycle"        : self.cycle,
        }

    def get_cascade_event(self):
        """Returns grid cascade event data if failure is happening"""
        if not self.cascade_active:
            return None

        steps = [
            {"step": 1, "event": "Brush contact resistance spiked",      "component": "BRUSH_UNIT_1",     "severity": "HIGH"},
            {"step": 2, "event": "Excitation current dropped 25%",        "component": "EXCITATION_SYS",   "severity": "HIGH"},
            {"step": 3, "event": "Generator output voltage dropping",     "component": "GENERATOR_1",      "severity": "CRITICAL"},
            {"step": 4, "event": "Phase A undervoltage detected",         "component": "GRID_PHASE_A",     "severity": "CRITICAL"},
            {"step": 5, "event": "Phase B overloaded -- compensating",     "component": "GRID_PHASE_B",     "severity": "CRITICAL"},
            {"step": 6, "event": "Relay protection triggered on feeder",  "component": "FEEDER_RELAY_3",   "severity": "CRITICAL"},
            {"step": 7, "event": "Grid section 3 isolated",               "component": "GRID_SECTION_3",   "severity": "BLACKOUT"},
            {"step": 8, "event": "Load shedding initiated -- 40MW lost",   "component": "LOAD_SHEDDING",    "severity": "BLACKOUT"},
            {"step": 9, "event": "Backup unit 2 ramping up",              "component": "GENERATOR_2",      "severity": "RECOVERY"},
            {"step":10, "event": "Grid stabilizing -- Section 3 restoring","component": "GRID_SECTION_3",   "severity": "RECOVERY"},
        ]

        step_idx = min(self.cascade_step - 1, len(steps) - 1)
        event = steps[step_idx].copy()
        event["failure_mode"]  = self.failure_mode
        event["timestamp"]     = datetime.utcnow().isoformat() + "Z"
        event["cascade_step"]  = self.cascade_step
        return event


# ─── MQTT CALLBACKS ───────────────────────────────────────
def on_connect(client, userdata, flags, rc):
    codes = {0:"Connected [OK]", 1:"Bad protocol", 2:"Client ID rejected",
             3:"Broker unavailable", 4:"Bad credentials", 5:"Not authorized"}
    print(f"\n{'='*55}")
    print(f"  MQTT: {codes.get(rc, f'Unknown error {rc}')}")
    print(f"  Broker: {BROKER}:{PORT}")
    print(f"{'='*55}\n")

def on_disconnect(client, userdata, rc):
    print(f"[WARN]  Disconnected (rc={rc}). Reconnecting...")

def on_publish(client, userdata, mid):
    pass  # Suppress publish confirmations for clean output


# ─── MAIN PUBLISHER ───────────────────────────────────────
def run_publisher(interval_seconds=2.0, reset_on_failure=True):
    """
    Main publishing loop -- sends sensor data every `interval_seconds`
    Simulates full brush degradation lifecycle
    """
    sim    = BrushDegradationSimulator()
    # paho-mqtt 2.x requires an explicit callback API version; VERSION1 keeps
    # the existing on_connect/on_disconnect/on_publish signatures valid.
    try:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1, client_id=CLIENT_ID)
    except AttributeError:
        client = mqtt.Client(client_id=CLIENT_ID)
    client.on_connect    = on_connect
    client.on_disconnect = on_disconnect
    client.on_publish    = on_publish

    print(f"\n[DISC] Connecting to HiveMQ broker: {BROKER}:{PORT}")
    client.connect(BROKER, PORT, keepalive=60)
    client.loop_start()

    time.sleep(1.5)   # Wait for connection

    print("[MQTT] Publishing power plant sensor data...")
    print("   Press Ctrl+C to stop\n")
    print(f"{'─'*55}")
    print(f"  {'CYCLE':<8} {'HEALTH':<10} {'TEMP°C':<10} {'VIB':<10} {'PHASE'}")
    print(f"{'─'*55}")

    try:
        while True:
            sim.step()
            data = sim.get_sensor_readings()

            # Publish each sensor to its topic
            for key, topic in TOPICS.items():
                if key in data:
                    payload = json.dumps({
                        "value"    : data[key],
                        "unit"     : _get_unit(key),
                        "timestamp": data["timestamp"],
                        "source"   : "powerplant_brush_unit_1"
                    })
                    client.publish(topic, payload, qos=1, retain=False)

            # Publish full telemetry packet
            client.publish(
                "powerplant/telemetry/full",
                json.dumps(data),
                qos=1
            )

            # Publish cascade event if failure happening
            cascade = sim.get_cascade_event()
            if cascade:
                client.publish(
                    TOPICS["cascade"],
                    json.dumps(cascade),
                    qos=2,   # Exactly once for critical events
                    retain=True
                )
                print(f"\n[ALERT] CASCADE [{cascade['step']:02d}]: {cascade['event']}")
                print(f"   Component: {cascade['component']} | Severity: {cascade['severity']}")

            # Console log
            phase_icons = {"HEALTHY":"[OK]", "WARNING":"[WARN] ", "CRITICAL":"[RED]", "FAILURE":"[FAIL]"}
            icon = phase_icons.get(data["phase"], "❓")
            print(f"  {data['cycle']:<8} {data['health_score']:>5}%     "
                  f"{data['temperature']:>7.1f}   {data['vibration']:>7.4f}   "
                  f"{icon} {data['phase']}")

            # Auto-reset after full failure cycle (for demo loop)
            if reset_on_failure and data["wear_pct"] >= 100 and sim.cascade_step >= 10:
                print(f"\n{'='*55}")
                print(f"  [RESET]  Full lifecycle complete. Resetting simulation...")
                print(f"{'='*55}\n")
                time.sleep(5)
                sim = BrushDegradationSimulator()

            time.sleep(interval_seconds)

    except KeyboardInterrupt:
        print(f"\n\n[STOP] Publisher stopped by user")
    finally:
        client.loop_stop()
        client.disconnect()
        print("[DISC] Disconnected from broker")


def _get_unit(key):
    units = {
        "temperature" : "°C",
        "vibration"   : "mm/s",
        "current"     : "A",
        "resistance"  : "Ω",
        "voltage_a"   : "V",
        "voltage_b"   : "V",
        "voltage_c"   : "V",
        "health_score": "%",
        "rul_hours"   : "hours",
        "alert_level" : "",
        "fault_status": "",
        "cascade"     : "",
    }
    return units.get(key, "")


if __name__ == "__main__":
    # Run publisher -- publishes every 2 seconds
    # Change interval_seconds for faster/slower simulation
    run_publisher(interval_seconds=2.0, reset_on_failure=True)
