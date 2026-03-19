#!/bin/bash
# CTG Core — One-Line Client Deployment Script
# Usage: bash <(curl -sL URL) or bash deploy.sh [--dry-run]
#
# Assesses the target machine, installs missing prerequisites,
# and deploys the 4-service CTG Core client stack (connects to CTG Hub via Tailscale).

set -euo pipefail

# ──────────────────────────────────────────────────
# Args
# ──────────────────────────────────────────────────
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
  esac
done

# ──────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────
CTG_DIR="${CTG_DIR:-$HOME/.ctg-core}"
MIN_DOCKER_VERSION="24.0"
MIN_DISK_GB=10
MIN_RAM_GB=4

# ──────────────────────────────────────────────────
# Colors & helpers
# ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

pass()  { echo -e "  ${GREEN}✓${NC} $1"; }
fail()  { echo -e "  ${RED}✗${NC} $1"; }
warn()  { echo -e "  ${YELLOW}!${NC} $1"; }
info()  { echo -e "  ${BLUE}→${NC} $1"; }
header(){ echo -e "\n${BOLD}${CYAN}── $1 ──${NC}\n"; }

# Track what needs installing
MISSING=()
INSTALLED=()
WARNINGS=()

if [ "$DRY_RUN" = "true" ]; then
  echo -e "\n${BOLD}${YELLOW}[DRY RUN MODE — no changes will be made]${NC}\n"
fi

# ──────────────────────────────────────────────────
# OS Detection
# ──────────────────────────────────────────────────
header "System Assessment"

OS="unknown"
PKG_MGR="none"
ARCH=$(uname -m)

case "$(uname -s)" in
  Darwin)
    OS="macos"
    OS_VERSION=$(sw_vers -productVersion 2>/dev/null || echo "unknown")
    if command -v brew &>/dev/null; then
      PKG_MGR="brew"
      pass "macOS $OS_VERSION ($ARCH) — Homebrew found"
    else
      PKG_MGR="none"
      warn "macOS $OS_VERSION ($ARCH) — Homebrew NOT found"
      MISSING+=("homebrew")
    fi
    ;;
  Linux)
    OS="linux"
    if [ -f /etc/os-release ]; then
      OS_VERSION=$(. /etc/os-release && echo "$PRETTY_NAME")
    else
      OS_VERSION="unknown"
    fi
    if command -v apt-get &>/dev/null; then
      PKG_MGR="apt"
    elif command -v dnf &>/dev/null; then
      PKG_MGR="dnf"
    elif command -v yum &>/dev/null; then
      PKG_MGR="yum"
    fi
    pass "$OS_VERSION ($ARCH) — package manager: $PKG_MGR"
    ;;
  *)
    fail "Unsupported OS: $(uname -s)"
    exit 1
    ;;
esac

# ──────────────────────────────────────────────────
# Tailscale Check (required)
# ──────────────────────────────────────────────────
if ! command -v tailscale &>/dev/null; then
  fail "Tailscale is required but not installed"
  echo "  Install: https://tailscale.com/download"
  MISSING+=("tailscale")
fi
if command -v tailscale &>/dev/null; then
  if tailscale status &>/dev/null; then
    pass "Tailscale connected"
    INSTALLED+=("tailscale")
  else
    warn "Tailscale installed but not connected — run: sudo tailscale up"
    WARNINGS+=("tailscale-disconnected")
  fi
fi

# ──────────────────────────────────────────────────
# Hardware Check
# ──────────────────────────────────────────────────
header "Hardware"

# RAM
if [ "$OS" = "macos" ]; then
  RAM_BYTES=$(sysctl -n hw.memsize 2>/dev/null || echo 0)
  RAM_GB=$((RAM_BYTES / 1073741824))
else
  RAM_KB=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo 0)
  RAM_GB=$((RAM_KB / 1048576))
fi

if [ "$RAM_GB" -ge "$MIN_RAM_GB" ]; then
  pass "RAM: ${RAM_GB} GB (minimum: ${MIN_RAM_GB} GB)"
else
  fail "RAM: ${RAM_GB} GB — need at least ${MIN_RAM_GB} GB"
  WARNINGS+=("Low RAM — Docker containers may struggle")
fi

# Disk
if [ "$OS" = "macos" ]; then
  DISK_AVAIL_KB=$(df -k "$HOME" | tail -1 | awk '{print $4}')
