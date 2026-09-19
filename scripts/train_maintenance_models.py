"""
=============================================================
  POWER PLANT BRUSH WEAR -- ML PREDICTION MODELS
  
  Uses patterns from:
  - NASA PCoE Bearing Data  → RUL Model (LSTM-equivalent via GRU)
  - Azure Predictive Maint. → Anomaly Detection
  - Electrical Fault Data   → Grid Cascade Classifier
  - UCI Power Plant         → Environmental Pattern Model
  
  Since datasets may not be downloaded yet, this generates
  synthetic training data matching the exact statistical
  patterns from each dataset.
=============================================================
"""

import numpy as np
import pandas as pd
import json
import os
import joblib
import warnings
warnings.filterwarnings('ignore')

from sklearn.ensemble import RandomForestClassifier, IsolationForest, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, mean_absolute_error
from xgboost import XGBClassifier
from datetime import datetime, timedelta

# Absolute paths into the merged GridSense layout. The standalone service used
# bare relative paths, so it only worked when launched from its own folder.
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, os.pardir))
MODELS_DIR = os.path.join(PROJECT_DIR, 'backend', 'ml', 'trained_models', 'maintenance')
DATA_DIR = os.path.join(PROJECT_DIR, 'backend', 'ml', 'datasets', 'maintenance')
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

print("=" * 60)
print("  POWER PLANT PREDICTIVE MAINTENANCE -- ML TRAINING")
print("=" * 60)


# ═══════════════════════════════════════════════════════════
#  DATASET GENERATOR
#  Generates data matching NASA/Azure/UCI statistical patterns
# ═══════════════════════════════════════════════════════════

