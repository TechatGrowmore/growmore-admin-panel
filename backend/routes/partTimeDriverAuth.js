/**
 * Part-Time Driver Authentication Routes
 * POST /api/ptdriver/auth/login   — Login with phone + firstName (lowercase)
 * POST /api/ptdriver/auth/logout
 * GET  /api/ptdriver/auth/me
 */
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const PartTimeDriver = require('../models/PartTimeDriver');

const router = express.Router();
const PT_DRIVER_JWT_SECRET = process.env.PT_DRIVER_JWT_SECRET || process.env.DRIVER_JWT_SECRET || 'growmore-pt-driver-secret-change-me';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function requirePartTimeDriverAuth(req, res, next) {
  try {
    const token =
      req.cookies?.pt_driver_token ||
      req.headers['authorization']?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const payload = jwt.verify(token, PT_DRIVER_JWT_SECRET);
    req.ptDriver = payload;
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

// Login: phone as username, firstName.toLowerCase() as password
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password)
      return res.status(400).json({ message: 'Phone number and password are required' });

    const driver = await PartTimeDriver.findOne({ phone: phone.trim() });
    if (!driver) return res.status(401).json({ message: 'Part-time driver not found. Please check your phone number.' });

    if (driver.status !== 'approved')
      return res.status(403).json({ message: 'Your account has not been approved yet. Please wait for HR approval.' });

    if (!driver.isLoginEnabled)
      return res.status(403).json({ message: 'Login is not enabled for your account. Please contact HR.' });

    const inputHash = hashPassword(password.trim());
    if (inputHash !== driver.password) {
      return res.status(401).json({ message: 'Incorrect password. Your password is your first name in lowercase letters.' });
    }

    const payload = {
      id: driver.id,
      name: `${driver.firstName} ${driver.lastName}`,
      firstName: driver.firstName,
      phone: driver.phone,
      role: 'pt_driver',
    };

    const token = jwt.sign(payload, PT_DRIVER_JWT_SECRET, { expiresIn: '24h' });

    res.cookie('pt_driver_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });

    return res.json({ success: true, user: payload });
  } catch (err) {
    console.error('[PT Driver Login]', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('pt_driver_token', { path: '/' });
  return res.json({ success: true });
});

router.get('/me', requirePartTimeDriverAuth, async (req, res) => {
  try {
    const driver = await PartTimeDriver.findById(req.ptDriver.id).select('-password');
    if (!driver) {
      res.clearCookie('pt_driver_token', { path: '/' });
      return res.status(401).json({ message: 'Driver not found' });
    }
    return res.json({ user: driver });
  } catch {
    return res.json({ user: req.ptDriver });
  }
});

module.exports = { router, requirePartTimeDriverAuth, PT_DRIVER_JWT_SECRET };

