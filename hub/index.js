/**
 * CTG Core Hub — Tenant Management API
 *
 * Runs on Charlie's hub to manage deployed client stacks.
 * Endpoints for tenant registry, health check-ins, config pushes,
 * and remote bot deployment.
 *
 * Storage: SQLite via better-sqlite3
 */

const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");

const PORT = parseInt(process.env.HUB_PORT || "9100", 10);
const HUB_ADMIN_TOKEN = process.env.HUB_ADMIN_TOKEN;
if (!HUB_ADMIN_TOKEN) {
  console.error("[hub] FATAL: HUB_ADMIN_TOKEN environment variable is required");
  process.exit(1);
}
const DB_PATH = process.env.HUB_DB_PATH || path.join(__dirname, "hub.db");

// ── SQLite setup ────────────────────────────────────────────────────
let db;
function initDb() {
  const Database = require("better-sqlite3");
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  const schema = fs.readFileSync(path.join(__dirname, "tenants.sql"), "utf8");
  db.exec(schema);
  console.log(`[hub] Database initialized at ${DB_PATH}`);
}

// ── Auth middleware ─────────────────────────────────────────────────
function authenticate(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

function isAdmin(token) {
  return token === HUB_ADMIN_TOKEN;
}

function isTenant(token, tenantId) {
  if (!db) return false;
  const row = db.prepare("SELECT id FROM tenants WHERE id = ? AND management_token = ?").get(tenantId, token);
  return !!row;
}

// ── Request body parser ─────────────────────────────────────────────
function parseBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => {
      try { resolve(JSON.parse(data)); }
      catch { resolve(null); }
    });
  });
}

// ── JSON response helper ────────────────────────────────────────────
function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

