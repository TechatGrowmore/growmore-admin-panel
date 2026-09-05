const express = require('express');
const ActivityLog = require('../models/ActivityLog');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Activity logs are exclusively accessible by Super Admin
router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /api/logs
 * Query params: page, limit, managerId, clientId, entity, action, search, from, to
 */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const skip = (page - 1) * limit;

    const query = {};

    // Filter by specific manager
    if (req.query.managerId) {
      query['user.id'] = req.query.managerId;
    }

    // Filter by client site
    if (req.query.clientId) {
      query.clientId = req.query.clientId;
    }

    // Filter by entity (e.g. Booking, Driver, Supervisor, Venue)
    if (req.query.entity) {
      query.entity = req.query.entity;
    }

    // Filter by action code
    if (req.query.action) {
      query.action = req.query.action;
    }

    // Date range
    if (req.query.from || req.query.to) {
      query.createdAt = {};
      if (req.query.from) query.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) query.createdAt.$lte = new Date(req.query.to);
    }

    // Free text search
    if (req.query.search && req.query.search.trim()) {
      const regex = new RegExp(req.query.search.trim(), 'i');
      query.$or = [
        { description: regex },
        { 'user.name': regex },
        { 'user.username': regex },
        { clientName: regex },
        { action: regex },
      ];
    }

    const [logs, total] = await Promise.all([
      ActivityLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments(query),
    ]);

    // Gather distinct filter values for the UI filters
    const [distinctManagers, distinctEntities] = await Promise.all([
      ActivityLog.distinct('user.name'),
      ActivityLog.distinct('entity'),
    ]);

    return res.json({
      logs: logs.map((log) => ({
        id: log._id.toString(),
        user: log.user,
        action: log.action,
        entity: log.entity,
        clientId: log.clientId?.toString() || null,
        clientName: log.clientName,
        description: log.description,
        details: log.details,
        status: log.status,
        createdAt: log.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      meta: {
        managers: distinctManagers.filter(Boolean),
        entities: distinctEntities.filter(Boolean),
      },
    });
  } catch (err) {
    console.error('[Activity Logs] GET error:', err);
    return res.status(500).json({ message: 'Failed to fetch activity logs' });
  }
});

/**
 * DELETE /api/logs/clear
 * Clear all activity logs (Super Admin only)
 */
router.delete('/clear', async (req, res) => {
  try {
    await ActivityLog.deleteMany({});
    return res.json({ success: true, message: 'Activity logs cleared' });
  } catch (err) {
    console.error('[Activity Logs] Clear error:', err);
    return res.status(500).json({ message: 'Failed to clear activity logs' });
  }
});

module.exports = router;