class DatasetGenerator:
    """
    Generates synthetic training data that mirrors the statistical
    distributions of the real datasets. Replace generate_* methods
    with actual CSV loading once datasets are downloaded.
    """

    @staticmethod
    def generate_nasa_bearing_rul(n_machines=20, cycles_per_machine=500):
        """
        Mirrors NASA IMS Bearing Dataset (Run-to-Failure)
        4 bearings: vibration (rms) + temperature
        Full lifecycle: 0 → failure
        """
        print("\n[1/4] Generating NASA Bearing RUL dataset...")
        records = []
        for machine_id in range(n_machines):
            total_cycles = random.randint(300, cycles_per_machine)
            for cycle in range(total_cycles):
                wear = cycle / total_cycles
                rul  = total_cycles - cycle  # Remaining Useful Life

                # Exponential degradation (NASA pattern)
                deg = np.exp(3 * wear) / np.exp(3)

                # Vibration: 0.3 → 8+ mm/s at failure
                vib_rms = 0.3 + deg * 8.0 + np.random.normal(0, 0.1)

                # Temperature: 40 → 95°C
                temp = 40 + deg * 55 + np.random.normal(0, 1.5)

                # Kurtosis (impulsiveness - rises before failure)
                kurtosis = 3.0 + (deg ** 2) * 20 + np.random.normal(0, 0.5)

                # RMS (acceleration)
                rms_accel = 0.2 + deg * 5.0 + np.random.normal(0, 0.05)

                # Contact resistance (brush specific)
                resistance = 0.02 + deg * 0.5 + np.random.normal(0, 0.005)

                records.append({
                    "machine_id"   : machine_id,
                    "cycle"        : cycle,
                    "rul"          : rul,
                    "wear_pct"     : wear * 100,
                    "vibration_rms": max(0, vib_rms),
                    "temperature"  : max(20, temp),
                    "kurtosis"     : max(3, kurtosis),
                    "rms_accel"    : max(0, rms_accel),
                    "resistance"   : max(0.01, resistance),
                    "phase"        : ("HEALTHY" if wear < 0.6 else
                                      "WARNING" if wear < 0.8 else
                                      "CRITICAL" if wear < 0.95 else "FAILURE"),
                })

        df = pd.DataFrame(records)
        print(f"   [OK] {len(df)} records | RUL range: 0-{df['rul'].max()} cycles")
        return df

    @staticmethod
    def generate_azure_telemetry(n_machines=100, days=90):
        """
        Mirrors Azure Predictive Maintenance Dataset
        Columns: telemetry (volt, rotate, pressure, vibration),
                 errors, failures
        """
        print("\n[2/4] Generating Azure Predictive Maintenance dataset...")
        records = []
        failure_types = ["comp1", "comp2", "comp3", "comp4", "none"]

        for machine_id in range(n_machines):
            age_years = np.random.uniform(0, 20)
            # Failure probability increases with age
            fail_prob = 0.003 * (1 + age_years / 10)

            for day in range(days):
                # Voltage: 160-185 V normal, drops before failure
                volt = np.random.normal(170, 5)

                # Rotate: 400-500 rpm
                rotate = np.random.normal(450, 20)

                # Pressure: 95-105
                pressure = np.random.normal(100, 3)

                # Vibration
                vibration = np.random.normal(40, 8)

                # Failure this day?
                failure_today = np.random.random() < fail_prob
                failure_type = np.random.choice(failure_types[:-1]) if failure_today else "none"

                # Sensor anomaly 24-48 hrs before failure
                if failure_today:
                    volt     -= np.random.uniform(15, 30)
                    rotate   -= np.random.uniform(50, 100)
                    pressure += np.random.uniform(10, 20)
                    vibration += np.random.uniform(20, 40)

                records.append({
                    "machine_id"  : machine_id,
                    "day"         : day,
                    "age_years"   : round(age_years, 1),
                    "volt"        : round(max(100, volt), 2),
                    "rotate"      : round(max(200, rotate), 2),
                    "pressure"    : round(pressure, 2),
                    "vibration"   : round(max(0, vibration), 2),
                    "failure_type": failure_type,
                    "has_failure" : 1 if failure_today else 0,
                })

        df = pd.DataFrame(records)
        failure_rate = df["has_failure"].mean() * 100
        print(f"   [OK] {len(df)} records | Failure rate: {failure_rate:.2f}%")
        return df

    @staticmethod
    def generate_electrical_fault(n_samples=10000):
        """
        Mirrors Electrical Fault Detection Dataset
        3-phase voltage + current → fault classification
        """
        print("\n[3/4] Generating Electrical Fault Detection dataset...")
        records = []
        fault_types = {
            "LG"   : "Line-to-Ground",
            "LL"   : "Line-to-Line",
            "LLG"  : "Double Line-to-Ground",
            "LLL"  : "Three-Phase",
            "LLLG" : "Three-Phase-to-Ground",
            "NO"   : "No Fault",
        }
        # Fault cascade severity mapping
        cascade_impacts = {
            "NO"   : 0,   # No impact
            "LG"   : 1,   # Single phase affected
            "LL"   : 2,   # Two phases affected
            "LLG"  : 3,   # Two phases + ground
            "LLL"  : 4,   # Full 3-phase -- major outage
            "LLLG" : 5,   # Full 3-phase + ground -- grid blackout
        }

        for _ in range(n_samples):
            fault = np.random.choice(list(fault_types.keys()),
                                     p=[0.1, 0.15, 0.15, 0.2, 0.1, 0.3])

            # Normal voltages (11kV line = 11000V)
            Va = 11000 * np.sin(0) + np.random.normal(0, 50)
            Vb = 11000 * np.sin(2*np.pi/3) + np.random.normal(0, 50)
            Vc = 11000 * np.sin(4*np.pi/3) + np.random.normal(0, 50)
            Ia = 500 + np.random.normal(0, 20)
            Ib = 500 + np.random.normal(0, 20)
            Ic = 500 + np.random.normal(0, 20)

            # Apply fault effects
            if fault == "LG":
                Va *= 0.1; Ia *= 5
            elif fault == "LL":
                Va *= 0.3; Vb *= 0.3; Ia *= 4; Ib *= 4
            elif fault == "LLG":
                Va *= 0.1; Vb *= 0.1; Ia *= 6; Ib *= 5
            elif fault == "LLL":
                Va *= 0.05; Vb *= 0.05; Vc *= 0.05
                Ia *= 8; Ib *= 8; Ic *= 8
            elif fault == "LLLG":
                Va *= 0.01; Vb *= 0.01; Vc *= 0.01
                Ia *= 10; Ib *= 10; Ic *= 10

            records.append({
                "Va": round(Va, 1), "Vb": round(Vb, 1), "Vc": round(Vc, 1),
                "Ia": round(Ia, 1), "Ib": round(Ib, 1), "Ic": round(Ic, 1),
                "fault_type"      : fault,
                "cascade_severity": cascade_impacts[fault],
                "sections_affected": cascade_impacts[fault],
                "blackout_risk"   : 1 if cascade_impacts[fault] >= 4 else 0,
            })

        df = pd.DataFrame(records)
        print(f"   [OK] {len(df)} records | Fault distribution:")
        print(df["fault_type"].value_counts().to_string(header=False))
        return df

    @staticmethod
    def generate_uci_power_plant(n_samples=10000):
        """
        Mirrors UCI Combined Cycle Power Plant Dataset
        Temperature, Vacuum, Pressure, Humidity → Power Output
        6 years of data
        """
        print("\n[4/4] Generating UCI Power Plant dataset...")
        records = []
        for _ in range(n_samples):
            # Environmental conditions
            temp     = np.random.uniform(1.8, 37.1)   # °C
            vacuum   = np.random.uniform(25.4, 81.6)  # cmHg
            pressure = np.random.uniform(992, 1033)   # mbar
            humidity = np.random.uniform(25.6, 100.2) # %

            # Power output (MW) -- decreases with temp/humidity
            # Based on UCI regression formula
            power = (480 
                     - 1.97 * temp
                     - 0.23 * vacuum
                     + 0.06 * pressure
                     - 0.16 * humidity
                     + np.random.normal(0, 4))

            # Brush stress risk -- higher temp + humidity = more wear
            stress = (temp / 37 * 0.4 + humidity / 100 * 0.4 +
                      (1 - (power - 420) / 100) * 0.2)
            stress = max(0, min(1, stress))

            records.append({
                "temperature" : round(temp, 1),
                "vacuum"      : round(vacuum, 1),
                "pressure"    : round(pressure, 2),
                "humidity"    : round(humidity, 1),
                "power_output": round(power, 2),
                "brush_stress": round(stress, 3),
                "high_stress" : 1 if stress > 0.6 else 0,
            })

        df = pd.DataFrame(records)
        print(f"   [OK] {len(df)} records | Power range: {df['power_output'].min():.0f}-{df['power_output'].max():.0f} MW")
        return df


