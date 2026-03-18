#!/usr/bin/env bash
# AIMEE Dashboard — Sync local service data to snapshot.json for Azure hosting
# Runs via cron every 5 minutes. Polls local services, calculates real costs, pushes to git.

set -euo pipefail

DASHBOARD_DIR="$(cd "$(dirname "$0")" && pwd)"
SNAPSHOT="$DASHBOARD_DIR/snapshot.json"
LOG="$DASHBOARD_DIR/sync.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"; }

# Config — same ports as config.js live view
GATEWAY_URL="http://localhost:18789"
PAPERCLIP_URL="http://localhost:3100"
RELAY_URL="http://localhost:19090"

# Curl with timeout, returns body or empty string
safe_curl() {
  curl -sf --max-time 5 "$1" 2>/dev/null || echo ""
}

log "Starting sync..."

# ── Poll services ────────────────────────────────────────

gw_ok="unreachable"
gw_body=$(safe_curl "$GATEWAY_URL/health")
if [ -n "$gw_body" ]; then gw_ok="healthy"; fi

pc_ok="unreachable"
pc_body=$(safe_curl "$PAPERCLIP_URL/api/health")
if [ -n "$pc_body" ]; then pc_ok="healthy"; fi

relay_ok="unreachable"
relay_status=$(safe_curl "$RELAY_URL/status")
if [ -n "$relay_status" ]; then relay_ok="healthy"; fi

relay_health=$(safe_curl "$RELAY_URL/health")
if [ -z "$relay_health" ]; then relay_health="{}"; fi

any_ok=false
if [ "$gw_ok" = "healthy" ] || [ "$pc_ok" = "healthy" ] || [ "$relay_ok" = "healthy" ]; then
  any_ok=true
fi

# ── Calculate real costs from OpenClaw session logs ──────
costs=$(node "$DASHBOARD_DIR/calc-costs.js" 2>/dev/null || echo '{"agents":[],"providers":[],"dailyTrend":[0,0,0,0,0,0,0],"revenue":0}')

# ── Build snapshot ───────────────────────────────────────

cat > "$SNAPSHOT" <<SNAP
{
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "services": {
    "gateway": "$gw_ok",
    "paperclip": "$pc_ok",
    "relay": "$relay_ok"
  },
  "relay": $relay_health,
  "agents": $(echo "$relay_status" | node -e "
    let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
      try{let j=JSON.parse(d);console.log(JSON.stringify(j.agents||[]))}
      catch(e){console.log('[]')}
    })
  " 2>/dev/null || echo '[]'),
  "costs": $costs,
  "_anyOk": $any_ok
}
SNAP

log "Snapshot written. Services: gw=$gw_ok pc=$pc_ok relay=$relay_ok"

# ── Git commit & push (via deploy clone) ─────────────────

DEPLOY_DIR="$HOME/.openclaw/aimee-dashboard-deploy"

if [ ! -d "$DEPLOY_DIR/.git" ]; then
  log "Deploy repo missing at $DEPLOY_DIR — skipping push."
else
  cp "$SNAPSHOT" "$DEPLOY_DIR/snapshot.json"
  # Phase 3b: Memory + Plaza snapshots
  [ -f "$HOME/.openclaw/memory/memory-snapshot.json" ] && cp "$HOME/.openclaw/memory/memory-snapshot.json" "$DEPLOY_DIR/memory-snapshot.json"
  [ -f "$HOME/.openclaw/plaza/feed.json" ] && cp "$HOME/.openclaw/plaza/feed.json" "$DEPLOY_DIR/feed.json"
  cd "$DEPLOY_DIR"

  git add snapshot.json
  git add memory-snapshot.json 2>/dev/null
  git add feed.json 2>/dev/null

  if git diff --cached --quiet 2>/dev/null; then
    log "No changes, skipping push."
  else
    if git commit -m "sync: dashboard snapshot $(date '+%Y-%m-%d %H:%M')" --no-gpg-sign 2>&1; then
      git push origin main 2>&1 && log "Pushed to GitHub." || log "Push failed (git push error)."
    else
      log "Commit failed — check git config (user.name/email) in $DEPLOY_DIR."
    fi
  fi
fi

log "Sync complete."
