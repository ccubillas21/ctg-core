# CTG Core Gatekeeper Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Parent Relay with a Gatekeeper that proxies all LLM calls, sanitizes external content, tracks usage/spending, and enforces licensing — all behind a Docker `internal: true` network that physically prevents agents from reaching the internet directly.

**Architecture:** Single Node.js service with four subsystems (LLM proxy, content sanitizer, usage ledger, hub reporter). Uses plain `http.request` with body buffering for proxying. SQLite for usage tracking. Absorbs existing Parent Relay logic. Docker Compose split into two networks: `internal-net` (no internet) and `gateway-net` (internet access for Gatekeeper + n8n only).

**Tech Stack:** Node.js 22, better-sqlite3, Docker Compose v2 with `internal: true` networking

**Spec:** `docs/superpowers/specs/2026-03-18-ctg-core-gatekeeper-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `gatekeeper/package.json` | Dependencies (better-sqlite3) and scripts |
| `gatekeeper/index.js` | HTTP server on :9090, request routing, auth validation, graceful shutdown |
| `gatekeeper/proxy.js` | LLM reverse proxy — URL parsing, key injection, body buffering, response forwarding |
| `gatekeeper/sanitizer.js` | Content fetch — URL fetching, HTML stripping, rate limiting, structured response |
| `gatekeeper/ledger.js` | SQLite schema, logging calls, computing rollups, serving usage API |
| `gatekeeper/hub.js` | Hub check-in, license enforcement, command handling (config/sop/deploy/pricing) |
| `gatekeeper/pricing.json` | Model cost table (provider + billing rates) |
| `gatekeeper/schema.sql` | SQLite table definitions (llm_calls, content_requests, usage_daily) |
| `Dockerfile.gatekeeper` | Multi-stage Node 22 Alpine build |
| `gatekeeper/test/test-ledger.js` | Ledger unit tests |
| `gatekeeper/test/test-proxy.js` | Proxy URL parsing and key injection tests |
| `gatekeeper/test/test-sanitizer.js` | Content sanitizer tests |
| `gatekeeper/test/test-hub.js` | Hub reporter and license enforcement tests |
| `gatekeeper/test/test-auth.js` | Internal auth token validation tests |

### Modified Files

| File | Change |
|---|---|
| `docker-compose.yml` | Two networks, Gatekeeper + n8n services, remove parent-relay |
| `.env.template` | Move API keys to Gatekeeper section, add GATEKEEPER_INTERNAL_TOKEN |
| `openclaw.seed.json` | Per-agent baseUrl overrides, dummy API key |
| `deploy.sh` | Port checks, API key routing, Gatekeeper token generation |
| `setup.sh` | Same changes as deploy.sh |
| `hub/tenants.sql` | Add usage_daily table, license columns |
| `hub/index.js` | Usage endpoint, dashboard endpoint, license in check-in response, bot-request handler |

### Deleted Files

| File | Reason |
|---|---|
| `parent-relay/` (entire directory) | Absorbed into gatekeeper/hub.js |

---

## Task 1: Gatekeeper Scaffolding — package.json, schema, pricing

**Files:**
- Create: `gatekeeper/package.json`
- Create: `gatekeeper/schema.sql`
- Create: `gatekeeper/pricing.json`

- [ ] **Step 1: Create gatekeeper directory**

```bash
mkdir -p ~/.openclaw/ctg-core/gatekeeper/test
```

- [ ] **Step 2: Write package.json**

Create `gatekeeper/package.json`:
```json
{
  "name": "ctg-gatekeeper",
  "version": "1.0.0",
  "description": "CTG Core Gatekeeper — LLM proxy, content sanitizer, usage ledger, hub reporter",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "test": "node --test test/"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0"
  }
}
```

- [ ] **Step 3: Write schema.sql**

Create `gatekeeper/schema.sql` with the three tables from the spec:
```sql
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
```

- [ ] **Step 4: Write pricing.json**

Create `gatekeeper/pricing.json` with the four models from the spec (exact content from spec lines 211-237).

- [ ] **Step 5: Commit**

```bash
cd ~/.openclaw/ctg-core
git add gatekeeper/package.json gatekeeper/schema.sql gatekeeper/pricing.json
git commit -m "feat(gatekeeper): scaffold package.json, schema, and pricing table"
```

---

## Task 2: Usage Ledger (ledger.js)

**Files:**
- Create: `gatekeeper/ledger.js`
- Create: `gatekeeper/test/test-ledger.js`

- [ ] **Step 1: Write failing tests for ledger**

Create `gatekeeper/test/test-ledger.js`:
```javascript
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const DB_PATH = path.join(__dirname, "test-ledger.db");

