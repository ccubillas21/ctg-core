import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeRemote } from '../sanitizer.js';

describe('sanitizeRemote', () => {
  test('returns error when no sanitization URL configured', async () => {
    const result = await sanitizeRemote('dirty content', { sanitizationUrl: '' });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, 'no_sanitization_url');
  });

  test('returns error when sanitization endpoint unreachable', async () => {
    const result = await sanitizeRemote('dirty content', {
      sanitizationUrl: 'http://127.0.0.1:1',
      timeout: 2000,
    });
    assert.strictEqual(result.ok, false);
    assert.ok(['fetch_error', 'timeout'].includes(result.error));
  });

  test('returns error with empty sanitization URL', async () => {
    const result = await sanitizeRemote('test', {});
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, 'no_sanitization_url');
  });
});
