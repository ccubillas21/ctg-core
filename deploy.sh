#!/bin/bash
# CTG Core — One-Line Client Deployment Script
# Usage: bash <(curl -sL URL) or bash deploy.sh
#
# Assesses the target machine, installs missing prerequisites,
# and deploys the full CTG Core stack.

set -euo pipefail

# ──────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────
CTG_DIR="${CTG_DIR:-$HOME/.ctg-core}"
TAILSCALE_REQUIRED=true
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

# Tailscale
if command -v tailscale &>/dev/null; then
  TS_VER=$(tailscale version 2>/dev/null | head -1 || echo "unknown")
  TS_STATUS=$(tailscale status --json 2>/dev/null | grep -o '"BackendState":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
  if [ "$TS_STATUS" = "Running" ]; then
    TS_IP=$(tailscale ip -4 2>/dev/null || echo "unknown")
    pass "Tailscale $TS_VER — connected (IP: $TS_IP)"
    INSTALLED+=("tailscale")
  else
    warn "Tailscale $TS_VER installed but not connected (state: $TS_STATUS)"
    MISSING+=("tailscale-connect")
  fi
else
  fail "Tailscale — not installed"
  MISSING+=("tailscale")
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

check_port 13100 "Paperclip"
check_port 14000 "Mission Control"
check_port 28789 "Gateway"
check_port 19090 "Gatekeeper"
check_port 5678 "n8n"

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
      tailscale-connect) info "Connect Tailscale: sudo tailscale up" ;;
      git)            info "Git: brew install git (macOS) or sudo apt install git (Linux)" ;;
      curl)           info "curl: brew install curl (macOS) or sudo apt install curl (Linux)" ;;
      jq)             info "jq: brew install jq (macOS) or sudo apt install jq (Linux)" ;;
      openssl)        info "openssl: brew install openssl (macOS) or sudo apt install openssl (Linux)" ;;
    esac
  done
  echo ""

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
          tailscale)
            if [ "$OS" = "macos" ]; then
              info "Installing Tailscale..."
              brew install --cask tailscale
              pass "Tailscale installed — open from menu bar to sign in"
            else
              info "Installing Tailscale..."
              curl -fsSL https://tailscale.com/install.sh | sh
              pass "Tailscale installed"
            fi
            ;;
          tailscale-connect)
            info "Connecting to Tailscale..."
            if [ "$OS" = "macos" ]; then
              echo -e "  ${YELLOW}!${NC} Open Tailscale from the menu bar and sign in"
            else
              sudo tailscale up
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
# Copy/extract CTG Core files
# ──────────────────────────────────────────────────
# Check if we're running from a CTG Core source directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/docker-compose.yml" ] && [ -f "$SCRIPT_DIR/Dockerfile.openclaw" ]; then
  info "Deploying from local source: $SCRIPT_DIR"

  # Copy all CTG Core files to deployment dir (skip if same dir)
  if [ "$SCRIPT_DIR" != "$CTG_DIR" ]; then
    cp -r "$SCRIPT_DIR"/docker-compose.yml "$CTG_DIR/"
    cp -r "$SCRIPT_DIR"/Dockerfile.openclaw "$CTG_DIR/"
    cp -r "$SCRIPT_DIR"/openclaw.seed.json "$CTG_DIR/"
    cp -r "$SCRIPT_DIR"/.env.template "$CTG_DIR/"
    cp -r "$SCRIPT_DIR"/agents "$CTG_DIR/"
    cp -r "$SCRIPT_DIR"/sops "$CTG_DIR/"
    cp -r "$SCRIPT_DIR"/lobster "$CTG_DIR/"
    cp -r "$SCRIPT_DIR"/skills "$CTG_DIR/"

    # Copy parent-relay if it has a Dockerfile
    if [ -d "$SCRIPT_DIR/parent-relay" ]; then
      cp -r "$SCRIPT_DIR"/parent-relay "$CTG_DIR/"
    fi

    pass "Files copied to $CTG_DIR"
  fi
else
  fail "Cannot find CTG Core source files."
  echo ""
  echo "  Run this script from the ctg-core directory, or set the source path:"
  echo "    CTG_DIR=$HOME/.ctg-core bash deploy.sh"
  exit 1
fi

