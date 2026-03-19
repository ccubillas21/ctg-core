-- Gatekeeper Usage Ledger Schema

CREATE TABLE IF NOT EXISTS llm_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  agent_id TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  provider_cost_cents INTEGER NOT NULL DEFAULT 0,
  billed_cost_cents INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_llm_calls_agent_date ON llm_calls(agent_id, timestamp);

CREATE TABLE IF NOT EXISTS content_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  agent_id TEXT NOT NULL,
  request_type TEXT NOT NULL,
  domain TEXT,
  size_bytes INTEGER DEFAULT 0,
  blocked INTEGER DEFAULT 0,
  block_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_content_agent ON content_requests(agent_id, timestamp);

CREATE TABLE IF NOT EXISTS usage_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  model TEXT NOT NULL,
  llm_calls INTEGER DEFAULT 0,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  provider_cost_cents INTEGER DEFAULT 0,
  billed_cost_cents INTEGER DEFAULT 0,
  content_requests INTEGER DEFAULT 0,
  content_blocked INTEGER DEFAULT 0,
  UNIQUE(date, agent_id, model)
);
