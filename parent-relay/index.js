/**
 * CTG Core — Parent Relay Sidecar
 *
 * Lightweight service that communicates with the CTG parent hub.
 * - Periodic health check-in (configurable, default 5 min)
 * - Receives config pushes from parent (SOP updates, model changes, new skills)
 * - Relays management commands (restart agent, deploy bot, update config)
 * - Does NOT relay message content — only metadata and status
 */

const http = require("node:http");
const https = require("node:https");
const { URL } = require("node:url");

// ── Config ──────────────────────────────────────────────────────────
const PARENT_HUB_URL = process.env.PARENT_HUB_URL;
const PARENT_HUB_TOKEN = process.env.PARENT_HUB_TOKEN;
const COMPANY_ID = process.env.COMPANY_ID;
const OPENCLAW_URL = process.env.OPENCLAW_URL || "http://openclaw:18789";
const PAPERCLIP_URL = process.env.PAPERCLIP_URL || "http://paperclip:3100";
const CHECKIN_INTERVAL = parseInt(process.env.CHECKIN_INTERVAL_MS || "300000", 10);
const PORT = parseInt(process.env.RELAY_PORT || "9090", 10);

let lastCheckin = null;
let lastCheckinStatus = "pending";
let checkinCount = 0;

// ── HTTP helpers ────────────────────────────────────────────────────
function fetch(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.request(url, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      timeout: 10000,
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

// ── Health collection ───────────────────────────────────────────────
async function collectHealth() {
  const report = {
    companyId: COMPANY_ID,
    timestamp: new Date().toISOString(),
    type: "checkin",
    services: {},
    agents: [],
    relay: { uptime: process.uptime(), checkins: checkinCount },
  };

  // Check Paperclip
  try {
    const r = await fetch(`${PAPERCLIP_URL}/api/health`);
    report.services.paperclip = r.status === 200 ? "healthy" : "unhealthy";
  } catch {
    report.services.paperclip = "unreachable";
  }

  // Check OpenClaw Gateway
  try {
    const r = await fetch(`${OPENCLAW_URL}/health`);
    report.services.gateway = r.status === 200 ? "healthy" : "unhealthy";
  } catch {
    report.services.gateway = "unreachable";
  }

  // Get agent list from Paperclip
  try {
    const r = await fetch(`${PAPERCLIP_URL}/api/companies/${COMPANY_ID}/agents`);
    if (r.status === 200 && Array.isArray(r.data)) {
      report.agents = r.data.map((a) => ({
        name: a.name,
        status: a.status,
        lastActivity: a.lastActivityAt,
      }));
    }
  } catch {
    // Agent list unavailable
  }

  return report;
}

// ── Check-in to parent hub ──────────────────────────────────────────
async function checkin() {
  if (!PARENT_HUB_URL || !PARENT_HUB_TOKEN) {
    lastCheckinStatus = "skipped-no-config";
    return;
  }

  try {
    const health = await collectHealth();
    const url = `${PARENT_HUB_URL}/api/tenants/${COMPANY_ID}/checkin`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${PARENT_HUB_TOKEN}` },
      body: health,
    });

    lastCheckin = new Date().toISOString();
    checkinCount++;
    lastCheckinStatus = res.status === 200 ? "ok" : `http-${res.status}`;

    // Process inbound commands from hub response
    if (res.data && res.data.commands && Array.isArray(res.data.commands)) {
      for (const cmd of res.data.commands) {
        await handleCommand(cmd);
      }
    }
  } catch (err) {
    lastCheckinStatus = `error: ${err.message}`;
    console.error(`[relay] Check-in failed: ${err.message}`);
  }
}

// ── Handle inbound commands from hub ────────────────────────────────
async function handleCommand(cmd) {
  console.log(`[relay] Received command: ${cmd.type}`);

  switch (cmd.type) {
    case "config-update":
      // Push config update to OpenClaw
      try {
        await fetch(`${OPENCLAW_URL}/api/reload`, { method: "POST", body: cmd.payload || {} });
        console.log("[relay] Config reload triggered");
      } catch (err) {
        console.error(`[relay] Config reload failed: ${err.message}`);
      }
      break;

    case "sop-update":
      // Write SOP file update (with path sanitization)
      if (cmd.payload && cmd.payload.filename && cmd.payload.content) {
        const fs = require("node:fs");
        const nodePath = require("node:path");
        const sopsDir = "/home/ctg/.openclaw/sops";
        // Sanitize filename — strip path separators to prevent traversal
        const safeName = nodePath.basename(cmd.payload.filename);
        if (safeName !== cmd.payload.filename) {
          console.error(`[relay] Rejected SOP update: suspicious filename "${cmd.payload.filename}"`);
          break;
        }
        const filePath = nodePath.join(sopsDir, safeName);
        fs.writeFileSync(filePath, cmd.payload.content, "utf8");
        console.log(`[relay] SOP updated: ${safeName}`);
      }
      break;

    case "deploy-bot":
      // Trigger bot deployment via Lobster
      try {
        await fetch(`${OPENCLAW_URL}/api/lobster/run`, {
          method: "POST",
          body: {
            workflow: "new-bot",
            vars: cmd.payload || {},
          },
        });
        console.log("[relay] Bot deployment triggered");
      } catch (err) {
        console.error(`[relay] Bot deploy failed: ${err.message}`);
      }
      break;

    default:
      console.log(`[relay] Unknown command type: ${cmd.type}`);
  }
}

// ── Local HTTP server (health + management) ─────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      uptime: process.uptime(),
      lastCheckin,
      lastCheckinStatus,
      checkinCount,
      parentHub: PARENT_HUB_URL ? "configured" : "not-configured",
    }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/status") {
    try {
      const health = await collectHealth();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(health));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/checkin") {
    await checkin();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ lastCheckin, lastCheckinStatus }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

// ── Start ───────────────────────────────────────────────────────────
server.listen(PORT, "0.0.0.0", () => {
  console.log(`[relay] Parent relay listening on :${PORT}`);
  console.log(`[relay] Parent hub: ${PARENT_HUB_URL || "not configured"}`);
  console.log(`[relay] Company ID: ${COMPANY_ID}`);
  console.log(`[relay] Check-in interval: ${CHECKIN_INTERVAL}ms`);

  // Initial check-in
  checkin();

  // Schedule periodic check-ins
  setInterval(checkin, CHECKIN_INTERVAL);
});
