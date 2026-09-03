const express = require('express');
const Client = require('../models/Client');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/clients
 * List all clients (API keys masked for security)
 */
router.get('/', async (req, res) => {
  try {
    const clients = await Client.find().sort({ createdAt: -1 });
    const safeClients = clients.map((c) => {
      const obj = c.toJSON();
      obj.apiKey = obj.apiKey
        ? `${obj.apiKey.slice(0, 8)}...${obj.apiKey.slice(-4)}`
        : '';
      obj.hasApiKey = !!c.apiKey;
      return obj;
    });
    return res.json({ clients: safeClients });
  } catch (err) {
    console.error('[Clients] GET error:', err);
    return res.status(500).json({ message: 'Failed to fetch clients' });
  }
});

/**
 * POST /api/clients
 * Add a new client
 * Body: { name, apiUrl, apiKey, logo? }
 */
router.post('/', async (req, res) => {
  try {
    const { name, apiUrl, apiKey, logo } = req.body;
    if (!name || !apiUrl || !apiKey) {
      return res.status(400).json({ message: 'name, apiUrl, and apiKey are required' });
    }

    const client = await Client.create({ name, apiUrl, apiKey, logo });
    return res.status(201).json({ client: client.toJSON() });
  } catch (err) {
    console.error('[Clients] POST error:', err);
    return res.status(500).json({ message: err.message });
  }
});

/**
 * PUT /api/clients/:id
 * Update a client (apiKey optional — only updated if provided)
 * Body: { name?, apiUrl?, apiKey?, logo?, isActive? }
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    // Don't allow id to be changed
    delete updates._id;
    delete updates.id;

    // Only update apiKey if explicitly provided
    if (!updates.apiKey) {
      delete updates.apiKey;
    }

    const client = await Client.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    return res.json({ client: client.toJSON() });
  } catch (err) {
    console.error('[Clients] PUT error:', err);
    return res.status(500).json({ message: err.message });
  }
});

/**
 * DELETE /api/clients/:id
 * Remove a client
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = await Client.findByIdAndDelete(id);

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[Clients] DELETE error:', err);
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
