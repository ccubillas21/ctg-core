/**
 * CTG Core Gatekeeper — Main HTTP Server
 *
 * Wires together: Ledger (SQLite usage tracking), Hub (license / check-in),
 * proxy (LLM forwarding), and sanitizer (content fetch).
 *
 * Environment variables:
 *   GATEKEEPER_PORT            (default: 9090)
 *   GATEKEEPER_INTERNAL_TOKEN  (shared secret; skip auth check if empty)
 *   GATEKEEPER_DB_PATH         (default: ./gatekeeper.db)
 *   GATEKEEPER_PRICING_PATH    (default: ./pricing.json)
 *   GATEKEEPER_DOMAIN_ALLOWLIST (comma-separated, default: "*")
 *   CHECKIN_INTERVAL_MS        (default: 300000)
 *   ANTHROPIC_API_KEY
 *   OPENAI_API_KEY
 *   COMPANY_ID
 *   PARENT_HUB_URL
 *   PARENT_HUB_TOKEN
 *   LICENSE_GRACE_HOURS
 */

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Ledger, Hub, proxy, and sanitizer are dynamically imported inside start() so
// that importing index.js for auth-only unit tests does not pull in heavy
// dependencies (better-sqlite3, hub.js) that may not yet be present.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Auth helpers ─────────────────────────────────────────────────────────────

/**
 * Validate a "Bearer <token>" Authorization header.
 *
 * @param {string|undefined|null} authHeader
 * @param {string} expectedToken
 * @returns {boolean}
 */
export function validateToken(authHeader, expectedToken) {
  if (!authHeader) return false;
  if (!authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7); // 'Bearer '.length === 7
  return token === expectedToken;
}

/**
 * Returns true when the path requires authentication.
 * /health and /status are public; everything else requires auth.
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export function requiresAuth(pathname) {
  return pathname !== '/health' && pathname !== '/status';
}

// ── Response helpers ──────────────────────────────────────────────────────────

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendError(res, statusCode, error, message) {
  sendJson(res, statusCode, { status: 'error', error, message });
}

// ── Body buffering ────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ── Server factory ────────────────────────────────────────────────────────────

/**
 * Start the Gatekeeper HTTP server.
 *
 * @param {object} [overrides] - Optional config overrides (used in tests)
 * @returns {Promise<{ server: http.Server, ledger: Ledger, hub: Hub, close: Function }>}
 */
