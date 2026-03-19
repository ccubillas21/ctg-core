import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

class Ledger {
  /**
   * @param {string} dbPath - Path to SQLite database file
   * @param {string} pricingPath - Path to pricing.json
   */
  constructor(dbPath, pricingPath) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    // Initialize schema
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    this.db.exec(schema);

    // Load pricing
    this.pricing = this._loadPricing(pricingPath);

    // Prepare statements
    this._prepare();
  }

  _loadPricing(pricingPath) {
    const raw = fs.readFileSync(pricingPath, 'utf8');
    return JSON.parse(raw);
  }

  _prepare() {
    this._stmtInsertLlmCall = this.db.prepare(`
      INSERT INTO llm_calls
        (agent_id, model, provider, tokens_in, tokens_out, provider_cost_cents, billed_cost_cents, latency_ms)
      VALUES
        (@agent_id, @model, @provider, @tokens_in, @tokens_out, @provider_cost_cents, @billed_cost_cents, @latency_ms)
    `);

    this._stmtInsertContentRequest = this.db.prepare(`
      INSERT INTO content_requests
        (agent_id, request_type, domain, size_bytes, blocked, block_reason)
      VALUES
        (@agent_id, @request_type, @domain, @size_bytes, @blocked, @block_reason)
    `);

    this._stmtUsageToday = this.db.prepare(`
      SELECT
        agent_id,
        model,
        COUNT(*) AS calls,
        SUM(tokens_in) AS tokens_in,
        SUM(tokens_out) AS tokens_out,
        SUM(provider_cost_cents) AS provider_cents,
        SUM(billed_cost_cents) AS billed_cents
      FROM llm_calls
      WHERE date(timestamp) = date('now')
      GROUP BY agent_id, model
    `);

    this._stmtContentToday = this.db.prepare(`
      SELECT
        COUNT(*) AS requests,
        SUM(CASE WHEN blocked = 1 THEN 1 ELSE 0 END) AS blocked
      FROM content_requests
      WHERE date(timestamp) = date('now')
    `);

    this._stmtAgentUsage = this.db.prepare(`
      SELECT
        model,
        COUNT(*) AS calls,
        SUM(tokens_in) AS tokens_in,
        SUM(tokens_out) AS tokens_out,
        SUM(provider_cost_cents) AS provider_cents,
        SUM(billed_cost_cents) AS billed_cents
      FROM llm_calls
      WHERE agent_id = ? AND date(timestamp) = date('now')
      GROUP BY model
    `);

    this._stmtSpendingMtd = this.db.prepare(`
      SELECT
        SUM(provider_cost_cents) AS provider_total_cents,
        SUM(billed_cost_cents) AS billed_total_cents
      FROM llm_calls
      WHERE strftime('%Y-%m', timestamp) = strftime('%Y-%m', 'now')
    `);

    this._stmtUsageHistory = this.db.prepare(`
      SELECT *
      FROM usage_daily
      WHERE date >= date('now', ?)
      ORDER BY date ASC, agent_id ASC, model ASC
    `);

    this._stmtContentRateLimit = this.db.prepare(`
      SELECT COUNT(*) AS cnt
      FROM content_requests
      WHERE agent_id = ?
        AND timestamp >= datetime('now', '-1 hour')
    `);

    // Rollup queries
    this._stmtRollupLlm = this.db.prepare(`
      SELECT
        agent_id,
        model,
        COUNT(*) AS llm_calls,
        SUM(tokens_in) AS tokens_in,
        SUM(tokens_out) AS tokens_out,
        SUM(provider_cost_cents) AS provider_cost_cents,
        SUM(billed_cost_cents) AS billed_cost_cents
      FROM llm_calls
      WHERE date(timestamp) = date('now')
      GROUP BY agent_id, model
    `);

    this._stmtRollupContent = this.db.prepare(`
      SELECT
        agent_id,
        COUNT(*) AS content_requests,
        SUM(CASE WHEN blocked = 1 THEN 1 ELSE 0 END) AS content_blocked
      FROM content_requests
      WHERE date(timestamp) = date('now')
      GROUP BY agent_id
    `);

    this._stmtUpsertRollup = this.db.prepare(`
      INSERT INTO usage_daily
        (date, agent_id, model, llm_calls, tokens_in, tokens_out,
         provider_cost_cents, billed_cost_cents, content_requests, content_blocked)
      VALUES
        (@date, @agent_id, @model, @llm_calls, @tokens_in, @tokens_out,
         @provider_cost_cents, @billed_cost_cents, @content_requests, @content_blocked)
      ON CONFLICT(date, agent_id, model) DO UPDATE SET
        llm_calls = excluded.llm_calls,
        tokens_in = excluded.tokens_in,
        tokens_out = excluded.tokens_out,
        provider_cost_cents = excluded.provider_cost_cents,
        billed_cost_cents = excluded.billed_cost_cents,
        content_requests = excluded.content_requests,
        content_blocked = excluded.content_blocked
    `);
  }

  /**
   * Calculate cost in cents from pricing table.
   * @param {string} model
   * @param {number} tokensIn
   * @param {number} tokensOut
   * @returns {{ providerCents: number, billedCents: number }}
   */
  _calcCost(model, tokensIn, tokensOut) {
    const p = this.pricing[model];
    if (!p) {
      return { providerCents: 0, billedCents: 0 };
    }
    const providerCents = Math.round(
      (tokensIn / 1_000_000) * p.input_per_mtok * 100 +
      (tokensOut / 1_000_000) * p.output_per_mtok * 100
    );
    const billedCents = Math.round(
      (tokensIn / 1_000_000) * p.billing_input_per_mtok * 100 +
      (tokensOut / 1_000_000) * p.billing_output_per_mtok * 100
    );
    return { providerCents, billedCents };
  }

  /**
   * Log an LLM call. Costs are calculated automatically from the pricing table.
   * @param {{ agent_id, model, provider, tokens_in, tokens_out, latency_ms }} params
   */
  logLlmCall({ agent_id, model, provider, tokens_in, tokens_out, latency_ms }) {
    const { providerCents, billedCents } = this._calcCost(model, tokens_in, tokens_out);
    this._stmtInsertLlmCall.run({
      agent_id,
      model,
      provider,
      tokens_in,
      tokens_out,
      provider_cost_cents: providerCents,
      billed_cost_cents: billedCents,
      latency_ms,
    });
  }

  /**
   * Log a content request.
   * @param {{ agent_id, request_type, domain, size_bytes, blocked, block_reason }} params
   */
  logContentRequest({ agent_id, request_type, domain, size_bytes, blocked, block_reason }) {
    this._stmtInsertContentRequest.run({
      agent_id,
      request_type,
      domain: domain || null,
      size_bytes: size_bytes || 0,
      blocked: blocked ? 1 : 0,
      block_reason: block_reason || null,
    });
  }

  /**
   * Returns today's usage grouped by agent_id → model.
   * @returns {{ [agent_id]: { [model]: { calls, tokens_in, tokens_out, provider_cents, billed_cents } } }}
   */
  getUsageToday() {
    const rows = this._stmtUsageToday.all();
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

  /**
   * Returns today's content request summary.
   * @returns {{ requests: number, sanitized: number, blocked: number }}
   */
  getContentToday() {
    const row = this._stmtContentToday.get();
    return {
      requests: row ? (row.requests || 0) : 0,
      sanitized: row ? ((row.requests || 0) - (row.blocked || 0)) : 0,
      blocked: row ? (row.blocked || 0) : 0,
    };
  }

  /**
   * Returns per-model usage for a specific agent today.
   * @param {string} agentId
   * @returns {{ [model]: { calls, tokens_in, tokens_out, provider_cents, billed_cents } }}
   */
  getAgentUsage(agentId) {
    const rows = this._stmtAgentUsage.all(agentId);
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

  /**
   * Returns month-to-date spending totals.
   * @returns {{ provider_total_cents: number, billed_total_cents: number }}
   */
  getSpendingMtd() {
    const row = this._stmtSpendingMtd.get();
    return {
      provider_total_cents: row ? (row.provider_total_cents || 0) : 0,
      billed_total_cents: row ? (row.billed_total_cents || 0) : 0,
    };
  }

  /**
   * Returns usage_daily rows for the last N days.
   * @param {number} days
   * @returns {Array}
   */
  getUsageHistory(days) {
    const offset = `-${days - 1} days`;
    return this._stmtUsageHistory.all(offset);
  }

  /**
   * Upserts today's aggregated data into usage_daily.
   *
   * Strategy:
   * 1. Aggregate LLM calls by (agent_id, model)
   * 2. Aggregate content by agent_id
   * 3. For each LLM row, attach content stats for that agent (only the FIRST model row gets content
   *    to avoid double-counting across multi-model agents)
   * 4. For agents with content but no LLM calls, insert a row with model = 'none'
   */
  computeDailyRollup() {
    const today = new Date().toISOString().slice(0, 10);

    const llmRows = this._stmtRollupLlm.all();
    const contentRows = this._stmtRollupContent.all();

    // Build content lookup by agent_id
    const contentByAgent = {};
    for (const c of contentRows) {
      contentByAgent[c.agent_id] = {
        content_requests: c.content_requests || 0,
        content_blocked: c.content_blocked || 0,
      };
    }

    // Track which agents have been assigned content in rollup (to avoid double-counting)
    const agentsWithContent = new Set();

    const runRollup = this.db.transaction(() => {
      // 1. Insert/update rows from LLM calls
      for (const row of llmRows) {
        const isFirstModelForAgent = !agentsWithContent.has(row.agent_id);
        agentsWithContent.add(row.agent_id);

        const contentData = isFirstModelForAgent
          ? (contentByAgent[row.agent_id] || { content_requests: 0, content_blocked: 0 })
          : { content_requests: 0, content_blocked: 0 };

        this._stmtUpsertRollup.run({
          date: today,
          agent_id: row.agent_id,
          model: row.model,
          llm_calls: row.llm_calls,
          tokens_in: row.tokens_in,
          tokens_out: row.tokens_out,
          provider_cost_cents: row.provider_cost_cents,
          billed_cost_cents: row.billed_cost_cents,
          content_requests: contentData.content_requests,
          content_blocked: contentData.content_blocked,
        });
      }

      // 2. Insert agents that have content but no LLM calls (model = 'none')
      for (const [agent_id, content] of Object.entries(contentByAgent)) {
        if (!agentsWithContent.has(agent_id)) {
          this._stmtUpsertRollup.run({
            date: today,
            agent_id,
            model: 'none',
            llm_calls: 0,
            tokens_in: 0,
            tokens_out: 0,
            provider_cost_cents: 0,
            billed_cost_cents: 0,
            content_requests: content.content_requests,
            content_blocked: content.content_blocked,
          });
        }
      }
    });

    runRollup();
  }

  /**
   * Returns true if the agent has made >= 30 content requests in the last hour.
   * @param {string} agentId
   * @returns {boolean}
   */
  isContentRateLimited(agentId) {
    const row = this._stmtContentRateLimit.get(agentId);
    return row ? row.cnt >= 30 : false;
  }

  /**
   * Reload pricing data from disk.
   * @param {string} pricingPath
   */
  reloadPricing(pricingPath) {
    this.pricing = this._loadPricing(pricingPath);
  }

  /**
   * Close the database connection.
   */
  close() {
    this.db.close();
  }
}

export default Ledger;