# ═══════════════════════════════════════════════════════════
#  MODEL 1: RUL PREDICTOR (NASA Pattern)
# ═══════════════════════════════════════════════════════════

def train_rul_model(df_nasa):
    """
    Gradient Boosting Regressor for Remaining Useful Life
    Input:  vibration_rms, temperature, kurtosis, rms_accel, resistance
    Output: RUL in cycles (convertible to hours)
    """
    print("\n" + "─"*55)
    print("  Training MODEL 1: RUL Predictor (NASA Bearing)")
    print("─"*55)

    features = ["vibration_rms", "temperature", "kurtosis", "rms_accel", "resistance"]
    X = df_nasa[features]
    y = df_nasa["rul"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s  = scaler.transform(X_test)

    model = GradientBoostingRegressor(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.1,
        random_state=42
    )
    model.fit(X_train_s, y_train)

    preds = model.predict(X_test_s)
    mae = mean_absolute_error(y_test, preds)
    print(f"   MAE: {mae:.1f} cycles  |  Feature importances:")
    for feat, imp in sorted(zip(features, model.feature_importances_), key=lambda x: -x[1]):
        bar = "█" * int(imp * 40)
        print(f"   {feat:<20} {bar} {imp:.3f}")

    # Save model
    joblib.dump(model,  f"{MODELS_DIR}/rul_model.pkl")
    joblib.dump(scaler, f"{MODELS_DIR}/rul_scaler.pkl")
    print(f"   [OK] Saved: models/rul_model.pkl")
    return model, scaler, features


# ═══════════════════════════════════════════════════════════
#  MODEL 2: ANOMALY DETECTOR (Azure Pattern)
# ═══════════════════════════════════════════════════════════

def train_anomaly_model(df_azure):
    """
    Isolation Forest for anomaly detection +
    Random Forest for failure type classification
    Input:  volt, rotate, pressure, vibration
    Output: health_score (0-100), anomaly flag, failure type
    """
    print("\n" + "─"*55)
    print("  Training MODEL 2: Anomaly Detector (Azure Data)")
    print("─"*55)

    features = ["volt", "rotate", "pressure", "vibration", "age_years"]
    X = df_azure[features]
    y = df_azure["has_failure"]

    # Isolation Forest -- unsupervised anomaly detection
    iso = IsolationForest(contamination=0.05, random_state=42, n_estimators=100)
    iso.fit(X[y == 0])  # Train on normal data only

    # Random Forest -- failure type classifier
    le = LabelEncoder()
    y_type = le.fit_transform(df_azure["failure_type"])

    X_train, X_test, y_train, y_test = train_test_split(X, y_type, test_size=0.2, random_state=42)
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s  = scaler.transform(X_test)

    rf = RandomForestClassifier(n_estimators=100, random_state=42, class_weight="balanced")
    rf.fit(X_train_s, y_train)

    preds = rf.predict(X_test_s)
    print(f"\n{classification_report(y_test, preds, target_names=le.classes_, zero_division=0)}")

    joblib.dump(iso,     f"{MODELS_DIR}/anomaly_iso.pkl")
    joblib.dump(rf,      f"{MODELS_DIR}/anomaly_rf.pkl")
    joblib.dump(scaler,  f"{MODELS_DIR}/anomaly_scaler.pkl")
    joblib.dump(le,      f"{MODELS_DIR}/anomaly_le.pkl")
    print(f"   [OK] Saved: models/anomaly_*.pkl")
    return iso, rf, scaler, le, features


# ═══════════════════════════════════════════════════════════
#  MODEL 3: FAULT CASCADE PREDICTOR (Electrical Data)
# ═══════════════════════════════════════════════════════════

def train_cascade_model(df_elec):
    """
    XGBoost for fault type classification and blackout risk
    Input:  Va, Vb, Vc, Ia, Ib, Ic
    Output: fault_type, cascade_severity, blackout_risk
    """
    print("\n" + "─"*55)
    print("  Training MODEL 3: Fault Cascade Predictor")
    print("─"*55)

    features = ["Va", "Vb", "Vc", "Ia", "Ib", "Ic"]
    X = df_elec[features]

    # Fault type classifier
    le_fault = LabelEncoder()
    y_fault  = le_fault.fit_transform(df_elec["fault_type"])

    # Blackout risk classifier
    y_blackout = df_elec["blackout_risk"]

    scaler = StandardScaler()
    X_s = scaler.fit_transform(X)

    X_train, X_test, y_train, y_test = train_test_split(X_s, y_fault, test_size=0.2, random_state=42)

    # XGBoost fault classifier
    xgb_fault = XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        use_label_encoder=False,
        eval_metric="mlogloss",
        random_state=42,
        verbosity=0
    )
    xgb_fault.fit(X_train, y_train)

    preds = xgb_fault.predict(X_test)
    print(f"\n{classification_report(y_test, preds, target_names=le_fault.classes_, zero_division=0)}")

    # XGBoost blackout classifier
    X_train2, X_test2, y_train2, y_test2 = train_test_split(X_s, y_blackout, test_size=0.2, random_state=42)
    xgb_blackout = XGBClassifier(n_estimators=100, max_depth=4, verbosity=0, random_state=42)
    xgb_blackout.fit(X_train2, y_train2)
    blackout_acc = (xgb_blackout.predict(X_test2) == y_test2).mean()
    print(f"   Blackout Risk Accuracy: {blackout_acc:.1%}")

    joblib.dump(xgb_fault,    f"{MODELS_DIR}/cascade_fault.pkl")
    joblib.dump(xgb_blackout, f"{MODELS_DIR}/cascade_blackout.pkl")
    joblib.dump(scaler,       f"{MODELS_DIR}/cascade_scaler.pkl")
    joblib.dump(le_fault,     f"{MODELS_DIR}/cascade_le.pkl")
    print(f"   [OK] Saved: models/cascade_*.pkl")
    return xgb_fault, xgb_blackout, scaler, le_fault, features