else
  DISK_AVAIL_KB=$(df -k "$HOME" | tail -1 | awk '{print $4}')
fi
DISK_AVAIL_GB=$((DISK_AVAIL_KB / 1048576))

if [ "$DISK_AVAIL_GB" -ge "$MIN_DISK_GB" ]; then
  pass "Disk: ${DISK_AVAIL_GB} GB available (minimum: ${MIN_DISK_GB} GB)"
else
  fail "Disk: ${DISK_AVAIL_GB} GB available — need at least ${MIN_DISK_GB} GB"
  WARNINGS+=("Low disk space — Docker images need ~5 GB")
fi

# CPU
if [ "$OS" = "macos" ]; then
  CPU_CORES=$(sysctl -n hw.ncpu 2>/dev/null || echo "?")
  CPU_NAME=$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "Apple Silicon")
else
  CPU_CORES=$(nproc 2>/dev/null || echo "?")
  CPU_NAME=$(grep 'model name' /proc/cpuinfo 2>/dev/null | head -1 | cut -d: -f2 | xargs || echo "unknown")
fi
pass "CPU: ${CPU_NAME} (${CPU_CORES} cores)"

# ──────────────────────────────────────────────────
# Software Prerequisites
# ──────────────────────────────────────────────────
header "Software Prerequisites"

# Docker
if command -v docker &>/dev/null; then
  DOCKER_VER=$(docker --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "0.0.0")
  if docker info &>/dev/null 2>&1; then
    pass "Docker $DOCKER_VER (daemon running)"
    INSTALLED+=("docker")
  else
    warn "Docker $DOCKER_VER installed but daemon NOT running"
    MISSING+=("docker-start")
  fi
else
  fail "Docker — not installed"
  MISSING+=("docker")
fi

# Docker Compose
if command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
  COMPOSE_VER=$(docker compose version --short 2>/dev/null || echo "unknown")
  pass "Docker Compose $COMPOSE_VER"
  INSTALLED+=("compose")
else
  fail "Docker Compose v2 — not found"
  MISSING+=("docker-compose")
fi

