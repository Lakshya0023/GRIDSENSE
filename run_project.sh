#!/usr/bin/env bash
# GridSense Universal Launcher (macOS / Linux / WSL / Git Bash)
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=================================================="
echo "    Starting GridSense AI (Auto-Setup & Launch)   "
echo "=================================================="

# ── 1. Check System Prerequisites ───────────────────────────
PYTHON_CMD=""
if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
elif command -v python &>/dev/null; then
    PYTHON_CMD="python"
else
    echo "❌ Error: Python 3 is not installed or not in PATH."
    echo "Please install Python 3.10+ from https://www.python.org/downloads/"
    exit 1
fi

if ! command -v npm &>/dev/null; then
    echo "❌ Error: Node.js / npm is not installed or not in PATH."
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# ── 2. Free up Ports 8000 and 3000 if occupied ─────────────
echo "⚡ Checking and freeing ports 8000 and 3000..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 1

# ── 3. Setup Python Virtual Environment & Packages ─────────
VENV_DIR="venv"
if [ ! -d "$VENV_DIR" ] || [ ! -f "$VENV_DIR/bin/python" ]; then
    echo "📦 Creating Python virtual environment in ./venv ..."
    $PYTHON_CMD -m venv "$VENV_DIR"
    echo "📦 Installing required Python packages (this may take a minute on first run)..."
    ./$VENV_DIR/bin/pip install --upgrade pip
    ./$VENV_DIR/bin/pip install -r requirements.txt
else
    # Verify key packages exist in venv
    if ! ./$VENV_DIR/bin/python -c "import fastapi, torch, uvicorn, pandapower" &>/dev/null; then
        echo "📦 Installing missing Python dependencies..."
        ./$VENV_DIR/bin/pip install -r requirements.txt
    fi
fi

# ── 4. Setup Frontend Packages ──────────────────────────────
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend npm dependencies..."
    (cd frontend && npm install)
fi

# ── 5. Cleanup Handler ──────────────────────────────────────
cleanup() {
    echo ""
    echo "🛑 Shutting down GridSense servers..."
    kill $(jobs -p) 2>/dev/null || true
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    echo "Done."
}
trap cleanup SIGINT SIGTERM EXIT

# ── 6. Start Backend & Frontend ─────────────────────────────
echo ""
echo "🚀 [1/2] Launching Backend on http://localhost:8000 ..."
./venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload &

echo "🚀 [2/2] Launching Frontend on http://localhost:3000 ..."
(cd frontend && npm run dev -- --port 3000) &

echo ""
echo "=================================================="
echo "  ✅ GridSense is live!"
echo "  🌐 Frontend UI:  http://localhost:3000"
echo "  📖 API Docs:     http://localhost:8000/docs"
echo "=================================================="
echo "Press Ctrl+C at any time to stop all servers."
echo ""

wait
