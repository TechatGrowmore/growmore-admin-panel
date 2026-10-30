/**
 * HR / Accountant Authentication Routes
 * POST /api/hr/auth/login
 * POST /api/hr/auth/logout
 * GET  /api/hr/auth/me
 * POST /api/hr/auth/seed  (seeds default hr + accountant users if not exist)
 */
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const HRUser = require('../models/HRUser');

const router = express.Router();

const HR_JWT_SECRET = process.env.HR_JWT_SECRET || 'growmore-hr-secret-change-me';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function requireHRAuth(req, res, next) {
  try {
    const token =
      req.cookies?.hr_token ||
      req.headers['authorization']?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const payload = jwt.verify(token, HR_JWT_SECRET);
    req.hrUser = payload;
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized: invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.hrUser || !roles.includes(req.hrUser.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

// Seed default users (call once or on startup)
router.post('/seed', async (req, res) => {
  try {
    const defaults = [
      {
        name: 'HR Manager',
        username: 'hr',
        password: hashPassword('hr@growmore'),
        role: 'hr',
      },
      {
        name: 'Accountant',
        username: 'accountant',
        password: hashPassword('accountant@growmore'),
        role: 'accountant',
      },
    ];

    const results = [];
    for (const u of defaults) {
      const existing = await HRUser.findOne({ username: u.username });
      if (!existing) {
        const created = await HRUser.create(u);
        results.push({ created: true, username: created.username, role: created.role });
      } else {
        results.push({ created: false, username: existing.username, role: existing.role });
      }
    }
    return res.json({ success: true, results });
  } catch (err) {
    console.error('[HR Seed]', err);
    return res.status(500).json({ message: 'Seed failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: 'Username and password required' });

    const user = await HRUser.findOne({ username: username.trim().toLowerCase() });
    if (!user) return res.status(401).json({ message: 'User not found' });
    if (!user.isActive) return res.status(403).json({ message: 'Account deactivated' });

    const inputHash = hashPassword(password);
    const trimHash = hashPassword(password.trim());
    if (inputHash !== user.password && trimHash !== user.password) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    user.lastLogin = new Date();
    await user.save();

    const payload = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
    };

    const token = jwt.sign(payload, HR_JWT_SECRET, { expiresIn: '24h' });

    res.cookie('hr_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });

    return res.json({ success: true, user: payload });
  } catch (err) {
    console.error('[HR Login]', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('hr_token', { path: '/' });
  return res.json({ success: true });
});

// Me
router.get('/me', requireHRAuth, async (req, res) => {
  try {
    const user = await HRUser.findById(req.hrUser.id).select('-password');
    if (!user || !user.isActive) {
      res.clearCookie('hr_token', { path: '/' });
      return res.status(401).json({ message: 'Account inactive' });
    }
    return res.json({ user: { id: user.id, name: user.name, username: user.username, role: user.role } });
  } catch {
    return res.json({ user: req.hrUser });
  }
});

module.exports = { router, requireHRAuth, requireRole, HR_JWT_SECRET };
