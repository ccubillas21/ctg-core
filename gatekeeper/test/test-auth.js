/**
 * test-auth.js — Unit tests for validateToken and requiresAuth (pure auth functions)
 *
 * Uses Node.js built-in test runner. Does NOT start the HTTP server.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { validateToken, requiresAuth } from '../index.js';

// ── validateToken ────────────────────────────────────────────────────────────

describe('validateToken', () => {
  it('accepts a correct token', () => {
    assert.equal(validateToken('Bearer secret123', 'secret123'), true);
  });

  it('rejects a missing/undefined token header', () => {
    assert.equal(validateToken(undefined, 'secret123'), false);
    assert.equal(validateToken(null, 'secret123'), false);
    assert.equal(validateToken('', 'secret123'), false);
  });

  it('rejects a wrong token', () => {
    assert.equal(validateToken('Bearer wrongtoken', 'secret123'), false);
  });

  it('rejects a malformed header (not "Bearer <token>")', () => {
    assert.equal(validateToken('Token secret123', 'secret123'), false);
    assert.equal(validateToken('secret123', 'secret123'), false);
    assert.equal(validateToken('Basic secret123', 'secret123'), false);
  });
});

// ── requiresAuth ─────────────────────────────────────────────────────────────

describe('requiresAuth', () => {
  it('returns false for /health and /status', () => {
    assert.equal(requiresAuth('/health'), false);
    assert.equal(requiresAuth('/status'), false);
  });

  it('returns true for /llm/*, /fetch, and /usage', () => {
    assert.equal(requiresAuth('/llm/anthropic/agents/primary/v1/messages'), true);
    assert.equal(requiresAuth('/fetch'), true);
    assert.equal(requiresAuth('/usage'), true);
    assert.equal(requiresAuth('/usage/history'), true);
    assert.equal(requiresAuth('/usage/agent-1'), true);
    assert.equal(requiresAuth('/checkin'), true);
  });
});

// ── x-api-key alternative auth (mirrors handler logic) ───────────────────────
//
// The handler gate is:
//   if (!validateToken(headers['authorization'], token) &&
//       headers['x-api-key'] !== token) → reject
//
// We test the combined boolean expression that determines whether a request
// is allowed through, matching the exact logic in index.js ~line 147-152.

function isAllowed(headers, token) {
  return validateToken(headers['authorization'], token) ||
         headers['x-api-key'] === token;
}

describe('x-api-key alternative auth', () => {
  const TOKEN = 'supersecret-token';

  it('accepts a valid x-api-key header with no Authorization header', () => {
    const headers = { 'x-api-key': TOKEN };
    assert.equal(isAllowed(headers, TOKEN), true);
  });

  it('rejects an invalid x-api-key with no Authorization header', () => {
    const headers = { 'x-api-key': 'wrong-token' };
    assert.equal(isAllowed(headers, TOKEN), false);
  });

  it('rejects missing x-api-key and missing Authorization header', () => {
    const headers = {};
    assert.equal(isAllowed(headers, TOKEN), false);
  });

  it('rejects an invalid x-api-key AND an invalid Authorization header', () => {
    const headers = {
      'authorization': 'Bearer wrong-token',
      'x-api-key': 'also-wrong',
    };
    assert.equal(isAllowed(headers, TOKEN), false);
  });

  it('accepts a valid Authorization: Bearer header (existing behavior)', () => {
    const headers = { 'authorization': `Bearer ${TOKEN}` };
    assert.equal(isAllowed(headers, TOKEN), true);
  });

  it('accepts when both Authorization and x-api-key are valid', () => {
    const headers = {
      'authorization': `Bearer ${TOKEN}`,
      'x-api-key': TOKEN,
    };
    assert.equal(isAllowed(headers, TOKEN), true);
  });

  it('accepts a valid Authorization even when x-api-key is wrong', () => {
    const headers = {
      'authorization': `Bearer ${TOKEN}`,
      'x-api-key': 'bad-key',
    };
    assert.equal(isAllowed(headers, TOKEN), true);
  });
});
