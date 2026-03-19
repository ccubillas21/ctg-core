/**
 * Unit tests for gatekeeper/proxy.js
 * Tests pure functions only — forwardRequest is excluded (makes real HTTP calls).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseRoute,
  getUpstreamUrl,
  stripAuthHeaders,
  injectApiKey,
  extractModel,
  extractUsage,
  PROVIDERS,
} from "../proxy.js";

// ── parseRoute ───────────────────────────────────────────────────────

describe("parseRoute", () => {
  it("parses anthropic URL path correctly", () => {
    const result = parseRoute("/llm/anthropic/agents/primary/v1/messages");
    assert.deepEqual(result, {
      provider: "anthropic",
      agentId: "primary",
      upstreamPath: "/v1/messages",
    });
  });

  it("parses openai URL path correctly", () => {
    const result = parseRoute("/llm/openai/agents/engineer/v1/chat/completions");
    assert.deepEqual(result, {
      provider: "openai",
      agentId: "engineer",
      upstreamPath: "/v1/chat/completions",
    });
  });

  it("returns null for unknown provider", () => {
    const result = parseRoute("/llm/cohere/agents/dispatch/v1/generate");
    assert.equal(result, null);
  });

  it("returns null when agent segment is missing", () => {
    const result = parseRoute("/llm/anthropic/v1/messages");
    assert.equal(result, null);
  });

  it("returns null for completely unrelated path", () => {
    const result = parseRoute("/health");
    assert.equal(result, null);
  });
});

// ── getUpstreamUrl ───────────────────────────────────────────────────

describe("getUpstreamUrl", () => {
  it("builds upstream URL for anthropic", () => {
    const url = getUpstreamUrl("anthropic", "/v1/messages");
    assert.equal(url, "https://api.anthropic.com/v1/messages");
  });

  it("builds upstream URL for openai", () => {
    const url = getUpstreamUrl("openai", "/v1/chat/completions");
    assert.equal(url, "https://api.openai.com/v1/chat/completions");
  });
});

// ── stripAuthHeaders ─────────────────────────────────────────────────

describe("stripAuthHeaders", () => {
  it("removes auth headers but keeps non-sensitive ones", () => {
    const input = {
      "content-type": "application/json",
      "authorization": "Bearer sk-test",
      "x-api-key": "sk-ant-test",
      "api-key": "some-key",
      "host": "localhost:3000",
      "connection": "keep-alive",
      "transfer-encoding": "chunked",
      "content-length": "42",
      "x-custom-header": "keep-me",
    };

    const result = stripAuthHeaders(input);

    // Auth / hop-by-hop headers must be gone
    assert.equal(result["authorization"], undefined);
    assert.equal(result["x-api-key"], undefined);
    assert.equal(result["api-key"], undefined);
    assert.equal(result["host"], undefined);
    assert.equal(result["connection"], undefined);
    assert.equal(result["transfer-encoding"], undefined);
    assert.equal(result["content-length"], undefined);

    // Safe headers must be kept
    assert.equal(result["content-type"], "application/json");
    assert.equal(result["x-custom-header"], "keep-me");
  });

  it("does not mutate the original headers object", () => {
    const input = { "authorization": "Bearer sk-test", "content-type": "application/json" };
    const original = { ...input };
    stripAuthHeaders(input);
    assert.deepEqual(input, original);
  });
});

// ── injectApiKey ─────────────────────────────────────────────────────

describe("injectApiKey", () => {
  it("injects anthropic API key as x-api-key and ensures anthropic-version", () => {
    const env = { ANTHROPIC_API_KEY: "sk-ant-secret" };
    const result = injectApiKey({}, "anthropic", env);
    assert.equal(result["x-api-key"], "sk-ant-secret");
    assert.ok(result["anthropic-version"], "anthropic-version header must be present");
  });

  it("does not overwrite existing anthropic-version if already set", () => {
    const env = { ANTHROPIC_API_KEY: "sk-ant-secret" };
    const result = injectApiKey({ "anthropic-version": "2023-01-01" }, "anthropic", env);
    assert.equal(result["anthropic-version"], "2023-01-01");
  });

  it("injects openai API key as Bearer authorization", () => {
    const env = { OPENAI_API_KEY: "sk-openai-secret" };
    const result = injectApiKey({}, "openai", env);
    assert.equal(result["authorization"], "Bearer sk-openai-secret");
  });
});

// ── extractModel ─────────────────────────────────────────────────────

describe("extractModel", () => {
  it("extracts model from anthropic request body", () => {
    const body = { model: "claude-opus-4-5", messages: [] };
    assert.equal(extractModel(body, "anthropic"), "anthropic/claude-opus-4-5");
  });

  it("extracts model from openai request body", () => {
    const body = { model: "gpt-4o", messages: [] };
    assert.equal(extractModel(body, "openai"), "openai/gpt-4o");
  });

  it("returns as-is when model already contains a slash", () => {
    const body = { model: "anthropic/claude-3-5-sonnet" };
    assert.equal(extractModel(body, "anthropic"), "anthropic/claude-3-5-sonnet");
  });

  it("returns provider/unknown when no model field", () => {
    assert.equal(extractModel({}, "openai"), "openai/unknown");
    assert.equal(extractModel(null, "anthropic"), "anthropic/unknown");
  });
});

// ── extractUsage ─────────────────────────────────────────────────────

describe("extractUsage", () => {
  it("extracts usage from anthropic response body", () => {
    const body = { usage: { input_tokens: 150, output_tokens: 75 } };
    const result = extractUsage(body, "anthropic");
    assert.deepEqual(result, { tokens_in: 150, tokens_out: 75 });
  });

  it("extracts usage from openai response body", () => {
    const body = { usage: { prompt_tokens: 200, completion_tokens: 100 } };
    const result = extractUsage(body, "openai");
    assert.deepEqual(result, { tokens_in: 200, tokens_out: 100 });
  });

  it("returns zeros when usage is absent", () => {
    assert.deepEqual(extractUsage({}, "anthropic"), { tokens_in: 0, tokens_out: 0 });
    assert.deepEqual(extractUsage(null, "openai"), { tokens_in: 0, tokens_out: 0 });
  });
});

// ── PROVIDERS constant ───────────────────────────────────────────────

describe("PROVIDERS", () => {
  it("contains correct base URLs", () => {
    assert.equal(PROVIDERS.anthropic, "https://api.anthropic.com");
    assert.equal(PROVIDERS.openai, "https://api.openai.com");
  });
});