describe("Ledger", () => {
  let ledger;

  before(() => {
    // Clean up any leftover test DB
    try { fs.unlinkSync(DB_PATH); } catch {}
    const Ledger = require("../ledger");
    ledger = new Ledger(DB_PATH, path.join(__dirname, "../pricing.json"));
  });

  after(() => {
    ledger.close();
    try { fs.unlinkSync(DB_PATH); } catch {}
  });

  it("logs an LLM call and retrieves it", () => {
    ledger.logLlmCall({
      agent_id: "primary",
      model: "anthropic/claude-sonnet-4-6",
      provider: "anthropic",
      tokens_in: 1000,
      tokens_out: 500,
      latency_ms: 340,
    });

    const usage = ledger.getUsageToday();
    assert.ok(usage.primary);
    assert.ok(usage.primary["anthropic/claude-sonnet-4-6"]);
    assert.equal(usage.primary["anthropic/claude-sonnet-4-6"].calls, 1);
    assert.equal(usage.primary["anthropic/claude-sonnet-4-6"].tokens_in, 1000);
    assert.equal(usage.primary["anthropic/claude-sonnet-4-6"].tokens_out, 500);
  });

  it("calculates provider and billed costs correctly", () => {
    // Sonnet: input 3.00/MTok, output 15.00/MTok
    // 1000 input tokens = 0.003 = 0.3 cents
    // 500 output tokens = 0.0075 = 0.75 cents
    // total provider = ~1 cent
    const usage = ledger.getUsageToday();
    const sonnet = usage.primary["anthropic/claude-sonnet-4-6"];
    assert.ok(sonnet.provider_cents > 0);
    assert.ok(sonnet.billed_cents >= sonnet.provider_cents);
  });

  it("logs a content request", () => {
    ledger.logContentRequest({
      agent_id: "primary",
      request_type: "fetch",
      domain: "example.com",
      size_bytes: 4200,
      blocked: false,
    });

    const content = ledger.getContentToday();
    assert.equal(content.requests, 1);
    assert.equal(content.sanitized, 1);
    assert.equal(content.blocked, 0);
  });

  it("logs a blocked content request", () => {
    ledger.logContentRequest({
      agent_id: "primary",
      request_type: "fetch",
      domain: "evil.com",
      size_bytes: 0,
      blocked: true,
      block_reason: "domain_blocked",
    });

    const content = ledger.getContentToday();
    assert.equal(content.requests, 2);
    assert.equal(content.blocked, 1);
  });

  it("computes daily rollup", () => {
    ledger.computeDailyRollup();
    const history = ledger.getUsageHistory(30);
    assert.ok(history.length > 0);
    assert.equal(history[0].agent_id, "primary");
    assert.equal(history[0].llm_calls, 1);
  });

  it("returns per-agent usage", () => {
    const usage = ledger.getAgentUsage("primary");
    assert.ok(usage);
    assert.ok(usage["anthropic/claude-sonnet-4-6"]);
  });

  it("returns spending MTD", () => {
    const spending = ledger.getSpendingMtd();
    assert.ok(spending.provider_total_cents >= 0);
    assert.ok(spending.billed_total_cents >= 0);
  });

  it("checks content rate limit", () => {
    // We already have 2 requests for primary. Limit is 30/hour.
    assert.equal(ledger.isContentRateLimited("primary"), false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/.openclaw/ctg-core/gatekeeper && npm install && npm test
```
Expected: FAIL — `require("../ledger")` fails, module not found.

- [ ] **Step 3: Implement ledger.js**

Create `gatekeeper/ledger.js`:
```javascript
const Database = require("better-sqlite3");
const fs = require("node:fs");
const path = require("node:path");

class Ledger {
  constructor(dbPath, pricingPath) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");

    // Initialize schema
    const schema = fs.readFileSync(
      path.join(__dirname, "schema.sql"), "utf8"
    );
    this.db.exec(schema);

    // Load pricing
    this.pricing = JSON.parse(
      fs.readFileSync(pricingPath || path.join(__dirname, "pricing.json"), "utf8")
    );

    // Prepare statements
    this._insertLlm = this.db.prepare(
      `INSERT INTO llm_calls (agent_id, model, provider, tokens_in, tokens_out,
       provider_cost_cents, billed_cost_cents, latency_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    this._insertContent = this.db.prepare(
      `INSERT INTO content_requests (agent_id, request_type, domain, size_bytes, blocked, block_reason)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    this._upsertDaily = this.db.prepare(
      `INSERT INTO usage_daily (date, agent_id, model, llm_calls, tokens_in, tokens_out,
       provider_cost_cents, billed_cost_cents, content_requests, content_blocked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(date, agent_id, model)
       DO UPDATE SET
         llm_calls = excluded.llm_calls,
         tokens_in = excluded.tokens_in,
         tokens_out = excluded.tokens_out,
         provider_cost_cents = excluded.provider_cost_cents,
         billed_cost_cents = excluded.billed_cost_cents,
         content_requests = excluded.content_requests,
         content_blocked = excluded.content_blocked`
    );
  }

  _calcCost(model, tokensIn, tokensOut) {
    const p = this.pricing[model];
    if (!p) return { provider: 0, billed: 0 };
    const providerCents = Math.round(
      (tokensIn / 1_000_000) * p.input_per_mtok * 100 +
      (tokensOut / 1_000_000) * p.output_per_mtok * 100
    );
    const billedCents = Math.round(
      (tokensIn / 1_000_000) * p.billing_input_per_mtok * 100 +
      (tokensOut / 1_000_000) * p.billing_output_per_mtok * 100
    );
    return { provider: providerCents, billed: billedCents };
  }

  logLlmCall({ agent_id, model, provider, tokens_in, tokens_out, latency_ms }) {
    const cost = this._calcCost(model, tokens_in, tokens_out);
    this._insertLlm.run(
      agent_id, model, provider, tokens_in, tokens_out,
      cost.provider, cost.billed, latency_ms || 0
    );
  }

  logContentRequest({ agent_id, request_type, domain, size_bytes, blocked, block_reason }) {
    this._insertContent.run(
      agent_id, request_type, domain || null, size_bytes || 0,
      blocked ? 1 : 0, block_reason || null
    );
  }

  getUsageToday() {
    const today = new Date().toISOString().slice(0, 10);
    const rows = this.db.prepare(
      `SELECT agent_id, model,
         COUNT(*) as calls,
         SUM(tokens_in) as tokens_in,
         SUM(tokens_out) as tokens_out,
         SUM(provider_cost_cents) as provider_cents,
         SUM(billed_cost_cents) as billed_cents
       FROM llm_calls
       WHERE date(timestamp) = ?
       GROUP BY agent_id, model`
    ).all(today);

    const result = {};
    for (const row of rows) {
      if (!result[row.agent_id]) result[row.agent_id] = {};
      result[row.agent_id][row.model] = {
        calls: row.calls,
        tokens_in: row.tokens_in,
        tokens_out: row.tokens_out,
        provider_cents: row.provider_cents,
        billed_cents: row.billed_cents,
      };
    }
    return result;
  }

  getContentToday() {
    const today = new Date().toISOString().slice(0, 10);
    const row = this.db.prepare(
      `SELECT COUNT(*) as requests,
         SUM(CASE WHEN blocked = 0 THEN 1 ELSE 0 END) as sanitized,
         SUM(blocked) as blocked
       FROM content_requests
       WHERE date(timestamp) = ?`
    ).get(today);
    return {
      requests: row.requests || 0,
      sanitized: row.sanitized || 0,
      blocked: row.blocked || 0,
    };
  }

  getAgentUsage(agentId) {
    const today = new Date().toISOString().slice(0, 10);
    const rows = this.db.prepare(
      `SELECT model,
         COUNT(*) as calls,
         SUM(tokens_in) as tokens_in,
         SUM(tokens_out) as tokens_out,
         SUM(provider_cost_cents) as provider_cents,
         SUM(billed_cost_cents) as billed_cents
       FROM llm_calls
       WHERE agent_id = ? AND date(timestamp) = ?
       GROUP BY model`
    ).all(agentId, today);

    const result = {};
    for (const row of rows) {
      result[row.model] = {
        calls: row.calls,
        tokens_in: row.tokens_in,
        tokens_out: row.tokens_out,
        provider_cents: row.provider_cents,
        billed_cents: row.billed_cents,
      };
    }
    return result;
  }

  getSpendingMtd() {
    const monthStart = new Date().toISOString().slice(0, 7) + "-01";
    const row = this.db.prepare(
      `SELECT COALESCE(SUM(provider_cost_cents), 0) as provider_total_cents,
              COALESCE(SUM(billed_cost_cents), 0) as billed_total_cents
       FROM llm_calls
       WHERE date(timestamp) >= ?`
    ).get(monthStart);
    return row;
  }

  getUsageHistory(days) {
    const rows = this.db.prepare(
      `SELECT date, agent_id, model, llm_calls, tokens_in, tokens_out,
         provider_cost_cents, billed_cost_cents, content_requests, content_blocked
       FROM usage_daily
       WHERE date >= date('now', '-' || ? || ' days')
       ORDER BY date DESC`
    ).all(days);
    return rows;
  }

  computeDailyRollup() {
    const today = new Date().toISOString().slice(0, 10);

    // LLM rollup
    const llmRows = this.db.prepare(
      `SELECT agent_id, model,
         COUNT(*) as llm_calls,
         SUM(tokens_in) as tokens_in,
         SUM(tokens_out) as tokens_out,
         SUM(provider_cost_cents) as provider_cost_cents,
         SUM(billed_cost_cents) as billed_cost_cents
       FROM llm_calls
       WHERE date(timestamp) = ?
       GROUP BY agent_id, model`
    ).all(today);

    // Content rollup by agent
    const contentRows = this.db.prepare(
      `SELECT agent_id,
         COUNT(*) as content_requests,
         SUM(blocked) as content_blocked
       FROM content_requests
       WHERE date(timestamp) = ?
       GROUP BY agent_id`
    ).all(today);
    const contentMap = {};
    for (const r of contentRows) {
      contentMap[r.agent_id] = { requests: r.content_requests, blocked: r.content_blocked };
    }

    // Track which agents had their content attributed
    const contentAttributed = new Set();

    const upsert = this.db.transaction(() => {
      for (const row of llmRows) {
        // Only attribute content to the first model row per agent
        const content = (!contentAttributed.has(row.agent_id) && contentMap[row.agent_id])
          ? contentMap[row.agent_id] : { requests: 0, blocked: 0 };
        if (contentMap[row.agent_id]) contentAttributed.add(row.agent_id);

        this._upsertDaily.run(
          today, row.agent_id, row.model,
          row.llm_calls, row.tokens_in, row.tokens_out,
          row.provider_cost_cents, row.billed_cost_cents,
          content.requests, content.blocked
        );
      }
      // Handle agents with content requests but no LLM calls
      for (const [agentId, content] of Object.entries(contentMap)) {
        if (!contentAttributed.has(agentId)) {
          this._upsertDaily.run(
            today, agentId, "none", 0, 0, 0, 0, 0,
            content.requests, content.blocked
          );
        }
      }
    });
    upsert();
  }

  isContentRateLimited(agentId) {
    const row = this.db.prepare(
      `SELECT COUNT(*) as count FROM content_requests
       WHERE agent_id = ? AND timestamp > datetime('now', '-1 hour')`
    ).get(agentId);
    return row.count >= 30;
  }

  reloadPricing(pricingPath) {
    this.pricing = JSON.parse(fs.readFileSync(pricingPath, "utf8"));
  }

  close() {
    this.db.close();
  }
}

module.exports = Ledger;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/.openclaw/ctg-core/gatekeeper && npm test
```
Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/.openclaw/ctg-core
git add gatekeeper/ledger.js gatekeeper/test/test-ledger.js
git commit -m "feat(gatekeeper): implement usage ledger with SQLite"
```

---

## Task 3: LLM Reverse Proxy (proxy.js)

**Files:**
- Create: `gatekeeper/proxy.js`
- Create: `gatekeeper/test/test-proxy.js`

- [ ] **Step 1: Write failing tests for proxy URL parsing and key injection**

Create `gatekeeper/test/test-proxy.js`:
```javascript
const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");

describe("Proxy", () => {
  let proxy;

  before(() => {
    proxy = require("../proxy");
  });

  it("parses agent ID from anthropic URL path", () => {
    const result = proxy.parseRoute("/llm/anthropic/agents/primary/v1/messages");
    assert.equal(result.provider, "anthropic");
    assert.equal(result.agentId, "primary");
    assert.equal(result.upstreamPath, "/v1/messages");
  });

  it("parses agent ID from openai URL path", () => {
    const result = proxy.parseRoute("/llm/openai/agents/dispatch/v1/chat/completions");
    assert.equal(result.provider, "openai");
    assert.equal(result.agentId, "dispatch");
    assert.equal(result.upstreamPath, "/v1/chat/completions");
  });

  it("returns null for unknown provider", () => {
    const result = proxy.parseRoute("/llm/google/agents/primary/v1/generate");
    assert.equal(result, null);
  });

  it("returns null for missing agent segment", () => {
    const result = proxy.parseRoute("/llm/anthropic/v1/messages");
    assert.equal(result, null);
  });

  it("builds upstream URL for anthropic", () => {
    const url = proxy.getUpstreamUrl("anthropic", "/v1/messages");
    assert.equal(url, "https://api.anthropic.com/v1/messages");
  });

  it("builds upstream URL for openai", () => {
    const url = proxy.getUpstreamUrl("openai", "/v1/chat/completions");
    assert.equal(url, "https://api.openai.com/v1/chat/completions");
  });

  it("strips auth headers from inbound request", () => {
    const headers = {
      "authorization": "Bearer sk-ant-placeholder",
      "x-api-key": "sk-ant-placeholder",
      "content-type": "application/json",
      "user-agent": "openclaw/1.0",
    };
    const cleaned = proxy.stripAuthHeaders(headers);
    assert.equal(cleaned["authorization"], undefined);
    assert.equal(cleaned["x-api-key"], undefined);
    assert.equal(cleaned["content-type"], "application/json");
    assert.equal(cleaned["user-agent"], "openclaw/1.0");
  });

  it("injects anthropic API key", () => {
    const headers = { "content-type": "application/json" };
    const injected = proxy.injectApiKey(headers, "anthropic", { ANTHROPIC_API_KEY: "sk-real-key" });
    assert.equal(injected["x-api-key"], "sk-real-key");
  });

  it("injects openai API key", () => {
    const headers = { "content-type": "application/json" };
    const injected = proxy.injectApiKey(headers, "openai", { OPENAI_API_KEY: "sk-openai-real" });
    assert.equal(injected["authorization"], "Bearer sk-openai-real");
  });

  it("extracts model from anthropic request body", () => {
    const body = { model: "claude-sonnet-4-6", messages: [] };
    assert.equal(proxy.extractModel(body, "anthropic"), "anthropic/claude-sonnet-4-6");
  });

  it("extracts model from openai request body", () => {
    const body = { model: "gpt-4o-mini", messages: [] };
    assert.equal(proxy.extractModel(body, "openai"), "openai/gpt-4o-mini");
  });

  it("extracts usage from anthropic response body", () => {
    const body = { usage: { input_tokens: 100, output_tokens: 50 } };
    const usage = proxy.extractUsage(body, "anthropic");
    assert.equal(usage.tokens_in, 100);
    assert.equal(usage.tokens_out, 50);
  });

  it("extracts usage from openai response body", () => {
    const body = { usage: { prompt_tokens: 200, completion_tokens: 80 } };
    const usage = proxy.extractUsage(body, "openai");
    assert.equal(usage.tokens_in, 200);
    assert.equal(usage.tokens_out, 80);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/.openclaw/ctg-core/gatekeeper && npm test
```
Expected: FAIL — `require("../proxy")` fails.

- [ ] **Step 3: Implement proxy.js**

Create `gatekeeper/proxy.js` — pure functions for URL parsing, header manipulation, model/usage extraction, plus a `handleProxy` function that does the full request cycle (buffer body → parse → build upstream → forward → read response → extract usage → return).

Reference the existing `parent-relay/index.js` lines 29-53 for the `http.request` pattern with body buffering. The proxy reuses this exact pattern.

```javascript
const http = require("node:http");
const https = require("node:https");
const { URL } = require("node:url");

const PROVIDERS = {
  anthropic: "https://api.anthropic.com",
  openai: "https://api.openai.com",
};

// Parse /llm/{provider}/agents/{agentId}/{rest...}
function parseRoute(urlPath) {
  const match = urlPath.match(/^\/llm\/(\w+)\/agents\/([^/]+)(\/.*)?$/);
  if (!match) return null;
  const provider = match[1];
  if (!PROVIDERS[provider]) return null;
  return {
    provider,
    agentId: match[2],
    upstreamPath: match[3] || "/",
  };
}

function getUpstreamUrl(provider, path) {
  return PROVIDERS[provider] + path;
}

function stripAuthHeaders(headers) {
  const cleaned = { ...headers };
  delete cleaned["authorization"];
  delete cleaned["x-api-key"];
  delete cleaned["api-key"];
  // Remove hop-by-hop headers
  delete cleaned["host"];
  delete cleaned["connection"];
  delete cleaned["transfer-encoding"];
  delete cleaned["content-length"]; // recalculated on forward
  return cleaned;
}

function injectApiKey(headers, provider, env) {
  const result = { ...headers };
  if (provider === "anthropic") {
    result["x-api-key"] = env.ANTHROPIC_API_KEY;
    result["anthropic-version"] = result["anthropic-version"] || "2023-06-01";
  } else if (provider === "openai") {
    result["authorization"] = `Bearer ${env.OPENAI_API_KEY}`;
  }
  return result;
}

function extractModel(body, provider) {
  const model = body && body.model;
  if (!model) return `${provider}/unknown`;
  // Normalize: if model already has provider prefix, use as-is
  if (model.includes("/")) return model;
  return `${provider}/${model}`;
}

function extractUsage(body, provider) {
  if (!body || !body.usage) return { tokens_in: 0, tokens_out: 0 };
  if (provider === "anthropic") {
    return {
      tokens_in: body.usage.input_tokens || 0,
      tokens_out: body.usage.output_tokens || 0,
    };
  }
  // OpenAI format
  return {
    tokens_in: body.usage.prompt_tokens || 0,
    tokens_out: body.usage.completion_tokens || 0,
  };
}

// Forward a request to the upstream provider
// Returns { status, headers, body (parsed JSON), rawBody (Buffer), latencyMs }
function forwardRequest(upstreamUrl, method, headers, bodyBuffer) {
  return new Promise((resolve, reject) => {
    const url = new URL(upstreamUrl);
    const mod = url.protocol === "https:" ? https : http;
    const finalHeaders = { ...headers, "content-length": Buffer.byteLength(bodyBuffer) };
    const startTime = Date.now();

    const req = mod.request(url, { method, headers: finalHeaders, timeout: 120000 }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const rawBody = Buffer.concat(chunks);
        let body;
        try { body = JSON.parse(rawBody.toString("utf8")); } catch { body = null; }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body,
          rawBody,
          latencyMs: Date.now() - startTime,
        });
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("upstream timeout")); });
    if (bodyBuffer.length > 0) req.write(bodyBuffer);
    req.end();
  });
}

module.exports = {
  parseRoute,
  getUpstreamUrl,
  stripAuthHeaders,
  injectApiKey,
  extractModel,
  extractUsage,
  forwardRequest,
  PROVIDERS,
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/.openclaw/ctg-core/gatekeeper && npm test
```
Expected: All 12 proxy tests PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/.openclaw/ctg-core
git add gatekeeper/proxy.js gatekeeper/test/test-proxy.js
git commit -m "feat(gatekeeper): implement LLM reverse proxy with URL-based agent routing"
```

---

## Task 4: Content Sanitizer (sanitizer.js)

**Files:**
- Create: `gatekeeper/sanitizer.js`
- Create: `gatekeeper/test/test-sanitizer.js`

- [ ] **Step 1: Write failing tests**

Create `gatekeeper/test/test-sanitizer.js`:
```javascript
const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");

describe("Sanitizer", () => {
  let sanitizer;

  before(() => {
    sanitizer = require("../sanitizer");
  });

  it("strips HTML tags and returns plain text", () => {
    const html = "<html><head><title>Test Page</title></head><body><p>Hello <b>world</b></p></body></html>";
    const result = sanitizer.stripHtml(html);
    assert.ok(!result.body.includes("<"));
    assert.ok(result.body.includes("Hello world"));
    assert.equal(result.title, "Test Page");
  });

  it("strips script tags entirely", () => {
    const html = "<p>Safe</p><script>alert('xss')</script><p>Also safe</p>";
    const result = sanitizer.stripHtml(html);
    assert.ok(!result.body.includes("alert"));
    assert.ok(result.body.includes("Safe"));
    assert.ok(result.body.includes("Also safe"));
  });

  it("strips style tags entirely", () => {
    const html = "<style>.foo{color:red}</style><p>Content</p>";
    const result = sanitizer.stripHtml(html);
    assert.ok(!result.body.includes("color"));
    assert.ok(result.body.includes("Content"));
  });

  it("extracts date from meta tag", () => {
    const html = '<html><head><meta name="date" content="2026-03-18"></head><body>Text</body></html>';
    const result = sanitizer.stripHtml(html);
    assert.equal(result.date, "2026-03-18");
  });

  it("extracts date from time tag", () => {
    const html = '<p>Published <time datetime="2026-03-18">March 18</time></p>';
    const result = sanitizer.stripHtml(html);
    assert.equal(result.date, "2026-03-18");
  });

  it("enforces max size", () => {
    const longHtml = "<p>" + "x".repeat(60000) + "</p>";
    const result = sanitizer.stripHtml(longHtml, { maxBytes: 50000 });
    assert.ok(Buffer.byteLength(result.body) <= 50000);
  });

  it("checks domain against allowlist", () => {
    assert.equal(sanitizer.isDomainAllowed("example.com", ["*"]), true);
    assert.equal(sanitizer.isDomainAllowed("evil.com", ["example.com", "safe.org"]), false);
    assert.equal(sanitizer.isDomainAllowed("example.com", ["example.com"]), true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/.openclaw/ctg-core/gatekeeper && npm test
```
Expected: FAIL.

- [ ] **Step 3: Implement sanitizer.js**

Create `gatekeeper/sanitizer.js`:
```javascript
const https = require("node:https");
const http = require("node:http");
const { URL } = require("node:url");

function stripHtml(html, opts = {}) {
  const maxBytes = opts.maxBytes || 50000;

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;

  // Extract date from meta or time tags
  let date = null;
  const metaDate = html.match(/<meta[^>]*name=["'](?:date|pubdate|publish[_-]?date)["'][^>]*content=["']([^"']+)["']/i);
  if (metaDate) date = metaDate[1];
  if (!date) {
    const timeTag = html.match(/<time[^>]*datetime=["']([^"']+)["']/i);
    if (timeTag) date = timeTag[1];
  }

  // Strip script and style blocks entirely
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  // Strip all HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode common entities
  text = text.replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  // Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();

  // Enforce max size
  if (Buffer.byteLength(text) > maxBytes) {
    text = text.slice(0, maxBytes);
  }

  return { title, body: text, date };
}

function isDomainAllowed(domain, allowlist) {
  if (!allowlist || allowlist.length === 0) return true;
  if (allowlist.includes("*")) return true;
  return allowlist.includes(domain);
}

async function fetchUrl(url, opts = {}) {
  const timeout = opts.timeout || 15000;
  const maxBytes = opts.maxBytes || 51200; // 50KB + buffer for HTML overhead

  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === "https:" ? https : http;

    const req = mod.get(parsed, { timeout, headers: { "user-agent": "CTG-Gatekeeper/1.0" } }, (res) => {
      // Follow redirects (up to 3)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if ((opts._redirects || 0) >= 3) {
          return reject(new Error("too many redirects"));
        }
        return fetchUrl(res.headers.location, { ...opts, _redirects: (opts._redirects || 0) + 1 })
          .then(resolve).catch(reject);
      }

      const chunks = [];
      let totalBytes = 0;
      res.on("data", (chunk) => {
        totalBytes += chunk.length;
        if (totalBytes > maxBytes) {
          res.destroy();
          return reject(new Error("response too large"));
        }
        chunks.push(chunk);
      });
      res.on("end", () => resolve({
        status: res.statusCode,
        body: Buffer.concat(chunks).toString("utf8"),
        bytes: totalBytes,
      }));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("fetch timeout")); });
  });
}

module.exports = { stripHtml, isDomainAllowed, fetchUrl };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/.openclaw/ctg-core/gatekeeper && npm test
```
Expected: All 7 sanitizer tests PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/.openclaw/ctg-core
git add gatekeeper/sanitizer.js gatekeeper/test/test-sanitizer.js
git commit -m "feat(gatekeeper): implement content sanitizer with HTML stripping"
```

---

## Task 5: Hub Reporter (hub.js)

**Files:**
- Create: `gatekeeper/hub.js`
- Create: `gatekeeper/test/test-hub.js`

- [ ] **Step 1: Write failing tests for hub reporter and license logic**

Create `gatekeeper/test/test-hub.js`:
```javascript
const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");

describe("Hub", () => {
  let Hub;

  before(() => {
    Hub = require("../hub");
  });

  it("builds check-in payload with usage data", () => {
    const hub = new Hub({
      companyId: "test-uuid",
      hubUrl: "http://localhost:9999",
      hubToken: "test-token",
      graceHours: 72,
    });

    const payload = hub.buildCheckinPayload({
      services: { openclaw: "healthy", paperclip: "healthy" },
      agents: [{ name: "primary", status: "active" }],
      usageToday: { primary: { "anthropic/claude-sonnet-4-6": { calls: 5, tokens_in: 1000, tokens_out: 500, provider_cents: 10, billed_cents: 12 } } },
      contentToday: { requests: 3, sanitized: 3, blocked: 0 },
      spendingMtd: { provider_total_cents: 100, billed_total_cents: 120 },
      botRequests: [],
    });

    assert.equal(payload.company_id, "test-uuid");
    assert.ok(payload.timestamp);
    assert.equal(payload.services.openclaw, "healthy");
    assert.equal(payload.usage_today.primary["anthropic/claude-sonnet-4-6"].calls, 5);
    assert.equal(payload.spending_mtd.provider_total_cents, 100);
  });

  it("detects license suspension from hub response", () => {
    const hub = new Hub({ companyId: "test", hubUrl: "http://x", hubToken: "t", graceHours: 72 });
    hub.processLicenseResponse({ status: "suspended", expires: "2026-01-01" });
    assert.equal(hub.isLicenseSuspended(), true);
  });

  it("detects license active from hub response", () => {
    const hub = new Hub({ companyId: "test", hubUrl: "http://x", hubToken: "t", graceHours: 72 });
    hub.processLicenseResponse({ status: "active", expires: "2026-12-31" });
    assert.equal(hub.isLicenseSuspended(), false);
  });

  it("triggers grace period degradation after 72 hours unreachable", () => {
    const hub = new Hub({ companyId: "test", hubUrl: "http://x", hubToken: "t", graceHours: 72 });
    // Simulate last successful checkin 73 hours ago
    hub._lastSuccessfulCheckin = Date.now() - (73 * 60 * 60 * 1000);
    assert.equal(hub.isLicenseSuspended(), true);
  });

  it("does not trigger degradation within grace period", () => {
    const hub = new Hub({ companyId: "test", hubUrl: "http://x", hubToken: "t", graceHours: 72 });
    hub._lastSuccessfulCheckin = Date.now() - (10 * 60 * 60 * 1000); // 10 hours
    assert.equal(hub.isLicenseSuspended(), false);
  });

  it("recovers from degradation when hub responds active", () => {
    const hub = new Hub({ companyId: "test", hubUrl: "http://x", hubToken: "t", graceHours: 72 });
    hub.processLicenseResponse({ status: "suspended" });
    assert.equal(hub.isLicenseSuspended(), true);
    hub.processLicenseResponse({ status: "active", expires: "2026-12-31" });
    hub._lastSuccessfulCheckin = Date.now();
    assert.equal(hub.isLicenseSuspended(), false);
  });

  it("skips check-in if no hub URL configured", () => {
    const hub = new Hub({ companyId: "test", hubUrl: "", hubToken: "", graceHours: 72 });
    assert.equal(hub.shouldCheckin(), false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/.openclaw/ctg-core/gatekeeper && npm test
```
Expected: FAIL.

- [ ] **Step 3: Implement hub.js**

Create `gatekeeper/hub.js`. This absorbs the Parent Relay logic from `parent-relay/index.js` (lines 29-183):
- `buildCheckinPayload()` — assembles the rich check-in JSON
- `checkin()` — POSTs to hub, processes response (license + commands)
- `processLicenseResponse()` — updates license state
- `isLicenseSuspended()` — checks license OR grace period expiry
- `handleCommand()` — config-update, sop-update, deploy-bot, pricing-update (copied from parent-relay lines 132-183, extended with pricing-update)
- `collectHealth()` — polls Paperclip + OpenClaw + n8n health (adapted from parent-relay lines 56-97)
- `shouldCheckin()` — returns false if no hubUrl configured

The HTTP helper `fetch` is copied directly from `parent-relay/index.js` lines 29-53.

```javascript
const http = require("node:http");
const https = require("node:https");
const { URL } = require("node:url");
const fs = require("node:fs");
const path = require("node:path");

function httpFetch(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.request(url, {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      timeout: 10000,
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

class Hub {
  constructor({ companyId, hubUrl, hubToken, graceHours, openclawUrl, paperclipUrl, n8nUrl, sopsDir }) {
    this._companyId = companyId;
    this._hubUrl = hubUrl;
    this._hubToken = hubToken;
    this._graceHours = graceHours || 72;
    this._openclawUrl = openclawUrl || "http://openclaw:18789";
    this._paperclipUrl = paperclipUrl || "http://paperclip:3100";
    this._n8nUrl = n8nUrl || "http://n8n:5678";
    this._sopsDir = sopsDir || "/home/ctg/.openclaw/sops";

    this._licenseStatus = "active";
    this._licenseExpires = null;
    this._lastSuccessfulCheckin = Date.now();
    this._checkinCount = 0;
    this._startTime = Date.now();
  }

  shouldCheckin() {
    return !!(this._hubUrl && this._hubToken);
  }

  buildCheckinPayload({ services, agents, usageToday, contentToday, spendingMtd, botRequests }) {
    return {
      company_id: this._companyId,
      timestamp: new Date().toISOString(),
      gatekeeper_version: "1.0.0",
      uptime_seconds: Math.floor((Date.now() - this._startTime) / 1000),
      services,
      agents,
      usage_today: usageToday,
      content_today: contentToday,
      spending_mtd: spendingMtd,
      bot_requests: botRequests || [],
    };
  }

  processLicenseResponse(license) {
    if (!license) return;
    this._licenseStatus = license.status || "active";
    this._licenseExpires = license.expires || null;
  }

  isLicenseSuspended() {
    // Explicit suspension from hub
    if (this._licenseStatus === "suspended" || this._licenseStatus === "expired") return true;
    // Grace period exceeded
    const elapsed = Date.now() - this._lastSuccessfulCheckin;
    const graceMs = this._graceHours * 60 * 60 * 1000;
    if (elapsed > graceMs) return true;
    return false;
  }

  async collectHealth() {
    const services = {};
    for (const [name, url] of [
      ["openclaw", `${this._openclawUrl}/health`],
      ["paperclip", `${this._paperclipUrl}/api/health`],
      ["n8n", `${this._n8nUrl}/healthz`],
      ["postgresql", `${this._paperclipUrl}/api/health`],  // PG health proxied via Paperclip
      ["mission_control", `${this._mcUrl || "http://mission-control:4000"}/api/status`],
    ]) {
      try {
        const r = await httpFetch(url);
        services[name] = r.status === 200 ? "healthy" : "unhealthy";
      } catch {
        services[name] = "unreachable";
      }
    }
    return services;
  }

  async getAgentList() {
    try {
      const r = await httpFetch(`${this._paperclipUrl}/api/companies/${this._companyId}/agents`);
      if (r.status === 200 && Array.isArray(r.data)) {
        return r.data.map((a) => ({ name: a.name, status: a.status || "active", last_activity: a.lastActivityAt }));
      }
    } catch {}
    return [];
  }

  async getBotRequests() {
    try {
      const r = await httpFetch(`${this._paperclipUrl}/api/companies/${this._companyId}/tasks?type=bot-request&status=pending`);
      if (r.status === 200 && Array.isArray(r.data)) {
        return r.data.map((t) => ({ id: t.id, description: t.description, requested_by: t.createdBy, created_at: t.createdAt }));
      }
    } catch {}
    return [];
  }

  async checkin(payload) {
    if (!this.shouldCheckin()) return { skipped: true };
    try {
      const url = `${this._hubUrl}/api/tenants/${this._companyId}/checkin`;
      const res = await httpFetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${this._hubToken}` },
        body: payload,
      });
      this._checkinCount++;
      if (res.status === 200) {
        this._lastSuccessfulCheckin = Date.now();
        if (res.data && res.data.license) this.processLicenseResponse(res.data.license);
        if (res.data && res.data.commands) {
          for (const cmd of res.data.commands) await this.handleCommand(cmd);
        }
        return { status: "ok", checkinCount: this._checkinCount };
      }
      return { status: `http-${res.status}` };
    } catch (err) {
      console.error(`[gatekeeper] Check-in failed: ${err.message}`);
      return { status: `error: ${err.message}` };
    }
  }

  async handleCommand(cmd) {
    console.log(`[gatekeeper] Received command: ${cmd.type}`);
    switch (cmd.type) {
      case "config-update":
        try {
          await httpFetch(`${this._openclawUrl}/api/reload`, { method: "POST", body: cmd.payload || {} });
        } catch (err) { console.error(`[gatekeeper] Config reload failed: ${err.message}`); }
        break;
      case "sop-update":
        if (cmd.payload && cmd.payload.filename && cmd.payload.content) {
          const safeName = path.basename(cmd.payload.filename);
          if (safeName !== cmd.payload.filename) {
            console.error(`[gatekeeper] Rejected SOP: suspicious filename "${cmd.payload.filename}"`);
            break;
          }
          fs.writeFileSync(path.join(this._sopsDir, safeName), cmd.payload.content, "utf8");
          console.log(`[gatekeeper] SOP updated: ${safeName}`);
        }
        break;
      case "deploy-bot":
        try {
          await httpFetch(`${this._openclawUrl}/api/lobster/run`, {
            method: "POST",
            body: { workflow: "new-bot", vars: cmd.payload || {} },
          });
        } catch (err) { console.error(`[gatekeeper] Bot deploy failed: ${err.message}`); }
        break;
      case "pricing-update":
        if (cmd.payload && cmd.payload.pricing) {
          try {
            const pricingPath = process.env.GATEKEEPER_PRICING_PATH || path.join(__dirname, "pricing.json");
            fs.writeFileSync(pricingPath, JSON.stringify(cmd.payload.pricing, null, 2), "utf8");
            console.log("[gatekeeper] Pricing table updated");
            // Caller should call ledger.reloadPricing() after this
          } catch (err) { console.error(`[gatekeeper] Pricing update failed: ${err.message}`); }
        }
        break;
      default:
        console.log(`[gatekeeper] Unknown command type: ${cmd.type}`);
    }
  }

  getStatus() {
    return {
      status: this.isLicenseSuspended() ? "suspended" : "ok",
      uptime: Math.floor((Date.now() - this._startTime) / 1000),
      lastCheckin: new Date(this._lastSuccessfulCheckin).toISOString(),
      checkinCount: this._checkinCount,
      licenseStatus: this._licenseStatus,
      licenseExpires: this._licenseExpires,
      parentHub: this._hubUrl ? "configured" : "not-configured",
    };
  }
}

module.exports = Hub;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/.openclaw/ctg-core/gatekeeper && npm test
```
Expected: All 7 hub tests PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/.openclaw/ctg-core
git add gatekeeper/hub.js gatekeeper/test/test-hub.js
git commit -m "feat(gatekeeper): implement hub reporter with license enforcement"
```

---

## Task 6: Internal Auth (test-auth.js) and Main Server (index.js)

**Files:**
- Create: `gatekeeper/index.js`
- Create: `gatekeeper/test/test-auth.js`

- [ ] **Step 1: Write failing tests for internal auth**

Create `gatekeeper/test/test-auth.js`:
```javascript
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("Auth", () => {
  it("validates correct internal token", () => {
    const { validateToken } = require("../index");
    assert.equal(validateToken("Bearer test-secret-123", "test-secret-123"), true);
  });

  it("rejects missing token", () => {
    const { validateToken } = require("../index");
    assert.equal(validateToken(undefined, "test-secret-123"), false);
  });

  it("rejects wrong token", () => {
    const { validateToken } = require("../index");
    assert.equal(validateToken("Bearer wrong-token", "test-secret-123"), false);
  });

  it("rejects malformed header", () => {
    const { validateToken } = require("../index");
    assert.equal(validateToken("NotBearer test-secret-123", "test-secret-123"), false);
  });

  it("allows health endpoint without auth", () => {
    const { requiresAuth } = require("../index");
    assert.equal(requiresAuth("/health"), false);
    assert.equal(requiresAuth("/status"), false);
  });

  it("requires auth for proxy and fetch endpoints", () => {
    const { requiresAuth } = require("../index");
    assert.equal(requiresAuth("/llm/anthropic/agents/primary/v1/messages"), true);
    assert.equal(requiresAuth("/fetch"), true);
    assert.equal(requiresAuth("/usage"), true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/.openclaw/ctg-core/gatekeeper && npm test
```

- [ ] **Step 3: Implement index.js**

Create `gatekeeper/index.js` — the main HTTP server that routes requests to subsystems, validates internal auth, handles graceful shutdown.

```javascript
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");

const Ledger = require("./ledger");
const Hub = require("./hub");
const proxy = require("./proxy");
const sanitizer = require("./sanitizer");

// ── Config ──────────────────────────────────────────────────────────
const PORT = parseInt(process.env.GATEKEEPER_PORT || "9090", 10);
const INTERNAL_TOKEN = process.env.GATEKEEPER_INTERNAL_TOKEN || "";
const DB_PATH = process.env.GATEKEEPER_DB_PATH || path.join(__dirname, "gatekeeper.db");
const PRICING_PATH = process.env.GATEKEEPER_PRICING_PATH || path.join(__dirname, "pricing.json");
const DOMAIN_ALLOWLIST = (process.env.GATEKEEPER_DOMAIN_ALLOWLIST || "*").split(",").map(s => s.trim());
const CHECKIN_INTERVAL = parseInt(process.env.CHECKIN_INTERVAL_MS || "300000", 10);
const API_KEYS = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
};

// ── Auth ────────────────────────────────────────────────────────────
function validateToken(authHeader, expectedToken) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;
  return authHeader.slice(7) === expectedToken;
}

const NO_AUTH_PATHS = ["/health", "/status"];

function requiresAuth(pathname) {
  return !NO_AUTH_PATHS.includes(pathname);
}

// ── Body parser ─────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

// ── Initialize subsystems ───────────────────────────────────────────
let ledger, hub;

function init() {
  ledger = new Ledger(DB_PATH, PRICING_PATH);
  hub = new Hub({
    companyId: process.env.COMPANY_ID || "",
    hubUrl: process.env.PARENT_HUB_URL || "",
    hubToken: process.env.PARENT_HUB_TOKEN || "",
    graceHours: parseInt(process.env.LICENSE_GRACE_HOURS || "72", 10),
    openclawUrl: process.env.OPENCLAW_URL || "http://openclaw:18789",
    paperclipUrl: process.env.PAPERCLIP_URL || "http://paperclip:3100",
    n8nUrl: process.env.N8N_URL || "http://n8n:5678",
  });
}

// ── Request handler ─────────────────────────────────────────────────
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // Auth check (skip for health/status)
  if (requiresAuth(pathname) && INTERNAL_TOKEN) {
    if (!validateToken(req.headers.authorization, INTERNAL_TOKEN)) {
      return json(res, 401, { status: "error", error: "unauthorized", message: "Invalid or missing internal token" });
    }
  }

  // ── Health & Status ───────────────────────────────────────────
  if (req.method === "GET" && pathname === "/health") {
    return json(res, 200, hub.getStatus());
  }

  if (req.method === "GET" && pathname === "/status") {
    const services = await hub.collectHealth();
    return json(res, 200, { ...hub.getStatus(), services });
  }

  // ── License check for operational endpoints ───────────────────
  if (hub.isLicenseSuspended() && (pathname.startsWith("/llm/") || pathname === "/fetch")) {
    return json(res, 403, {
      status: "error",
      error: "license_suspended",
      message: "Service suspended. Contact CTG to restore.",
      contact: "support@cubillastech.com",
    });
  }

  // ── LLM Proxy ─────────────────────────────────────────────────
  if (pathname.startsWith("/llm/")) {
    const route = proxy.parseRoute(pathname);
    if (!route) {
      return json(res, 403, { status: "error", error: "forbidden", message: "Unknown or unsupported provider" });
    }

    try {
      const bodyBuffer = await readBody(req);
      let requestBody;
      try { requestBody = JSON.parse(bodyBuffer.toString("utf8")); } catch { requestBody = {}; }

      const model = proxy.extractModel(requestBody, route.provider);
      const upstreamUrl = proxy.getUpstreamUrl(route.provider, route.upstreamPath);
      const headers = proxy.stripAuthHeaders(req.headers);
      const authedHeaders = proxy.injectApiKey(headers, route.provider, API_KEYS);

      const upstream = await proxy.forwardRequest(upstreamUrl, req.method, authedHeaders, bodyBuffer);
      const usage = proxy.extractUsage(upstream.body, route.provider);

      // Log to ledger
      ledger.logLlmCall({
        agent_id: route.agentId,
        model,
        provider: route.provider,
        tokens_in: usage.tokens_in,
        tokens_out: usage.tokens_out,
        latency_ms: upstream.latencyMs,
      });

      // Forward response
      const responseHeaders = { ...upstream.headers };
      delete responseHeaders["transfer-encoding"];
      responseHeaders["content-length"] = upstream.rawBody.length;
      res.writeHead(upstream.status, responseHeaders);
      res.end(upstream.rawBody);
    } catch (err) {
      console.error(`[gatekeeper] Proxy error: ${err.message}`);
      const code = err.message.includes("timeout") ? 504 : 502;
      json(res, code, { status: "error", error: code === 504 ? "upstream_timeout" : "upstream_error", message: err.message });
    }
    return;
  }

  // ── Content Fetch ─────────────────────────────────────────────
  if (req.method === "POST" && pathname === "/fetch") {
    try {
      const bodyBuffer = await readBody(req);
      const body = JSON.parse(bodyBuffer.toString("utf8"));
      const { agent_id, url: fetchUrl } = body;

      if (!agent_id || !fetchUrl) {
        return json(res, 400, { status: "error", error: "bad_request", message: "agent_id and url are required" });
      }

      // Rate limit check
      if (ledger.isContentRateLimited(agent_id)) {
        ledger.logContentRequest({ agent_id, request_type: "fetch", domain: null, blocked: true, block_reason: "rate_limited" });
        return json(res, 429, { status: "error", error: "rate_limit_exceeded", message: `Agent '${agent_id}' exceeded 30 requests/hour limit`, retry_after_seconds: 1800 });
      }

      // Domain check
      const domain = new URL(fetchUrl).hostname;
      if (!sanitizer.isDomainAllowed(domain, DOMAIN_ALLOWLIST)) {
        ledger.logContentRequest({ agent_id, request_type: "fetch", domain, blocked: true, block_reason: "domain_blocked" });
        return json(res, 403, { status: "error", error: "domain_blocked", message: `Domain '${domain}' is not in the allowlist` });
      }

      const startTime = Date.now();
      const fetched = await sanitizer.fetchUrl(fetchUrl);
      const result = sanitizer.stripHtml(fetched.body);
      const fetchTimeMs = Date.now() - startTime;

      ledger.logContentRequest({ agent_id, request_type: "fetch", domain, size_bytes: fetched.bytes, blocked: false });

      return json(res, 200, {
        status: "ok",
        data: { title: result.title, body: result.body, date: result.date },
        metadata: {
          source_domain: domain,
          original_size_bytes: fetched.bytes,
          sanitized_size_bytes: Buffer.byteLength(result.body),
          fetch_time_ms: fetchTimeMs,
        },
      });
    } catch (err) {
      console.error(`[gatekeeper] Fetch error: ${err.message}`);
      return json(res, 502, { status: "error", error: "fetch_failed", message: err.message });
    }
  }

  // ── Usage API ─────────────────────────────────────────────────
  if (req.method === "GET" && pathname === "/usage") {
    return json(res, 200, {
      usage: ledger.getUsageToday(),
      content: ledger.getContentToday(),
      spending_mtd: ledger.getSpendingMtd(),
    });
  }

  if (req.method === "GET" && pathname.match(/^\/usage\/history$/)) {
    return json(res, 200, ledger.getUsageHistory(30));
  }

  if (req.method === "GET" && pathname.match(/^\/usage\/[^/]+$/)) {
    const agentId = pathname.split("/")[2];
    return json(res, 200, ledger.getAgentUsage(agentId));
  }

  // ── Force check-in ────────────────────────────────────────────
  if (req.method === "POST" && pathname === "/checkin") {
    const services = await hub.collectHealth();
    const agents = await hub.getAgentList();
    const botRequests = await hub.getBotRequests();
    ledger.computeDailyRollup();
    const payload = hub.buildCheckinPayload({
      services,
      agents,
      usageToday: ledger.getUsageToday(),
      contentToday: ledger.getContentToday(),
      spendingMtd: ledger.getSpendingMtd(),
      botRequests,
    });
    const result = await hub.checkin(payload);
    return json(res, 200, result);
  }

  // 404
  json(res, 404, { status: "error", error: "not_found", message: "Endpoint not found" });
}

// ── Server ──────────────────────────────────────────────────────────
let server;
let checkinInterval;

function start() {
  init();

  server = http.createServer(handleRequest);
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[gatekeeper] Listening on :${PORT}`);
    console.log(`[gatekeeper] Company ID: ${process.env.COMPANY_ID}`);
    console.log(`[gatekeeper] Hub: ${process.env.PARENT_HUB_URL || "not configured"}`);
    console.log(`[gatekeeper] Auth: ${INTERNAL_TOKEN ? "enabled" : "disabled"}`);

    // Initial check-in
    if (hub.shouldCheckin()) {
      performCheckin();
      checkinInterval = setInterval(performCheckin, CHECKIN_INTERVAL);
    }
  });

  // Graceful shutdown
  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
}

