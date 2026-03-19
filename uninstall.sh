#!/bin/bash
# CTG Core / OpenClaw — Full Uninstall Script
# Finds everything OpenClaw-related and removes it with confirmation.
#
# Usage: bash uninstall.sh
#        bash uninstall.sh --dry-run    (assessment only, no changes)

set -euo pipefail

# ──────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────
DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

# ──────────────────────────────────────────────────
# Colors & helpers
# ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

pass()  { echo -e "  ${GREEN}✓${NC} $1"; }
fail()  { echo -e "  ${RED}✗${NC} $1"; }
warn()  { echo -e "  ${YELLOW}!${NC} $1"; }
info()  { echo -e "  ${BLUE}→${NC} $1"; }
skip()  { echo -e "  ${DIM}–${NC} $1"; }
header(){ echo -e "\n${BOLD}${CYAN}── $1 ──${NC}\n"; }

# Track what we find
FOUND_ITEMS=()
TOTAL_SIZE=0

add_found() {
  FOUND_ITEMS+=("$1")
}

# ──────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}"
echo "============================================"
echo "  OpenClaw — Full Uninstall Assessment"
echo "============================================"
echo -e "${NC}"

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}${BOLD}DRY RUN — no changes will be made${NC}\n"
fi

# ──────────────────────────────────────────────────
# 1. Docker Containers
# ──────────────────────────────────────────────────
header "Docker Containers"

if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  # Running containers
  RUNNING=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -iE 'openclaw|ctg-core|paperclip|ctg_core' || true)
  if [ -n "$RUNNING" ]; then
    echo -e "  ${RED}Running containers:${NC}"
    while IFS= read -r name; do
      fail "$name (running)"
      add_found "container:$name"
    done <<< "$RUNNING"
  else
    skip "No running OpenClaw containers"
  fi

  # Stopped containers
  STOPPED=$(docker ps -a --format '{{.Names}}' 2>/dev/null | grep -iE 'openclaw|ctg-core|paperclip|ctg_core' || true)
  STOPPED_ONLY=""
  if [ -n "$STOPPED" ]; then
    while IFS= read -r name; do
      if ! echo "$RUNNING" | grep -q "^${name}$" 2>/dev/null; then
        STOPPED_ONLY+="$name"$'\n'
      fi
    done <<< "$STOPPED"
  fi
  if [ -n "$STOPPED_ONLY" ]; then
    echo -e "  ${YELLOW}Stopped containers:${NC}"
    while IFS= read -r name; do
      [ -z "$name" ] && continue
      warn "$name (stopped)"
      add_found "container:$name"
    done <<< "$STOPPED_ONLY"
  fi

  [ -z "$RUNNING" ] && [ -z "$STOPPED_ONLY" ] && skip "No OpenClaw containers found"
else
  skip "Docker not running — skipping container check"
fi

# ──────────────────────────────────────────────────
# 2. Docker Images
# ──────────────────────────────────────────────────
header "Docker Images"

if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  IMAGES=$(docker images --format '{{.Repository}}:{{.Tag}} ({{.Size}})' 2>/dev/null | grep -iE 'openclaw|ctg-core|ctg_core|paperclip' || true)
  if [ -n "$IMAGES" ]; then
    while IFS= read -r img; do
      warn "$img"
      IMG_NAME=$(echo "$img" | cut -d' ' -f1)
      add_found "image:$IMG_NAME"
    done <<< "$IMAGES"
  else
    skip "No OpenClaw images found"
  fi
else
  skip "Docker not running — skipping image check"
fi

# ──────────────────────────────────────────────────
# 3. Docker Volumes
# ──────────────────────────────────────────────────
header "Docker Volumes"

if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  VOLUMES=$(docker volume ls --format '{{.Name}}' 2>/dev/null | grep -iE 'openclaw|ctg-core|ctg_core|pgdata' || true)
  if [ -n "$VOLUMES" ]; then
    while IFS= read -r vol; do
      # Get volume size
      VOL_SIZE=$(docker system df -v 2>/dev/null | grep "$vol" | awk '{print $NF}' || echo "unknown size")
      warn "$vol ($VOL_SIZE)"
      add_found "volume:$vol"
    done <<< "$VOLUMES"
  else
    skip "No OpenClaw volumes found"
  fi