# Git
if command -v git &>/dev/null; then
  GIT_VER=$(git --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
  pass "Git $GIT_VER"
  INSTALLED+=("git")
else
  fail "Git — not installed"
  MISSING+=("git")
fi

# curl
if command -v curl &>/dev/null; then
  pass "curl $(curl --version | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
  INSTALLED+=("curl")
else
  fail "curl — not installed"
  MISSING+=("curl")
fi

# jq
if command -v jq &>/dev/null; then
  pass "jq $(jq --version 2>/dev/null | tr -d 'jq-')"
  INSTALLED+=("jq")
else
  fail "jq — not installed (needed for health checks)"
  MISSING+=("jq")
fi

# openssl
if command -v openssl &>/dev/null; then
  pass "openssl $(openssl version 2>/dev/null | awk '{print $2}')"
  INSTALLED+=("openssl")
else
  fail "openssl — not installed (needed for credential generation)"
  MISSING+=("openssl")
fi

# ──────────────────────────────────────────────────
# Port Availability
# ──────────────────────────────────────────────────
header "Port Availability"

check_port() {
  local port=$1
  local name=$2
  if command -v lsof &>/dev/null; then
    if lsof -iTCP:"$port" -sTCP:LISTEN &>/dev/null 2>&1; then
      fail "Port $port ($name) — IN USE"
      WARNINGS+=("Port $port is occupied — $name will fail to bind")
    else
      pass "Port $port ($name) — available"
    fi
  elif command -v ss &>/dev/null; then
    if ss -tlnp 2>/dev/null | grep -q ":$port "; then
      fail "Port $port ($name) — IN USE"
      WARNINGS+=("Port $port is occupied — $name will fail to bind")
    else
      pass "Port $port ($name) — available"
    fi
  else
    warn "Port $port ($name) — cannot check (no lsof/ss)"
  fi
}

check_port 14000 "Mission Control"
check_port 28789 "Gateway"
check_port 19090 "Gatekeeper"
check_port 5678  "n8n"

# ──────────────────────────────────────────────────
# Existing Installation Check
# ──────────────────────────────────────────────────
header "Existing Installation"

if [ -d "$CTG_DIR" ]; then
  warn "CTG Core directory already exists at $CTG_DIR"
  if [ -f "$CTG_DIR/.env" ]; then
    warn "  .env file present — existing configuration found"
  fi
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "ctg-core"; then
    warn "  CTG Core containers are currently running"
    WARNINGS+=("Running CTG Core containers detected — will need to stop before redeployment")
  fi
else
  pass "Clean install — no existing CTG Core at $CTG_DIR"
fi

# ──────────────────────────────────────────────────
# Assessment Summary
# ──────────────────────────────────────────────────
header "Assessment Summary"

if [ ${#WARNINGS[@]} -gt 0 ]; then
  echo -e "${YELLOW}Warnings:${NC}"
  for w in "${WARNINGS[@]}"; do
    warn "$w"
  done
  echo ""
fi

if [ ${#MISSING[@]} -eq 0 ]; then
  echo -e "${GREEN}${BOLD}All prerequisites met — ready to deploy!${NC}"
  echo ""
else
  echo -e "${YELLOW}${BOLD}Missing prerequisites:${NC}"
  for m in "${MISSING[@]}"; do
    case "$m" in
      homebrew)       info "Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"" ;;
      docker)
        if [ "$OS" = "macos" ]; then
          info "Docker Desktop: brew install --cask docker"
        else
          info "Docker: curl -fsSL https://get.docker.com | sh"
        fi
        ;;
      docker-start)   info "Start Docker daemon — open Docker Desktop or: sudo systemctl start docker" ;;
      docker-compose) info "Docker Compose is included with Docker Desktop (macOS)" ;;
      tailscale)
        if [ "$OS" = "macos" ]; then
          info "Tailscale: brew install --cask tailscale"
        else
          info "Tailscale: curl -fsSL https://tailscale.com/install.sh | sh"
        fi
        ;;
      git)            info "Git: brew install git (macOS) or sudo apt install git (Linux)" ;;
      curl)           info "curl: brew install curl (macOS) or sudo apt install curl (Linux)" ;;
      jq)             info "jq: brew install jq (macOS) or sudo apt install jq (Linux)" ;;
      openssl)        info "openssl: brew install openssl (macOS) or sudo apt install openssl (Linux)" ;;
    esac
  done
  echo ""

  # Block on missing Tailscale — it is required for the client stack
  if printf '%s\n' "${MISSING[@]}" | grep -q "^tailscale$"; then
    fail "Tailscale is required. Install it and re-run this script."
    exit 1
  fi

  # ──────────────────────────────────────────────
  # Offer to install missing prerequisites
  # ──────────────────────────────────────────────
  if [ "$PKG_MGR" != "none" ]; then
    echo -e "${BOLD}Would you like to install missing prerequisites now?${NC}"
    read -rp "Install? (Y/n): " DO_INSTALL
    DO_INSTALL="${DO_INSTALL:-Y}"

    if [[ "$DO_INSTALL" =~ ^[Yy]$ ]]; then
      echo ""

      for m in "${MISSING[@]}"; do
        case "$m" in
          homebrew)
            info "Installing Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            # Add brew to PATH for this session (Apple Silicon)
            if [ -f /opt/homebrew/bin/brew ]; then
              eval "$(/opt/homebrew/bin/brew shellenv)"
            fi
            PKG_MGR="brew"
            pass "Homebrew installed"
            ;;
          docker)
            if [ "$OS" = "macos" ]; then
              info "Installing Docker Desktop..."
              brew install --cask docker
              pass "Docker Desktop installed — please open it from Applications to start the daemon"
              echo -e "  ${YELLOW}!${NC} Docker Desktop must be launched manually the first time."
              echo -e "  ${YELLOW}!${NC} After opening, wait ~30 seconds for the daemon to start, then re-run this script."
              exit 0
            else
              info "Installing Docker..."
              curl -fsSL https://get.docker.com | sh
              sudo usermod -aG docker "$USER" 2>/dev/null || true
              sudo systemctl enable docker 2>/dev/null || true
              sudo systemctl start docker 2>/dev/null || true
              pass "Docker installed"
            fi
            ;;
          docker-start)
            if [ "$OS" = "macos" ]; then
              info "Opening Docker Desktop..."
              open -a Docker 2>/dev/null || true
              echo -e "  ${YELLOW}!${NC} Waiting for Docker daemon to start..."
              for i in $(seq 1 30); do
                if docker info &>/dev/null 2>&1; then
                  pass "Docker daemon is running"
                  break
                fi
                sleep 2
              done
              if ! docker info &>/dev/null 2>&1; then
                fail "Docker daemon did not start in time — open Docker Desktop manually, then re-run"
                exit 1
              fi
            else
              info "Starting Docker daemon..."
              sudo systemctl start docker 2>/dev/null || true
              pass "Docker started"
            fi
            ;;
          git)
            info "Installing git..."
            if [ "$PKG_MGR" = "brew" ]; then brew install git
            elif [ "$PKG_MGR" = "apt" ]; then sudo apt-get install -y git
            elif [ "$PKG_MGR" = "dnf" ]; then sudo dnf install -y git
            fi
            pass "Git installed"
            ;;
          jq)
            info "Installing jq..."
            if [ "$PKG_MGR" = "brew" ]; then brew install jq
            elif [ "$PKG_MGR" = "apt" ]; then sudo apt-get install -y jq
            elif [ "$PKG_MGR" = "dnf" ]; then sudo dnf install -y jq
            fi
            pass "jq installed"
            ;;
          openssl)
            info "Installing openssl..."
            if [ "$PKG_MGR" = "brew" ]; then brew install openssl
            elif [ "$PKG_MGR" = "apt" ]; then sudo apt-get install -y openssl
            elif [ "$PKG_MGR" = "dnf" ]; then sudo dnf install -y openssl
            fi
            pass "openssl installed"
            ;;
          curl)
            info "Installing curl..."
            if [ "$PKG_MGR" = "brew" ]; then brew install curl
            elif [ "$PKG_MGR" = "apt" ]; then sudo apt-get install -y curl
            elif [ "$PKG_MGR" = "dnf" ]; then sudo dnf install -y curl
            fi
            pass "curl installed"
            ;;
        esac
      done

      echo ""
      pass "Prerequisite installation complete"
      echo ""
    else
      echo ""
      echo "Install the missing prerequisites listed above, then re-run this script."
      exit 1
    fi
  fi