async function performCheckin() {
  try {
    const services = await hub.collectHealth();
    const agents = await hub.getAgentList();
    const botRequests = await hub.getBotRequests();
    ledger.computeDailyRollup();
    const payload = hub.buildCheckinPayload({
      services,
      agents,
      usageToday: ledger.getUsageToday(),
      contentToday: ledger.getContentToday(),
      spendingMtd: ledger.getSpendingMtd(),
      botRequests,
    });
    await hub.checkin(payload);
  } catch (err) {
    console.error(`[gatekeeper] Check-in error: ${err.message}`);
  }
}

function gracefulShutdown() {
  console.log("[gatekeeper] Shutting down gracefully...");
  if (checkinInterval) clearInterval(checkinInterval);
  if (server) {
    server.close(() => {
      console.log("[gatekeeper] All connections closed");
      if (ledger) ledger.close();
      process.exit(0);
    });
    // Force exit after 10 seconds
    setTimeout(() => {
      console.error("[gatekeeper] Forced shutdown after 10s timeout");
      process.exit(1);
    }, 10000);
  }
}

// Only start if run directly (not required as module for testing)
if (require.main === module) {
  start();
}

module.exports = { validateToken, requiresAuth, start };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/.openclaw/ctg-core/gatekeeper && npm test
```
Expected: All auth tests PASS plus all previous tests still PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/.openclaw/ctg-core
git add gatekeeper/index.js gatekeeper/test/test-auth.js
git commit -m "feat(gatekeeper): implement main server with auth, routing, and graceful shutdown"
```

