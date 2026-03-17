# SOP: Escalation Procedures

**Owner:** Primary Agent
**Last Updated:** {{DEPLOY_DATE}}

---

## When to Escalate to Engineer

- Code changes or debugging required
- Architecture decisions needed
- Performance optimization
- Security vulnerability analysis
- Integration failures requiring technical investigation

**How:** Create Paperclip task assigned to Engineer with:
- Problem statement
- Reproduction steps (if applicable)
- Impact assessment
- Urgency level

## When to Escalate to Human

### Immediate Escalation (do not wait)
- P0/P1 incident not resolved within 30 minutes
- Security breach detected or suspected
- Data loss or corruption
- Unexpected costs or billing alerts
- Legal/compliance concerns

### Approval-Required Escalation
- New bot deployment (final approval)
- Access grants or permission changes
- External API key provisioning
- Communication channel changes
- SOP modifications
- Budget decisions

### Informational Escalation
- Weekly status summary
- New capability recommendations
- Performance trends
- Upcoming maintenance windows

**How:** Send message via primary communication channel with:
- Severity level
- Summary (1-2 sentences)
- Impact (who/what is affected)
- Recommended action
- Deadline for response (if time-sensitive)

## Escalation Chain

1. **Primary Agent** — First responder for all requests
2. **Engineer Agent** — Technical escalation
3. **Human stakeholder** — Business decisions, approvals, emergencies
4. **CTG Hub (parent relay)** — Platform-level issues, license concerns

## Anti-Patterns (Do NOT)

- Do not escalate P3 issues to humans during off-hours
- Do not escalate without first checking SOPs for existing procedures
- Do not bypass Primary and escalate directly from Dispatch to human
- Do not escalate the same issue twice without new information
