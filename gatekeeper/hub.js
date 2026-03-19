/**
 * CTG Core — Gatekeeper Hub Reporter
 *
 * Handles check-ins to the parent CTG hub, license management,
 * service health collection, and inbound command handling.
 *
 * Absorbs the functionality previously in parent-relay/index.js.
 */

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { URL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GATEKEEPER_VERSION = '1.0.0';

// ── HTTP helper ──────────────────────────────────────────────────────
function httpFetch(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

class Hub {
  /**
   * @param {object} opts
   * @param {string} opts.companyId
   * @param {string|null} opts.hubUrl
   * @param {string|null} opts.hubToken
   * @param {number} opts.graceHours - Hours before grace period triggers suspension
   * @param {string} opts.openclawUrl
   * @param {string} opts.paperclipUrl
   * @param {string} opts.n8nUrl
   * @param {string} opts.mcUrl
   * @param {string} opts.sopsDir
   */
  constructor({ companyId, hubUrl, hubToken, graceHours, openclawUrl, paperclipUrl, n8nUrl, mcUrl, sopsDir }) {
    this.companyId = companyId;
    this.hubUrl = hubUrl || null;
    this.hubToken = hubToken || null;
    this.graceHours = graceHours || 72;
    this.openclawUrl = openclawUrl;
    this.paperclipUrl = paperclipUrl;
    this.n8nUrl = n8nUrl;
    this.mcUrl = mcUrl;
    this.sopsDir = sopsDir;

    this._startTime = Date.now();
    this._licenseStatus = 'unknown';
    this._licenseExpires = null;
    this._lastSuccessfulCheckin = null;
    this._lastCheckin = null;
    this._checkinCount = 0;
  }

  /**
   * Returns true if hub check-ins are configured.
   * @returns {boolean}
   */
  shouldCheckin() {
    return !!(this.hubUrl && this.hubToken);
  }

  /**
   * Builds the check-in payload to send to the hub.
   * @param {{ services, agents, usageToday, contentToday, spendingMtd, botRequests }} data
   * @returns {object}
   */
  buildCheckinPayload({ services, agents, usageToday, contentToday, spendingMtd, botRequests }) {
    return {
      company_id: this.companyId,
      timestamp: new Date().toISOString(),
      gatekeeper_version: GATEKEEPER_VERSION,
      uptime_seconds: (Date.now() - this._startTime) / 1000,
      services,
      agents,
      usage_today: usageToday,
      content_today: contentToday,
      spending_mtd: spendingMtd,
      bot_requests: botRequests,
    };
  }

  /**
   * Updates internal license state from hub response.
   * @param {{ status: string, expires: string }} license
   */
  processLicenseResponse(license) {
    if (license && license.status) {
      this._licenseStatus = license.status;
    }
    if (license && license.expires) {
      this._licenseExpires = license.expires;
    }
  }

  /**
   * Returns true if the license is suspended or expired, or if the grace period has elapsed.
   * @returns {boolean}
   */
  isLicenseSuspended() {
    // Explicit suspension or expiry
    if (this._licenseStatus === 'suspended' || this._licenseStatus === 'expired') {
      return true;
    }

    // Grace period: if last successful checkin is > graceHours ago
    if (this._lastSuccessfulCheckin !== null) {
      const elapsedMs = Date.now() - this._lastSuccessfulCheckin;
      const elapsedHours = elapsedMs / (1000 * 60 * 60);
      if (elapsedHours > this.graceHours) {
        return true;
      }
    }

    return false;
  }

  /**
   * Collects health status for all services.
   * @returns {Promise<{ openclaw, paperclip, n8n, postgresql, mission_control }>}
   */
  async collectHealth() {
    const health = {
      openclaw: 'unreachable',
      paperclip: 'unreachable',
      n8n: 'unreachable',
      postgresql: 'unreachable',
      mission_control: 'unreachable',
    };

    // OpenClaw gateway
    try {
      const r = await httpFetch(`${this.openclawUrl}/health`);
      health.openclaw = r.status === 200 ? 'healthy' : 'unhealthy';
    } catch {
      health.openclaw = 'unreachable';
    }

    // Paperclip API
    try {
      const r = await httpFetch(`${this.paperclipUrl}/api/health`);
      health.paperclip = r.status === 200 ? 'healthy' : 'unhealthy';
      // Paperclip health also indicates PostgreSQL is up
      health.postgresql = health.paperclip;
    } catch {
      health.paperclip = 'unreachable';
      health.postgresql = 'unreachable';
    }

    // n8n
    try {
      const r = await httpFetch(`${this.n8nUrl}/healthz`);
      health.n8n = r.status === 200 ? 'healthy' : 'unhealthy';
    } catch {
      health.n8n = 'unreachable';
    }

    // Mission control
    try {
      const r = await httpFetch(`${this.mcUrl}/api/status`);
      health.mission_control = r.status === 200 ? 'healthy' : 'unhealthy';
    } catch {
      health.mission_control = 'unreachable';
    }

    return health;
  }

  /**
   * Gets the list of agents from Paperclip.
   * @returns {Promise<Array<{ name, status, last_activity }>>}
   */
  async getAgentList() {
    try {
      const r = await httpFetch(`${this.paperclipUrl}/api/companies/${this.companyId}/agents`);
      if (r.status === 200 && Array.isArray(r.data)) {
        return r.data.map((a) => ({
          name: a.name,
          status: a.status,
          last_activity: a.lastActivityAt || null,
        }));
      }
    } catch {
      // Agent list unavailable
    }
    return [];
  }

  /**
   * Gets pending bot requests from Paperclip tasks API.
   * @returns {Promise<Array>}
   */
  async getBotRequests() {
    try {
      const r = await httpFetch(
        `${this.paperclipUrl}/api/companies/${this.companyId}/tasks?type=bot-request&status=pending`
      );
      if (r.status === 200 && Array.isArray(r.data)) {
        return r.data;
      }
    } catch {
      // Bot requests unavailable
    }
    return [];
  }

  /**
   * Sends a check-in to the parent hub and processes the response.
   * @param {object} payload - Built by buildCheckinPayload()
   * @returns {Promise<void>}
   */
  async checkin(payload) {
    if (!this.shouldCheckin()) {
      return;
    }

    const url = `${this.hubUrl}/api/tenants/${this.companyId}/checkin`;
    const res = await httpFetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.hubToken}` },
      body: payload,
    });

    this._lastCheckin = new Date().toISOString();
    this._checkinCount++;

    if (res.status === 200) {
      this._lastSuccessfulCheckin = Date.now();
    }

    // Process license info from response
    if (res.data && res.data.license) {
      this.processLicenseResponse(res.data.license);
    }

    // Process inbound commands from hub response
    if (res.data && Array.isArray(res.data.commands)) {
      for (const cmd of res.data.commands) {
        await this.handleCommand(cmd);
      }
    }
  }

  /**
   * Handles a command received from the hub.
   * @param {{ type: string, payload: object }} cmd
   */
  async handleCommand(cmd) {
    console.log(`[hub] Received command: ${cmd.type}`);

    switch (cmd.type) {
      case 'config-update':
        try {
          await httpFetch(`${this.openclawUrl}/api/reload`, {
            method: 'POST',
            body: cmd.payload || {},
          });
          console.log('[hub] Config reload triggered');
        } catch (err) {
          console.error(`[hub] Config reload failed: ${err.message}`);
        }
        break;

      case 'sop-update':
        if (cmd.payload && cmd.payload.filename && cmd.payload.content) {
          const safeName = path.basename(cmd.payload.filename);
          if (safeName !== cmd.payload.filename) {
            console.error(`[hub] Rejected SOP update: suspicious filename "${cmd.payload.filename}"`);
            break;
          }
          const filePath = path.join(this.sopsDir, safeName);
          fs.writeFileSync(filePath, cmd.payload.content, 'utf8');
          console.log(`[hub] SOP updated: ${safeName}`);
        }
        break;

      case 'deploy-bot':
        try {
          await httpFetch(`${this.openclawUrl}/api/lobster/run`, {
            method: 'POST',
            body: {
              workflow: 'new-bot',
              vars: cmd.payload || {},
            },
          });
          console.log('[hub] Bot deployment triggered');
        } catch (err) {
          console.error(`[hub] Bot deploy failed: ${err.message}`);
        }
        break;

      case 'pricing-update':
        if (cmd.payload && cmd.payload.pricing) {
          const pricingPath = process.env.GATEKEEPER_PRICING_PATH || path.join(__dirname, 'pricing.json');
          fs.writeFileSync(pricingPath, JSON.stringify(cmd.payload.pricing, null, 2), 'utf8');
          console.log('[hub] Pricing updated');
        }
        break;

      default:
        console.log(`[hub] Unknown command type: ${cmd.type}`);
    }
  }

  /**
   * Returns the current hub/license status summary.
   * @returns {object}
   */
  getStatus() {
    return {
      status: this.isLicenseSuspended() ? 'suspended' : 'active',
      uptime: (Date.now() - this._startTime) / 1000,
      lastCheckin: this._lastCheckin,
      checkinCount: this._checkinCount,
      licenseStatus: this._licenseStatus,
      licenseExpires: this._licenseExpires,
      parentHub: this.hubUrl ? 'configured' : 'not-configured',
    };
  }
}

export default Hub;
