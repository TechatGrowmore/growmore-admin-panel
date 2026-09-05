const express = require('express');
const Client = require('../models/Client');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// All proxy routes require authentication
router.use(requireAuth);

/**
 * Helper: look up a client by MongoDB ID, with a 404 if not found.
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
 * Helper: forward a request to the client's backend and pipe the response.
 */
async function proxyRequest(req, res, targetUrl, client) {
  // Forward query params
  Object.entries(req.query).forEach(([k, v]) => targetUrl.searchParams.set(k, v));

  const fetchOptions = {
    method: req.method,
    headers: {
      'X-API-KEY': client.apiKey,
      'Content-Type': 'application/json',
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

    // Preserve the /admin prefix — BenneCafe routes live at /api/admin/* not /api/*
    const endpointPath = '/admin/' + (req.params[0] || '');
    const targetUrl = new URL(`${client.apiUrl}/api${endpointPath}`);

    return await proxyRequest(req, res, targetUrl, client);
  } catch (err) {
    console.error('[Admin Proxy]', err.message);
    return res.status(502).json({ message: 'Failed to reach client API', error: err.message });
  }
});

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