// ── Route handler ───────────────────────────────────────────────────
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const parts = url.pathname.split("/").filter(Boolean);
  const token = authenticate(req);

  // Health check (no auth)
  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, { status: "ok", tenants: db.prepare("SELECT COUNT(*) as c FROM tenants").get().c });
  }

  // ── GET /api/tenants ────────────────────────────────────────────
  if (req.method === "GET" && url.pathname === "/api/tenants") {
    if (!isAdmin(token)) return json(res, 401, { error: "unauthorized" });
    const tenants = db.prepare("SELECT id, name, contact_email, created_at, updated_at FROM tenants").all();
    return json(res, 200, tenants);
  }

  // ── POST /api/tenants (create tenant) ───────────────────────────
  if (req.method === "POST" && url.pathname === "/api/tenants") {
    if (!isAdmin(token)) return json(res, 401, { error: "unauthorized" });
    const body = await parseBody(req);
    if (!body || !body.id || !body.name || !body.management_token) {
      return json(res, 400, { error: "id, name, and management_token required" });
    }
    try {
      db.prepare("INSERT INTO tenants (id, name, contact_email, management_token, relay_url) VALUES (?, ?, ?, ?, ?)")
        .run(body.id, body.name, body.contact_email || null, body.management_token, body.relay_url || null);
      return json(res, 201, { id: body.id, name: body.name });
    } catch (err) {
      return json(res, 409, { error: "tenant already exists" });
    }
  }

  // Route: /api/tenants/:id/...
  if (parts[0] === "api" && parts[1] === "tenants" && parts[2]) {
    const tenantId = parts[2];
    const action = parts[3];

    // ── POST /api/tenants/:id/checkin (from relay) ────────────────
    if (req.method === "POST" && action === "checkin") {
      if (!isTenant(token, tenantId)) return json(res, 401, { error: "unauthorized" });

      const body = await parseBody(req);
      if (!body) return json(res, 400, { error: "invalid payload" });

      db.prepare("INSERT INTO checkins (tenant_id, timestamp, payload) VALUES (?, ?, ?)")
        .run(tenantId, body.timestamp || new Date().toISOString(), JSON.stringify(body));

      db.prepare("UPDATE tenants SET updated_at = datetime('now') WHERE id = ?").run(tenantId);

      // Return any pending commands
      const commands = db.prepare(
        "SELECT id, command_type as type, payload FROM pending_commands WHERE tenant_id = ? AND status = 'pending'"
      ).all(tenantId);

      // Mark delivered
      if (commands.length > 0) {
        const ids = commands.map((c) => c.id);
        db.prepare(`UPDATE pending_commands SET status = 'delivered', delivered_at = datetime('now') WHERE id IN (${ids.map(() => "?").join(",")})`)
          .run(...ids);
      }

      const parsed = commands.map((c) => ({
        type: c.type,
        payload: JSON.parse(c.payload),
      }));

      return json(res, 200, { received: true, commands: parsed });
    }

    // ── GET /api/tenants/:id/health ───────────────────────────────
    if (req.method === "GET" && action === "health") {
      if (!isAdmin(token)) return json(res, 401, { error: "unauthorized" });

      const latest = db.prepare(
        "SELECT timestamp, payload FROM checkins WHERE tenant_id = ? ORDER BY timestamp DESC LIMIT 1"
      ).get(tenantId);

      if (!latest) return json(res, 404, { error: "no check-ins found" });

      return json(res, 200, {
        tenantId,
        lastCheckin: latest.timestamp,
        health: JSON.parse(latest.payload),
      });
    }

    // ── GET /api/tenants/:id/agents ───────────────────────────────
    if (req.method === "GET" && action === "agents") {
      if (!isAdmin(token)) return json(res, 401, { error: "unauthorized" });

      const latest = db.prepare(
        "SELECT payload FROM checkins WHERE tenant_id = ? ORDER BY timestamp DESC LIMIT 1"
      ).get(tenantId);

      if (!latest) return json(res, 404, { error: "no check-ins found" });

      const data = JSON.parse(latest.payload);
      return json(res, 200, data.agents || []);
    }

    // ── POST /api/tenants/:id/config ──────────────────────────────
    if (req.method === "POST" && action === "config") {
      if (!isAdmin(token)) return json(res, 401, { error: "unauthorized" });
      const body = await parseBody(req);
      if (!body) return json(res, 400, { error: "invalid payload" });

      db.prepare("INSERT INTO pending_commands (tenant_id, command_type, payload) VALUES (?, 'config-update', ?)")
        .run(tenantId, JSON.stringify(body));
      return json(res, 202, { queued: true, type: "config-update" });
    }

    // ── POST /api/tenants/:id/sops ────────────────────────────────
    if (req.method === "POST" && action === "sops") {
      if (!isAdmin(token)) return json(res, 401, { error: "unauthorized" });
      const body = await parseBody(req);
      if (!body || !body.filename || !body.content) {
        return json(res, 400, { error: "filename and content required" });
      }

      db.prepare("INSERT INTO pending_commands (tenant_id, command_type, payload) VALUES (?, 'sop-update', ?)")
        .run(tenantId, JSON.stringify(body));
      return json(res, 202, { queued: true, type: "sop-update" });
    }

    // ── POST /api/tenants/:id/deploy-bot ──────────────────────────
    if (req.method === "POST" && action === "deploy-bot") {
      if (!isAdmin(token)) return json(res, 401, { error: "unauthorized" });
      const body = await parseBody(req);
      if (!body || !body.agent_name || !body.model_tier) {
        return json(res, 400, { error: "agent_name and model_tier required" });
      }

      db.prepare("INSERT INTO pending_commands (tenant_id, command_type, payload) VALUES (?, 'deploy-bot', ?)")
        .run(tenantId, JSON.stringify(body));
      return json(res, 202, { queued: true, type: "deploy-bot" });
    }
  }

  // 404
  json(res, 404, { error: "not found" });
}

// ── Start ───────────────────────────────────────────────────────────
if (require.main === module) {
  initDb();

  const server = http.createServer(handleRequest);
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[hub] CTG Core Hub API listening on :${PORT}`);
    console.log(`[hub] Database: ${DB_PATH}`);
  });
}

module.exports = { initDb };
