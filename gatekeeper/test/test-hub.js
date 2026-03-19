import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

import Hub from '../hub.js';

function makeSopsDir() {
  const dir = path.join(os.tmpdir(), `test-sops-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

describe('Hub', () => {
  // Test 1: Builds check-in payload with usage data
  it('builds check-in payload with usage data', () => {
    const hub = new Hub({
      companyId: 'test-company-123',
      hubUrl: 'https://hub.example.com',
      hubToken: 'tok-abc',
      graceHours: 72,
      openclawUrl: 'http://openclaw:18789',
      paperclipUrl: 'http://paperclip:3100',
      n8nUrl: 'http://n8n:5678',
      mcUrl: 'http://mc:8090',
      sopsDir: makeSopsDir(),
    });

    const usageToday = { primary: { 'anthropic/claude-sonnet-4-6': { calls: 5, tokens_in: 1000, tokens_out: 500 } } };
    const contentToday = { requests: 10, blocked: 1, sanitized: 9 };
    const spendingMtd = { provider_total_cents: 500, billed_total_cents: 600 };
    const services = { openclaw: 'healthy', paperclip: 'healthy', n8n: 'unreachable', postgresql: 'healthy', mission_control: 'healthy' };
    const agents = [{ name: 'primary', status: 'active', last_activity: '2026-03-19T10:00:00Z' }];
    const botRequests = [];

    const payload = hub.buildCheckinPayload({ services, agents, usageToday, contentToday, spendingMtd, botRequests });

    assert.equal(payload.company_id, 'test-company-123', 'should include company_id');
    assert.ok(payload.timestamp, 'should include timestamp');
    assert.equal(payload.gatekeeper_version, '1.0.0', 'should include gatekeeper_version 1.0.0');
    assert.ok(typeof payload.uptime_seconds === 'number', 'should include uptime_seconds');
    assert.deepEqual(payload.services, services, 'should include services');
    assert.deepEqual(payload.usage_today, usageToday, 'should include usage_today');
    assert.deepEqual(payload.content_today, contentToday, 'should include content_today');
    assert.deepEqual(payload.spending_mtd, spendingMtd, 'should include spending_mtd');
    assert.deepEqual(payload.bot_requests, botRequests, 'should include bot_requests');
    assert.deepEqual(payload.agents, agents, 'should include agents');
  });

  // Test 2: Detects license suspension from hub response
  it('detects license suspension from hub response', () => {
    const hub = new Hub({
      companyId: 'test-company-123',
      hubUrl: 'https://hub.example.com',
      hubToken: 'tok-abc',
      graceHours: 72,
      openclawUrl: 'http://openclaw:18789',
      paperclipUrl: 'http://paperclip:3100',
      n8nUrl: 'http://n8n:5678',
      mcUrl: 'http://mc:8090',
      sopsDir: makeSopsDir(),
    });

    hub.processLicenseResponse({ status: 'suspended', expires: '2026-04-01T00:00:00Z' });

    assert.equal(hub.isLicenseSuspended(), true, 'should be suspended when status is suspended');
  });

  // Test 3: Detects license active from hub response
  it('detects license active from hub response', () => {
    const hub = new Hub({
      companyId: 'test-company-123',
      hubUrl: 'https://hub.example.com',
      hubToken: 'tok-abc',
      graceHours: 72,
      openclawUrl: 'http://openclaw:18789',
      paperclipUrl: 'http://paperclip:3100',
      n8nUrl: 'http://n8n:5678',
      mcUrl: 'http://mc:8090',
      sopsDir: makeSopsDir(),
    });

    hub.processLicenseResponse({ status: 'active', expires: '2027-01-01T00:00:00Z' });
    // Simulate a recent successful checkin
    hub._lastSuccessfulCheckin = Date.now();

    assert.equal(hub.isLicenseSuspended(), false, 'should not be suspended when status is active and recent checkin');
  });

  // Test 4: Triggers grace period degradation after 72 hours unreachable
  it('triggers grace period degradation after graceHours unreachable', () => {
    const hub = new Hub({
      companyId: 'test-company-123',
      hubUrl: 'https://hub.example.com',
      hubToken: 'tok-abc',
      graceHours: 72,
      openclawUrl: 'http://openclaw:18789',
      paperclipUrl: 'http://paperclip:3100',
      n8nUrl: 'http://n8n:5678',
      mcUrl: 'http://mc:8090',
      sopsDir: makeSopsDir(),
    });

    // Set license to active but last checkin was 73 hours ago
    hub.processLicenseResponse({ status: 'active', expires: '2027-01-01T00:00:00Z' });
    const seventyThreeHoursAgo = Date.now() - (73 * 60 * 60 * 1000);
    hub._lastSuccessfulCheckin = seventyThreeHoursAgo;

    assert.equal(hub.isLicenseSuspended(), true, 'should be suspended after 72h without contact');
  });

  // Test 5: Does not trigger degradation within grace period
  it('does not trigger degradation within grace period', () => {
    const hub = new Hub({
      companyId: 'test-company-123',
      hubUrl: 'https://hub.example.com',
      hubToken: 'tok-abc',
      graceHours: 72,
      openclawUrl: 'http://openclaw:18789',
      paperclipUrl: 'http://paperclip:3100',
      n8nUrl: 'http://n8n:5678',
      mcUrl: 'http://mc:8090',
      sopsDir: makeSopsDir(),
    });

    // Set license to active and last checkin was 48 hours ago (within 72h grace)
    hub.processLicenseResponse({ status: 'active', expires: '2027-01-01T00:00:00Z' });
    const fortyEightHoursAgo = Date.now() - (48 * 60 * 60 * 1000);
    hub._lastSuccessfulCheckin = fortyEightHoursAgo;

    assert.equal(hub.isLicenseSuspended(), false, 'should not be suspended within grace period');
  });

  // Test 6: Recovers from degradation when hub responds active
  it('recovers from degradation when hub responds active', () => {
    const hub = new Hub({
      companyId: 'test-company-123',
      hubUrl: 'https://hub.example.com',
      hubToken: 'tok-abc',
      graceHours: 72,
      openclawUrl: 'http://openclaw:18789',
      paperclipUrl: 'http://paperclip:3100',
      n8nUrl: 'http://n8n:5678',
      mcUrl: 'http://mc:8090',
      sopsDir: makeSopsDir(),
    });

    // First: suspend via expired status
    hub.processLicenseResponse({ status: 'expired', expires: '2025-01-01T00:00:00Z' });
    assert.equal(hub.isLicenseSuspended(), true, 'should initially be suspended');

    // Now: hub responds with active and we update last checkin
    hub.processLicenseResponse({ status: 'active', expires: '2027-01-01T00:00:00Z' });
    hub._lastSuccessfulCheckin = Date.now();

    assert.equal(hub.isLicenseSuspended(), false, 'should recover to active after hub responds active');
  });

  // Test 7: Skips check-in if no hub URL configured
  it('skips check-in if no hub URL configured', () => {
    const hub = new Hub({
      companyId: 'test-company-123',
      hubUrl: null,
      hubToken: null,
      graceHours: 72,
      openclawUrl: 'http://openclaw:18789',
      paperclipUrl: 'http://paperclip:3100',
      n8nUrl: 'http://n8n:5678',
      mcUrl: 'http://mc:8090',
      sopsDir: makeSopsDir(),
    });

    assert.equal(hub.shouldCheckin(), false, 'should not check in when hubUrl is not configured');
  });
});
