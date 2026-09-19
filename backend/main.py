"""Compatibility entry point for the GridSense FastAPI application.

The application implementation is kept in ``backend.api.main``; exposing it
here preserves the documented Uvicorn command and existing test imports.
"""

from backend.api.main import app

