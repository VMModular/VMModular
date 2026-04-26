#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# VM CRM — One-Shot Setup Script
# Usage: ./setup.sh [--reset]
#   --reset   Drop all data, re-migrate and re-seed
# ─────────────────────────────────────────────────────────────
set -euo pipefail

RESET=false
for arg in "$@"; do
  [[ "$arg" == "--reset" ]] && RESET=true
done

# Colour helpers
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── 0. Prerequisites ─────────────────────────────────────────
info "Checking prerequisites …"
command -v docker  >/dev/null 2>&1 || error "docker not found — please install Docker Desktop"
command -v docker compose version >/dev/null 2>&1 || error "docker compose (v2) not found"

# ── 1. Copy .env if missing ───────────────────────────────────
if [[ ! -f backend/.env ]]; then
  info "Creating backend/.env from .env.example …"
  cp backend/.env.example backend/.env
fi

# Ensure JWT_SECRET is present and at least 32 chars
if grep -q "JWT_SECRET=" backend/.env; then
  CURRENT_SECRET=$(grep "JWT_SECRET=" backend/.env | cut -d '=' -f2)
  if [[ ${#CURRENT_SECRET} -lt 32 || "$CURRENT_SECRET" == "your-jwt-secret-change-this-in-production" || -z "$CURRENT_SECRET" ]]; then
    warn "JWT_SECRET is too short, default, or empty. Generating a new 32-char secret …"
    # Use /dev/urandom (macOS/Linux compatible)
    RANDOM_SECRET=$(LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom 2>/dev/null | head -c 32 || openssl rand -hex 16 2>/dev/null || echo "vmcrm-super-secret-key-32-chars-long-fallback")
    
    # Use a temp file for sed to be safe across different sed versions
    sed "s/JWT_SECRET=.*/JWT_SECRET=$RANDOM_SECRET/" backend/.env > backend/.env.tmp && mv backend/.env.tmp backend/.env
    success "JWT_SECRET updated in backend/.env"
  fi
fi

# ── 2. Reset (optional) ───────────────────────────────────────
if $RESET; then
  warn "RESET flag detected — removing all volumes (this deletes the database) …"
  docker compose down -v --remove-orphans || true
  rm -rf backend/data/*.db* || true
  info "Data cleared."
fi

# ── 3. Start Infrastructure ──────────────────────────────────
info "Starting Docker services …"
docker compose up -d --build

# ── 4. Wait for Backend ──────────────────────────────────────
info "Waiting for backend to be healthy …"
ATTEMPTS=0
MAX_ATTEMPTS=30
until curl --output /dev/null --silent --head --fail http://localhost/health; do
    if [ ${ATTEMPTS} -eq ${MAX_ATTEMPTS} ];then
      error "Backend failed to start in time."
    fi
    printf '.'
    ATTEMPTS=$((ATTEMPTS+1))
    sleep 2
done
echo ""
success "Backend is UP"

# ── 5. Run Migrations & Seeds ─────────────────────────────────
info "Running database migrations …"
docker compose exec backend npm run migrate
success "Migrations completed"

info "Running database seeds …"
docker compose exec backend npm run seed
success "Seeding completed"

# ── 6. Summary ───────────────────────────────────────────────
echo ""
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo -e "${GREEN}        VM CRM — Setup Complete!${NC}"
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo -e "  ${CYAN}Frontend UI${NC}  → http://localhost"
echo -e "  ${CYAN}GraphQL API${NC}  → http://localhost/graphql"
echo -e "  ${CYAN}Health Check${NC} → http://localhost/health"
echo ""
echo -e "  ${YELLOW}Default Login Credentials:${NC}"
echo -e "  Owner:   owner@moducraft.com"
echo -e "  Manager: sm1@moducraft.com"
echo ""
echo -e "  ${CYAN}Logs:${NC} docker compose logs -f"
echo -e "  ${CYAN}Stop:${NC} docker compose down"
echo -e "${GREEN}══════════════════════════════════════════${NC}"
