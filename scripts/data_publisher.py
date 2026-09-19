"""
=============================================================
  POWER PLANT — REAL DATA PUBLISHER
  
  Replays actual dataset records as live MQTT messages.
  Also supports OpenWeatherMap live data.
  
  Mode 1: DATASET REPLAY  — plays NASA/Azure CSV row by row
  Mode 2: LIVE WEATHER    — real temperature/pressure/humidity
  Mode 3: SIMULATE        — mathematical model (original)
=============================================================
"""

import paho.mqtt.client as mqtt
import json
import time
import random
import math
import os
import sys
import csv
import threading
import urllib.request
from datetime import datetime

# ─── CONFIG ───────────────────────────────────────────────
BROKER    = "broker.hivemq.com"
PORT      = 1883
CLIENT_ID = f"powerplant_pub_{random.randint(1000,9999)}"

# OpenWeatherMap free API (sign up at openweathermap.org)
# Replace with your real key for Option 2
OWM_API_KEY  = "654c2edd5d1b1ed3d37151e92e698c34"
OWM_CITY     = "Chennai"   # Change to your city near the power plant
OWM_INTERVAL = 60          # Fetch every 60 seconds

TOPICS = {
    "temperature" : "powerplant/brush/temperature",
    "vibration"   : "powerplant/brush/vibration",
    "current"     : "powerplant/brush/current",
    "resistance"  : "powerplant/brush/resistance",
    "voltage_a"   : "powerplant/grid/voltage_phaseA",
    "voltage_b"   : "powerplant/grid/voltage_phaseB",
    "voltage_c"   : "powerplant/grid/voltage_phaseC",
    "health_score": "powerplant/alerts/health_score",
    "rul_hours"   : "powerplant/alerts/rul_hours",
    "alert_level" : "powerplant/alerts/level",
    "cascade"     : "powerplant/grid/cascade_event",
    "full"        : "powerplant/telemetry/full",
    "weather"     : "powerplant/environment/weather",
}

# ─── MQTT SETUP ───────────────────────────────────────────
# Paths resolved from this file, not the process CWD: after the merge into
# GridSense this script is normally launched from the project root.
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, os.pardir))
MAINTENANCE_DATA_DIR = os.path.join(PROJECT_DIR, 'backend', 'ml', 'datasets', 'maintenance')


def make_client():
    # paho-mqtt 2.x requires an explicit callback API version; VERSION1 keeps
    # the on_connect/on_disconnect signatures below valid. 1.x rejects the arg.
    try:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1, client_id=CLIENT_ID)
    except AttributeError:
        client = mqtt.Client(client_id=CLIENT_ID)
    def on_connect(c, u, f, rc):
        status = {0:"Connected [OK]", 1:"Bad protocol", 3:"Broker unavailable"}.get(rc, f"Error {rc}")
        print(f"\n[MQTT] {status} -> {BROKER}:{PORT}\n")
    def on_disconnect(c, u, rc):
        print(f"[MQTT] Disconnected (rc={rc})")
    client.on_connect    = on_connect
    client.on_disconnect = on_disconnect
    client.connect(BROKER, PORT, keepalive=60)
    client.loop_start()
    time.sleep(1.5)
    return client

def publish_all(client, data):
    """Publish full packet + individual sensor topics"""
    # Full telemetry
    client.publish(TOPICS["full"], json.dumps(data), qos=1)
    # Individual topics
    for key in ["temperature","vibration","current","resistance",
                "voltage_a","voltage_b","voltage_c","health_score","rul_hours"]:
        if key in data:
            client.publish(TOPICS[key], json.dumps({
                "value"    : data[key],
                "timestamp": data.get("timestamp",""),
                "source"   : data.get("source",""),
            }), qos=1)
    # Console
    h = data.get("health_score", 100)
    p = data.get("phase","HEALTHY")
    icons = {"HEALTHY":"[OK]","WARNING":"[!!]","CRITICAL":"[!!]","FAILURE":"[XX]"}
    print(f"  Cycle {data.get('cycle','?'):>5} | Health {h:>5.1f}% | "
          f"Temp {data.get('temperature',0):>6.1f}C | "
          f"Vib {data.get('vibration',0):>7.4f} | {icons.get(p,'[?]')} {p}")


# ═══════════════════════════════════════════════════════════
#  MODE 1 — DATASET REPLAY (Real NASA/Azure data row by row)
# ═══════════════════════════════════════════════════════════

