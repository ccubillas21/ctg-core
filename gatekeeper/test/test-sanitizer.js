import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stripHtml, isDomainAllowed } from '../sanitizer.js';

describe('stripHtml', () => {
  it('strips HTML tags and returns plain text', () => {
    const html = '<html><body><p>Hello world</p></body></html>';
    const result = stripHtml(html);
    assert.ok(result.body.includes('Hello world'), 'body should contain "Hello world"');
    assert.ok(!result.body.includes('<p>'), 'body should not contain HTML tags');
  });

  it('strips script tags entirely (no alert in output)', () => {
    const html = '<html><body><script>alert("xss")</script><p>Safe content</p></body></html>';
    const result = stripHtml(html);
    assert.ok(!result.body.includes('alert'), 'body should not contain "alert"');
    assert.ok(result.body.includes('Safe content'), 'body should contain safe content');
  });

  it('strips style tags entirely', () => {
    const html = '<html><head><style>body { color: red; }</style></head><body><p>Text</p></body></html>';
    const result = stripHtml(html);
    assert.ok(!result.body.includes('color'), 'body should not contain CSS');
    assert.ok(!result.body.includes('red'), 'body should not contain style values');
    assert.ok(result.body.includes('Text'), 'body should contain text content');
  });

  it('extracts date from meta tag', () => {
    const html = '<html><head><meta name="date" content="2026-03-19"></head><body><p>Article</p></body></html>';
    const result = stripHtml(html);
    assert.equal(result.date, '2026-03-19');
  });

  it('extracts date from time tag', () => {
    const html = '<html><body><time datetime="2026-01-15">January 15</time><p>Post</p></body></html>';
    const result = stripHtml(html);
    assert.equal(result.date, '2026-01-15');
  });

  it('enforces max size and truncates', () => {
    const longContent = 'A'.repeat(60000);
    const html = `<html><body><p>${longContent}</p></body></html>`;
    const result = stripHtml(html, { maxBytes: 50000 });
    assert.ok(
      Buffer.byteLength(result.body, 'utf8') <= 50000,
      `body should be <= 50000 bytes, got ${Buffer.byteLength(result.body, 'utf8')}`
    );
  });

  it('extracts title from title tag', () => {
    const html = '<html><head><title>My Page Title</title></head><body><p>Content</p></body></html>';
    const result = stripHtml(html);
    assert.equal(result.title, 'My Page Title');
  });

  it('decodes common HTML entities', () => {
    const html = '<html><body><p>&amp; &lt; &gt; &quot; &#39; &nbsp;</p></body></html>';
    const result = stripHtml(html);
    assert.ok(result.body.includes('&'), 'should decode &amp;');
    assert.ok(result.body.includes('<'), 'should decode &lt;');
    assert.ok(result.body.includes('>'), 'should decode &gt;');
  });
});

describe('isDomainAllowed', () => {
  it('allows everything when allowlist contains "*"', () => {
    assert.equal(isDomainAllowed('example.com', ['*']), true);
    assert.equal(isDomainAllowed('anything.org', ['*']), true);
  });

  it('allows everything when allowlist is empty', () => {
    assert.equal(isDomainAllowed('example.com', []), true);
  });

  it('allows everything when allowlist is null', () => {
    assert.equal(isDomainAllowed('example.com', null), true);
  });

  it('allows domain that is in the allowlist', () => {
    const allowlist = ['example.com', 'trusted.org'];
    assert.equal(isDomainAllowed('example.com', allowlist), true);
    assert.equal(isDomainAllowed('trusted.org', allowlist), true);
  });

  it('blocks domain not in the allowlist', () => {
    const allowlist = ['example.com', 'trusted.org'];
    assert.equal(isDomainAllowed('evil.com', allowlist), false);
    assert.equal(isDomainAllowed('untrusted.net', allowlist), false);
  });
});
