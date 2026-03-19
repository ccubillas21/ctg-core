/**
 * CTG Core Gatekeeper — LLM Reverse Proxy Module
 *
 * Pure functions for proxying LLM API calls. This module does NOT create
 * an HTTP server — it provides helpers consumed by index.js.
 */

import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

// ── Constants ─────────────────────────────────────────────────────────

export const PROVIDERS = {
  anthropic: "https://api.anthropic.com",
  openai: "https://api.openai.com",
};

const VALID_PROVIDERS = new Set(Object.keys(PROVIDERS));

// Headers to strip before forwarding upstream
const STRIP_HEADERS = new Set([
  "authorization",
  "x-api-key",
  "api-key",
  "host",
  "connection",
  "transfer-encoding",
  "content-length",
]);

// Default Anthropic API version if not already provided
const DEFAULT_ANTHROPIC_VERSION = "2023-06-01";

// ── parseRoute ────────────────────────────────────────────────────────

/**
 * Parse an incoming URL path of the form /llm/{provider}/agents/{agentId}/{rest...}
 *
 * @param {string} urlPath - e.g. "/llm/anthropic/agents/primary/v1/messages"
 * @returns {{ provider: string, agentId: string, upstreamPath: string } | null}
 */
export function parseRoute(urlPath) {
  // Expect at least: /llm/{provider}/agents/{agentId}/...
  const match = urlPath.match(/^\/llm\/([^/]+)\/agents\/([^/]+)(\/.*)?$/);
  if (!match) return null;

  const [, provider, agentId, rest] = match;

  if (!VALID_PROVIDERS.has(provider)) return null;

  const upstreamPath = rest || "/";

  return { provider, agentId, upstreamPath };
}

// ── getUpstreamUrl ────────────────────────────────────────────────────

/**
 * Build the full upstream URL for a given provider and path.
 *
 * @param {string} provider - "anthropic" | "openai"
 * @param {string} path     - e.g. "/v1/messages"
 * @returns {string}
 */
export function getUpstreamUrl(provider, path) {
  return `${PROVIDERS[provider]}${path}`;
}

// ── stripAuthHeaders ──────────────────────────────────────────────────

/**
 * Return a copy of the headers object with auth/connection headers removed.
 * Does NOT mutate the input.
 *
 * @param {Record<string, string>} headers
 * @returns {Record<string, string>}
 */
export function stripAuthHeaders(headers) {
  const result = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!STRIP_HEADERS.has(key.toLowerCase())) {
      result[key] = value;
    }
  }
  return result;
}

// ── injectApiKey ──────────────────────────────────────────────────────

/**
 * Return a copy of headers with the provider API key injected.
 * For Anthropic: sets x-api-key and ensures anthropic-version is present.
 * For OpenAI: sets Authorization as Bearer token.
 * Does NOT mutate the input.
 *
 * @param {Record<string, string>} headers
 * @param {string} provider - "anthropic" | "openai"
 * @param {Record<string, string>} env - environment variables
 * @returns {Record<string, string>}
 */
export function injectApiKey(headers, provider, env) {
  const result = { ...headers };

  if (provider === "anthropic") {
    result["x-api-key"] = env.ANTHROPIC_API_KEY;
    if (!result["anthropic-version"]) {
      result["anthropic-version"] = DEFAULT_ANTHROPIC_VERSION;
    }
  } else if (provider === "openai") {
    result["authorization"] = `Bearer ${env.OPENAI_API_KEY}`;
  }

  return result;
}

// ── extractModel ──────────────────────────────────────────────────────

/**
 * Extract the model identifier from a request body.
 * Returns "{provider}/{model}", or "{provider}/unknown" if model is absent.
 * If model already contains a slash it is returned as-is.
 *
 * @param {object|null} body
 * @param {string} provider
 * @returns {string}
 */
export function extractModel(body, provider) {
  const model = body && body.model;
  if (!model) return `${provider}/unknown`;
  if (model.includes("/")) return model;
  return `${provider}/${model}`;
}

// ── extractUsage ──────────────────────────────────────────────────────

/**
 * Extract token usage from a response body.
 *
 * Anthropic shape: { usage: { input_tokens, output_tokens } }
 * OpenAI shape:    { usage: { prompt_tokens, completion_tokens } }
 *
 * @param {object|null} body
 * @param {string} provider - "anthropic" | "openai"
 * @returns {{ tokens_in: number, tokens_out: number }}
 */
export function extractUsage(body, provider) {
  const usage = body && body.usage;
  if (!usage) return { tokens_in: 0, tokens_out: 0 };

  if (provider === "anthropic") {
    return {
      tokens_in: usage.input_tokens || 0,
      tokens_out: usage.output_tokens || 0,
    };
  }

  // openai
  return {
    tokens_in: usage.prompt_tokens || 0,
    tokens_out: usage.completion_tokens || 0,
  };
}

// ── forwardRequest ────────────────────────────────────────────────────

/**
 * Forward an HTTP/HTTPS request to the upstream URL and return the response.
 *
 * @param {string} upstreamUrl       - Full URL to forward to
 * @param {string} method            - HTTP method (GET, POST, etc.)
 * @param {Record<string, string>} headers - Request headers (already stripped/injected)
 * @param {Buffer|null} bodyBuffer   - Raw request body
 * @returns {Promise<{
 *   status: number,
 *   headers: Record<string, string>,
 *   body: object|null,
 *   rawBody: Buffer,
 *   latencyMs: number,
 * }>}
 */
export function forwardRequest(upstreamUrl, method, headers, bodyBuffer) {
  return new Promise((resolve, reject) => {
    const url = new URL(upstreamUrl);
    const mod = url.protocol === "https:" ? https : http;

    const reqHeaders = { ...headers };
    if (bodyBuffer && bodyBuffer.length > 0) {
      reqHeaders["content-length"] = String(bodyBuffer.length);
    }

    const startMs = Date.now();

    const req = mod.request(url, {
      method,
      headers: reqHeaders,
      timeout: 120_000,
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const latencyMs = Date.now() - startMs;
        const rawBody = Buffer.concat(chunks);
        let body = null;
        try {
          body = JSON.parse(rawBody.toString("utf8"));
        } catch {
          // non-JSON response — leave body as null
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body,
          rawBody,
          latencyMs,
        });
      });
      res.on("error", reject);
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("upstream request timed out after 120s"));
    });

    if (bodyBuffer && bodyBuffer.length > 0) {
      req.write(bodyBuffer);
    }
    req.end();
  });
}
