# Lobster Workflow: Slack App Setup
# End-to-end Slack app creation, configuration, and agent binding

workflow:
  name: slack-setup
  version: "1.0"
  trigger: manual

steps:
  - id: validate-params
    name: Validate input parameters
    agent: primary
    action: shell
    config:
      command: |
        if [ -z "{{agent_id}}" ] || [ -z "{{bot_name}}" ] || [ -z "{{account_name}}" ]; then
          echo "ERROR: agent_id, bot_name, and account_name are required"
          exit 1
        fi
        echo "Setting up Slack for agent={{agent_id}} bot={{bot_name}} account={{account_name}}"

  - id: guide-app-creation
    name: Guide human through Slack app creation
    agent: primary
    action: approval_gate
    config:
      approvers:
        - human
      message: |
        Please create a Slack app manually:

        1. Go to https://api.slack.com/apps → Create New App → From Scratch
        2. App Name: {{bot_name}}
        3. Select your workspace
        4. Under OAuth & Permissions, add these Bot Token Scopes:
           app_mentions:read, channels:history, channels:join, channels:read,
           chat:write, commands, emoji:read, files:read, files:write,
           groups:history, im:history, im:read, im:write,
           mpim:history, mpim:read, mpim:write,
           pins:read, pins:write, reactions:read, reactions:write,
           users:read, assistant:write
        5. Enable Socket Mode → generate App-Level Token (connections:write scope)
        6. Enable Event Subscriptions → subscribe to:
           message.im, message.channels, message.groups, message.mpim, app_mention
        7. Install app to workspace

        When done, approve this step and provide:
        - Bot Token (xoxb-...)
        - App Token (xapp-...)

  - id: configure-openclaw
    name: Add Slack account to openclaw.json
    agent: primary
    action: shell
    config:
      command: |
        CONFIG="/home/ctg/.openclaw/openclaw.json"
        # Update slack channel config using jq
        jq --arg name "{{account_name}}" \
           --arg display "{{bot_name}}" \
           '.channels.slack.enabled = true |
            .channels.slack.mode = "socket" |
            .channels.slack.defaultAccount = $name |
            .channels.slack.accounts[$name] = {
              "name": $display,
              "botToken": "${SLACK_BOT_TOKEN_" + ($name | ascii_upcase) + "}",
              "appToken": "${SLACK_APP_TOKEN_" + ($name | ascii_upcase) + "}",
              "dmPolicy": "open",
              "allowFrom": ["*"],
              "groupPolicy": "open",
              "nativeStreaming": true,
              "streaming": "partial"
            }' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
        echo "Slack account '{{account_name}}' configured"

  - id: add-binding
    name: Bind agent to Slack account
    agent: primary
    action: shell
    config:
      command: |
        CONFIG="/home/ctg/.openclaw/openclaw.json"
        jq --arg agent "{{agent_id}}" \
           --arg account "{{account_name}}" \
           '.bindings += [{"agentId": $agent, "match": {"channel": "slack", "accountId": $account}}]' \
           "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
        echo "Agent '{{agent_id}}' bound to Slack account '{{account_name}}'"

  - id: prompt-tokens
    name: Remind to set environment variables
    agent: primary
    action: approval_gate
    config:
      approvers:
        - human
      message: |
        Add these environment variables to your .env file:

        SLACK_BOT_TOKEN_{{account_name | upper}}=xoxb-YOUR-TOKEN
        SLACK_APP_TOKEN_{{account_name | upper}}=xapp-YOUR-TOKEN

        Then restart the OpenClaw container:
        docker compose restart openclaw

        Approve when done.

  - id: verify
    name: Verify Slack connection
    agent: dispatch
    action: shell
    config:
      command: |
        sleep 5
        # Check if Slack channel is connected
        STATUS=$(wget -qO- http://localhost:18789/health 2>/dev/null)
        if echo "$STATUS" | jq -e '.channels.slack.connected' >/dev/null 2>&1; then
          echo "Slack connected successfully"
        else
          echo "WARNING: Slack connection not confirmed. Check logs."
        fi

  - id: notify-completion
    name: Notify setup complete
    agent: primary
    action: shell
    config:
      command: |
        echo "Slack setup complete for agent '{{agent_id}}' via account '{{account_name}}'"
        echo "Bot '{{bot_name}}' is ready to receive messages"

---

variables: {}

---

usage:
  example: |
    lobster run slack-setup.lobster \
      --var agent_id="primary" \
      --var bot_name="CTG Assistant" \
      --var account_name="assistant"
