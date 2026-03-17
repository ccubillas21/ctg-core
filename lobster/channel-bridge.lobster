# Lobster Workflow: Channel Bridge
# Connect an existing Slack/Teams workspace to an agent

workflow:
  name: channel-bridge
  version: "1.0"
  trigger: manual

steps:
  - id: validate-params
    name: Validate input parameters
    agent: primary
    action: shell
    config:
      command: |
        if [ -z "{{agent_id}}" ] || [ -z "{{channel_type}}" ]; then
          echo "ERROR: agent_id and channel_type are required"
          exit 1
        fi
        case "{{channel_type}}" in
          slack|msteams|telegram) echo "Channel type: {{channel_type}}" ;;
          *) echo "ERROR: channel_type must be slack, msteams, or telegram"; exit 1 ;;
        esac

  - id: check-agent-exists
    name: Verify agent exists
    agent: dispatch
    action: shell
    config:
      command: |
        CONFIG="/home/ctg/.openclaw/openclaw.json"
        AGENT=$(jq -e --arg id "{{agent_id}}" '.agents.list[] | select(.id == $id)' "$CONFIG" 2>/dev/null)
        if [ -z "$AGENT" ]; then
          echo "ERROR: Agent '{{agent_id}}' not found in config"
          exit 1
        fi
        echo "Agent '{{agent_id}}' found"

  - id: approval-gate
    name: Approve channel bridge
    agent: primary
    action: approval_gate
    config:
      approvers:
        - human
      message: |
        Channel bridge requested:

        Agent: {{agent_id}}
        Channel: {{channel_type}}
        Account: {{account_id}}

        This will add a binding from agent '{{agent_id}}' to the
        {{channel_type}} account '{{account_id}}'.

        Approve to proceed?

  - id: add-binding
    name: Add binding to openclaw.json
    agent: primary
    action: shell
    config:
      command: |
        CONFIG="/home/ctg/.openclaw/openclaw.json"
        jq --arg agent "{{agent_id}}" \
           --arg channel "{{channel_type}}" \
           --arg account "{{account_id}}" \
           '.bindings += [{"agentId": $agent, "match": {"channel": $channel, "accountId": $account}}]' \
           "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
        echo "Binding added: {{agent_id}} → {{channel_type}}/{{account_id}}"

  - id: restart-channel
    name: Restart OpenClaw to pick up new binding
    agent: dispatch
    action: shell
    config:
      command: |
        # Signal OpenClaw to reload config (if supported) or note restart needed
        if wget -qO- --post-data='{}' http://openclaw:18789/api/reload 2>/dev/null; then
          echo "Config reloaded"
        else
          echo "NOTE: OpenClaw container may need restart to pick up new binding"
          echo "Run: docker compose restart openclaw"
        fi

  - id: verify
    name: Verify channel connection
    agent: dispatch
    action: shell
    config:
      command: |
        sleep 3
        HEALTH=$(wget -qO- http://openclaw:18789/health 2>/dev/null)
        echo "Gateway health: $HEALTH"
        echo ""
        echo "Channel bridge complete: {{agent_id}} → {{channel_type}}/{{account_id}}"

---

variables: {}

---

usage:
  example: |
    lobster run channel-bridge.lobster \
      --var agent_id="primary" \
      --var channel_type="slack" \
      --var account_id="assistant"
