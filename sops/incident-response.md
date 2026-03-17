# SOP: Incident Response

**Owner:** Dispatch Agent (detection), Primary Agent (coordination)
**Last Updated:** {{DEPLOY_DATE}}
**Approval Required:** P0/P1 require human acknowledgment

---

## Severity Levels

| Level | Definition | Response Time | Escalation |
|-------|-----------|---------------|------------|
| P0 | Service down, all users affected | Immediate | Human + Engineer |
| P1 | Major degradation, most users affected | < 15 min | Human + Engineer |
| P2 | Minor issue, some users affected | < 1 hour | Primary + Engineer |
| P3 | Cosmetic/low-impact | Next business day | Primary |

## Detection

Dispatch monitors all services every 5 minutes:
- HTTP health endpoints (Paperclip, Gateway, Mission Control)
- Agent liveness (last check-in time)
- Resource thresholds (CPU > 90%, memory > 85%, disk > 80%)
- Error rate spikes in logs

## Response Procedure

### Step 1: Detect & Classify
1. Dispatch detects anomaly via health check
2. Classify severity (P0-P3) based on impact
3. Create incident record in Paperclip

### Step 2: Alert
- **P0/P1:** Immediate alert to Primary + all channels
- **P2:** Alert to Primary via internal message
- **P3:** Log and queue for next business day

### Step 3: Investigate
1. Primary assigns to Engineer (P0-P2) or self-handles (P3)
2. Engineer investigates root cause
3. Updates incident log with findings

### Step 4: Mitigate
1. Apply fix or workaround
2. Verify service restored via health checks
3. Update Paperclip task with resolution

### Step 5: Communicate
1. Primary notifies stakeholders of resolution
2. Include: what happened, impact, fix applied, prevention plan

### Step 6: Post-Mortem (P0/P1 only)
1. Schedule within 24 hours of resolution
2. Document timeline, root cause, action items
3. Update SOPs if process gaps found

---

## Escalation to Human

Escalate immediately when:
- P0 incident not resolved within 30 minutes
- Data loss suspected
- Security breach detected
- Budget/cost implications
