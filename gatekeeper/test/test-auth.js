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