# ──────────────────────────────────────────────────
# Configure .env
# ──────────────────────────────────────────────────
if [ "$UPGRADE_MODE" = "false" ]; then
  header "Configuration"

  cp "$CTG_DIR/.env.template" "$CTG_DIR/.env"

  # Generate secure credentials
  PG_PASSWORD=$(openssl rand -hex 24)
  AUTH_TOKEN=$(openssl rand -hex 24)
  GK_TOKEN=$(openssl rand -hex 24)
  N8N_PASSWORD=$(openssl rand -hex 16)
  N8N_ENCRYPTION=$(openssl rand -hex 32)

  # Generate UUID (macOS compatible)
  if command -v uuidgen &>/dev/null; then
    COMPANY_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
  else
    COMPANY_ID=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || openssl rand -hex 16 | sed 's/\(.\{8\}\)\(.\{4\}\)\(.\{4\}\)\(.\{4\}\)\(.\{12\}\)/\1-\2-\3-\4-\5/')
  fi

  # Write credentials to .env
  if [ "$OS" = "macos" ]; then
    sed -i '' "s/PG_PASSWORD=CHANGE_ME_GENERATE_WITH_OPENSSL/PG_PASSWORD=$PG_PASSWORD/" "$CTG_DIR/.env"
    sed -i '' "s/OPENCLAW_AUTH_TOKEN=CHANGE_ME_GENERATE_WITH_OPENSSL/OPENCLAW_AUTH_TOKEN=$AUTH_TOKEN/" "$CTG_DIR/.env"
    sed -i '' "s/COMPANY_ID=CHANGE_ME_UUID/COMPANY_ID=$COMPANY_ID/" "$CTG_DIR/.env"
    sed -i '' "s/GATEKEEPER_INTERNAL_TOKEN=CHANGE_ME_GENERATE_WITH_OPENSSL/GATEKEEPER_INTERNAL_TOKEN=$GK_TOKEN/" "$CTG_DIR/.env"
    sed -i '' "s/N8N_BASIC_AUTH_PASSWORD=CHANGE_ME_GENERATE_WITH_OPENSSL/N8N_BASIC_AUTH_PASSWORD=$N8N_PASSWORD/" "$CTG_DIR/.env"
    sed -i '' "s/N8N_ENCRYPTION_KEY=CHANGE_ME_GENERATE_WITH_OPENSSL/N8N_ENCRYPTION_KEY=$N8N_ENCRYPTION/" "$CTG_DIR/.env"
  else
    sed -i "s/PG_PASSWORD=CHANGE_ME_GENERATE_WITH_OPENSSL/PG_PASSWORD=$PG_PASSWORD/" "$CTG_DIR/.env"
    sed -i "s/OPENCLAW_AUTH_TOKEN=CHANGE_ME_GENERATE_WITH_OPENSSL/OPENCLAW_AUTH_TOKEN=$AUTH_TOKEN/" "$CTG_DIR/.env"
    sed -i "s/COMPANY_ID=CHANGE_ME_UUID/COMPANY_ID=$COMPANY_ID/" "$CTG_DIR/.env"
    sed -i "s/GATEKEEPER_INTERNAL_TOKEN=CHANGE_ME_GENERATE_WITH_OPENSSL/GATEKEEPER_INTERNAL_TOKEN=$GK_TOKEN/" "$CTG_DIR/.env"
    sed -i "s/N8N_BASIC_AUTH_PASSWORD=CHANGE_ME_GENERATE_WITH_OPENSSL/N8N_BASIC_AUTH_PASSWORD=$N8N_PASSWORD/" "$CTG_DIR/.env"
    sed -i "s/N8N_ENCRYPTION_KEY=CHANGE_ME_GENERATE_WITH_OPENSSL/N8N_ENCRYPTION_KEY=$N8N_ENCRYPTION/" "$CTG_DIR/.env"
  fi

  pass "Credentials generated"
  info "Company ID: $COMPANY_ID"

  # API Key
  echo ""
  echo -e "${BOLD}Anthropic API Key${NC} (required for agents to work)"
  read -rp "  sk-ant-...: " ANTHROPIC_KEY
  if [ -n "$ANTHROPIC_KEY" ]; then
    if [ "$OS" = "macos" ]; then
      sed -i '' "s|ANTHROPIC_API_KEY=sk-ant-CHANGE_ME|ANTHROPIC_API_KEY=$ANTHROPIC_KEY|" "$CTG_DIR/.env"
    else
      sed -i "s|ANTHROPIC_API_KEY=sk-ant-CHANGE_ME|ANTHROPIC_API_KEY=$ANTHROPIC_KEY|" "$CTG_DIR/.env"
    fi
    pass "API key set"
  else
    warn "No API key — agents won't work until you set ANTHROPIC_API_KEY in $CTG_DIR/.env"
  fi

  # Parent Hub
  echo ""
  echo -e "${BOLD}Parent Hub${NC} (for remote management by CTG)"
  read -rp "  Hub token (press Enter to skip): " HUB_TOKEN
  if [ -n "$HUB_TOKEN" ]; then
    if [ "$OS" = "macos" ]; then
      sed -i '' "s|PARENT_HUB_TOKEN=CHANGE_ME_PROVIDED_BY_CTG|PARENT_HUB_TOKEN=$HUB_TOKEN|" "$CTG_DIR/.env"
    else
      sed -i "s|PARENT_HUB_TOKEN=CHANGE_ME_PROVIDED_BY_CTG|PARENT_HUB_TOKEN=$HUB_TOKEN|" "$CTG_DIR/.env"
    fi
    pass "Hub token set"
  else
    info "Skipped — can be configured later in $CTG_DIR/.env"
  fi