fi

# ──────────────────────────────────────────────────
# Deploy
# ──────────────────────────────────────────────────
header "Deployment"

# Final gate check
if ! docker info &>/dev/null 2>&1; then
  fail "Docker daemon is not running. Start Docker and re-run."
  exit 1
fi

# Handle existing installation
if [ -d "$CTG_DIR" ]; then
  echo -e "${YELLOW}Existing installation found at $CTG_DIR${NC}"

  # Stop running containers
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "ctg-core"; then
    info "Stopping existing CTG Core containers..."
    (cd "$CTG_DIR" && docker compose down 2>/dev/null) || true
    pass "Containers stopped"
  fi

  echo ""
  echo "  1) Clean install  — removes existing config and starts fresh"
  echo "  2) Upgrade        — keeps .env, rebuilds containers"
  echo "  3) Abort          — exit without changes"
  echo ""
  read -rp "Choose (1/2/3): " INSTALL_MODE

  case "$INSTALL_MODE" in
    1)
      info "Backing up existing .env..."
      [ -f "$CTG_DIR/.env" ] && cp "$CTG_DIR/.env" "$CTG_DIR/.env.backup.$(date +%s)"
      info "Removing existing installation..."
      rm -rf "$CTG_DIR"
      pass "Clean slate"
      ;;
    2)
      info "Upgrade mode — keeping .env"
      UPGRADE_MODE=true
      ;;
    3)
      echo "Aborted."
      exit 0
      ;;
    *)
      fail "Invalid choice"
      exit 1
      ;;
  esac
fi

UPGRADE_MODE="${UPGRADE_MODE:-false}"

# Create deployment directory
mkdir -p "$CTG_DIR"

# ──────────────────────────────────────────────────
# Fetch CTG Core files
# ──────────────────────────────────────────────────
CTG_REPO="https://raw.githubusercontent.com/ccubillas21/ctg-core/master"
CTG_REGISTRY="ghcr.io/ccubillas21"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"