def run_dataset_replay(interval=1.5):
    """
    Reads the generated dataset CSVs row by row and publishes
    them as if they are live sensor readings.
    
    To use REAL NASA data:
    1. Download from: https://ti.arc.nasa.gov/tech/dash/groups/pcoe/prognostic-data-repository/
    2. Place CSV in data/ folder
    3. Update the column mapping below
    """
    data_file = os.path.join(MAINTENANCE_DATA_DIR, 'nasa_bearing_rul.csv')
    if not os.path.exists(data_file):
        print(f"[WARN] Dataset not found: {data_file}")
        print("       Run scripts/train_maintenance_models.py to regenerate datasets")
        print("       Falling back to simulation mode...\n")
        run_simulation(interval)
        return

    print(f"\n[DATA] Replaying dataset: {data_file}")
    print(f"[DATA] Publishing 1 row every {interval}s (real historical data)\n")
    print(f"{'='*60}")
    print(f"  {'CYCLE':<8} {'HEALTH':>8} {'TEMP':>8} {'VIB':>10} {'PHASE'}")
    print(f"{'='*60}")

    client = make_client()
    cycle  = 0

    try:
        while True:  # Loop dataset for continuous demo
            with open(data_file, newline='', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    cycle += 1
                    wear = float(row.get("wear_pct", 0))
                    rul  = float(row.get("rul", 999))
                    temp = float(row.get("temperature", 45))
                    vib  = float(row.get("vibration_rms", 0.5))
                    res  = float(row.get("resistance", 0.02))
                    phase = row.get("phase", "HEALTHY")

                    # Map NASA bearing signals to power plant brush signals
                    health = max(0, 100 - wear)
                    data = {
                        "cycle"       : cycle,
                        "timestamp"   : datetime.utcnow().isoformat() + "Z",
                        "source"      : "NASA_IMS_BEARING_REPLAY",
                        "temperature" : round(temp, 2),
                        "vibration"   : round(vib, 4),
                        "current"     : round(120 + (wear/100)*30 + random.uniform(-2,2), 2),
                        "resistance"  : round(res, 5),
                        "voltage_a"   : round(11000 * (1 if wear < 90 else 0.7 + random.uniform(-0.05,0.05)), 1),
                        "voltage_b"   : round(11000 * (1 if wear < 95 else 0.75), 1),
                        "voltage_c"   : round(11000, 1),
                        "health_score": round(health, 1),
                        "rul_hours"   : round(rul * 0.1, 1),
                        "wear_pct"    : round(wear, 2),
                        "phase"       : phase,
                        "alert_level" : phase,
                    }

                    # Publish cascade event at failure
                    if phase in ["CRITICAL", "FAILURE"] and wear > 90:
                        step = int((wear - 90) / 2)
                        cascade_steps = [
                            "Brush contact resistance spiked",
                            "Excitation current dropped 25%",
                            "Generator output voltage dropping",
                            "Phase A undervoltage detected",
                            "Feeder relay tripped",
                        ]
                        if step < len(cascade_steps):
                            client.publish(TOPICS["cascade"], json.dumps({
                                "step"       : step + 1,
                                "event"      : cascade_steps[step],
                                "component"  : ["BRUSH","EXCITATION","GENERATOR","GRID_PHASE_A","RELAY"][step],
                                "severity"   : "CRITICAL" if step < 3 else "BLACKOUT",
                                "failure_mode": "BRUSH_WEAR_THERMAL",
                                "timestamp"  : datetime.utcnow().isoformat() + "Z",
                                "cascade_step": step + 1,
                            }), qos=2, retain=True)

                    publish_all(client, data)
                    time.sleep(interval)

            print("\n[LOOP] Dataset complete. Replaying from beginning...\n")
            cycle = 0

    except KeyboardInterrupt:
        print("\n[STOP] Publisher stopped")
    finally:
        client.loop_stop()
        client.disconnect()


# ═══════════════════════════════════════════════════════════
#  MODE 2 — LIVE WEATHER (Real environmental data via API)
# ═══════════════════════════════════════════════════════════

def fetch_weather():
    """
    Fetch real weather data from OpenWeatherMap API.
    Temperature + Humidity + Pressure → affects power plant output.
    """
    if OWM_API_KEY == "654c2edd5d1b1ed3d37151e92e698c34":
        return None
    try:
        url = (f"https://api.openweathermap.org/data/2.5/weather"
               f"?q={OWM_CITY}&appid={OWM_API_KEY}&units=metric")
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read())
        return {
            "city"        : data["name"],
            "temperature" : data["main"]["temp"],
            "humidity"    : data["main"]["humidity"],
            "pressure"    : data["main"]["pressure"],
            "wind_speed"  : data["wind"]["speed"],
            "description" : data["weather"][0]["description"],
            "timestamp"   : datetime.utcnow().isoformat() + "Z",
        }
    except Exception as e:
        print(f"[WARN] Weather API error: {e}")
        return None

def weather_to_brush_stress(weather):
    """
    UCI Power Plant model:
    High temp + high humidity = more brush stress
    """
    if not weather:
        return 0
    temp  = weather.get("temperature", 25)
    humid = weather.get("humidity", 50)
    # Stress increases with heat + humidity
    stress = (temp / 45 * 0.5) + (humid / 100 * 0.5)
    return round(min(1.0, stress), 3)