fi

# ──────────────────────────────────────────────────
# Build & Launch
# ──────────────────────────────────────────────────
header "Building & Starting Stack"

cd "$CTG_DIR"

info "Building OpenClaw image (this may take a few minutes)..."
docker compose build openclaw 2>&1 | tail -5

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
    pass "All core services healthy ($HEALTHY/$TOTAL)"
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
# Seed Paperclip
# ──────────────────────────────────────────────────
if [ "$UPGRADE_MODE" = "false" ]; then
  echo ""
  info "Seeding Paperclip with agents..."

  PAPERCLIP_PORT=$(grep '^PAPERCLIP_PORT=' "$CTG_DIR/.env" 2>/dev/null | cut -d= -f2 || echo "13100")
  PAPERCLIP_URL="http://localhost:${PAPERCLIP_PORT}"
  COMPANY_ID=$(grep '^COMPANY_ID=' "$CTG_DIR/.env" | cut -d= -f2)

  # Wait for Paperclip API
  for i in $(seq 1 15); do
    if curl -sf "$PAPERCLIP_URL/api/health" &>/dev/null; then
      break
    fi
    sleep 2
  done

  # Create company
  curl -sf -X POST "$PAPERCLIP_URL/api/companies" \
    -H "Content-Type: application/json" \
    -d "{\"id\":\"$COMPANY_ID\",\"name\":\"Client Deployment\"}" &>/dev/null || true

  # Register agents
  for AGENT in primary engineer dispatch; do
    case $AGENT in
      primary)  TITLE="Communications & Triage Lead" ;;
      engineer) TITLE="Technical Specialist" ;;
      dispatch) TITLE="Operations & Automation Specialist" ;;
    esac
    curl -sf -X POST "$PAPERCLIP_URL/api/companies/$COMPANY_ID/agents" \
      -H "Content-Type: application/json" \
      -d "{\"name\":\"$AGENT\",\"title\":\"$TITLE\",\"role\":\"general\",\"adapterType\":\"openclaw_gateway\"}" &>/dev/null || true
  done

  pass "Agents registered: primary, engineer, dispatch"
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

PAPERCLIP_PORT=$(grep '^PAPERCLIP_PORT=' "$CTG_DIR/.env" 2>/dev/null | cut -d= -f2 || echo "13100")
MC_PORT=$(grep '^MC_PORT=' "$CTG_DIR/.env" 2>/dev/null | cut -d= -f2 || echo "14000")
GW_PORT=$(grep '^GW_PORT=' "$CTG_DIR/.env" 2>/dev/null | cut -d= -f2 || echo "28789")
RELAY_PORT=$(grep '^RELAY_PORT=' "$CTG_DIR/.env" 2>/dev/null | cut -d= -f2 || echo "19090")

echo -e "${BOLD}Services:${NC}"
echo "  Paperclip:        http://localhost:$PAPERCLIP_PORT"
echo "  Mission Control:  http://localhost:$MC_PORT"
echo "  Gateway:          http://localhost:$GW_PORT"
echo "  Parent Relay:     http://localhost:$RELAY_PORT"

if [ -n "$TS_IP" ]; then
  echo ""
  echo -e "${BOLD}Tailscale Access (from your network):${NC}"
  echo "  Paperclip:        http://$TS_IP:$PAPERCLIP_PORT"
  echo "  Mission Control:  http://$TS_IP:$MC_PORT"
  echo "  Gateway:          http://$TS_IP:$GW_PORT"
fi

echo ""
echo -e "${BOLD}Config:${NC}  $CTG_DIR/.env"
echo -e "${BOLD}Logs:${NC}    cd $CTG_DIR && docker compose logs -f"
echo -e "${BOLD}Stop:${NC}    cd $CTG_DIR && docker compose down"
echo -e "${BOLD}Restart:${NC} cd $CTG_DIR && docker compose restart"
echo ""
pass "CTG Core is live."
