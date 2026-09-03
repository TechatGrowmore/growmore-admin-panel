const express = require('express');
const Client = require('../models/Client');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// All proxy routes require authentication
router.use(requireAuth);

/**
 * GET /api/proxy/:clientId/*
 * Forwards to: [client.apiUrl]/api/public-data/*
 *
 * Example:
 *   GET /api/proxy/6634abc.../summary
 *   → https://bennecafe.onrender.com/api/public-data/summary
 */
router.get('/:clientId/*', async (req, res) => {
  try {
    const { clientId } = req.params;

    // Extract the path after /:clientId/
    const endpointPath = '/' + (req.params[0] || '');

    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Build target URL, forward query params
    const targetUrl = new URL(`${client.apiUrl}/api/public-data${endpointPath}`);
    Object.entries(req.query).forEach(([key, val]) => {
      targetUrl.searchParams.set(key, val);
    });

    const upstream = await fetch(targetUrl.toString(), {
      headers: {
        'X-API-KEY': client.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return res.status(upstream.status).json({
        message: `Client API error: ${upstream.status}`,
        details: errText,
      });
    }

    const data = await upstream.json();
    return res.json(data);
  } catch (err) {
    console.error('[Proxy] Error:', err.message);
    return res.status(502).json({
      message: 'Failed to reach client API',
      error: err.message,
    });
  }
});

module.exports = router;