# Try local source first, fall back to GitHub
if [ -f "$SCRIPT_DIR/docker-compose.client.yml" ] && [ -f "$SCRIPT_DIR/.env.template" ]; then
  info "Deploying from local source: $SCRIPT_DIR"

  if [ "$SCRIPT_DIR" != "$CTG_DIR" ]; then
    cp "$SCRIPT_DIR/docker-compose.client.yml" "$CTG_DIR/docker-compose.yml"
    pass "Copied docker-compose.client.yml → docker-compose.yml"
    for f in openclaw.seed.json .env.template; do
      [ -f "$SCRIPT_DIR/$f" ] && cp "$SCRIPT_DIR/$f" "$CTG_DIR/"
    done
    for d in agents sops lobster skills gatekeeper; do
      [ -d "$SCRIPT_DIR/$d" ] && cp -r "$SCRIPT_DIR/$d" "$CTG_DIR/"
    done
    pass "Files copied to $CTG_DIR"
  fi
else
  info "Downloading deployment files from CTG..."

  # Download docker-compose.client.yml and save as docker-compose.yml
  if curl -sfL "$CTG_REPO/docker-compose.client.yml" -o "$CTG_DIR/docker-compose.yml" 2>/dev/null; then
    pass "Downloaded docker-compose.client.yml → docker-compose.yml"
  else
    fail "Failed to download docker-compose.client.yml"
    echo "  Check your internet connection and try again."
    exit 1
  fi

  # Download openclaw.seed.json
  if curl -sfL "$CTG_REPO/openclaw.seed.json" -o "$CTG_DIR/openclaw.seed.json" 2>/dev/null; then
    pass "Downloaded openclaw.seed.json"
  else
    fail "Failed to download openclaw.seed.json"
    echo "  Check your internet connection and try again."
    exit 1
  fi

  pass "Deployment files downloaded"
fi

# ──────────────────────────────────────────────────
# CTG Hub Configuration
# ──────────────────────────────────────────────────
if [ "$UPGRADE_MODE" = "false" ]; then
  header "CTG Hub Configuration"
  read -rp "  CTG Hub IP (Tailscale): " CTG_HUB_IP
  read -rp "  Company ID: " COMPANY_ID
  read -rp "  Hub Tenant Token: " HUB_TENANT_TOKEN

  if [ -z "$CTG_HUB_IP" ] || [ -z "$COMPANY_ID" ] || [ -z "$HUB_TENANT_TOKEN" ]; then
    fail "CTG Hub IP, Company ID, and Hub Tenant Token are required"
    fail "Contact CTG to get these credentials"
    exit 1
  fi

  # ──────────────────────────────────────────────────
  # Connectivity Check
  # ──────────────────────────────────────────────────
  header "Connectivity Check"

  if [ "$DRY_RUN" = "true" ]; then
    warn "[DRY RUN] Skipping connectivity checks"
  else
    if curl -sf "http://${CTG_HUB_IP}:9100/health" &>/dev/null; then
      pass "CTG Hub reachable at ${CTG_HUB_IP}:9100"
    else
      fail "Cannot reach CTG Hub at ${CTG_HUB_IP}:9100"
      fail "Check Tailscale connection and Hub IP"
      exit 1
    fi
    if curl -sf "http://${CTG_HUB_IP}:3101/api/health" &>/dev/null; then
      pass "CTG Paperclip reachable at ${CTG_HUB_IP}:3101"
    else
      warn "Cannot reach CTG Paperclip at ${CTG_HUB_IP}:3101 — may not be running yet"
    fi
  fi
fi

# ──────────────────────────────────────────────────
# Configure .env
# ──────────────────────────────────────────────────
if [ "$UPGRADE_MODE" = "false" ]; then
  header "Configuration"

  # Generate secure credentials
  AUTH_TOKEN=$(openssl rand -hex 24)
  GK_TOKEN=$(openssl rand -hex 24)
  N8N_PASSWORD=$(openssl rand -hex 16)
  N8N_ENCRYPTION=$(openssl rand -hex 32)

  # Write .env
  cat > "$CTG_DIR/.env" <<EOF
# CTG Core Client Configuration
# Generated by deploy.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Do not share this file — it contains secrets.

# ── CTG Hub ──────────────────────────────────────
CTG_HUB_IP=${CTG_HUB_IP}
COMPANY_ID=${COMPANY_ID}
HUB_TENANT_TOKEN=${HUB_TENANT_TOKEN}

