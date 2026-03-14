#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
DIM='\033[0;90m'
NC='\033[0m'

echo -e "${GREEN}[DS4]${NC} Starting Doomscroll4 dev environment..."

# --- Preflight checks ---

if [ ! -f api/.env ]; then
  echo -e "${RED}[DS4]${NC} api/.env not found. Creating from .env.example..."
  cp api/.env.example api/.env
  echo -e "${RED}[DS4]${NC} ⚠ Fill in ANTHROPIC_API_KEY and API_SECRET in api/.env before classifying posts."
fi

# --- Python venv ---

VENV_DIR="$PROJECT_ROOT/api/.venv"
if [ ! -d "$VENV_DIR" ]; then
  echo -e "${GREEN}[DS4]${NC} Creating Python venv..."
  python3 -m venv "$VENV_DIR"
fi
source "$VENV_DIR/bin/activate"
echo -e "${DIM}[DS4] Using Python: $(python3 --version) (venv)${NC}"

# --- Install dependencies if needed ---

if [ ! -d extension/node_modules ]; then
  echo -e "${GREEN}[DS4]${NC} Installing extension dependencies..."
  (cd extension && npm install)
fi

if ! python3 -c "import fastapi" 2>/dev/null; then
  echo -e "${GREEN}[DS4]${NC} Installing API dependencies..."
  pip install -r api/requirements.txt
fi

# --- Build extension ---

echo -e "${GREEN}[DS4]${NC} Building extension..."
(cd extension && npx webpack --mode production 2>&1 | tail -1)

# --- Kill any existing backend on port 8080 ---

if lsof -i :8080 -sTCP:LISTEN >/dev/null 2>&1; then
  echo -e "${DIM}[DS4]${NC} Killing existing process on port 8080..."
  kill $(lsof -t -i :8080 -sTCP:LISTEN) 2>/dev/null || true
  sleep 1
fi

# --- Start backend ---

echo -e "${GREEN}[DS4]${NC} Starting API server on http://localhost:8080..."
(cd api && python3 -m uvicorn main:app --reload --port 8080 &)
API_PID=$!

# Wait for API to be ready
for i in $(seq 1 15); do
  if curl -s http://localhost:8080/health >/dev/null 2>&1; then
    echo -e "${GREEN}[DS4]${NC} API is live ✓"
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo -e "${RED}[DS4]${NC} API failed to start"
    exit 1
  fi
  sleep 1
done

# --- Open Chrome extensions page ---

echo -e "${GREEN}[DS4]${NC} Opening chrome://extensions..."
open -a "Google Chrome" "chrome://extensions/"

echo ""
echo -e "${GREEN}[DS4]${NC} ✓ Dev environment ready"
echo -e "${DIM}      API:       http://localhost:8080${NC}"
echo -e "${DIM}      Extension: ${PROJECT_ROOT}/extension/dist/${NC}"
echo ""
echo -e "${DIM}      Load the extension: click 'Load unpacked' → select extension/dist/${NC}"
echo -e "${DIM}      Stop: kill %1 (or close this terminal)${NC}"
echo ""

# Keep script alive so background API stays running
wait $API_PID 2>/dev/null
