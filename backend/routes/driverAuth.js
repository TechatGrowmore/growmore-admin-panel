/**
 * Driver Authentication Routes
 * POST /api/driver/auth/login   — Login with phone + firstName (lowercase)
 * POST /api/driver/auth/logout
 * GET  /api/driver/auth/me
 */
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');

const router = express.Router();
const DRIVER_JWT_SECRET = process.env.DRIVER_JWT_SECRET || 'growmore-driver-secret-change-me';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function requireDriverAuth(req, res, next) {
  try {
    const token =
      req.cookies?.driver_token ||
      req.headers['authorization']?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const payload = jwt.verify(token, DRIVER_JWT_SECRET);
    req.driver = payload;
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
      return res.status(400).json({ message: 'Phone and password required' });

    const employee = await Employee.findOne({ phone: phone.trim() });
    if (!employee) return res.status(401).json({ message: 'Driver not found' });
    if (employee.status !== 'verified')
      return res.status(403).json({ message: 'Account not yet verified. Please wait for accountant approval.' });
    if (!employee.isLoginEnabled)
      return res.status(403).json({ message: 'Login not enabled. Contact HR.' });

    const inputHash = hashPassword(password);
    const trimHash = hashPassword(password.trim());
    if (inputHash !== employee.password && trimHash !== employee.password) {
      return res.status(401).json({ message: 'Incorrect password. Use your first name in lowercase.' });
    }

    const payload = {
      id: employee.id,
      name: employee.fullName,
      firstName: employee.firstName,
      phone: employee.phone,
      role: 'driver',
    };

    const token = jwt.sign(payload, DRIVER_JWT_SECRET, { expiresIn: '24h' });

    res.cookie('driver_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });

    return res.json({ success: true, user: payload });
  } catch (err) {
    console.error('[Driver Login]', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('driver_token', { path: '/' });
  return res.json({ success: true });
});

router.get('/me', requireDriverAuth, async (req, res) => {
  try {
    const employee = await Employee.findById(req.driver.id).select('-password');
    if (!employee) {
      res.clearCookie('driver_token', { path: '/' });
      return res.status(401).json({ message: 'Driver not found' });
    }
    return res.json({ user: employee });
  } catch {
    return res.json({ user: req.driver });
  }
});

module.exports = { router, requireDriverAuth, DRIVER_JWT_SECRET };