def run_live_weather(interval=60):
    """
    Publishes real environmental data + derived brush stress.
    Combines real weather with simulated degradation.
    """
    if OWM_API_KEY == "654c2edd5d1b1ed3d37151e92e698c34":
        print("\n[WARN] No OpenWeatherMap API key set!")
        print("       Get free key at: https://openweathermap.org/api")
        print("       Set OWM_API_KEY in this file")
        print("       Falling back to dataset replay...\n")
        run_dataset_replay()
        return

    print(f"\n[LIVE] Fetching real weather for: {OWM_CITY}")
    print(f"[LIVE] Publishing every {interval} seconds\n")

    client = make_client()
    sim    = __import__('mqtt_publisher').BrushDegradationSimulator()
    cycle  = 0

    try:
        while True:
            cycle += 1
            sim.step()

            # Get real weather
            weather = fetch_weather()
            stress  = weather_to_brush_stress(weather)

            # Publish real weather
            if weather:
                client.publish(TOPICS["weather"], json.dumps(weather), qos=1)
                print(f"  [WEATHER] {weather['city']}: {weather['temperature']}C, "
                      f"{weather['humidity']}% humidity, {weather['description']}")

            # Combine simulated sensors with real environmental stress
            sensor_data = sim.get_sensor_readings()
            sensor_data["brush_stress"]  = stress
            sensor_data["source"]        = f"REAL_WEATHER_{OWM_CITY}+SIM"
            sensor_data["env_temp"]      = weather.get("temperature") if weather else None
            sensor_data["env_humidity"]  = weather.get("humidity") if weather else None

            publish_all(client, sensor_data)
            time.sleep(interval)

    except KeyboardInterrupt:
        print("\n[STOP] Publisher stopped")
    finally:
        client.loop_stop()
        client.disconnect()


# ═══════════════════════════════════════════════════════════
#  MODE 3 — SIMULATION (Original mathematical model)
# ═══════════════════════════════════════════════════════════

def run_simulation(interval=2.0):
    """Original simulation mode — mathematical degradation model"""
    import importlib
    # Resolve the sibling simulator by path so this mode works from any CWD.
    if SCRIPT_DIR not in sys.path:
        sys.path.insert(0, SCRIPT_DIR)
    pub = importlib.import_module('mqtt_publisher') if os.path.exists(
        os.path.join(SCRIPT_DIR, 'mqtt_publisher.py')) else None

    if pub is None:
        print("[ERR] mqtt_publisher.py not found")
        return

    print("\n[SIM] Running mathematical degradation simulation\n")
    sim    = pub.BrushDegradationSimulator()
    client = make_client()
    print(f"{'='*60}")
    print(f"  {'CYCLE':<8} {'HEALTH':>8} {'TEMP':>8} {'VIB':>10} {'PHASE'}")
    print(f"{'='*60}")

    try:
        while True:
            sim.step()
            data = sim.get_sensor_readings()
            data["source"] = "MATHEMATICAL_SIM_NASA_PATTERN"

            cascade = sim.get_cascade_event()
            if cascade:
                client.publish(TOPICS["cascade"], json.dumps(cascade), qos=2, retain=True)
                print(f"\n  [CASCADE] Step {cascade['step']}: {cascade['event']}")

            publish_all(client, data)

            if data["wear_pct"] >= 100 and sim.cascade_step >= 10:
                print("\n[RESET] Full lifecycle done. Restarting...\n")
                time.sleep(5)
                sim = pub.BrushDegradationSimulator()

            time.sleep(interval)

    except KeyboardInterrupt:
        print("\n[STOP] Simulation stopped")
    finally:
        client.loop_stop()
        client.disconnect()


# ═══════════════════════════════════════════════════════════
#  MAIN — Choose your data mode
# ═══════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 60)
    print("  POWER PLANT DATA PUBLISHER")
    print("  Broker: broker.hivemq.com:1883")
    print("=" * 60)
    print("\n  Choose data source:")
    print("  [1] Dataset Replay  — Real historical NASA/Azure data")
    print("  [2] Live Weather    — Real weather + simulated sensors")
    print("  [3] Simulation      — Mathematical degradation model")
    print("\n  (Auto-selecting Dataset Replay in 5 seconds...)\n")

    import sys
    choice = None

    def wait_for_input():
        global choice
        choice = input("  Your choice (1/2/3): ").strip()

    t = threading.Thread(target=wait_for_input, daemon=True)
    t.start()
    t.join(timeout=5)

    if choice == "2":
        run_live_weather(interval=60)
    elif choice == "3":
        run_simulation(interval=2.0)
    else:
        # Default: Dataset Replay
        run_dataset_replay(interval=1.0)
