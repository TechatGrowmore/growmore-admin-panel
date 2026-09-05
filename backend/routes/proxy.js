const express = require('express');
const Client = require('../models/Client');
const OperationalManager = require('../models/OperationalManager');
const ActivityLog = require('../models/ActivityLog');
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
 * Verify whether the current user has access to this client site.
 */
async function checkClientAccess(user, clientId) {
  if (!user || user.role === 'superadmin') return true;
  if (user.role === 'manager') {
    const manager = await OperationalManager.findById(user.id);
    if (!manager || !manager.isActive) return false;
    if (manager.allSites) return true;
    return (manager.assignedClients || []).some(
      (c) => c.toString() === clientId.toString()
    );
  }
  return false;
}

/**
 * Record an activity log entry for a mutating operation.
 */
async function logActivity({ user, client, method, path, body, status }) {
  try {
    const methodUpper = (method || 'GET').toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(methodUpper)) {
      return; // only log mutating actions
    }

    const pathClean = (path || '').replace(/^\/+/, '');
    const segments = pathClean.split('/'); // e.g. ['bookings', '123', 'payment'] or ['drivers']
    const mainResource = segments[0] || '';
    const targetId = segments[1] || '';
    const subAction = segments[2] || '';

    let entity = 'General';
    let action = `${methodUpper}_${mainResource.toUpperCase()}`;
    let description = `${methodUpper} ${pathClean}`;

    if (mainResource === 'bookings') {
      entity = 'Booking';
      if (subAction === 'payment') {
        action = 'UPDATE_PAYMENT';
        const st = body?.paymentStatus || 'paid';
        const m = body?.paymentMethod || 'cash';
        description = `Updated payment to "${st}" (${m}) for booking`;
      } else if (methodUpper === 'DELETE') {
        action = 'DELETE_BOOKING';
        description = `Deleted booking (ID: ${targetId})`;
      } else if (methodUpper === 'POST') {
        action = 'CREATE_BOOKING';
        const cust = body?.customer?.name ? `for ${body.customer.name}` : '';
        const veh = body?.vehicle?.number ? `(${body.vehicle.number})` : '';
        description = `Created new booking ${cust} ${veh}`.trim();
      } else {
        action = 'UPDATE_BOOKING';
        description = `Updated booking (ID: ${targetId})`;
      }
    } else if (mainResource === 'drivers') {
      entity = 'Driver';
      if (methodUpper === 'POST') {
        action = 'ADD_DRIVER';
        description = `Added driver "${body?.name || ''}" (${body?.phone || ''})`.trim();
      } else if (methodUpper === 'PUT' || methodUpper === 'PATCH') {
        action = 'UPDATE_DRIVER';
        description = `Updated driver "${body?.name || targetId}"`.trim();
      } else if (methodUpper === 'DELETE') {
        action = 'DELETE_DRIVER';
        description = `Deleted driver (ID: ${targetId})`;
      }
    } else if (mainResource === 'supervisors') {
      entity = 'Supervisor';
      if (methodUpper === 'POST') {
        action = 'ADD_SUPERVISOR';
        description = `Added supervisor "${body?.name || ''}" (${body?.phone || ''})`.trim();
      } else if (methodUpper === 'PUT' || methodUpper === 'PATCH') {
        action = 'UPDATE_SUPERVISOR';
        description = `Updated supervisor "${body?.name || targetId}"`.trim();
      } else if (methodUpper === 'DELETE') {
        action = 'DELETE_SUPERVISOR';
        description = `Deleted supervisor (ID: ${targetId})`;
      }
    } else if (mainResource === 'venues') {
      entity = 'Venue';
      if (methodUpper === 'POST') {
        action = 'ADD_VENUE';
        description = `Added venue "${body?.name || ''}"`.trim();
      } else if (methodUpper === 'PUT' || methodUpper === 'PATCH') {
        action = 'UPDATE_VENUE';
        description = `Updated venue "${body?.name || targetId}"`.trim();
      } else if (methodUpper === 'DELETE') {
        action = 'DELETE_VENUE';
        description = `Deleted venue (ID: ${targetId})`;
      }
    }

    await ActivityLog.create({
      user: {
        id: user.id || null,
        name: user.name || user.username || 'User',
        username: user.username || 'unknown',
        role: user.role || 'manager',
      },
      action,
      entity,
      clientId: client._id,
      clientName: client.name,
      description,
      details: {
        method: methodUpper,
        path: pathClean,
        body: body || null,
      },
      status: status >= 200 && status < 300 ? 'success' : 'failed',
    });
  } catch (logErr) {
    console.error('[ActivityLog] Failed to record activity:', logErr.message);
  }
}

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
 */
router.all('/:clientId/admin/*', async (req, res) => {
  try {
    const hasAccess = await checkClientAccess(req.user, req.params.clientId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Forbidden: You do not have access to this client site' });
    }

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

    const rawSubpath = req.params[0] || '';
    const endpointPath = '/admin/' + rawSubpath;
    let targetUrl = new URL(`${client.apiUrl}/api${endpointPath}`);

    // First attempt
    let upstream = await fetch(targetUrl.toString(), buildFetchOptions(req, client, token));

    // If 404 on POST /admin/bookings, also check if client API uses POST /api/bookings directly
    if (upstream.status === 404 && req.method === 'POST' && rawSubpath === 'bookings') {
      const fallbackUrl = new URL(`${client.apiUrl}/api/bookings`);
      const fallbackAttempt = await fetch(fallbackUrl.toString(), buildFetchOptions(req, client, token));
      if (fallbackAttempt.status !== 404) {
        upstream = fallbackAttempt;
      }
    }

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
      upstream = await fetch(targetUrl.toString(), buildFetchOptions(req, client, token));
    }

    // Log the activity if this is a mutating request and was successful
    if (upstream.status >= 200 && upstream.status < 300) {
      logActivity({
        user: req.user,
        client,
        method: req.method,
        path: rawSubpath,
        body: req.body,
        status: upstream.status,
      });
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
 */
router.get('/:clientId/*', async (req, res) => {
  try {
    const hasAccess = await checkClientAccess(req.user, req.params.clientId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Forbidden: You do not have access to this client site' });
    }

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
