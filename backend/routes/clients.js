const express = require('express');
const Client = require('../models/Client');
const OperationalManager = require('../models/OperationalManager');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/clients
 * List all clients accessible to the current user.
 * If Super Admin or Manager with allSites = true: returns all clients.
 * If Manager with specific sites: returns only assigned clients.
 */
router.get('/', async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === 'manager') {
      // Re-fetch manager to ensure assignedClients are current
      const manager = await OperationalManager.findById(req.user.id);
      if (!manager || !manager.isActive) {
        return res.status(401).json({ message: 'Manager account not active' });
      }

      if (!manager.allSites) {
        filter = { _id: { $in: manager.assignedClients || [] } };
      }
    }

    const clients = await Client.find(filter).sort({ createdAt: -1 });
    const safeClients = clients.map((c) => {
      const obj = c.toJSON();
      obj.apiKey = obj.apiKey
        ? `${obj.apiKey.slice(0, 8)}...${obj.apiKey.slice(-4)}`
        : '';
      obj.hasApiKey = !!c.apiKey;
      obj.hasAdminCredentials = !!(c.adminPhone && c.adminPassword);
      // Never expose the password
      delete obj.adminPassword;
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
 * Add a new client (Super Admin only)
 * Body: { name, apiUrl, apiKey, logo?, adminPhone?, adminPassword? }
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, apiUrl, apiKey, logo, adminPhone, adminPassword } = req.body;
    if (!name || !apiUrl || !apiKey) {
      return res.status(400).json({ message: 'name, apiUrl, and apiKey are required' });
    }

    const client = await Client.create({ name, apiUrl, apiKey, logo, adminPhone, adminPassword });
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
router.put('/:id', requireAdmin, async (req, res) => {
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

    // Only update adminPassword if explicitly provided (blank = keep existing)
    if (!updates.adminPassword) {
      delete updates.adminPassword;
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
 * Remove a client (Super Admin only)
 */
router.delete('/:id', requireAdmin, async (req, res) => {
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
