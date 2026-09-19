# GridSense — Launch Script for Windows (PowerShell)
# Automatically checks & installs all required Python and Node.js dependencies before launching.

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ROOT

Write-Host ""
Write-Host "  ┌─────────────────────────────────────────┐" -ForegroundColor Cyan
Write-Host "  │    GridSense — Predict • Explain • Act   │" -ForegroundColor Cyan
Write-Host "  │    Auto-Setup & Launcher                │" -ForegroundColor Cyan
Write-Host "  └─────────────────────────────────────────┘" -ForegroundColor Cyan
Write-Host ""

# ─── 1. Locate Python & Node.js ─────────────────────────────────────────
$PYTHON_SYS = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $PYTHON_SYS) {
    $PYTHON_SYS = (Get-Command py -ErrorAction SilentlyContinue).Source
}

if (-not $PYTHON_SYS) {
    Write-Host "❌ Error: Python is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install Python 3.10+ from https://www.python.org/downloads/ (check 'Add Python to PATH')" -ForegroundColor Yellow
    pause
    exit 1
}

$NPM_CMD = (Get-Command npm -ErrorAction SilentlyContinue).Source
if (-not $NPM_CMD) {
    $env:Path = "C:\Program Files\nodejs;" + $env:Path
    $NPM_CMD = (Get-Command npm -ErrorAction SilentlyContinue).Source
}

if (-not $NPM_CMD) {
    Write-Host "❌ Error: Node.js / npm is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install Node.js 18+ from https://nodejs.org/" -ForegroundColor Yellow
    pause
    exit 1
}

# ─── 2. Free up Ports 8000 and 3000 if occupied ───────────────────────
Write-Host "⚡ Checking and freeing ports 8000 and 3000..." -ForegroundColor DarkGray
try {
    Get-NetTCPConnection -LocalPort 8000, 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
} catch {}

# ─── 3. Python Virtual Environment & Packages ─────────────────────────
$VENV_DIR = Join-Path $ROOT "venv"
$VENV_PYTHON = Join-Path $VENV_DIR "Scripts\python.exe"
$VENV_PIP = Join-Path $VENV_DIR "Scripts\pip.exe"

if (-not (Test-Path $VENV_PYTHON)) {
    Write-Host "📦 Creating Python virtual environment in .\venv ..." -ForegroundColor Yellow
    & $PYTHON_SYS -m venv $VENV_DIR
    Write-Host "📦 Installing required Python packages (requirements.txt)..." -ForegroundColor Yellow
    & $VENV_PIP install --upgrade pip
    & $VENV_PIP install -r (Join-Path $ROOT "requirements.txt")
} else {
    # Check if packages are installed
    $check = & $VENV_PYTHON -c "import fastapi, torch, uvicorn, pandapower" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "📦 Installing missing Python dependencies..." -ForegroundColor Yellow
        & $VENV_PIP install -r (Join-Path $ROOT "requirements.txt")
    }
}

# ─── 4. Frontend Node Dependencies ────────────────────────────────────
$FRONTEND_DIR = Join-Path $ROOT "frontend"
$FRONTEND_NODE_MODULES = Join-Path $FRONTEND_DIR "node_modules"

if (-not (Test-Path $FRONTEND_NODE_MODULES)) {
    Write-Host "📦 Installing frontend npm dependencies..." -ForegroundColor Yellow
    Push-Location $FRONTEND_DIR
    & cmd.exe /c "npm install"
    Pop-Location
}

# ─── 5. Start Backend & Frontend Jobs ─────────────────────────────────
Write-Host ""
Write-Host "🚀 [1/2] Starting backend (FastAPI) on http://localhost:8000 ..." -ForegroundColor Cyan
$backendJob = Start-Job -ScriptBlock {
    param($pythonExe, $rootPath)
    Set-Location $rootPath
    & $pythonExe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload 2>&1
} -ArgumentList $VENV_PYTHON, $ROOT

Start-Sleep -Seconds 2

Write-Host "🚀 [2/2] Starting frontend (Next.js) on http://localhost:3000 ..." -ForegroundColor Cyan
$frontendJob = Start-Job -ScriptBlock {
    param($frontendPath)
    $env:Path = "C:\Program Files\nodejs;" + $env:Path
    Set-Location $frontendPath
    & cmd.exe /c "npm run dev -- --port 3000" 2>&1
} -ArgumentList $FRONTEND_DIR

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "  ✅ GridSense is live!" -ForegroundColor Green
Write-Host "  🌐 Frontend UI:  http://localhost:3000" -ForegroundColor Green
Write-Host "  📖 API Docs:     http://localhost:8000/docs" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop both servers." -ForegroundColor DarkGray
Write-Host ""

# ─── 6. Tail logs until user presses Ctrl+C ───────────────────────────
try {
    while ($true) {
        Receive-Job -Job $backendJob -ErrorAction SilentlyContinue 2>$null | ForEach-Object { Write-Host "[backend]  $_" -ForegroundColor DarkCyan }
        Receive-Job -Job $frontendJob -ErrorAction SilentlyContinue 2>$null | ForEach-Object { Write-Host "[frontend] $_" -ForegroundColor DarkMagenta }
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host "`n🛑 Shutting down GridSense..." -ForegroundColor Yellow
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job $frontendJob -ErrorAction SilentlyContinue
    Write-Host "Done." -ForegroundColor Green
}
