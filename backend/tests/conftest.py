"""
Shared pytest setup for the GridSense backend suite.

The merged predictive-maintenance router starts a background MQTT subscriber
during app startup. Tests must stay deterministic and must not reach the public
HiveMQ broker, so the subscriber is disabled here.

This has to happen in conftest rather than in an individual test module:
`backend.api.maintenance` reads MQTT_ENABLED at import time, and the first test
module to import the app wins. pytest loads conftest.py before any test module.
"""

import os

os.environ.setdefault("MQTT_ENABLED", "0")
