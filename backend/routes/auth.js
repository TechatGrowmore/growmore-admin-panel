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
    const inputHash = hashPassword(password);
    const trimmedHash = hashPassword(password.trim());

    const adminUsername = (process.env.ADMIN_USERNAME || 'admin').trim();
    const adminPasswordHash =
      process.env.ADMIN_PASSWORD_HASH || hashPassword('growmore2024');

    const isAdminMatch =
      trimmedUser.toLowerCase() === adminUsername.toLowerCase() &&
      (inputHash === adminPasswordHash || trimmedHash === adminPasswordHash);

    // Helper to log in as Operational Manager
    const loginAsManager = async (manager) => {
      if (manager.isActive === false) {
        return res.status(403).json({
          message: 'Your manager account has been deactivated. Please contact the administrator.',
        });
      }

      const passwordMatches =
        inputHash === manager.password || trimmedHash === manager.password;

      if (!passwordMatches) {
        console.warn(`[Auth] Password mismatch for manager: ${manager.username}`);
        return res.status(401).json({ message: 'Incorrect password' });
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
        assignedClients: (manager.assignedClients || []).map((id) =>
          typeof id === 'object' && id._id ? id._id.toString() : id.toString()
        ),
      };

      const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '24h' });

      res.cookie('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
      });

      console.log(`[Auth] Operational Manager "${manager.username}" logged in successfully`);
      return res.json({
        success: true,
        user: userPayload,
      });
    };

    // Helper to log in as Super Admin
    const loginAsAdmin = () => {
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
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
      });

      console.log(`[Auth] Super Admin logged in successfully`);
      return res.json({
        success: true,
        user: userPayload,
      });
    };

    // ─── If explicitly on Manager tab ───────────────────────────────────────
    if (loginType === 'manager') {
      const manager = await OperationalManager.findOne({
        $or: [
          { username: trimmedUser.toLowerCase() },
          { email: trimmedUser.toLowerCase() },
          { phone: trimmedUser },
        ],
      });

      if (manager) {
        return await loginAsManager(manager);
      }

      // Fallback: in case admin credentials were typed in manager tab
      if (isAdminMatch) {
        return loginAsAdmin();
      }

      console.warn(`[Auth] Manager not found for input: "${trimmedUser}"`);
      return res.status(401).json({ message: 'Operational Manager not found. Check your username.' });
    }

    // ─── If on Super Admin tab ──────────────────────────────────────────────
    if (isAdminMatch) {
      return loginAsAdmin();
    }

    // Fallback: in case manager credentials were typed in admin tab
    const managerFallback = await OperationalManager.findOne({
      $or: [
        { username: trimmedUser.toLowerCase() },
        { email: trimmedUser.toLowerCase() },
        { phone: trimmedUser },
      ],
    });

    if (managerFallback) {
      return await loginAsManager(managerFallback);
    }

    console.warn(`[Auth] Invalid credentials for: "${trimmedUser}"`);
    return res.status(401).json({ message: 'Invalid username or password' });
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
