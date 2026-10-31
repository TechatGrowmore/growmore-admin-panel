/**
 * Private file access for R2-stored uploads.
 *   GET /api/files/<key>  — HR / accountant: any file. Drivers: only files on their own record.
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');
const PartTimeDriver = require('../models/PartTimeDriver');
const PunchIn = require('../models/PunchIn');
const PartTimePunch = require('../models/PartTimePunch');
const { getFile, TYPES } = require('../utils/r2');

const router = express.Router();

const HR_SECRET = process.env.HR_JWT_SECRET || 'growmore-hr-secret-change-me';
const DRIVER_SECRET = process.env.DRIVER_JWT_SECRET || 'growmore-driver-secret-change-me';
const PT_SECRET = process.env.PT_DRIVER_JWT_SECRET || process.env.DRIVER_JWT_SECRET || 'growmore-pt-driver-secret-change-me';

function verify(token, secret) {
  if (!token) return null;
  try { return jwt.verify(token, secret); } catch { return null; }
}

const hasUrl = (doc, url) => !!doc && Object.values(doc.toObject()).some(v => v === url);

router.get('/*', async (req, res) => {
  try {
    const key = req.params[0];
    if (!key || key.includes('..') || key.startsWith('/')) return res.status(400).json({ message: 'Invalid file' });
    const url = `/api/files/${key}`;

    const hr = verify(req.cookies?.hr_token, HR_SECRET);
    let allowed = !!hr;

    if (!allowed) {
      const ft = verify(req.cookies?.driver_token, DRIVER_SECRET);
      if (ft) {
        const emp = await Employee.findById(ft.id);
        allowed = hasUrl(emp, url) || !!(await PunchIn.exists({ employee: ft.id, photoUrl: url }));
      }
    }
    if (!allowed) {
      const pt = verify(req.cookies?.pt_driver_token, PT_SECRET);
      if (pt) {
        const drv = await PartTimeDriver.findById(pt.id);
        allowed = hasUrl(drv, url) || !!(await PartTimePunch.exists({
          driver: pt.id, $or: [{ punchInPhotoUrl: url }, { punchOutPhotoUrl: url }],
        }));
      }
    }
    if (!allowed) return res.status(403).json({ message: 'Forbidden' });

    const obj = await getFile(key);
    const ext = key.split('.').pop().toLowerCase();
    res.setHeader('Content-Type', TYPES[ext] || obj.ContentType || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    if (obj.ContentLength) res.setHeader('Content-Length', obj.ContentLength);
    obj.Body.pipe(res);
  } catch (err) {
    if (err.name === 'NoSuchKey') return res.status(404).json({ message: 'File not found' });
    console.error('[Files]', err.message);
    return res.status(500).json({ message: 'Could not load file' });
  }
});

module.exports = router;
