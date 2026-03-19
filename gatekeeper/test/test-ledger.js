import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import Ledger from '../ledger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRICING_PATH = path.join(__dirname, '..', 'pricing.json');

function tmpDbPath() {
  return path.join(os.tmpdir(), `test-ledger-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
}

describe('Ledger', () => {
  let ledger;
  let dbPath;

  before(() => {
    dbPath = tmpDbPath();
    ledger = new Ledger(dbPath, PRICING_PATH);
  });

  after(() => {
    ledger.close();
    try { fs.unlinkSync(dbPath); } catch (_) {}
    // Also remove WAL files if present
    try { fs.unlinkSync(dbPath + '-wal'); } catch (_) {}
    try { fs.unlinkSync(dbPath + '-shm'); } catch (_) {}
  });

  // Test 1: Log an LLM call and retrieve it
  it('logs an LLM call and retrieves usage today', () => {
    ledger.logLlmCall({
      agent_id: 'primary',
      model: 'anthropic/claude-sonnet-4-6',
      provider: 'anthropic',
      tokens_in: 1000,
      tokens_out: 500,
      latency_ms: 350,
    });

    const usage = ledger.getUsageToday();
    assert.ok(usage['primary'], 'should have primary agent');
    assert.ok(usage['primary']['anthropic/claude-sonnet-4-6'], 'should have model entry');
    const entry = usage['primary']['anthropic/claude-sonnet-4-6'];
    assert.equal(entry.calls, 1);
    assert.equal(entry.tokens_in, 1000);
    assert.equal(entry.tokens_out, 500);
  });

  // Test 2: Provider and billed costs calculated correctly
  it('calculates provider and billed costs correctly', () => {
    const dbPath2 = tmpDbPath();
    const l2 = new Ledger(dbPath2, PRICING_PATH);

    try {
      // claude-opus-4-6: input=15.00/mtok, output=75.00/mtok
      // billing: input=18.00/mtok, output=90.00/mtok
      // 1,000,000 tokens in + 1,000,000 tokens out
      l2.logLlmCall({
        agent_id: 'engineer',
        model: 'anthropic/claude-opus-4-6',
        provider: 'anthropic',
        tokens_in: 1_000_000,
        tokens_out: 1_000_000,
        latency_ms: 1000,
      });

      const usage = l2.getUsageToday();
      const entry = usage['engineer']['anthropic/claude-opus-4-6'];
      // provider: (1 * 15.00 + 1 * 75.00) * 100 = 9000 cents
      assert.equal(entry.provider_cents, 9000);
      // billed: (1 * 18.00 + 1 * 90.00) * 100 = 10800 cents
      assert.equal(entry.billed_cents, 10800);
    } finally {
      l2.close();
      try { fs.unlinkSync(dbPath2); } catch (_) {}
      try { fs.unlinkSync(dbPath2 + '-wal'); } catch (_) {}
      try { fs.unlinkSync(dbPath2 + '-shm'); } catch (_) {}
    }
  });

  // Test 3: Log a content request (not blocked)
  it('logs a non-blocked content request', () => {
    ledger.logContentRequest({
      agent_id: 'primary',
      request_type: 'web_fetch',
      domain: 'example.com',
      size_bytes: 4096,
      blocked: false,
      block_reason: null,
    });

    const content = ledger.getContentToday();
    assert.ok(content.requests >= 1, 'should have at least one request');
    assert.equal(content.blocked, 0, 'no blocked requests yet from content calls');
  });

  // Test 4: Log a blocked content request
  it('logs a blocked content request', () => {
    ledger.logContentRequest({
      agent_id: 'primary',
      request_type: 'web_fetch',
      domain: 'malware.example.com',
      size_bytes: 0,
      blocked: true,
      block_reason: 'domain_blacklist',
    });

    const content = ledger.getContentToday();
    assert.equal(content.blocked, 1, 'should have one blocked request');
  });

  // Test 5: Compute daily rollup
  it('computes daily rollup and stores to usage_daily', () => {
    ledger.computeDailyRollup();

    const history = ledger.getUsageHistory(1);
    assert.ok(history.length > 0, 'should have at least one history row');

    // Find row for primary/claude-sonnet-4-6
    const row = history.find(r => r.agent_id === 'primary' && r.model === 'anthropic/claude-sonnet-4-6');
    assert.ok(row, 'should have rollup row for primary/sonnet');
    assert.equal(row.llm_calls, 1);
    assert.equal(row.tokens_in, 1000);
    assert.equal(row.tokens_out, 500);
    assert.ok(row.content_requests >= 2, 'primary agent had 2 content requests');
    assert.equal(row.content_blocked, 1);
  });

  // Test 6: Per-agent usage
  it('returns per-agent usage for a specific agent', () => {
    const agentUsage = ledger.getAgentUsage('primary');
    assert.ok(agentUsage['anthropic/claude-sonnet-4-6'], 'should have sonnet entry');
    const entry = agentUsage['anthropic/claude-sonnet-4-6'];
    assert.equal(entry.calls, 1);
    assert.equal(entry.tokens_in, 1000);
  });

  // Test 7: Spending MTD
  it('returns spending month-to-date', () => {
    const spend = ledger.getSpendingMtd();
    assert.ok(typeof spend.provider_total_cents === 'number', 'should have provider_total_cents');
    assert.ok(typeof spend.billed_total_cents === 'number', 'should have billed_total_cents');
    assert.ok(spend.provider_total_cents >= 0);
    assert.ok(spend.billed_total_cents >= spend.provider_total_cents, 'billing should be >= provider cost');
  });

  // Test 8: Content rate limit check
  it('rate limits agents with >= 30 content requests in last hour', () => {
    const dbPath3 = tmpDbPath();
    const l3 = new Ledger(dbPath3, PRICING_PATH);

    try {
      // Log 29 requests — should NOT be rate limited
      for (let i = 0; i < 29; i++) {
        l3.logContentRequest({
          agent_id: 'dispatch',
          request_type: 'web_fetch',
          domain: 'example.com',
          size_bytes: 100,
          blocked: false,
          block_reason: null,
        });
      }
      assert.equal(l3.isContentRateLimited('dispatch'), false, '29 requests: not rate limited');

      // Log 1 more — should now be rate limited
      l3.logContentRequest({
        agent_id: 'dispatch',
        request_type: 'web_fetch',
        domain: 'example.com',
        size_bytes: 100,
        blocked: false,
        block_reason: null,
      });
      assert.equal(l3.isContentRateLimited('dispatch'), true, '30 requests: should be rate limited');
    } finally {
      l3.close();
      try { fs.unlinkSync(dbPath3); } catch (_) {}
      try { fs.unlinkSync(dbPath3 + '-wal'); } catch (_) {}
      try { fs.unlinkSync(dbPath3 + '-shm'); } catch (_) {}
    }
  });
});
