const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const OperationalManager = require('../models/OperationalManager');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * POST /api/auth/login
 * Body: { username, password, loginType: 'admin' | 'manager' }
 * Returns: { success, user } and sets httpOnly cookie
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password, loginType = 'admin' } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    const trimmedUser = username.trim();

    // ─── Operational Manager Login ──────────────────────────────────────────
    if (loginType === 'manager') {
      const manager = await OperationalManager.findOne({
        username: trimmedUser.toLowerCase(),
      });

      if (!manager) {
        return res.status(401).json({ message: 'Operational Manager not found' });
      }

      if (manager.isActive === false) {
        return res.status(403).json({ message: 'Your manager account has been deactivated. Please contact the administrator.' });
      }

      const inputHash = hashPassword(password);
      if (inputHash !== manager.password) {
        return res.status(401).json({ message: 'Invalid password' });
      }

      // Update last login
      manager.lastLogin = new Date();
      await manager.save();

      const userPayload = {
        id: manager.id,
        name: manager.name,
        username: manager.username,
        role: 'manager',
        allSites: !!manager.allSites,
        assignedClients: (manager.assignedClients || []).map((id) => id.toString()),
      };

      const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '24h' });

      res.cookie('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
      });

      return res.json({
        success: true,
        user: userPayload,
      });
    }

    // ─── Super Admin Login ──────────────────────────────────────────────────
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPasswordHash =
      process.env.ADMIN_PASSWORD_HASH || hashPassword('growmore2024');

    const inputHash = hashPassword(password);

    if (trimmedUser !== adminUsername || inputHash !== adminPasswordHash) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    const userPayload = {
      name: 'Super Admin',
      username: adminUsername,
      role: 'superadmin',
      allSites: true,
    };

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '24h' });

    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1 day in ms
      path: '/',
    });

    return res.json({
      success: true,
      user: userPayload,
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /api/auth/logout
 * Clears the admin_token cookie
 */
router.post('/logout', (req, res) => {
  res.clearCookie('admin_token', { path: '/' });
  return res.json({ success: true });
});

/**
 * GET /api/auth/me
 * Returns current authenticated user info with fresh data from database
 */
router.get('/me', require('../middleware/auth').requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'manager' && req.user.id) {
      const manager = await OperationalManager.findById(req.user.id).select('-password');
      if (!manager || !manager.isActive) {
        res.clearCookie('admin_token', { path: '/' });
        return res.status(401).json({ message: 'Manager account is inactive or removed' });
      }

      const freshUser = {
        id: manager.id,
        name: manager.name,
        username: manager.username,
        role: 'manager',
        allSites: !!manager.allSites,
        assignedClients: (manager.assignedClients || []).map((id) => id.toString()),
        phone: manager.phone,
        email: manager.email,
      };
      return res.json({ user: freshUser });
    }

    return res.json({ user: req.user });
  } catch (err) {
    console.error('[Auth] me error:', err);
    return res.json({ user: req.user });
  }
});

module.exports = router;
