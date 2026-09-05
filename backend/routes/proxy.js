const express = require('express');
const Client = require('../models/Client');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// All proxy routes require authentication (growmore-panel login)
router.use(requireAuth);

// ─── JWT Token Cache ─────────────────────────────────────────────────────────
// Stores { token, expiresAt } per clientId. Tokens are refreshed automatically.
const tokenCache = new Map();
const TOKEN_TTL_MS = 23 * 60 * 60 * 1000; // 23 hours (BenneCafe JWTs last 24h)

/**
 * Obtain (or return cached) a JWT token for a client's backend admin user.
 * Logs in via POST [apiUrl]/api/auth/login with the client's adminPhone + adminPassword.
 */
async function getAdminToken(client) {
  const cached = tokenCache.get(client.id);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  if (!client.adminPhone || !client.adminPassword) {
    throw new Error(
      `No admin credentials configured for client "${client.name}". ` +
      'Set adminPhone and adminPassword on the Client record.'
    );
  }

  const loginUrl = `${client.apiUrl}/api/auth/login`;
  const loginRes = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: client.adminPhone,
      password: client.adminPassword,
      role: 'admin',
    }),
  });

  if (!loginRes.ok) {
    const txt = await loginRes.text();
    throw new Error(`Admin login failed for client "${client.name}": ${txt}`);
  }

  const data = await loginRes.json();
  const token = data.token;
  if (!token) {
    throw new Error(`Admin login for client "${client.name}" returned no token.`);
  }

  tokenCache.set(client.id, { token, expiresAt: Date.now() + TOKEN_TTL_MS });
  console.log(`[Admin Proxy] Obtained fresh JWT for client: ${client.name}`);
  return token;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Look up a client by MongoDB ID, returning 404 if not found.
 */
async function resolveClient(clientId, res) {
  const client = await Client.findById(clientId);
  if (!client) {
    res.status(404).json({ message: 'Client not found' });
    return null;
  }
  return client;
}

/**
 * Forward a request to the client's backend and pipe the response back.
 * @param {object} extraHeaders - Additional headers to merge (e.g. Authorization).
 */
async function proxyRequest(req, res, targetUrl, client, extraHeaders = {}) {
  // Forward query params
  Object.entries(req.query).forEach(([k, v]) => targetUrl.searchParams.set(k, v));

  const fetchOptions = {
    method: req.method,
    headers: {
      'X-API-KEY': client.apiKey,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  };

  // Attach body for mutating methods
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    fetchOptions.body = JSON.stringify(req.body);
  }

  const upstream = await fetch(targetUrl.toString(), fetchOptions);

  // Pipe response — handle empty 204 bodies
  if (upstream.status === 204) {
    return res.status(204).end();
  }

  const text = await upstream.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text };
  }

  return res.status(upstream.status).json(data);
}

// ─── ADMIN PROXY (All HTTP Methods) ───────────────────────────────────────────
/**
 * ALL /api/proxy/:clientId/admin/*
 * Forwards to: [client.apiUrl]/api/admin/*  (preserves the /admin prefix)
 * Authenticates using a cached JWT obtained via the client's admin credentials.
 *
 * Used for management operations:
 *   PATCH  /api/proxy/:cId/admin/bookings/:id/payment → PATCH  [url]/api/admin/bookings/:id/payment
 *   DELETE /api/proxy/:cId/admin/bookings/:id         → DELETE [url]/api/admin/bookings/:id
 *   POST   /api/proxy/:cId/admin/drivers              → POST   [url]/api/admin/drivers
 *   PUT    /api/proxy/:cId/admin/drivers/:id          → PUT    [url]/api/admin/drivers/:id
 *   DELETE /api/proxy/:cId/admin/drivers/:id          → DELETE [url]/api/admin/drivers/:id
 *   POST   /api/proxy/:cId/admin/supervisors          → POST   [url]/api/admin/supervisors
 *   PUT    /api/proxy/:cId/admin/supervisors/:id      → PUT    [url]/api/admin/supervisors/:id
 *   DELETE /api/proxy/:cId/admin/supervisors/:id      → DELETE [url]/api/admin/supervisors/:id
 *   POST   /api/proxy/:cId/admin/venues               → POST   [url]/api/admin/venues
 *   PUT    /api/proxy/:cId/admin/venues/:id           → PUT    [url]/api/admin/venues/:id
 *   DELETE /api/proxy/:cId/admin/venues/:id           → DELETE [url]/api/admin/venues/:id
 */
router.all('/:clientId/admin/*', async (req, res) => {
  try {
    const client = await resolveClient(req.params.clientId, res);
    if (!client) return;

    // Obtain a valid JWT for this client's admin user
    let token;
    try {
      token = await getAdminToken(client);
    } catch (authErr) {
      console.error('[Admin Proxy] Auth error:', authErr.message);
      return res.status(502).json({ message: authErr.message });
    }

    // Preserve the /admin prefix — BenneCafe routes live at /api/admin/* not /api/*
    const endpointPath = '/admin/' + (req.params[0] || '');
    const targetUrl = new URL(`${client.apiUrl}/api${endpointPath}`);

    // First attempt
    const upstream = await fetch(targetUrl.toString(), buildFetchOptions(req, client, token));

    // If the upstream returns 401 (token expired mid-session), re-login once and retry
    if (upstream.status === 401) {
      console.warn(`[Admin Proxy] 401 from upstream for ${client.name} — refreshing token`);
      tokenCache.delete(client.id);
      try {
        token = await getAdminToken(client);
      } catch (authErr) {
        console.error('[Admin Proxy] Re-auth failed:', authErr.message);
        return res.status(502).json({ message: authErr.message });
      }
      const retry = await fetch(targetUrl.toString(), buildFetchOptions(req, client, token));
      return await pipeResponse(retry, res);
    }

    return await pipeResponse(upstream, res);
  } catch (err) {
    console.error('[Admin Proxy]', err.message);
    return res.status(502).json({ message: 'Failed to reach client API', error: err.message });
  }
});

/** Build fetch options for a proxied request, including Bearer auth header. */
function buildFetchOptions(req, client, token) {
  const opts = {
    method: req.method,
    headers: {
      'X-API-KEY': client.apiKey,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };
  // Forward query params
  // (targetUrl already has them set before this is called)
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    opts.body = JSON.stringify(req.body);
  }
  return opts;
}

/** Pipe an upstream fetch Response into the Express res. */
async function pipeResponse(upstream, res) {
  if (upstream.status === 204) return res.status(204).end();
  const text = await upstream.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { message: text }; }
  return res.status(upstream.status).json(data);
}

// ─── READ-ONLY DATA PROXY (GET only) ──────────────────────────────────────────
/**
 * GET /api/proxy/:clientId/*
 * Forwards to: [client.apiUrl]/api/public-data/*
 *
 * Used for read-only dashboard data (summary, bookings, revenue, users, venues)
 */
router.get('/:clientId/*', async (req, res) => {
  try {
    const client = await resolveClient(req.params.clientId, res);
    if (!client) return;

    const endpointPath = '/' + (req.params[0] || '');
    const targetUrl = new URL(`${client.apiUrl}/api/public-data${endpointPath}`);

    return await proxyRequest(req, res, targetUrl, client);
  } catch (err) {
    console.error('[Read Proxy]', err.message);
    return res.status(502).json({ message: 'Failed to reach client API', error: err.message });
  }
});

module.exports = router;