else
  skip "Docker not running — skipping volume check"
fi

# ──────────────────────────────────────────────────
# 4. Docker Networks
# ──────────────────────────────────────────────────
header "Docker Networks"

if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  NETWORKS=$(docker network ls --format '{{.Name}}' 2>/dev/null | grep -iE 'openclaw|ctg-core|ctg_core' || true)
  if [ -n "$NETWORKS" ]; then
    while IFS= read -r net; do
      warn "$net"
      add_found "network:$net"
    done <<< "$NETWORKS"
  else
    skip "No OpenClaw networks found"
  fi
else
  skip "Docker not running — skipping network check"
fi

# ──────────────────────────────────────────────────
# 5. Docker Compose Projects
# ──────────────────────────────────────────────────
header "Docker Compose Projects"

if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  PROJECTS=$(docker compose ls --format json 2>/dev/null | jq -r '.Name' 2>/dev/null | grep -iE 'openclaw|ctg-core|ctg_core' || true)
  if [ -n "$PROJECTS" ]; then
    while IFS= read -r proj; do
      warn "$proj"
      add_found "compose:$proj"
    done <<< "$PROJECTS"
  else
    skip "No OpenClaw compose projects found"
  fi
fi

# ──────────────────────────────────────────────────
# 6. File System — Config & Data Directories
# ──────────────────────────────────────────────────
header "Files & Directories"

check_dir() {
  local path="$1"
  local label="$2"
  if [ -d "$path" ]; then
    DIR_SIZE=$(du -sh "$path" 2>/dev/null | cut -f1 || echo "unknown")
    FILE_COUNT=$(find "$path" -type f 2>/dev/null | wc -l | tr -d ' ')
    warn "$label: $path ($DIR_SIZE, $FILE_COUNT files)"
    add_found "dir:$path"
  else
    skip "$label: $path (not found)"
  fi
}

check_file() {
  local path="$1"
  local label="$2"
  if [ -f "$path" ]; then
    FILE_SIZE=$(du -sh "$path" 2>/dev/null | cut -f1 || echo "unknown")
    warn "$label: $path ($FILE_SIZE)"
    add_found "file:$path"
  else
    skip "$label: $path (not found)"
  fi
}

# Primary config directory
check_dir "$HOME/.openclaw" "OpenClaw config"
check_dir "$HOME/.ctg-core" "CTG Core deployment"

# Common alternative locations
check_dir "$HOME/.config/openclaw" "OpenClaw alt config"
check_dir "/opt/openclaw" "System-wide OpenClaw"
check_dir "/usr/local/openclaw" "System-wide OpenClaw"

# QMD data
check_dir "$HOME/.qmd" "QMD data"
check_dir "$HOME/.config/qmd" "QMD alt config"

# Lobster
check_dir "$HOME/.lobster" "Lobster config"
check_dir "$HOME/.config/lobster" "Lobster alt config"

# Paperclip (standalone, outside Docker)
check_dir "$HOME/.paperclip" "Paperclip config"
check_dir "$HOME/.config/paperclip" "Paperclip alt config"

# Logs
check_dir "$HOME/Library/Logs/openclaw" "OpenClaw logs (macOS)"
check_dir "$HOME/.local/share/openclaw" "OpenClaw data (XDG)"

# ──────────────────────────────────────────────────
# 7. Global NPM Packages
# ──────────────────────────────────────────────────
header "Global NPM/Node Packages"

if command -v npm &>/dev/null; then
  NPM_PKGS=$(npm list -g --depth=0 2>/dev/null | grep -iE 'openclaw|qmd|lobster|paperclip' || true)
  if [ -n "$NPM_PKGS" ]; then
    while IFS= read -r pkg; do
      warn "$pkg"
      PKG_NAME=$(echo "$pkg" | grep -oE '@[^ ]+' | head -1 || echo "$pkg")
      add_found "npm:$PKG_NAME"
    done <<< "$NPM_PKGS"
  else
    skip "No OpenClaw npm packages found globally"
  fi
