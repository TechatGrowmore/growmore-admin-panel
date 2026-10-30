/**
 * Employee Management Routes (Full-Time Drivers)
 *
 * Public:
 *   POST /api/employees/public/fulltime   — Submit full-time registration form (public)
 *   POST /api/employees/public/parttime   — Submit part-time registration form (public)
 *   GET  /api/employees/public/fulltime/:token  — Get pending form data by token
 *   GET  /api/employees/public/parttime/:token  — Get pending form data by token
 *
 * HR:
 *   GET  /api/employees/fulltime          — List all full-time employees
 *   GET  /api/employees/parttime          — List all part-time drivers
 *   POST /api/employees/fulltime          — Create/update full-time employee
 *   PUT  /api/employees/fulltime/:id      — HR edit + submit for accountant
 *   PUT  /api/employees/parttime/:id      — HR edit + approve part-time
 *   DELETE /api/employees/fulltime/:id    — Delete
 *   DELETE /api/employees/parttime/:id    — Delete
 *   POST /api/employees/parttime/:id/approve — HR approve part-time
 *   POST /api/employees/parttime/:id/reject  — HR reject part-time
 *
 * Accountant:
 *   POST /api/employees/fulltime/:id/verify  — Verify full-time employee
 *   POST /api/employees/fulltime/:id/reject  — Reject with remarks
 *
 * Schedule/Calendar:
 *   GET  /api/employees/schedule/:date    — Get day schedule
 *   PUT  /api/employees/schedule/:date    — Update day schedule
 *
 * Part-time punch token:
 *   GET  /api/employees/parttime/punch/:token  — Get driver info by punch token (public)
 *   POST /api/employees/parttime/punch/:token  — Submit punch in/out (public)
 */
const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const Employee = require('../models/Employee');
const PartTimeDriver = require('../models/PartTimeDriver');
const PunchIn = require('../models/PunchIn');
const PartTimePunch = require('../models/PartTimePunch');
const Leave = require('../models/Leave');
const DaySchedule = require('../models/DaySchedule');
const OperationalManager = require('../models/OperationalManager');
const { requireHRAuth, requireRole } = require('./hrAuth');
const { requireDriverAuth } = require('./driverAuth');

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
});

// Multer: store in memory for Cloudinary upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDFs are allowed'));
    }
  },
});

// Helper: upload buffer to cloudinary
async function uploadToCloudinary(buffer, folder, publicId, resourceType = 'image') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: publicId, resource_type: resourceType, overwrite: true },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
}