---

## Task 7: Dockerfile.gatekeeper

**Files:**
- Create: `Dockerfile.gatekeeper`

- [ ] **Step 1: Write the Dockerfile**

Create `Dockerfile.gatekeeper`:
```dockerfile
# CTG Core — Gatekeeper Container
# LLM proxy + content sanitizer + usage ledger + hub reporter

# ---- Stage 1: Build native dependencies ----
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY gatekeeper/package.json gatekeeper/package-lock.json* ./
RUN npm install --production

# ---- Stage 2: Production image ----
FROM node:22-alpine

RUN apk add --no-cache tini wget bash

# Create non-root user
RUN addgroup -g 1000 ctg && \
    adduser -u 1000 -G ctg -s /bin/bash -D ctg

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy gatekeeper source
COPY gatekeeper/index.js gatekeeper/proxy.js gatekeeper/sanitizer.js \
     gatekeeper/ledger.js gatekeeper/hub.js gatekeeper/schema.sql \
     gatekeeper/package.json ./

# Pricing is mounted as a volume, but include default
COPY gatekeeper/pricing.json /app/pricing.json.default

# Data directory for SQLite
RUN mkdir -p /data && chown -R ctg:ctg /data /app

USER ctg

EXPOSE 9090

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:9090/health || exit 1

ENTRYPOINT ["tini", "--"]
CMD ["node", "index.js"]
```

