const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const OperationalManager = require('../models/OperationalManager');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All manager management routes require Super Admin authentication
router.use(requireAuth);
router.use(requireAdmin);

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password).trim()).digest('hex');
}

/**
 * Safely converts an array of client IDs, strings, or objects into valid Mongoose ObjectIds.
 */
function cleanAssignedClients(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      if (!item) return null;
      if (typeof item === 'string') {
        const trimmed = item.trim();
        return mongoose.Types.ObjectId.isValid(trimmed) ? new mongoose.Types.ObjectId(trimmed) : null;
      }
      if (typeof item === 'object') {
        const id = item.id || item._id;
        if (id && mongoose.Types.ObjectId.isValid(String(id))) {
          return new mongoose.Types.ObjectId(String(id));
        }
      }
      return null;
    })
    .filter(Boolean);
}

/**
 * GET /api/managers
 * List all operational managers
 */
router.get('/', async (req, res) => {
  try {
    const managers = await OperationalManager.find()
      .populate('assignedClients', 'name apiUrl')
      .sort({ createdAt: -1 });

    return res.json({ managers: managers.map((m) => m.toJSON()) });
  } catch (err) {
    console.error('[Managers] GET error:', err);
    return res.status(500).json({ message: 'Failed to fetch operational managers' });
  }
});

/**
 * POST /api/managers
 * Add a new operational manager
 * Body: { name, username, password, phone, email, allSites, assignedClients }
 */
router.post('/', async (req, res) => {
  try {
    const { name, username, password, phone, email, allSites, assignedClients } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({ message: 'Name, username, and password are required' });
    }

    const cleanUsername = username.trim().toLowerCase();

    // Check uniqueness
    const existing = await OperationalManager.findOne({ username: cleanUsername });
    if (existing) {
      return res.status(409).json({ message: `Username "${cleanUsername}" is already taken` });
    }

    const newManager = await OperationalManager.create({
      name: name.trim(),
      username: cleanUsername,
      password: hashPassword(password),
      phone: phone ? phone.trim() : '',
      email: email ? email.trim() : '',
      allSites: Boolean(allSites),
      assignedClients: cleanAssignedClients(assignedClients),
      isActive: true,
    });

    const populated = await OperationalManager.findById(newManager._id).populate(
      'assignedClients',
      'name apiUrl'
    );

    return res.status(201).json({ manager: populated.toJSON() });
  } catch (err) {
    console.error('[Managers] POST error:', err);
    return res.status(500).json({ message: err.message || 'Failed to create manager' });
  }
});

/**
 * PUT /api/managers/:id
 * Update an operational manager
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, username, password, phone, email, allSites, assignedClients, isActive } = req.body;

    const manager = await OperationalManager.findById(id);
    if (!manager) {
      return res.status(404).json({ message: 'Operational manager not found' });
    }

    if (name !== undefined) manager.name = name.trim();
    if (phone !== undefined) manager.phone = phone.trim();
    if (email !== undefined) manager.email = email.trim();
    if (allSites !== undefined) manager.allSites = Boolean(allSites);
    if (assignedClients !== undefined) {
      manager.assignedClients = cleanAssignedClients(assignedClients);
    }
    if (isActive !== undefined) manager.isActive = Boolean(isActive);

    if (username) {
      const cleanUsername = username.trim().toLowerCase();
      if (cleanUsername !== manager.username) {
        const existing = await OperationalManager.findOne({ username: cleanUsername });
        if (existing && existing.id !== id) {
          return res.status(409).json({ message: `Username "${cleanUsername}" is already taken` });
        }
        manager.username = cleanUsername;
      }
    }

    if (password && password.trim()) {
      manager.password = hashPassword(password);
    }

    await manager.save();

    const populated = await OperationalManager.findById(id).populate(
      'assignedClients',
      'name apiUrl'
    );

    return res.json({ manager: populated.toJSON() });
  } catch (err) {
    console.error('[Managers] PUT error:', err);
    return res.status(500).json({ message: err.message || 'Failed to update manager' });
  }
});

/**
 * PATCH /api/managers/:id/toggle-status
 * Toggle manager active/inactive status
 */
router.patch('/:id/toggle-status', async (req, res) => {
  try {
    const { id } = req.params;
    const manager = await OperationalManager.findById(id);
    if (!manager) {
      return res.status(404).json({ message: 'Operational manager not found' });
    }

    manager.isActive = !manager.isActive;
    await manager.save();

    return res.json({ success: true, isActive: manager.isActive });
  } catch (err) {
    console.error('[Managers] Toggle status error:', err);
    return res.status(500).json({ message: err.message });
  }
});

/**
 * DELETE /api/managers/:id
 * Delete an operational manager
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const manager = await OperationalManager.findByIdAndDelete(id);
    if (!manager) {
      return res.status(404).json({ message: 'Operational manager not found' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[Managers] DELETE error:', err);
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
