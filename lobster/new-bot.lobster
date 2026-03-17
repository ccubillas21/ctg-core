# Lobster Workflow: Deploy New Corporate Bot
# Creates agent workspace, registers in Paperclip, seeds config

workflow:
  name: new-bot
  version: "1.0"
  trigger: manual

steps:
  - id: validate-params
    name: Validate input parameters
    agent: primary
    action: shell
    config:
      command: |
        if [ -z "{{agent_name}}" ] || [ -z "{{agent_title}}" ] || [ -z "{{model_tier}}" ]; then
          echo "ERROR: agent_name, agent_title, and model_tier are required"
          exit 1
        fi
        case "{{model_tier}}" in
          sonnet|opus|haiku) echo "Model tier: {{model_tier}}" ;;
          *) echo "ERROR: model_tier must be sonnet, opus, or haiku"; exit 1 ;;
        esac

  - id: approval-gate
    name: Approve new bot deployment
    agent: primary
    action: approval_gate
    config:
      approvers:
        - human
      message: |
        New bot deployment requested:

        Name: {{agent_name}}
        Title: {{agent_title}}
        Model: {{model_tier}}
        Purpose: {{purpose}}

        This will:
        1. Create agent workspace directory
        2. Register agent in Paperclip
        3. Add agent to OpenClaw config

        Approve to proceed?

  - id: create-workspace
    name: Create agent workspace directory
    agent: engineer
    action: shell
    config:
      command: |
        AGENT_DIR="/home/ctg/.openclaw/agents/{{agent_name}}"
        mkdir -p "$AGENT_DIR/memory"

        # Determine model ID
        case "{{model_tier}}" in
          sonnet) MODEL="anthropic/claude-sonnet-4-6" ;;
          opus)   MODEL="anthropic/claude-opus-4-6" ;;
          haiku)  MODEL="anthropic/claude-haiku-4-5" ;;
        esac

        # Generate SOUL.md
        cat > "$AGENT_DIR/SOUL.md" << 'SOULEOF'
        # SOUL.md — {{agent_name}}

        **Name:** {{agent_name}}
        **Title:** {{agent_title}}
        **Department:** Operations

        ## Your Purpose

        {{purpose}}

        ## Your Constraints

        - Follow all SOPs in the corporate knowledge base
        - Escalate per escalation SOP when uncertain
        - Never share credentials or API keys
        SOULEOF

        # Generate AGENTS.md
        cat > "$AGENT_DIR/AGENTS.md" << 'AGENTSEOF'
        # AGENTS.md — {{agent_name}} Workspace

        **Agent:** {{agent_name}} ({{agent_title}})
        **Model:** {{model_tier}}

        ## QMD Collections
        - `/sops/` — Standard operating procedures
        - `/lobster/` — Workflow definitions
        AGENTSEOF

        # Generate IDENTITY.md
        AGENT_UUID=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || openssl rand -hex 16 | sed 's/\(.\{8\}\)\(.\{4\}\)\(.\{4\}\)\(.\{4\}\)\(.\{12\}\)/\1-\2-\3-\4-\5/')
        cat > "$AGENT_DIR/IDENTITY.md" << IDEOF
        # IDENTITY.md — {{agent_name}}

        **Name:** {{agent_name}}
        **Title:** {{agent_title}}
        **Role:** General Agent
        **Agent ID:** \`$AGENT_UUID\`
        IDEOF

        echo "Workspace created: $AGENT_DIR"
        echo "AGENT_UUID=$AGENT_UUID"

  - id: register-paperclip
    name: Register agent in Paperclip
    agent: engineer
    action: http_post
    config:
      url: http://paperclip:3100/api/companies/{{company_id}}/agents
      method: POST
      body:
        name: "{{agent_name}}"
        title: "{{agent_title}}"
        role: general
        capabilities: "{{purpose}}"
        adapterType: openclaw_gateway
    output:
      paperclip_agent_id: $.id

  - id: update-openclaw-config
    name: Add agent to OpenClaw config
    agent: engineer
    action: shell
    config:
      command: |
        CONFIG="/home/ctg/.openclaw/openclaw.json"

        case "{{model_tier}}" in
          sonnet) MODEL="anthropic/claude-sonnet-4-6" ;;
          opus)   MODEL="anthropic/claude-opus-4-6" ;;
          haiku)  MODEL="anthropic/claude-haiku-4-5" ;;
        esac

        jq --arg id "{{agent_name}}" \
           --arg model "$MODEL" \
           '.agents.list += [{
              "id": $id,
              "name": $id,
              "workspace": "/home/ctg/.openclaw/agents/" + $id,
              "agentDir": "/home/ctg/.openclaw/agents/" + $id,
              "model": {"primary": $model},
              "tools": {"allow": ["lobster", "qmd", "paperclip"], "fs": {"workspaceOnly": true}}
            }]' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
        echo "Agent '{{agent_name}}' added to OpenClaw config"

  - id: verify
    name: Verify agent registration
    agent: dispatch
    action: shell
    config:
      command: |
        echo "Verifying agent '{{agent_name}}'..."
        # Check workspace exists
        ls -la "/home/ctg/.openclaw/agents/{{agent_name}}/SOUL.md" && echo "Workspace: OK"
        # Check Paperclip registration
        wget -qO- "http://paperclip:3100/api/companies/{{company_id}}/agents" 2>/dev/null | \
          jq -e ".[] | select(.name == \"{{agent_name}}\")" && echo "Paperclip: OK"

  - id: notify
    name: Notify deployment complete
    agent: primary
    action: shell
    config:
      command: |
        echo "New bot deployed successfully:"
        echo "  Name: {{agent_name}}"
        echo "  Title: {{agent_title}}"
        echo "  Model: {{model_tier}}"
        echo ""
        echo "Next steps:"
        echo "  1. Connect a channel: lobster run slack-setup.lobster --var agent_id={{agent_name}} ..."
        echo "  2. Or bridge an existing channel: lobster run channel-bridge.lobster ..."

---

variables:
  company_id: "${COMPANY_ID}"

---

usage:
  example: |
    lobster run new-bot.lobster \
      --var agent_name="support" \
      --var agent_title="Customer Support Specialist" \
      --var model_tier="sonnet" \
      --var purpose="Handle customer inquiries, FAQ responses, and ticket triage"
