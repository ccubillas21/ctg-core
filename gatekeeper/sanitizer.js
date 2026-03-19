/**
 * sanitizer.js — Content fetching and HTML sanitization for CTG Gatekeeper
 */

import http from 'node:http';
import https from 'node:https';

const DEFAULT_MAX_BYTES = 50000;
const DEFAULT_FETCH_MAX_BYTES = 51200;
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 3;
const USER_AGENT = 'CTG-Gatekeeper/1.0';

/**
 * Decode common HTML entities.
 * @param {string} str
 * @returns {string}
 */
function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Strip HTML and return structured data.
 *
 * @param {string} html - Raw HTML string
 * @param {{ maxBytes?: number }} [opts]
 * @returns {{ title: string|null, body: string, date: string|null }}
 */
export function stripHtml(html, opts = {}) {
  const maxBytes = opts.maxBytes !== undefined ? opts.maxBytes : DEFAULT_MAX_BYTES;

  // Extract <title> content
  let title = null;
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    title = decodeEntities(titleMatch[1]).trim();
  }

  // Extract date from <meta name="date" content="...">
  let date = null;
  const metaDateMatch = html.match(/<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']date["']/i);
  if (metaDateMatch) {
    date = metaDateMatch[1].trim();
  }

  // Extract date from <time datetime="..."> (only if not already found)
  if (!date) {
    const timeDateMatch = html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
    if (timeDateMatch) {
      date = timeDateMatch[1].trim();
    }
  }

  // Remove <script>...</script> blocks entirely (including content)
  let body = html.replace(/<script[\s\S]*?<\/script>/gi, '');

  // Remove <style>...</style> blocks entirely
  body = body.replace(/<style[\s\S]*?<\/style>/gi, '');

  // Remove <noscript>...</noscript> blocks entirely
  body = body.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  // Strip all remaining HTML tags
  body = body.replace(/<[^>]+>/g, ' ');

  // Decode entities
  body = decodeEntities(body);

  // Collapse whitespace
  body = body.replace(/\s+/g, ' ').trim();

  // Enforce max size (truncate by byte count)
  if (Buffer.byteLength(body, 'utf8') > maxBytes) {
    // Truncate to maxBytes safely (avoid splitting multi-byte chars)
    const buf = Buffer.from(body, 'utf8');
    body = buf.slice(0, maxBytes).toString('utf8');
    // Remove any trailing partial multi-byte character (tostring may produce replacement char at end)
    // Safe approach: trim trailing replacement character if any
    body = body.replace(/\uFFFD$/, '');
  }

  return { title, body, date };
}

/**
 * Check whether a domain is permitted by the allowlist.
 *
 * @param {string} domain
 * @param {string[]|null} allowlist
 * @returns {boolean}
 */
export function isDomainAllowed(domain, allowlist) {
  if (!allowlist || allowlist.length === 0) return true;
  if (allowlist.includes('*')) return true;
  return allowlist.includes(domain);
}

/**
 * Fetch a URL and return its content.
 *
 * @param {string} url
 * @param {{ maxBytes?: number, timeout?: number, method?: string, body?: string|object }} [opts]
 * @returns {Promise<{ status: number, body: string, bytes: number }>}
 */
export function fetchUrl(url, opts = {}) {
  const maxBytes = opts.maxBytes || DEFAULT_FETCH_MAX_BYTES;
  const timeout = opts.timeout || DEFAULT_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    let redirectCount = 0;

    function doRequest(currentUrl) {
      let parsed;
      try {
        parsed = new URL(currentUrl);
      } catch (err) {
        return reject(new Error(`Invalid URL: ${currentUrl}`));
      }

      const lib = parsed.protocol === 'https:' ? https : http;
      const reqOpts = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: opts.method || 'GET',
        headers: {
          'User-Agent': USER_AGENT,
        },
      };

      const req = lib.request(reqOpts, (res) => {
        const { statusCode, headers } = res;

        // Handle redirects
        if ([301, 302, 303, 307, 308].includes(statusCode) && headers.location) {
          if (redirectCount >= MAX_REDIRECTS) {
            return reject(new Error('Too many redirects'));
          }
          redirectCount++;
          // Resolve relative redirects
          let nextUrl;
          try {
            nextUrl = new URL(headers.location, currentUrl).href;
          } catch {
            return reject(new Error(`Invalid redirect URL: ${headers.location}`));
          }
          res.resume(); // discard response body
          return doRequest(nextUrl);
        }

        const chunks = [];
        let totalBytes = 0;

        res.on('data', (chunk) => {
          totalBytes += chunk.length;
          if (totalBytes > maxBytes) {
            req.destroy();
            reject(new Error('Response too large'));
            return;
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolve({
            status: statusCode,
            body: buf.toString('utf8'),
            bytes: buf.length,
          });
        });

        res.on('error', (err) => reject(new Error(`Response error: ${err.message}`)));
      });

      req.setTimeout(timeout, () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });

      req.on('error', (err) => reject(new Error(`Fetch error: ${err.message}`)));
      if (opts.body) req.write(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
      req.end();
    }

    doRequest(url);
  });
}

/**
 * Send content to remote CTG sanitization endpoint for classification.
 * Returns { ok: true, clean, classification } on success.
 * Returns { ok: false, error } on failure — caller should queue, not bypass.
 *
 * @param {string} content
 * @param {{ sanitizationUrl?: string, timeout?: number }} [opts]
 * @returns {Promise<{ ok: boolean, clean?: boolean, classification?: string, error?: string }>}
 */
export async function sanitizeRemote(content, opts = {}) {
  const { sanitizationUrl, timeout = 30000 } = opts;
  if (!sanitizationUrl) {
    return { ok: false, error: 'no_sanitization_url' };
  }
  try {
    const response = await fetchUrl(`${sanitizationUrl}/sanitize`, {
      method: 'POST',
      body: JSON.stringify({ content }),
      timeout,
    });
    if (response.status >= 200 && response.status < 300) {
      const data = JSON.parse(response.body);
      return { ok: true, clean: data.clean, classification: data.classification };
    }
    return { ok: false, error: `http_${response.status}` };
  } catch (err) {
    return { ok: false, error: err.message.includes('timeout') ? 'timeout' : 'fetch_error' };
  }
}
