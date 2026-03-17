-- CTG Core Hub — Tenant Registry Schema

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,                    -- UUID company ID
  name TEXT NOT NULL,                     -- Company display name
  contact_email TEXT,                     -- Primary contact
  management_token TEXT NOT NULL,         -- Scoped token for relay auth
  relay_url TEXT,                         -- Client's relay endpoint (if reachable)
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  timestamp TEXT NOT NULL,
  payload TEXT NOT NULL,                  -- JSON health report
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_checkins_tenant ON checkins(tenant_id);
CREATE INDEX IF NOT EXISTS idx_checkins_timestamp ON checkins(timestamp DESC);

CREATE TABLE IF NOT EXISTS pending_commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  command_type TEXT NOT NULL,             -- config-update, sop-update, deploy-bot
  payload TEXT NOT NULL,                  -- JSON command payload
  status TEXT DEFAULT 'pending',          -- pending, delivered, failed
  created_at TEXT DEFAULT (datetime('now')),
  delivered_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_commands_tenant ON pending_commands(tenant_id, status);