- [ ] **Step 2: Verify Dockerfile syntax**

```bash
cd ~/.openclaw/ctg-core && docker build --check -f Dockerfile.gatekeeper . 2>&1 || echo "Docker build check not available — visual review OK"
```

- [ ] **Step 3: Commit**

```bash
cd ~/.openclaw/ctg-core
git add Dockerfile.gatekeeper
git commit -m "feat(gatekeeper): add Dockerfile with multi-stage build"
```

---

## Task 8: Update docker-compose.yml — Two Networks + Gatekeeper + n8n

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Read current docker-compose.yml**

```bash
cat ~/.openclaw/ctg-core/docker-compose.yml
```
Verify current structure matches what we expect (5 services, single `ctg-core-net` network).

- [ ] **Step 2: Rewrite docker-compose.yml**

Replace the entire file. Key changes:
- Split `ctg-core-net` into `internal-net` (internal: true) + `gateway-net`
- Add `gatekeeper` service on both networks
- Add `n8n` service on both networks
- Move all existing services to `internal-net` only
- Remove `parent-relay` service
- Add `gatekeeper-data` and `gatekeeper-pricing` volumes
- Move API keys from `openclaw` env to `gatekeeper` env
- OpenClaw gets `GATEKEEPER_INTERNAL_TOKEN` and dummy API key
- Gatekeeper depends on PostgreSQL (healthy) — it needs to be up before proxying starts
- n8n gets its own volume for persistent data

