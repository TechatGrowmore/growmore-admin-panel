const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * POST /api/auth/login
 * Body: { username, password }
 * Returns: { success, user } and sets httpOnly cookie
 */
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPasswordHash =
      process.env.ADMIN_PASSWORD_HASH || hashPassword('growmore2024');

    const inputHash = hashPassword(password);

    if (username !== adminUsername || inputHash !== adminPasswordHash) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { username, role: 'superadmin' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1 day in ms
      path: '/',
    });

    return res.json({
      success: true,
      user: { username, role: 'superadmin' },
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
 * Returns current authenticated user info
 */
router.get('/me', require('../middleware/auth').requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

module.exports = router;