else
  skip "npm not installed"
fi

# ──────────────────────────────────────────────────
# 8. Homebrew Packages (macOS)
# ──────────────────────────────────────────────────
if [ "$(uname -s)" = "Darwin" ] && command -v brew &>/dev/null; then
  header "Homebrew Packages"
  BREW_PKGS=$(brew list 2>/dev/null | grep -iE 'openclaw|qmd|lobster|paperclip' || true)
  if [ -n "$BREW_PKGS" ]; then
    while IFS= read -r pkg; do
      warn "$pkg"
      add_found "brew:$pkg"
    done <<< "$BREW_PKGS"
  else
    skip "No OpenClaw Homebrew packages found"
  fi
fi

# ──────────────────────────────────────────────────
# 9. Systemd / launchd Services
# ──────────────────────────────────────────────────
header "System Services"

if [ "$(uname -s)" = "Darwin" ]; then
  # macOS launchd
  LAUNCH_AGENTS=$(find "$HOME/Library/LaunchAgents" /Library/LaunchDaemons /Library/LaunchAgents -name '*openclaw*' -o -name '*paperclip*' -o -name '*ctg-core*' 2>/dev/null || true)
  if [ -n "$LAUNCH_AGENTS" ]; then
    while IFS= read -r la; do
      warn "LaunchAgent: $la"
      add_found "launchd:$la"
    done <<< "$LAUNCH_AGENTS"
  else
    skip "No OpenClaw LaunchAgents/Daemons found"
  fi
else
  # Linux systemd
  SERVICES=$(systemctl list-unit-files 2>/dev/null | grep -iE 'openclaw|paperclip|ctg-core' || true)
  if [ -n "$SERVICES" ]; then
    while IFS= read -r svc; do
      warn "Service: $svc"
      add_found "systemd:$svc"
    done <<< "$SERVICES"
  else
    skip "No OpenClaw systemd services found"
  fi
fi

# ──────────────────────────────────────────────────
# 10. Cron Jobs
# ──────────────────────────────────────────────────
header "Cron Jobs"

CRON_ENTRIES=$(crontab -l 2>/dev/null | grep -iE 'openclaw|ctg-core|paperclip|qmd' || true)
if [ -n "$CRON_ENTRIES" ]; then
  while IFS= read -r entry; do
    warn "Cron: $entry"
    add_found "cron:$entry"
  done <<< "$CRON_ENTRIES"
else
  skip "No OpenClaw cron jobs found"
fi

# ──────────────────────────────────────────────────
# 11. Shell Profile Entries
# ──────────────────────────────────────────────────
header "Shell Profile"

for profile in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.zprofile" "$HOME/.profile"; do
  if [ -f "$profile" ]; then
    PROFILE_HITS=$(grep -n -iE 'openclaw|ctg-core|paperclip|OPENCLAW' "$profile" 2>/dev/null || true)
    if [ -n "$PROFILE_HITS" ]; then
      warn "References in $profile:"
      while IFS= read -r line; do
        echo -e "    ${DIM}$line${NC}"
      done <<< "$PROFILE_HITS"
      add_found "profile:$profile"
    fi
  fi
done