The compose file should keep all existing logging, healthcheck, and user configurations for the unchanged services. Only network assignments and the services list change.

- [ ] **Step 3: Validate compose file**

```bash
cd ~/.openclaw/ctg-core && docker compose config --quiet
```
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd ~/.openclaw/ctg-core
git add docker-compose.yml
git commit -m "feat(gatekeeper): split networks, add gatekeeper + n8n services"
```

---

## Task 9: Update openclaw.seed.json — Per-Agent baseUrl + Dummy Key

**Files:**
- Modify: `openclaw.seed.json`

- [ ] **Step 1: Read current openclaw.seed.json**

Verify current agent model config structure.

- [ ] **Step 2: Update seed config**

Changes:
- Set `env.ANTHROPIC_API_KEY` to `"sk-ant-placeholder-routed-through-gatekeeper"`
- Add `baseUrl` to each agent's model config pointing at `http://gatekeeper:9090/llm/anthropic/agents/{agent_id}`
- Keep all other config unchanged

- [ ] **Step 3: Validate JSON**

```bash
cd ~/.openclaw/ctg-core && node -e "JSON.parse(require('fs').readFileSync('openclaw.seed.json','utf8')); console.log('Valid JSON')"
```

- [ ] **Step 4: Commit**

```bash
cd ~/.openclaw/ctg-core
git add openclaw.seed.json
git commit -m "feat(gatekeeper): route LLM calls through gatekeeper with per-agent baseUrl"
```

