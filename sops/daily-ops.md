# SOP: Daily Operations Checklist

**Owner:** Dispatch Agent
**Last Updated:** {{DEPLOY_DATE}}
**Schedule:** Every 5 minutes (health), daily summary at 09:00 local

---

## Continuous Monitoring (Every 5 Minutes)

### Service Health Checks
| Service | Endpoint | Expected |
|---------|----------|----------|
| PostgreSQL | `pg_isready` | Ready |
| Paperclip | `http://paperclip:3100/api/health` | 200 OK |
| OpenClaw Gateway | `http://openclaw:18789/health` | 200 OK |
| Mission Control | `http://mission-control:4000/api/status` | 200 OK |
| Parent Relay | `http://parent-relay:9090/health` | 200 OK |

### Agent Liveness
- Check each agent's last activity timestamp
- Alert if any agent hasn't checked in for > 10 minutes

### Resource Monitoring
- Container CPU usage (alert if > 90% sustained for 5 min)
- Container memory usage (alert if > 85%)
- Disk usage on volumes (alert if > 80%)

---

## Daily Summary (09:00)

Generate and send to Primary:

1. **Uptime report** — Service availability over last 24 hours
2. **Incident summary** — Any P0-P3 incidents and current status
3. **Agent activity** — Messages handled, tasks completed per agent
4. **Resource trends** — CPU/memory/disk trend (stable/increasing/decreasing)
5. **Parent relay status** — Last successful check-in, any failed check-ins

Run via: `lobster run health-report.lobster`

---

## Weekly Tasks (Monday 09:00)

1. **Log rotation** — Archive logs older than 7 days
2. **Backup verification** — Confirm PostgreSQL backup completed
3. **SOP review** — Check if any SOPs have pending updates from hub
4. **Capacity check** — Project disk usage for next 30 days

---

## Alert Actions

When a health check fails:
1. Retry once after 30 seconds
2. If still failing, classify severity per incident-response SOP
3. Create incident in Paperclip
4. Alert Primary agent
5. If P0/P1, trigger incident-response workflow