if [ ${#FOUND_ITEMS[@]} -eq 0 ] || ! printf '%s\n' "${FOUND_ITEMS[@]}" | grep -q "^profile:"; then
  skip "No OpenClaw references in shell profiles"
fi

# ──────────────────────────────────────────────────
# Assessment Summary
# ──────────────────────────────────────────────────
header "Summary"

if [ ${#FOUND_ITEMS[@]} -eq 0 ]; then
  echo -e "${GREEN}${BOLD}Nothing found — this machine is clean.${NC}"
  exit 0
fi

echo -e "Found ${BOLD}${#FOUND_ITEMS[@]}${NC} items to remove:\n"

# Group by type
for TYPE in container image volume network compose dir file npm brew launchd systemd cron profile; do
  TYPE_ITEMS=$(printf '%s\n' "${FOUND_ITEMS[@]}" | grep "^${TYPE}:" || true)
  if [ -n "$TYPE_ITEMS" ]; then
    COUNT=$(echo "$TYPE_ITEMS" | wc -l | tr -d ' ')
    echo -e "  ${BOLD}${TYPE}${NC}: $COUNT"
  fi
done

echo ""

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}${BOLD}DRY RUN complete — no changes made.${NC}"
  echo "Run without --dry-run to proceed with removal."
  exit 0
fi

# ──────────────────────────────────────────────────
# Confirmation & Removal
# ──────────────────────────────────────────────────
echo -e "${RED}${BOLD}This will permanently remove all items listed above.${NC}"
echo ""
read -rp "Type 'UNINSTALL' to confirm: " CONFIRM

if [ "$CONFIRM" != "UNINSTALL" ]; then
  echo "Aborted."
  exit 0
fi

echo ""
header "Removing Everything"

# Step 1: Stop and remove Docker containers
CONTAINERS=$(printf '%s\n' "${FOUND_ITEMS[@]}" | grep "^container:" | cut -d: -f2- || true)
if [ -n "$CONTAINERS" ]; then
  info "Stopping containers..."
  while IFS= read -r c; do
    docker stop "$c" 2>/dev/null || true
    docker rm -f "$c" 2>/dev/null || true
    pass "Removed container: $c"
  done <<< "$CONTAINERS"
fi

# Step 2: Docker compose down (catches anything missed)
COMPOSE_DIRS=()
for item in "${FOUND_ITEMS[@]}"; do
  case "$item" in
    dir:*/.ctg-core|dir:*/.openclaw)
      DIR="${item#dir:}"
      if [ -f "$DIR/docker-compose.yml" ]; then
        COMPOSE_DIRS+=("$DIR")
      fi
      ;;
  esac
done

for cdir in "${COMPOSE_DIRS[@]}"; do
  info "Running docker compose down in $cdir..."
  (cd "$cdir" && docker compose down --remove-orphans 2>/dev/null) || true
  pass "Compose stack torn down: $cdir"
done

# Step 3: Remove Docker images
IMAGES_TO_RM=$(printf '%s\n' "${FOUND_ITEMS[@]}" | grep "^image:" | cut -d: -f2- || true)
if [ -n "$IMAGES_TO_RM" ]; then
  info "Removing images..."
  while IFS= read -r img; do
    docker rmi -f "$img" 2>/dev/null || true
    pass "Removed image: $img"
  done <<< "$IMAGES_TO_RM"
fi

# Step 4: Remove Docker volumes
VOLUMES_TO_RM=$(printf '%s\n' "${FOUND_ITEMS[@]}" | grep "^volume:" | cut -d: -f2- || true)
if [ -n "$VOLUMES_TO_RM" ]; then
  info "Removing volumes..."
  while IFS= read -r vol; do
    docker volume rm -f "$vol" 2>/dev/null || true
    pass "Removed volume: $vol"
  done <<< "$VOLUMES_TO_RM"
fi

# Step 5: Remove Docker networks
NETWORKS_TO_RM=$(printf '%s\n' "${FOUND_ITEMS[@]}" | grep "^network:" | cut -d: -f2- || true)
if [ -n "$NETWORKS_TO_RM" ]; then
  info "Removing networks..."
  while IFS= read -r net; do
    docker network rm "$net" 2>/dev/null || true
    pass "Removed network: $net"
  done <<< "$NETWORKS_TO_RM"
fi

# Step 6: Uninstall npm packages
NPM_TO_RM=$(printf '%s\n' "${FOUND_ITEMS[@]}" | grep "^npm:" | cut -d: -f2- || true)
if [ -n "$NPM_TO_RM" ]; then
  info "Uninstalling npm packages..."
  while IFS= read -r pkg; do
    npm uninstall -g "$pkg" 2>/dev/null || true
    pass "Uninstalled: $pkg"
  done <<< "$NPM_TO_RM"
fi

# Step 7: Uninstall Homebrew packages
BREW_TO_RM=$(printf '%s\n' "${FOUND_ITEMS[@]}" | grep "^brew:" | cut -d: -f2- || true)
if [ -n "$BREW_TO_RM" ]; then
  info "Uninstalling Homebrew packages..."
  while IFS= read -r pkg; do
    brew uninstall "$pkg" 2>/dev/null || true
    pass "Uninstalled: $pkg"
  done <<< "$BREW_TO_RM"
fi

# Step 8: Remove launchd services
LAUNCHD_TO_RM=$(printf '%s\n' "${FOUND_ITEMS[@]}" | grep "^launchd:" | cut -d: -f2- || true)
if [ -n "$LAUNCHD_TO_RM" ]; then
  info "Removing LaunchAgents..."
  while IFS= read -r la; do
    LABEL=$(defaults read "$la" Label 2>/dev/null || basename "$la" .plist)
    launchctl unload "$la" 2>/dev/null || true
    rm -f "$la" 2>/dev/null || true
    pass "Removed: $la"
  done <<< "$LAUNCHD_TO_RM"
fi

# Step 9: Remove systemd services
SYSTEMD_TO_RM=$(printf '%s\n' "${FOUND_ITEMS[@]}" | grep "^systemd:" | cut -d: -f2- || true)
if [ -n "$SYSTEMD_TO_RM" ]; then
  info "Removing systemd services..."
  while IFS= read -r svc; do
    SVC_NAME=$(echo "$svc" | awk '{print $1}')
    sudo systemctl stop "$SVC_NAME" 2>/dev/null || true
    sudo systemctl disable "$SVC_NAME" 2>/dev/null || true
    pass "Disabled: $SVC_NAME"
  done <<< "$SYSTEMD_TO_RM"
fi

# Step 10: Remove cron entries
if printf '%s\n' "${FOUND_ITEMS[@]}" | grep -q "^cron:"; then
  info "Removing cron entries..."
  crontab -l 2>/dev/null | grep -viE 'openclaw|ctg-core|paperclip|qmd' | crontab - 2>/dev/null || true
  pass "OpenClaw cron entries removed"
fi

# Step 11: Remove directories and files
DIRS_TO_RM=$(printf '%s\n' "${FOUND_ITEMS[@]}" | grep "^dir:" | cut -d: -f2- || true)
if [ -n "$DIRS_TO_RM" ]; then
  info "Removing directories..."
  while IFS= read -r dir; do
    rm -rf "$dir"
    pass "Removed: $dir"
  done <<< "$DIRS_TO_RM"
fi

FILES_TO_RM=$(printf '%s\n' "${FOUND_ITEMS[@]}" | grep "^file:" | cut -d: -f2- || true)
if [ -n "$FILES_TO_RM" ]; then
  info "Removing files..."
  while IFS= read -r f; do
    rm -f "$f"
    pass "Removed: $f"
  done <<< "$FILES_TO_RM"
fi

# Step 12: Shell profile references (warn, don't auto-edit)
PROFILES_HIT=$(printf '%s\n' "${FOUND_ITEMS[@]}" | grep "^profile:" | cut -d: -f2- || true)
if [ -n "$PROFILES_HIT" ]; then
  echo ""
  warn "Shell profiles with OpenClaw references (edit manually):"
  while IFS= read -r p; do
    echo -e "    ${YELLOW}→${NC} $p"
    grep -n -iE 'openclaw|ctg-core|paperclip|OPENCLAW' "$p" 2>/dev/null | while IFS= read -r line; do
      echo -e "      ${DIM}$line${NC}"
    done
  done <<< "$PROFILES_HIT"
  echo ""
  warn "Remove these lines manually, then run: source ~/.zshrc (or restart terminal)"
fi

# ──────────────────────────────────────────────────
# Done
# ──────────────────────────────────────────────────
header "Uninstall Complete"

pass "All OpenClaw components removed"
echo ""
echo "  Machine is ready for a fresh deployment."
echo "  Run deploy.sh when ready."
echo ""