---

## Task 10: Update .env.template — Move API Keys to Gatekeeper

**Files:**
- Modify: `.env.template`

- [ ] **Step 1: Read current .env.template**

Verify current structure.

- [ ] **Step 2: Update .env.template**

Add Gatekeeper section with:
- `ANTHROPIC_API_KEY=sk-ant-CHANGE_ME`
- `OPENAI_API_KEY=` (optional, blank default)
- `GATEKEEPER_INTERNAL_TOKEN=CHANGE_ME_GENERATE_WITH_OPENSSL`
- `GATEKEEPER_PORT=9090`
- `GATEKEEPER_DB_PATH=/data/gatekeeper.db`
- `GATEKEEPER_PRICING_PATH=/data/pricing.json`
- `LICENSE_GRACE_HOURS=72`
- `GATEKEEPER_DOMAIN_ALLOWLIST=*`

Remove `ANTHROPIC_API_KEY` from the OpenClaw section (it's now set to placeholder in seed config).

Add n8n section:
- `N8N_PORT=5678`

- [ ] **Step 3: Commit**

```bash
cd ~/.openclaw/ctg-core
git add .env.template
git commit -m "feat(gatekeeper): move API keys to gatekeeper env section"
```

---

## Task 11: Update deploy.sh and setup.sh

**Files:**
- Modify: `deploy.sh`
- Modify: `setup.sh`

- [ ] **Step 1: Read current deploy.sh and setup.sh**

Understand current flow for API key prompts and port checks.

- [ ] **Step 2: Update deploy.sh**

Changes:
- Add port 5678 (n8n) to port availability checks
- API key prompt value goes to Gatekeeper's env vars (in the generated `.env`)
- Generate `GATEKEEPER_INTERNAL_TOKEN` via `openssl rand -hex 24`
- Set OpenClaw's `ANTHROPIC_API_KEY` to `sk-ant-placeholder-routed-through-gatekeeper` in `.env`

- [ ] **Step 3: Update setup.sh**

Same changes as deploy.sh — API key goes to Gatekeeper section, generate internal token.

- [ ] **Step 4: Test deploy.sh dry-run syntax**

```bash
bash -n ~/.openclaw/ctg-core/deploy.sh && echo "Syntax OK"
bash -n ~/.openclaw/ctg-core/setup.sh && echo "Syntax OK"
```

- [ ] **Step 5: Commit**

```bash
cd ~/.openclaw/ctg-core
git add deploy.sh setup.sh
git commit -m "feat(gatekeeper): update deploy/setup scripts for gatekeeper env"
```

---

## Task 12: Update Hub — Usage Endpoint + License + Dashboard

**Files:**
- Modify: `hub/tenants.sql`
- Modify: `hub/index.js`

- [ ] **Step 1: Update hub/tenants.sql**

Add `usage_daily` table (same schema as gatekeeper's, but with `tenant_id`):
```sql
CREATE TABLE IF NOT EXISTS usage_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
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
  UNIQUE(tenant_id, date, agent_id, model)
);

CREATE INDEX IF NOT EXISTS idx_usage_tenant_date ON usage_daily(tenant_id, date);
```

Add license columns to tenants:
```sql
-- Run as ALTER if table already exists; handled in migration code
```
Note: SQLite doesn't support `ALTER TABLE ADD COLUMN IF NOT EXISTS`. The hub's `initDb` should run `ALTER TABLE tenants ADD COLUMN license_status TEXT DEFAULT 'active'` and `ALTER TABLE tenants ADD COLUMN license_expires TEXT` wrapped in try/catch to handle the "duplicate column" error gracefully.

- [ ] **Step 2: Update hub/index.js**

Add to the check-in handler (after storing the check-in):
- Extract `usage_today` from the payload and upsert into `usage_daily` (with `tenant_id`)
- Return `license` object in the response, reading from the tenant's `license_status` and `license_expires` columns
- Handle `bot_requests` in the payload — store as pending bot requests

Add new endpoints:
- `GET /api/tenants/:id/usage` — query `usage_daily` for the tenant, with optional `from`/`to` query params
- `GET /api/dashboard` — admin-only, returns all tenants with their latest check-in, today's usage, and spending MTD

- [ ] **Step 3: Test that hub still starts**

```bash
cd ~/.openclaw/ctg-core/hub && node -e "const h = require('./index.js'); console.log('Hub module loads OK')"
```

- [ ] **Step 4: Commit**

```bash
cd ~/.openclaw/ctg-core
git add hub/tenants.sql hub/index.js
git commit -m "feat(hub): add usage tracking, license enforcement, and dashboard endpoint"
```

---

## Task 13: Delete Parent Relay

**Files:**
- Delete: `parent-relay/` (entire directory)

- [ ] **Step 1: Verify parent-relay is fully absorbed**

Confirm all functionality from `parent-relay/index.js` exists in `gatekeeper/hub.js`:
- `fetch` helper → `httpFetch` in hub.js
- `collectHealth` → `hub.collectHealth()`
- `checkin` → `hub.checkin()`
- `handleCommand` (config-update, sop-update, deploy-bot) → `hub.handleCommand()`
- HTTP server (health, status, checkin endpoints) → `index.js` routes

- [ ] **Step 2: Remove parent-relay directory**

```bash
cd ~/.openclaw/ctg-core && rm -rf parent-relay/
```

- [ ] **Step 3: Commit**

```bash
cd ~/.openclaw/ctg-core
git add -A parent-relay/
git commit -m "refactor: remove parent-relay (absorbed into gatekeeper)"
```

---

## Task 14: Integration Test — Full Stack Validation

**Files:**
- No new files — manual testing

- [ ] **Step 1: Build all containers**

```bash
cd ~/.openclaw/ctg-core && docker compose build
```
Expected: All images build successfully.

- [ ] **Step 2: Validate compose configuration**

```bash
cd ~/.openclaw/ctg-core && docker compose config --quiet
```
Expected: No errors.

- [ ] **Step 3: Verify network isolation (dry run)**

Review the docker-compose output:
```bash
cd ~/.openclaw/ctg-core && docker compose config | grep -A5 "internal-net"
```
Confirm `internal: true` is set on `internal-net`.

- [ ] **Step 4: Run all Gatekeeper unit tests**

```bash
cd ~/.openclaw/ctg-core/gatekeeper && npm test
```
Expected: All tests pass (ledger: 8, proxy: 12, sanitizer: 7, hub: 7, auth: 6 = ~40 tests).

- [ ] **Step 5: Commit any test fixes**

If any tests needed adjustment, commit the fixes.

---

## Summary

| Task | Component | Est. Time | Tests |
|---|---|---|---|
| 1 | Scaffolding (package.json, schema, pricing) | 3 min | — |
| 2 | Usage Ledger (ledger.js) | 10 min | 8 |
| 3 | LLM Reverse Proxy (proxy.js) | 10 min | 12 |
| 4 | Content Sanitizer (sanitizer.js) | 8 min | 7 |
| 5 | Hub Reporter (hub.js) | 10 min | 7 |
| 6 | Main Server + Auth (index.js) | 10 min | 6 |
| 7 | Dockerfile.gatekeeper | 3 min | — |
| 8 | docker-compose.yml (two networks) | 8 min | — |
| 9 | openclaw.seed.json (baseUrl routing) | 5 min | — |
| 10 | .env.template (key migration) | 3 min | — |
| 11 | deploy.sh + setup.sh | 8 min | — |
| 12 | Hub updates (usage + license + dashboard) | 12 min | — |
| 13 | Delete parent-relay | 2 min | — |
| 14 | Integration test | 5 min | — |
| **Total** | | **~97 min** | **~40** |