# ═══════════════════════════════════════════════════════════
#  PREDICTION ENGINE -- Used by live system
# NOTE: the runtime inference engine that used to live here has moved to
#   backend/ml/maintenance/engine.py  ->  MaintenancePredictionEngine
# so the FastAPI server and the MQTT subscriber share one implementation.
# This file is now training-only.

# ═══════════════════════════════════════════════════════════
#  MAIN -- Train all models
# ═══════════════════════════════════════════════════════════

import random  # needed inside generator

if __name__ == "__main__":
    gen = DatasetGenerator()

    # Generate training data
    df_nasa  = gen.generate_nasa_bearing_rul(n_machines=30, cycles_per_machine=600)
    df_azure = gen.generate_azure_telemetry(n_machines=150, days=120)
    df_elec  = gen.generate_electrical_fault(n_samples=15000)
    df_uci   = gen.generate_uci_power_plant(n_samples=10000)

    # Save raw datasets
    df_nasa.to_csv(os.path.join(DATA_DIR, 'nasa_bearing_rul.csv'),     index=False)
    df_azure.to_csv(os.path.join(DATA_DIR, 'azure_predictive.csv'),    index=False)
    df_elec.to_csv(os.path.join(DATA_DIR, 'electrical_fault.csv'),     index=False)
    df_uci.to_csv(os.path.join(DATA_DIR, 'uci_power_plant.csv'),       index=False)
    print("\n[SAVE] Datasets saved to data/ folder")

    # Train models
    train_rul_model(df_nasa)
    train_anomaly_model(df_azure)
    train_cascade_model(df_elec)

    print("\n" + "="*55)
    print("  [OK] ALL MODELS TRAINED & SAVED")
    print("="*55)

    # Quick demo prediction
    print("\n[DATA] SAMPLE PREDICTION (simulated sensor reading):")
    engine = PredictionEngine()
    sample = {
        "temperature": 82.5,
        "vibration"  : 3.2,
        "current"    : 145,
        "resistance" : 0.18,
        "voltage_a"  : 9800,
        "voltage_b"  : 10200,
        "voltage_c"  : 10900,
    }
    result = engine.full_prediction(sample)
    print(json.dumps(result, indent=2))