function hashPassword(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────────────

// Public: submit full-time registration form
router.post(
  '/public/fulltime',
  upload.fields([
    { name: 'aadharDoc', maxCount: 1 },
    { name: 'panDoc', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const data = req.body;
      const token = uuidv4();

      let aadharDocUrl = '';
      let panDocUrl = '';
      let photoUrl = '';

      // Temp upload with token as folder
      if (req.files?.aadharDoc?.[0]) {
        const r = await uploadToCloudinary(
          req.files.aadharDoc[0].buffer,
          `growmore/pending/${token}`,
          'aadhar',
          'auto'
        );
        aadharDocUrl = r.secure_url;
      }
      if (req.files?.panDoc?.[0]) {
        const r = await uploadToCloudinary(
          req.files.panDoc[0].buffer,
          `growmore/pending/${token}`,
          'pan',
          'auto'
        );
        panDocUrl = r.secure_url;
      }
      if (req.files?.photo?.[0]) {
        const r = await uploadToCloudinary(
          req.files.photo[0].buffer,
          `growmore/pending/${token}`,
          'photo'
        );
        photoUrl = r.secure_url;
      }

      const employee = await Employee.create({
        ...data,
        aadharDocUrl,
        panDocUrl,
        photoUrl,
        status: 'pending',
        submittedViaPublicForm: true,
        publicFormToken: token,
        declarationAccepted: data.declarationAccepted === 'true' || data.declarationAccepted === true,
        declarationDate: data.declarationAccepted ? new Date() : null,
      });

      return res.json({ success: true, token, id: employee.id });
    } catch (err) {
      console.error('[Public FT Register]', err);
      return res.status(500).json({ message: err.message || 'Registration failed' });
    }
  }
);

// Public: submit part-time registration form
router.post(
  '/public/parttime',
  upload.fields([{ name: 'aadharDoc', maxCount: 1 }]),
  async (req, res) => {
    try {
      const data = req.body;
      const token = uuidv4();
      let aadharDocUrl = '';

      if (req.files?.aadharDoc?.[0]) {
        const r = await uploadToCloudinary(
          req.files.aadharDoc[0].buffer,
          `growmore/parttime/pending/${token}`,
          'aadhar',
          'auto'
        );
        aadharDocUrl = r.secure_url;
      }

      const driver = await PartTimeDriver.create({
        ...data,
        aadharDocUrl,
        status: 'pending',
        submittedViaPublicForm: true,
        publicFormToken: token,
      });

      return res.json({ success: true, token, id: driver.id });
    } catch (err) {
      console.error('[Public PT Register]', err);
      return res.status(500).json({ message: err.message || 'Registration failed' });
    }
  }
);

// Public: get full-time form data by token
router.get('/public/fulltime/:token', async (req, res) => {
  try {
    const emp = await Employee.findOne({ publicFormToken: req.params.token });
    if (!emp) return res.status(404).json({ message: 'Application not found' });
    return res.json({ employee: emp });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Public: get part-time form data by token
router.get('/public/parttime/:token', async (req, res) => {
  try {
    const driver = await PartTimeDriver.findOne({ publicFormToken: req.params.token });
    if (!driver) return res.status(404).json({ message: 'Application not found' });
    return res.json({ driver });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ─── PART-TIME PUNCH TOKEN ROUTES (Public) ────────────────────────────────────

// Get driver info by punchToken
router.get('/parttime/punch/:token', async (req, res) => {
  try {
    const driver = await PartTimeDriver.findOne({ punchToken: req.params.token, status: 'approved' });
    if (!driver) return res.status(404).json({ message: 'Invalid or inactive punch link' });
    const today = new Date().toISOString().split('T')[0];
    const existingPunch = await PartTimePunch.findOne({ driver: driver._id, date: today });
    return res.json({ driver, punch: existingPunch || null, today });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Submit punch in/out for part-time driver
router.post('/parttime/punch/:token', async (req, res) => {
  try {
    const driver = await PartTimeDriver.findOne({ punchToken: req.params.token, status: 'approved' });
    if (!driver) return res.status(404).json({ message: 'Invalid punch link' });

    const today = new Date().toISOString().split('T')[0];
    const { action, lat, lng, address } = req.body; // action: 'punchin' | 'punchout'
    const location = { lat: lat ? Number(lat) : null, lng: lng ? Number(lng) : null, address: address || '' };

    let punch = await PartTimePunch.findOne({ driver: driver._id, date: today });
    if (!punch) {
      if (action !== 'punchin') return res.status(400).json({ message: 'Punch in first' });
      punch = await PartTimePunch.create({
        driver: driver._id,
        date: today,
        punchInTime: new Date(),
        location,
        token: req.params.token,
      });
    } else {
      if (action === 'punchout') {
        if (punch.punchOutTime) return res.status(400).json({ message: 'Already punched out' });
        punch.punchOutTime = new Date();
        punch.location = location;
        await punch.save();
      } else {
        return res.status(400).json({ message: 'Already punched in today' });
      }
    }
    return res.json({ success: true, punch });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ─── HR ROUTES ────────────────────────────────────────────────────────────────

// List all full-time employees
router.get('/fulltime', requireHRAuth, async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { aadharNumber: { $regex: search, $options: 'i' } },
      ];
    }
    const employees = await Employee.find(filter).select('-password').sort({ createdAt: -1 });
    return res.json({ employees });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Get single full-time employee
router.get('/fulltime/:id', requireHRAuth, async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id).select('-password');
    if (!emp) return res.status(404).json({ message: 'Employee not found' });
    return res.json({ employee: emp });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// HR: Create full-time employee directly
router.post(
  '/fulltime',
  requireHRAuth,
  upload.fields([
    { name: 'aadharDoc', maxCount: 1 },
    { name: 'panDoc', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const data = req.body;
      let aadharDocUrl = '';
      let panDocUrl = '';
      let photoUrl = '';

      const tempId = uuidv4();
      if (req.files?.aadharDoc?.[0]) {
        const r = await uploadToCloudinary(req.files.aadharDoc[0].buffer, `growmore/fulltime/${tempId}`, 'aadhar', 'auto');
        aadharDocUrl = r.secure_url;
      }
      if (req.files?.panDoc?.[0]) {
        const r = await uploadToCloudinary(req.files.panDoc[0].buffer, `growmore/fulltime/${tempId}`, 'pan', 'auto');
        panDocUrl = r.secure_url;
      }
      if (req.files?.photo?.[0]) {
        const r = await uploadToCloudinary(req.files.photo[0].buffer, `growmore/fulltime/${tempId}`, 'photo');
        photoUrl = r.secure_url;
      }

      const employee = await Employee.create({
        ...data,
        aadharDocUrl: aadharDocUrl || data.aadharDocUrl || '',
        panDocUrl: panDocUrl || data.panDocUrl || '',
        photoUrl: photoUrl || data.photoUrl || '',
        status: 'hr_approved',
        declarationAccepted: data.declarationAccepted === 'true' || data.declarationAccepted === true,
        declarationDate: new Date(),
      });

      return res.json({ success: true, employee });
    } catch (err) {
      console.error('[HR Create FT]', err);
      return res.status(500).json({ message: err.message || 'Failed to create employee' });
    }
  }
);

// HR: Update / submit for accountant approval
router.put(
  '/fulltime/:id',
  requireHRAuth,
  upload.fields([
    { name: 'aadharDoc', maxCount: 1 },
    { name: 'panDoc', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const emp = await Employee.findById(req.params.id);
      if (!emp) return res.status(404).json({ message: 'Employee not found' });

      const data = req.body;

      if (req.files?.aadharDoc?.[0]) {
        const r = await uploadToCloudinary(req.files.aadharDoc[0].buffer, `growmore/fulltime/${emp.id}`, 'aadhar', 'auto');
        emp.aadharDocUrl = r.secure_url;
      }
      if (req.files?.panDoc?.[0]) {
        const r = await uploadToCloudinary(req.files.panDoc[0].buffer, `growmore/fulltime/${emp.id}`, 'pan', 'auto');
        emp.panDocUrl = r.secure_url;
      }
      if (req.files?.photo?.[0]) {
        const r = await uploadToCloudinary(req.files.photo[0].buffer, `growmore/fulltime/${emp.id}`, 'photo');
        emp.photoUrl = r.secure_url;
      }

      // Update fields
      const fields = ['firstName', 'lastName', 'phone', 'email', 'dob', 'gender', 'bloodGroup',
        'addressLine1', 'addressLine2', 'city', 'state', 'pincode',
        'aadharNumber', 'panNumber', 'designation', 'department', 'joiningDate', 'salary'];
      fields.forEach(f => { if (data[f] !== undefined) emp[f] = data[f]; });

      if (data.declarationAccepted === 'true' || data.declarationAccepted === true) {
        emp.declarationAccepted = true;
        emp.declarationDate = emp.declarationDate || new Date();
      }

      // If HR submits for verification, change status to hr_approved
      if (data.submitForVerification === 'true' || data.submitForVerification === true) {
        emp.status = 'hr_approved';
      }

      await emp.save();
      return res.json({ success: true, employee: emp });
    } catch (err) {
      console.error('[HR Update FT]', err);
      return res.status(500).json({ message: err.message });
    }
  }
);

// HR: Delete full-time employee
router.delete('/fulltime/:id', requireHRAuth, requireRole('hr'), async (req, res) => {
  try {
    await Employee.findByIdAndDelete(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// List all part-time drivers
router.get('/parttime', requireHRAuth, async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }
    const drivers = await PartTimeDriver.find(filter).sort({ createdAt: -1 });
    return res.json({ drivers });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// List all operational managers / supervisors (viewable by HR & Accountant)
router.get('/supervisors', requireHRAuth, async (req, res) => {
  try {
    const supervisors = await OperationalManager.find({ isActive: true })
      .select('-password')
      .populate('assignedClients', 'name code city address')
      .sort({ createdAt: -1 });
    return res.json({ supervisors });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Get single part-time driver
router.get('/parttime/:id', requireHRAuth, async (req, res) => {
  try {
    const driver = await PartTimeDriver.findById(req.params.id);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    return res.json({ driver });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// HR: Create part-time driver directly
router.post(
  '/parttime',
  requireHRAuth,
  upload.fields([{ name: 'aadharDoc', maxCount: 1 }]),
  async (req, res) => {
    try {
      const data = req.body;
      let aadharDocUrl = '';
      const tempId = uuidv4();
      if (req.files?.aadharDoc?.[0]) {
        const r = await uploadToCloudinary(req.files.aadharDoc[0].buffer, `growmore/parttime/${tempId}`, 'aadhar', 'auto');
        aadharDocUrl = r.secure_url;
      }
      const punchToken = uuidv4();
      const driver = await PartTimeDriver.create({
        ...data,
        aadharDocUrl: aadharDocUrl || data.aadharDocUrl || '',
        status: 'approved',
        punchToken,
      });
      return res.json({ success: true, driver });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
);

// HR: Update part-time driver
router.put(
  '/parttime/:id',
  requireHRAuth,
  upload.fields([{ name: 'aadharDoc', maxCount: 1 }]),
  async (req, res) => {
    try {
      const driver = await PartTimeDriver.findById(req.params.id);
      if (!driver) return res.status(404).json({ message: 'Driver not found' });
      const data = req.body;
      if (req.files?.aadharDoc?.[0]) {
        const r = await uploadToCloudinary(req.files.aadharDoc[0].buffer, `growmore/parttime/${driver.id}`, 'aadhar', 'auto');
        driver.aadharDocUrl = r.secure_url;
      }
      ['firstName', 'lastName', 'phone', 'email', 'aadharNumber', 'address'].forEach(f => {
        if (data[f] !== undefined) driver[f] = data[f];
      });
      await driver.save();
      return res.json({ success: true, driver });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
);

// HR: Approve part-time driver
router.post('/parttime/:id/approve', requireHRAuth, requireRole('hr'), async (req, res) => {
  try {
    const driver = await PartTimeDriver.findById(req.params.id);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    driver.status = 'approved';
    driver.rejectionRemarks = '';
    if (!driver.punchToken) driver.punchToken = uuidv4();
    await driver.save();
    return res.json({ success: true, driver, punchLink: `/punchin/${driver.punchToken}` });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// HR: Reject part-time driver
router.post('/parttime/:id/reject', requireHRAuth, requireRole('hr'), async (req, res) => {
  try {
    const driver = await PartTimeDriver.findById(req.params.id);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    driver.status = 'rejected';
    driver.rejectionRemarks = req.body.remarks || '';
    await driver.save();
    return res.json({ success: true, driver });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// HR: Delete part-time driver
router.delete('/parttime/:id', requireHRAuth, requireRole('hr'), async (req, res) => {
  try {
    await PartTimeDriver.findByIdAndDelete(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ─── ACCOUNTANT ROUTES ────────────────────────────────────────────────────────

// Accountant: verify full-time employee
router.post('/fulltime/:id/verify', requireHRAuth, requireRole('accountant'), async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ message: 'Employee not found' });

    emp.status = 'verified';
    emp.verifiedBy = req.hrUser.name;
    emp.verifiedAt = new Date();
    emp.rejectionRemarks = '';

    // Enable login: password = firstName.toLowerCase()
    emp.password = hashPassword(emp.firstName.toLowerCase());
    emp.isLoginEnabled = true;

    await emp.save();
    return res.json({ success: true, employee: emp });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Accountant: reject full-time employee with remarks
router.post('/fulltime/:id/reject', requireHRAuth, requireRole('accountant'), async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ message: 'Employee not found' });
    emp.status = 'rejected';
    emp.rejectionRemarks = req.body.remarks || 'Rejected by accountant';
    emp.isLoginEnabled = false;
    await emp.save();
    return res.json({ success: true, employee: emp });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ─── SCHEDULE / CALENDAR ──────────────────────────────────────────────────────

router.get('/schedule/:date', requireHRAuth, async (req, res) => {
  try {
    const schedule = await DaySchedule.findOne({ date: req.params.date })
      .populate('fullTimeDrivers', 'firstName lastName phone designation status')
      .populate('partTimeDrivers', 'firstName lastName phone status');
    return res.json({ schedule: schedule || { date: req.params.date, fullTimeDrivers: [], partTimeDrivers: [] } });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.put('/schedule/:date', requireHRAuth, async (req, res) => {
  try {
    const { fullTimeDrivers = [], partTimeDrivers = [], notes = '' } = req.body;
    const schedule = await DaySchedule.findOneAndUpdate(
      { date: req.params.date },
      { date: req.params.date, fullTimeDrivers, partTimeDrivers, notes },
      { upsert: true, new: true }
    )
      .populate('fullTimeDrivers', 'firstName lastName phone designation status')
      .populate('partTimeDrivers', 'firstName lastName phone status');
    return res.json({ success: true, schedule });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Get schedules for month (for calendar view)
router.get('/schedule', requireHRAuth, async (req, res) => {
  try {
    const { month, year } = req.query; // e.g. month=10&year=2026
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${endDay}`;
    const schedules = await DaySchedule.find({ date: { $gte: start, $lte: end } })
      .populate('fullTimeDrivers', 'firstName lastName')
      .populate('partTimeDrivers', 'firstName lastName');
    return res.json({ schedules });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ─── PUNCH-IN ROUTES (for full-time driver) ──────────────────────────────────

// Driver: punch in with photo + location
router.post(
  '/punches/fulltime',
  requireDriverAuth,
  upload.single('photo'),
  async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const employeeId = req.driver.id;

      // Check if already punched in today
      let record = await PunchIn.findOne({ employee: employeeId, date: today });
      if (record) return res.status(400).json({ message: 'Already punched in today' });

      let photoUrl = '';
      let cloudinaryPublicId = '';

      if (req.file) {
        const result = await uploadToCloudinary(
          req.file.buffer,
          `growmore/drivers/${employeeId}`,
          `punchin_${today}`
        );
        photoUrl = result.secure_url;
        cloudinaryPublicId = result.public_id;
      }

      const { lat, lng, address } = req.body;
      const location = { lat: lat ? Number(lat) : null, lng: lng ? Number(lng) : null, address: address || '' };

      record = await PunchIn.create({
        employee: employeeId,
        date: today,
        punchInTime: new Date(),
        photoUrl,
        cloudinaryPublicId,
        location,
        status: 'present',
      });

      return res.json({ success: true, punch: record });
    } catch (err) {
      console.error('[PunchIn FT]', err);
      return res.status(500).json({ message: err.message });
    }
  }
);

// Driver: get own punch history
router.get('/punches/fulltime/me', requireDriverAuth, async (req, res) => {
  try {
    const punches = await PunchIn.find({ employee: req.driver.id }).sort({ date: -1 });
    return res.json({ punches });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// HR/Accountant: get punch history for any employee
router.get('/punches/fulltime/:employeeId', requireHRAuth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = { employee: req.params.employeeId };
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to) filter.date.$lte = to;
    }
    const punches = await PunchIn.find(filter).sort({ date: -1 });
    return res.json({ punches });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// HR/Accountant: get all punches for a date
router.get('/punches/date/:date', requireHRAuth, async (req, res) => {
  try {
    const punches = await PunchIn.find({ date: req.params.date })
      .populate('employee', 'firstName lastName phone designation');
    return res.json({ punches });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Get part-time punches for date (HR/Accountant)
router.get('/punches/parttime/date/:date', requireHRAuth, async (req, res) => {
  try {
    const punches = await PartTimePunch.find({ date: req.params.date })
      .populate('driver', 'firstName lastName phone');
    return res.json({ punches });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Get all part-time punches for a driver
router.get('/punches/parttime/:driverId', requireHRAuth, async (req, res) => {
  try {
    const punches = await PartTimePunch.find({ driver: req.params.driverId }).sort({ date: -1 });
    return res.json({ punches });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ─── LEAVE ROUTES ─────────────────────────────────────────────────────────────

// Driver: apply for leave
router.post('/leaves', requireDriverAuth, async (req, res) => {
  try {
    const { date, reason } = req.body;
    if (!date) return res.status(400).json({ message: 'Date required' });

    // Can't apply leave for a date with existing punch
    const existingPunch = await PunchIn.findOne({ employee: req.driver.id, date });
    if (existingPunch) return res.status(400).json({ message: 'Already have a punch record for this date' });

    let leave = await Leave.findOne({ employee: req.driver.id, date });
    if (leave) return res.status(400).json({ message: 'Leave already applied for this date' });

    leave = await Leave.create({ employee: req.driver.id, date, reason, status: 'pending' });
    return res.json({ success: true, leave });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Driver: get own leaves
router.get('/leaves/me', requireDriverAuth, async (req, res) => {
  try {
    const leaves = await Leave.find({ employee: req.driver.id }).sort({ date: -1 });
    return res.json({ leaves });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// HR/Accountant: get all leaves
router.get('/leaves', requireHRAuth, async (req, res) => {
  try {
    const { employeeId, status } = req.query;
    const filter = {};
    if (employeeId) filter.employee = employeeId;
    if (status) filter.status = status;
    const leaves = await Leave.find(filter)
      .populate('employee', 'firstName lastName phone')
      .sort({ date: -1 });
    return res.json({ leaves });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Accountant: update leave status
router.put('/leaves/:id', requireHRAuth, requireRole('accountant'), async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: 'Leave not found' });
    leave.status = status;
    leave.accountantRemarks = remarks || '';
    leave.reviewedBy = req.hrUser.name;
    leave.reviewedAt = new Date();
    await leave.save();

    // If marking present, create a punch record
    if (status === 'approved') {
      // Mark as leave-approved in punch records (optional)
      await PunchIn.findOneAndUpdate(
        { employee: leave.employee, date: leave.date },
        { employee: leave.employee, date: leave.date, status: 'leave' },
        { upsert: true }
      );
    }

    return res.json({ success: true, leave });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