export async function start(overrides = {}) {
  const env = { ...process.env, ...overrides };

  const port = parseInt(env.GATEKEEPER_PORT || '9090', 10);
  const internalToken = env.GATEKEEPER_INTERNAL_TOKEN || '';
  const dbPath = env.GATEKEEPER_DB_PATH || path.join(__dirname, 'gatekeeper.db');
  const pricingPath = env.GATEKEEPER_PRICING_PATH || path.join(__dirname, 'pricing.json');
  const checkinIntervalMs = parseInt(env.CHECKIN_INTERVAL_MS || '300000', 10);

  // Domain allowlist — comma-separated, default ["*"]
  const allowlistRaw = env.GATEKEEPER_DOMAIN_ALLOWLIST || '*';
  const domainAllowlist = allowlistRaw.split(',').map((s) => s.trim()).filter(Boolean);

  // Dynamic imports — kept here so auth-only unit tests can import this file
  // without pulling in heavy dependencies that may not yet be installed/present.
  const [
    { default: Hub },
    { default: Ledger },
    proxy,
    sanitizer,
  ] = await Promise.all([
    import('./hub.js'),
    import('./ledger.js'),
    import('./proxy.js'),
    import('./sanitizer.js'),
  ]);

  // Initialise subsystems
  const ledger = new Ledger(dbPath, pricingPath);

  const hub = new Hub({
    companyId: env.COMPANY_ID,
    hubUrl: env.PARENT_HUB_URL,
    hubToken: env.PARENT_HUB_TOKEN,
    graceHours: env.LICENSE_GRACE_HOURS ? parseInt(env.LICENSE_GRACE_HOURS, 10) : undefined,
    openclawUrl: env.OPENCLAW_URL || 'http://openclaw:18789',
    paperclipUrl: env.PAPERCLIP_URL || 'http://paperclip:3100',
    n8nUrl: env.N8N_URL || 'http://n8n:5678',
    mcUrl: env.MC_URL || 'http://mission-control:4000',
    sopsDir: env.SOPS_DIR || '/home/node/.openclaw/sops',
  });

  // Periodic hub check-in
  const checkinInterval = setInterval(async () => {
    try {
      const [services, agents, botRequests] = await Promise.all([
        hub.collectHealth(),
        hub.getAgentList(),
        hub.getBotRequests(),
      ]);
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
      console.error('[gatekeeper] hub check-in error:', err.message);
    }
  }, checkinIntervalMs);

  // ── Request handler ─────────────────────────────────────────────────────────

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost`);
    const pathname = url.pathname;
    const method = req.method;

    // ── Auth gate ─────────────────────────────────────────────────────────────
    if (internalToken && requiresAuth(pathname)) {
      if (!validateToken(req.headers['authorization'], internalToken) &&
          req.headers['x-api-key'] !== internalToken) {
        sendError(res, 401, 'unauthorized', 'Missing or invalid Authorization token');
        return;
      }
    }

    try {
      // ── GET /health ─────────────────────────────────────────────────────────
      if (method === 'GET' && pathname === '/health') {
        const status = hub.getStatus();
        sendJson(res, 200, { status: 'ok', ...status });
        return;
      }

      // ── GET /status ─────────────────────────────────────────────────────────
      if (method === 'GET' && pathname === '/status') {
        const [status, health] = await Promise.all([
          hub.getStatus(),
          hub.collectHealth(),
        ]);
        sendJson(res, 200, { status: 'ok', hub: status, health });
        return;
      }

      // ── GET /usage ──────────────────────────────────────────────────────────
      if (method === 'GET' && pathname === '/usage') {
        const usage = ledger.getUsageToday();
        const content = ledger.getContentToday();
        const spending = ledger.getSpendingMtd();
        sendJson(res, 200, { status: 'ok', usage, content, spending });
        return;
      }

      // ── GET /usage/history ──────────────────────────────────────────────────
      if (method === 'GET' && pathname === '/usage/history') {
        const history = ledger.getUsageHistory(30);
        sendJson(res, 200, { status: 'ok', history });
        return;
      }

      // ── GET /usage/:agent ───────────────────────────────────────────────────
      if (method === 'GET' && pathname.startsWith('/usage/')) {
        const agentId = pathname.slice('/usage/'.length);
        if (!agentId) {
          sendError(res, 400, 'bad_request', 'Missing agent ID');
          return;
        }
        const usage = ledger.getAgentUsage(agentId);
        sendJson(res, 200, { status: 'ok', agent_id: agentId, usage });
        return;
      }

      // ── POST /checkin ───────────────────────────────────────────────────────
      if (method === 'POST' && pathname === '/checkin') {
        const [services, agents, botRequests] = await Promise.all([
          hub.collectHealth(),
          hub.getAgentList(),
          hub.getBotRequests(),
        ]);
        const payload = hub.buildCheckinPayload({
          services,
          agents,
          usageToday: ledger.getUsageToday(),
          contentToday: ledger.getContentToday(),
          spendingMtd: ledger.getSpendingMtd(),
          botRequests,
        });
        await hub.checkin(payload);
        sendJson(res, 200, { status: 'ok', checkin: hub.getStatus() });
        return;
      }

      // ── POST /fetch ─────────────────────────────────────────────────────────
      if (method === 'POST' && pathname === '/fetch') {
        // License check
        if (hub.isLicenseSuspended()) {
          sendError(res, 403, 'license_suspended', 'License is suspended — content fetch blocked');
          return;
        }

        const rawBody = await readBody(req);
        let bodyObj;
        try {
          bodyObj = JSON.parse(rawBody.toString('utf8'));
        } catch {
          sendError(res, 400, 'bad_request', 'Invalid JSON body');
          return;
        }

        const { url: fetchUrl, agent_id } = bodyObj;
        if (!fetchUrl) {
          sendError(res, 400, 'bad_request', 'Missing "url" in request body');
          return;
        }

        const agentId = agent_id || 'unknown';

        // Rate limit check
        if (ledger.isContentRateLimited(agentId)) {
          sendError(res, 429, 'rate_limited', 'Content rate limit exceeded (30 requests/hour)');
          return;
        }

        // Domain check
        let fetchDomain;
        try {
          fetchDomain = new URL(fetchUrl).hostname;
        } catch {
          sendError(res, 400, 'bad_request', 'Invalid URL');
          return;
        }

        if (!sanitizer.isDomainAllowed(fetchDomain, domainAllowlist)) {
          ledger.logContentRequest({
            agent_id: agentId,
            request_type: 'fetch',
            domain: fetchDomain,
            size_bytes: 0,
            blocked: true,
            block_reason: 'domain_not_allowed',
          });
          sendError(res, 403, 'domain_not_allowed', `Domain "${fetchDomain}" is not in the allowlist`);
          return;
        }

        // Fetch and strip
        let fetchResult;
        try {
          fetchResult = await sanitizer.fetchUrl(fetchUrl);
        } catch (err) {
          ledger.logContentRequest({
            agent_id: agentId,
            request_type: 'fetch',
            domain: fetchDomain,
            size_bytes: 0,
            blocked: true,
            block_reason: `fetch_error: ${err.message}`,
          });
          sendError(res, 502, 'fetch_error', err.message);
          return;
        }

        const stripped = sanitizer.stripHtml(fetchResult.body);

        ledger.logContentRequest({
          agent_id: agentId,
          request_type: 'fetch',
          domain: fetchDomain,
          size_bytes: fetchResult.bytes,
          blocked: false,
          block_reason: null,
        });

        sendJson(res, 200, {
          status: 'ok',
          url: fetchUrl,
          http_status: fetchResult.status,
          title: stripped.title,
          date: stripped.date,
          body: stripped.body,
          bytes: fetchResult.bytes,
        });
        return;
      }

      // ── /llm/* ──────────────────────────────────────────────────────────────
      if (pathname.startsWith('/llm/')) {
        // License check
        if (hub.isLicenseSuspended()) {
          sendError(res, 403, 'license_suspended', 'License is suspended — LLM proxy blocked');
          return;
        }

        // Parse route
        const route = proxy.parseRoute(pathname);
        if (!route) {
          sendError(res, 400, 'bad_route', 'Invalid LLM proxy path — expected /llm/{provider}/agents/{agentId}/...');
          return;
        }

        const { provider, agentId, upstreamPath } = route;

        // Buffer request body
        const rawBody = await readBody(req);
        let bodyObj = null;
        try {
          if (rawBody.length > 0) {
            bodyObj = JSON.parse(rawBody.toString('utf8'));
          }
        } catch {
          // Non-JSON body — pass through as-is
        }

        // Extract model
        const model = proxy.extractModel(bodyObj, provider);

        // Build upstream headers
        const stripped = proxy.stripAuthHeaders(req.headers);
        const upstream = proxy.injectApiKey(stripped, provider, env);

        // Build upstream URL
        const upstreamUrl = proxy.getUpstreamUrl(provider, upstreamPath);

        // Forward request
        let upstreamResponse;
        try {
          upstreamResponse = await proxy.forwardRequest(upstreamUrl, method, upstream, rawBody);
        } catch (err) {
          sendError(res, 502, 'upstream_error', err.message);
          return;
        }

        // Extract usage from response
        const { tokens_in, tokens_out } = proxy.extractUsage(upstreamResponse.body, provider);

        // Log to ledger (best-effort)
        try {
          ledger.logLlmCall({
            agent_id: agentId,
            model,
            provider,
            tokens_in,
            tokens_out,
            latency_ms: upstreamResponse.latencyMs,
          });
        } catch (err) {
          console.error('[gatekeeper] ledger log error:', err.message);
        }

        // Stream response back to client
        const responseHeaders = { ...upstreamResponse.headers };
        // Remove hop-by-hop headers
        delete responseHeaders['transfer-encoding'];
        delete responseHeaders['connection'];

        res.writeHead(upstreamResponse.status, responseHeaders);
        res.end(upstreamResponse.rawBody);
        return;
      }

      // ── 404 ─────────────────────────────────────────────────────────────────
      sendError(res, 404, 'not_found', `No route for ${method} ${pathname}`);

    } catch (err) {
      console.error('[gatekeeper] unhandled error:', err);
      sendError(res, 500, 'internal_error', err.message || 'Internal server error');
    }
  });

  // ── Start listening ─────────────────────────────────────────────────────────
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  console.log(`[gatekeeper] listening on port ${port}`);

  // ── Graceful shutdown ───────────────────────────────────────────────────────
  function shutdown(signal) {
    console.log(`[gatekeeper] ${signal} received — shutting down`);
    clearInterval(checkinInterval);
    server.close(() => {
      console.log('[gatekeeper] server closed');
      ledger.close();
      process.exit(0);
    });
    // Force exit after 10s
    setTimeout(() => {
      console.error('[gatekeeper] forced exit after 10s');
      process.exit(1);
    }, 10_000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return {
    server,
    ledger,
    hub,
    close: () =>
      new Promise((resolve) => {
        clearInterval(checkinInterval);
        server.close(resolve);
        ledger.close();
      }),
  };
}

// ── Entry point ───────────────────────────────────────────────────────────────

// Only auto-start when this file is run directly (not imported in tests).
// import.meta.url is a file:// URL; process.argv[1] is an absolute path.
// We convert argv[1] to a file URL string for a reliable comparison.
if (process.argv[1]) {
  const mainFileUrl = new URL(process.argv[1], 'file://').href;
  if (import.meta.url === mainFileUrl || import.meta.url.endsWith(process.argv[1])) {
    start().catch((err) => {
      console.error('[gatekeeper] startup failed:', err);
      process.exit(1);
    });
  }
}