# ── Auto-generated secrets ───────────────────────
OPENCLAW_AUTH_TOKEN=${AUTH_TOKEN}
GATEKEEPER_INTERNAL_TOKEN=${GK_TOKEN}

# ── n8n ──────────────────────────────────────────
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION}
EOF

  pass "Credentials generated and .env written"
  info "Company ID: $COMPANY_ID"
  info "CTG Hub IP: $CTG_HUB_IP"
fi

# ──────────────────────────────────────────────────
# Build & Launch
# ──────────────────────────────────────────────────
if [ "$DRY_RUN" = "true" ]; then
  header "Dry Run Complete"
  info "Would start 4 services from $CTG_DIR/docker-compose.yml"
  info "No changes were made."
  exit 0
fi

header "Building & Starting Stack (4 services)"

cd "$CTG_DIR"

info "Pulling container images (this may take a few minutes)..."
docker compose pull 2>&1 | tail -10

echo ""
info "Starting all services..."
docker compose up -d 2>&1

echo ""
info "Waiting for services to become healthy..."

TIMEOUT=120
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  HEALTHY=$(docker compose ps --format json 2>/dev/null | jq -r 'select(.Health == "healthy") | .Name' 2>/dev/null | wc -l | tr -d ' ' || echo "0")
  TOTAL=$(docker compose ps --format json 2>/dev/null | jq -r '.Name' 2>/dev/null | wc -l | tr -d ' ' || echo "0")

  if [ "$HEALTHY" -ge 4 ]; then
    pass "All 4 services healthy ($HEALTHY/$TOTAL)"
    break
  fi

  printf "  Waiting... (%s/%s healthy, %ss)\r" "$HEALTHY" "$TOTAL" "$ELAPSED"
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
  warn "Timeout — some services may still be starting"
  info "Check status: cd $CTG_DIR && docker compose ps"
fi

# ──────────────────────────────────────────────────
# Final Report
# ──────────────────────────────────────────────────
header "Deployment Complete"

# Get Tailscale IP if available
TS_IP=""
if command -v tailscale &>/dev/null; then
  TS_IP=$(tailscale ip -4 2>/dev/null || echo "")
fi

MC_PORT=$(grep '^MC_PORT=' "$CTG_DIR/.env" 2>/dev/null | cut -d= -f2 || echo "14000")
GW_PORT=$(grep '^GW_PORT=' "$CTG_DIR/.env" 2>/dev/null | cut -d= -f2 || echo "28789")
GK_PORT=$(grep '^GK_PORT=' "$CTG_DIR/.env" 2>/dev/null | cut -d= -f2 || echo "19090")
N8N_PORT=5678

echo -e "${BOLD}Services (4):${NC}"
echo "  Mission Control:  http://localhost:$MC_PORT"
echo "  Gateway:          http://localhost:$GW_PORT"
echo "  Gatekeeper:       http://localhost:$GK_PORT"
echo "  n8n:              http://localhost:$N8N_PORT"

CTG_HUB_IP_DISPLAY=$(grep '^CTG_HUB_IP=' "$CTG_DIR/.env" 2>/dev/null | cut -d= -f2 || echo "")
if [ -n "$CTG_HUB_IP_DISPLAY" ]; then
  echo ""
  echo -e "${BOLD}CTG Hub (via Tailscale):${NC}"
  echo "  Hub Gateway:      http://${CTG_HUB_IP_DISPLAY}:9100"
  echo "  Paperclip:        http://${CTG_HUB_IP_DISPLAY}:3101"
fi

if [ -n "$TS_IP" ]; then
  echo ""
  echo -e "${BOLD}Tailscale Access (from your network):${NC}"
  echo "  Mission Control:  http://$TS_IP:$MC_PORT"
  echo "  Gateway:          http://$TS_IP:$GW_PORT"
fi

echo ""
echo -e "${BOLD}Config:${NC}  $CTG_DIR/.env"
echo -e "${BOLD}Logs:${NC}    cd $CTG_DIR && docker compose logs -f"
echo -e "${BOLD}Stop:${NC}    cd $CTG_DIR && docker compose down"
echo -e "${BOLD}Restart:${NC} cd $CTG_DIR && docker compose restart"
echo ""
pass "CTG Core client stack is live — connected to CTG Hub via Tailscale."
