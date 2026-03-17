# Lobster Workflow: Health Report
# Scheduled status report to parent hub

workflow:
  name: health-report
  version: "1.0"
  trigger: manual

steps:
  - id: check-services
    name: Check all service health endpoints
    agent: dispatch
    action: shell
    config:
      command: |
        REPORT="/tmp/health-report-$(date +%s).json"
        echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","services":{}}' > "$REPORT"

        # Check PostgreSQL
        if pg_isready -h postgresql -U ctgcore >/dev/null 2>&1; then
          PG_STATUS="healthy"
        else
          PG_STATUS="unhealthy"
        fi

        # Check Paperclip
        PC_RESP=$(wget -qO- http://paperclip:3100/api/health 2>/dev/null) && PC_STATUS="healthy" || PC_STATUS="unhealthy"

        # Check OpenClaw Gateway
        GW_RESP=$(wget -qO- http://openclaw:18789/health 2>/dev/null) && GW_STATUS="healthy" || GW_STATUS="unhealthy"

        # Check Mission Control
        MC_RESP=$(wget -qO- http://mission-control:4000/api/status 2>/dev/null) && MC_STATUS="healthy" || MC_STATUS="unhealthy"

        # Build report
        jq -n \
          --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
          --arg pg "$PG_STATUS" \
          --arg pc "$PC_STATUS" \
          --arg gw "$GW_STATUS" \
          --arg mc "$MC_STATUS" \
          '{
            timestamp: $ts,
            services: {
              postgresql: $pg,
              paperclip: $pc,
              gateway: $gw,
              mission_control: $mc
            }
          }' > "$REPORT"
        cat "$REPORT"

  - id: check-agents
    name: Check agent status from Paperclip
    agent: dispatch
    action: shell
    config:
      command: |
        AGENTS=$(wget -qO- "http://paperclip:3100/api/companies/${COMPANY_ID}/agents" 2>/dev/null)
        if [ $? -eq 0 ]; then
          echo "$AGENTS" | jq '[.[] | {name: .name, status: .status, lastActivity: .lastActivityAt}]'
        else
          echo '[]'
        fi

  - id: check-resources
    name: Collect resource usage
    agent: dispatch
    action: shell
    config:
      command: |
        # Disk usage
        DISK_USED=$(df -h /home/ctg 2>/dev/null | tail -1 | awk '{print $5}' || echo "unknown")

        # Memory (from /proc if available)
        if [ -f /proc/meminfo ]; then
          MEM_TOTAL=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
          MEM_AVAIL=$(awk '/MemAvailable/ {print $2}' /proc/meminfo)
          MEM_USED_PCT=$(( (MEM_TOTAL - MEM_AVAIL) * 100 / MEM_TOTAL ))
        else
          MEM_USED_PCT="unknown"
        fi

        jq -n \
          --arg disk "$DISK_USED" \
          --arg mem "${MEM_USED_PCT}%" \
          '{ disk_used: $disk, memory_used: $mem }'

  - id: send-to-hub
    name: Send health report to parent hub
    agent: dispatch
    action: shell
    config:
      command: |
        if [ -z "$PARENT_HUB_URL" ] || [ -z "$PARENT_HUB_TOKEN" ]; then
          echo "Parent hub not configured, skipping check-in"
          exit 0
        fi

        # Combine all data into final payload
        PAYLOAD=$(jq -n \
          --arg company "$COMPANY_ID" \
          --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
          '{
            companyId: $company,
            timestamp: $ts,
            type: "health-report"
          }')

        wget -qO- \
          --header="Authorization: Bearer $PARENT_HUB_TOKEN" \
          --header="Content-Type: application/json" \
          --post-data="$PAYLOAD" \
          "$PARENT_HUB_URL/api/tenants/$COMPANY_ID/checkin" || \
          echo "WARNING: Failed to send health report to parent hub"

---

variables: {}

---

usage:
  example: |
    # Manual run
    lobster run health-report.lobster

    # Schedule via cron (every 5 minutes)
    # */5 * * * * openclaw lobster run /home/ctg/.openclaw/lobster/health-report.lobster
