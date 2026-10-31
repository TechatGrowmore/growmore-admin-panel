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
const Venue = require('../models/Venue');
const OperationalManager = require('../models/OperationalManager');
const { requireHRAuth, requireRole } = require('./hrAuth');
const { requireDriverAuth } = require('./driverAuth');
const { DOC_URL_FIELDS, FULL_TIME_DOCS, PART_TIME_DOCS, docStatus } = require('../utils/profileCompletion');

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

// Upload optional files from multer's req.files. spec: { fieldName: [urlKey, publicId, resourceType] }
async function uploadFiles(files, spec, folder) {
  const out = {};
  for (const [field, [urlKey, publicId, resourceType]] of Object.entries(spec)) {
    if (files?.[field]?.[0]) {
      const r = await uploadToCloudinary(files[field][0].buffer, folder, publicId, resourceType);
      out[urlKey] = r.secure_url;
    }
  }
  return out;
}

// Bank details are compulsory on the public registration forms
function bankDetailsError(data, files) {
  const required = [
    ['bankName', 'Bank name'],
    ['bankAccountNumber', 'Account number'],
    ['bankIfsc', 'IFSC code'],
    ['bankAccountHolderName', 'Account holder name'],
    ['bankBranchName', 'Branch name'],
  ];
  for (const [key, label] of required) {
    if (!String(data[key] || '').trim()) return `${label} is required`;
  }
  if (!files?.passbookDoc?.[0]) return 'Passbook photo is required';
  return null;
}

const FT_DOC_SPEC = {
  aadharDoc: ['aadharDocUrl', 'aadhar', 'auto'],
  panDoc: ['panDocUrl', 'pan', 'auto'],
  photo: ['photoUrl', 'photo', 'image'],
  licenseDoc: ['licenseDocUrl', 'license', 'auto'],
  passbookDoc: ['passbookDocUrl', 'passbook', 'auto'],
};
const FT_DOC_FIELDS = Object.keys(FT_DOC_SPEC).map(name => ({ name, maxCount: 1 }));

const PT_DOC_SPEC = {
  aadharDoc: ['aadharDocUrl', 'aadhar', 'auto'],
  photo: ['photoUrl', 'photo', 'image'],
  licenseDoc: ['licenseDocUrl', 'license', 'auto'],
  passbookDoc: ['passbookDocUrl', 'passbook', 'auto'],
};
const PT_DOC_FIELDS = Object.keys(PT_DOC_SPEC).map(name => ({ name, maxCount: 1 }));

// Punching / leave are only for verified (full-time) or approved (part-time) drivers
function requireActiveAccount(Model, okStatus, getId) {
  return async (req, res, next) => {
    try {
      const rec = await Model.findById(getId(req)).select('status');
      if (!rec || rec.status !== okStatus) {
        return res.status(403).json({ message: 'Your account is not approved yet. This feature unlocks after approval.' });
      }
      next();
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  };
}

// Venue + pay assigned to a part-time driver for a day (or null)
async function assignmentFor(driverId, date) {
  const sched = await DaySchedule.findOne({ date, 'partTimeAssignments.driver': driverId });
  return sched?.partTimeAssignments?.find(a => String(a.driver) === String(driverId)) || null;
}

// Clear the review of every document whose file was just replaced (it goes back to "pending")
function resetReviewsFor(rec, urls) {
  const reviews = { ...(rec.docReviews || {}) };
  Object.keys(urls).forEach(urlKey => {
    const docKey = Object.keys(DOC_URL_FIELDS).find(k => DOC_URL_FIELDS[k] === urlKey);
    if (docKey) delete reviews[docKey];
  });
  rec.docReviews = reviews;
}

// Fields the client must never set directly
function stripServerFields(body) {
  const { docReviews, documents, profileCompletion, id, password, isLoginEnabled, ...clean } = body;
  return clean;
}

const DOC_UPLOAD_SPEC = {
  photo: ['photoUrl', 'photo', 'image'],
  aadhar: ['aadharDocUrl', 'aadhar', 'auto'],
  pan: ['panDocUrl', 'pan', 'auto'],
  license: ['licenseDocUrl', 'license', 'auto'],
  passbook: ['passbookDocUrl', 'passbook', 'auto'],
};

// HR / accountant: approve or reject one uploaded document
function reviewDocHandler(Model, validDocs, respKey) {
  return async (req, res) => {
    try {
      const key = req.params.doc;
      const { status, remarks } = req.body;
      if (!validDocs.includes(key)) return res.status(400).json({ message: 'Unknown document' });
      if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ message: 'Status must be approved or rejected' });
      if (status === 'rejected' && !String(remarks || '').trim()) return res.status(400).json({ message: 'Remarks are required to reject a document' });
      const rec = await Model.findById(req.params.id);
      if (!rec) return res.status(404).json({ message: 'Record not found' });
      if (docStatus(rec, key) === 'missing') return res.status(400).json({ message: 'Document has not been uploaded' });
      rec.docReviews = {
        ...(rec.docReviews || {}),
        [key]: {
          status,
          remarks: status === 'rejected' ? String(remarks).trim() : '',
          reviewedBy: req.hrUser.name,
          reviewedByRole: req.hrUser.role,
          reviewedAt: new Date(),
        },
      };
      await rec.save();
      return res.json({ success: true, [respKey]: rec });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  };
}

// Driver: upload (or re-upload) a document that is missing or was rejected. It goes back to "pending".
function driverUploadDocHandler(Model, validDocs, getId, folderBase, respKey) {
  return async (req, res) => {
    try {
      const key = req.params.doc;
      if (!validDocs.includes(key)) return res.status(400).json({ message: 'Unknown document' });
      if (!req.file) return res.status(400).json({ message: 'Please choose a file to upload' });
      if (key === 'photo' && !req.file.mimetype.startsWith('image/')) return res.status(400).json({ message: 'Photograph must be an image' });
      const rec = await Model.findById(getId(req));
      if (!rec) return res.status(404).json({ message: 'Record not found' });
      const current = docStatus(rec, key);
      if (current !== 'missing' && current !== 'rejected') {
        return res.status(400).json({ message: 'Only rejected or missing documents can be uploaded again' });
      }
      const [urlKey, publicId, resourceType] = DOC_UPLOAD_SPEC[key];
      const r = await uploadToCloudinary(req.file.buffer, `${folderBase}/${rec.id}`, publicId, resourceType);
      rec[urlKey] = r.secure_url;
      rec.docReviews = {
        ...(rec.docReviews || {}),
        [key]: { status: 'pending', remarks: '', resubmittedAt: new Date() },
      };
      await rec.save();
      return res.json({ success: true, [respKey]: rec });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  };
}

function hashPassword(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────────────

// Public: submit full-time registration form
router.post(
  '/public/fulltime',
  upload.fields(FT_DOC_FIELDS),
  async (req, res) => {
    try {
      const data = req.body;
      const token = uuidv4();

      const bankError = bankDetailsError(data, req.files);
      if (bankError) return res.status(400).json({ message: bankError });

      // Temp upload with token as folder
      const urls = await uploadFiles(req.files, FT_DOC_SPEC, `growmore/pending/${token}`);

      const employee = await Employee.create({
        ...data,
        aadharDocUrl: '',
        panDocUrl: '',
        photoUrl: '',
        ...urls,
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
  upload.fields(PT_DOC_FIELDS),
  async (req, res) => {
    try {
      const data = req.body;
      const token = uuidv4();

      const bankError = bankDetailsError(data, req.files);
      if (bankError) return res.status(400).json({ message: bankError });

      const urls = await uploadFiles(req.files, PT_DOC_SPEC, `growmore/registration/part-time/${token}`);

      const driver = await PartTimeDriver.create({
        ...data,
        aadharDocUrl: '',
        photoUrl: '',
        ...urls,
        registrationDate: new Date(),
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
    const { firstName, lastName, phone, email, city, state } = emp;
    return res.json({ employee: { firstName, lastName, phone, email, city, state } });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Public: get part-time form data by token
router.get('/public/parttime/:token', async (req, res) => {
  try {
    const driver = await PartTimeDriver.findOne({ publicFormToken: req.params.token });
    if (!driver) return res.status(404).json({ message: 'Application not found' });
    const { firstName, lastName, phone, email, address } = driver;
    return res.json({ driver: { firstName, lastName, phone, email, address } });
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
    const { firstName, lastName, phone } = driver;
    return res.json({ driver: { firstName, lastName, phone }, punch: existingPunch || null, today });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Submit punch in/out for part-time driver
router.post('/parttime/punch/:token', upload.single('photo'), async (req, res) => {
  try {
    const driver = await PartTimeDriver.findOne({ punchToken: req.params.token, status: 'approved' });
    if (!driver) return res.status(404).json({ message: 'Invalid punch link' });

    const today = new Date().toISOString().split('T')[0];
    const { action, lat, lng, address } = req.body; // action: 'punchin' | 'punchout'
    const hasLocation = lat !== undefined && lat !== '' && lat !== 'null' && lng !== undefined && lng !== '' && lng !== 'null';
    const location = { lat: hasLocation ? Number(lat) : null, lng: hasLocation ? Number(lng) : null, address: address || '' };

    if (action !== 'punchin' && action !== 'punchout') return res.status(400).json({ message: 'Invalid action' });
    if (!req.file) return res.status(400).json({ message: 'Photo is required to punch' });
    if (!hasLocation || Number.isNaN(location.lat) || Number.isNaN(location.lng)) {
      return res.status(400).json({ message: 'Location is required to punch' });
    }

    let punch = await PartTimePunch.findOne({ driver: driver._id, date: today });
    if (action === 'punchin' && punch) return res.status(400).json({ message: 'Already punched in today' });
    if (action === 'punchout' && !punch) return res.status(400).json({ message: 'Punch in first' });
    if (action === 'punchout' && punch.punchOutTime) return res.status(400).json({ message: 'Already punched out' });

    const r = await uploadToCloudinary(
      req.file.buffer,
      `growmore/parttime/punches/${driver.id}`,
      `${action}_${today}`
    );

    if (!punch) {
      punch = await PartTimePunch.create({
        driver: driver._id,
        date: today,
        punchInTime: new Date(),
        punchInPhotoUrl: r.secure_url,
        venue: (await assignmentFor(driver._id, today))?.venueName || '',
        location,
        token: req.params.token,
      });
    } else {
      if (action === 'punchout') {
        punch.punchOutTime = new Date();
        punch.punchOutPhotoUrl = r.secure_url;
        punch.punchOutLocation = location;
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
router.get('/fulltime/:id([0-9a-fA-F]{24})', requireHRAuth, async (req, res) => {
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
  upload.fields(FT_DOC_FIELDS),
  async (req, res) => {
    try {
      const data = stripServerFields(req.body);
      const urls = await uploadFiles(req.files, FT_DOC_SPEC, `growmore/fulltime/${uuidv4()}`);

      const employee = await Employee.create({
        ...data,
        ...urls,
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
  upload.fields(FT_DOC_FIELDS),
  async (req, res) => {
    try {
      const emp = await Employee.findById(req.params.id);
      if (!emp) return res.status(404).json({ message: 'Employee not found' });

      const data = req.body;

      const urls = await uploadFiles(req.files, FT_DOC_SPEC, `growmore/fulltime/${emp.id}`);
      Object.assign(emp, urls);
      resetReviewsFor(emp, urls);

      // Update fields
      const fields = ['firstName', 'lastName', 'phone', 'email', 'dob', 'gender', 'bloodGroup',
        'addressLine1', 'addressLine2', 'city', 'state', 'pincode',
        'aadharNumber', 'panNumber', 'designation', 'department', 'joiningDate', 'salary',
        'venue', 'aadharAddressLine1', 'aadharAddressLine2', 'aadharCity', 'aadharState', 'aadharPincode',
        'emergencyContactName', 'emergencyContactPhone',
        'bankName', 'bankAccountNumber', 'bankIfsc', 'bankAccountHolderName', 'bankBranchName',
        'pfNumber', 'esicNumber'];
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
router.get('/parttime/:id([0-9a-fA-F]{24})', requireHRAuth, async (req, res) => {
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
  upload.fields(PT_DOC_FIELDS),
  async (req, res) => {
    try {
      const data = stripServerFields(req.body);
      const urls = await uploadFiles(req.files, PT_DOC_SPEC, `growmore/parttime/${uuidv4()}`);
      const driver = await PartTimeDriver.create({
        ...data,
        ...urls,
        status: 'approved',
        punchToken: uuidv4(),
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
  upload.fields(PT_DOC_FIELDS),
  async (req, res) => {
    try {
      const driver = await PartTimeDriver.findById(req.params.id);
      if (!driver) return res.status(404).json({ message: 'Driver not found' });
      const data = req.body;
      const urls = await uploadFiles(req.files, PT_DOC_SPEC, `growmore/parttime/${driver.id}`);
      Object.assign(driver, urls);
      resetReviewsFor(driver, urls);
      ['firstName', 'lastName', 'phone', 'email', 'aadharNumber', 'address',
        'bankName', 'bankAccountNumber', 'bankIfsc', 'bankAccountHolderName', 'bankBranchName'].forEach(f => {
        if (data[f] !== undefined) driver[f] = data[f];
      });
      await driver.save();
      return res.json({ success: true, driver });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
);

// HR / accountant: review an uploaded document
router.post('/fulltime/:id/docs/:doc/review', requireHRAuth, reviewDocHandler(Employee, FULL_TIME_DOCS, 'employee'));
router.post('/parttime/:id/docs/:doc/review', requireHRAuth, reviewDocHandler(PartTimeDriver, PART_TIME_DOCS, 'driver'));

// HR: Approve part-time driver
router.post('/parttime/:id/approve', requireHRAuth, requireRole('hr'), async (req, res) => {
  try {
    const driver = await PartTimeDriver.findById(req.params.id);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    driver.status = 'approved';
    driver.rejectionRemarks = '';
    if (!driver.punchToken) driver.punchToken = uuidv4();
    // Set login credentials: phone = username, firstName lowercase = password
    driver.password = hashPassword(driver.firstName.toLowerCase().trim());
    driver.isLoginEnabled = true;
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

const SCHEDULE_POPULATE = [
  { path: 'fullTimeDrivers', select: 'firstName lastName phone designation status venue' },
  { path: 'partTimeDrivers', select: 'firstName lastName phone status' },
  { path: 'partTimeAssignments.driver', select: 'firstName lastName phone status' },
];

router.get('/schedule/:date', requireHRAuth, async (req, res) => {
  try {
    const schedule = await DaySchedule.findOne({ date: req.params.date }).populate(SCHEDULE_POPULATE);
    return res.json({ schedule: schedule || { date: req.params.date, fullTimeDrivers: [], partTimeDrivers: [], partTimeAssignments: [] } });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// HR only: assign drivers (and, for part-timers, a venue + pay for that day)
router.put('/schedule/:date', requireHRAuth, requireRole('hr'), async (req, res) => {
  try {
    const { fullTimeDrivers = [], partTimeAssignments, partTimeDrivers = [], notes = '' } = req.body;
    const update = { date: req.params.date, fullTimeDrivers, notes };

    if (Array.isArray(partTimeAssignments)) {
      const seen = new Set();
      const assignments = [];
      for (const a of partTimeAssignments) {
        if (!a.driver) continue;
        if (seen.has(String(a.driver))) return res.status(400).json({ message: 'A driver can only be assigned once per day' });
        seen.add(String(a.driver));
        if (!a.venue) return res.status(400).json({ message: 'Select a venue for every assigned driver' });
        const amount = Number(a.amount);
        if (a.amount === '' || a.amount === null || a.amount === undefined || !Number.isFinite(amount) || amount < 0) {
          return res.status(400).json({ message: 'Enter a valid payment amount for every assigned driver' });
        }
        const venue = await Venue.findById(a.venue);
        if (!venue) return res.status(400).json({ message: 'Selected venue no longer exists' });
        assignments.push({ driver: a.driver, venue: venue._id, venueName: venue.name, amount });
      }
      update.partTimeAssignments = assignments;
      update.partTimeDrivers = assignments.map(a => a.driver);
    } else {
      update.partTimeDrivers = partTimeDrivers;
    }

    const schedule = await DaySchedule.findOneAndUpdate(
      { date: req.params.date }, update, { upsert: true, new: true }
    ).populate(SCHEDULE_POPULATE);
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
    const schedules = await DaySchedule.find({ date: { $gte: start, $lte: end } }).populate(SCHEDULE_POPULATE);
    return res.json({ schedules });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ─── VENUES (HR manages, accountant can read) ─────────────────────────────────

router.get('/venues', requireHRAuth, async (req, res) => {
  try {
    const filter = req.query.active === 'true' ? { active: true } : {};
    const venues = await Venue.find(filter).sort({ name: 1 });
    return res.json({ venues });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.post('/venues', requireHRAuth, requireRole('hr'), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Venue name is required' });
    const exists = await Venue.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    if (exists) return res.status(400).json({ message: 'A venue with this name already exists' });
    const venue = await Venue.create({ name, address: req.body.address || '' });
    return res.json({ success: true, venue });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.put('/venues/:id', requireHRAuth, requireRole('hr'), async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) return res.status(404).json({ message: 'Venue not found' });
    if (req.body.name !== undefined) {
      if (!String(req.body.name).trim()) return res.status(400).json({ message: 'Venue name is required' });
      venue.name = req.body.name;
    }
    if (req.body.address !== undefined) venue.address = req.body.address;
    if (req.body.active !== undefined) venue.active = !!req.body.active;
    await venue.save();
    return res.json({ success: true, venue });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// A venue that was ever assigned is only deactivated, so past pay records keep their venue
router.delete('/venues/:id', requireHRAuth, requireRole('hr'), async (req, res) => {
  try {
    const used = await DaySchedule.exists({ 'partTimeAssignments.venue': req.params.id });
    if (used) {
      await Venue.findByIdAndUpdate(req.params.id, { active: false });
      return res.json({ success: true, deactivated: true });
    }
    await Venue.findByIdAndDelete(req.params.id);
    return res.json({ success: true, deleted: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// HR / accountant: part-time assignments joined with attendance for a date range
router.get('/analysis/parttime', requireHRAuth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(from || '') || !re.test(to || '')) return res.status(400).json({ message: 'from and to (YYYY-MM-DD) are required' });

    const schedules = await DaySchedule.find({ date: { $gte: from, $lte: to }, 'partTimeAssignments.0': { $exists: true } })
      .populate('partTimeAssignments.driver', 'firstName lastName phone')
      .populate('partTimeAssignments.venue', 'name');
    const punches = await PartTimePunch.find({ date: { $gte: from, $lte: to } }).populate('driver', 'firstName lastName phone');

    const punchByKey = new Map(punches.map(p => [`${p.driver?.id || p.driver}_${p.date}`, p]));
    const assignedKeys = new Set();
    const rows = [];
    schedules.forEach(sc => {
      sc.partTimeAssignments.forEach(a => {
        if (!a.driver) return; // driver was deleted
        const key = `${a.driver.id}_${sc.date}`;
        assignedKeys.add(key);
        const p = punchByKey.get(key);
        rows.push({
          date: sc.date,
          driverId: a.driver.id,
          driverName: `${a.driver.firstName} ${a.driver.lastName}`,
          phone: a.driver.phone,
          venueName: a.venue?.name || a.venueName || '—',
          amount: a.amount,
          punchInTime: p?.punchInTime || null,
          punchOutTime: p?.punchOutTime || null,
        });
      });
    });

    const unassignedPunches = punches
      .filter(p => p.driver && !assignedKeys.has(`${p.driver.id}_${p.date}`))
      .map(p => ({
        date: p.date,
        driverId: p.driver.id,
        driverName: `${p.driver.firstName} ${p.driver.lastName}`,
        punchInTime: p.punchInTime || null,
        punchOutTime: p.punchOutTime || null,
      }));

    return res.json({ from, to, rows, unassignedPunches });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ─── PUNCH-IN ROUTES (for full-time driver) ──────────────────────────────────

// Driver: punch in with photo + location
router.post(
  '/punches/fulltime',
  requireDriverAuth,
  requireActiveAccount(Employee, 'verified', req => req.driver.id),
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

      const emp = await Employee.findById(employeeId).select('venue');
      record = await PunchIn.create({
        employee: employeeId,
        venue: emp?.venue || '',
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
router.get('/punches/parttime/:driverId([0-9a-fA-F]{24})', requireHRAuth, async (req, res) => {
  try {
    const punches = await PartTimePunch.find({ driver: req.params.driverId }).sort({ date: -1 });
    return res.json({ punches });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ─── LEAVE ROUTES ─────────────────────────────────────────────────────────────

// Driver: apply for leave
router.post('/leaves', requireDriverAuth, requireActiveAccount(Employee, 'verified', req => req.driver.id), async (req, res) => {
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

// ─── PART-TIME DRIVER PORTAL ROUTES (authenticated via pt_driver_token) ──────

const { requirePartTimeDriverAuth } = require('./partTimeDriverAuth');

// PT Driver: get own profile
router.get('/parttime/me', requirePartTimeDriverAuth, async (req, res) => {
  try {
    const driver = await PartTimeDriver.findById(req.ptDriver.id).select('-password');
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    return res.json({ driver });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// PT Driver: upload / re-upload a missing or rejected document
router.post(
  '/parttime/me/docs/:doc',
  requirePartTimeDriverAuth,
  upload.single('file'),
  driverUploadDocHandler(PartTimeDriver, PART_TIME_DOCS, req => req.ptDriver.id, 'growmore/parttime', 'driver')
);

// PT Driver: get own punch history
router.get('/punches/parttime/me', requirePartTimeDriverAuth, async (req, res) => {
  try {
    const punches = await PartTimePunch.find({ driver: req.ptDriver.id }).sort({ date: -1 });
    return res.json({ punches });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// PT Driver: punch in (with optional photo)
router.post(
  '/punches/parttime/me',
  requirePartTimeDriverAuth,
  requireActiveAccount(PartTimeDriver, 'approved', req => req.ptDriver.id),
  upload.single('photo'),
  async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const driverId = req.ptDriver.id;
      const { action, lat, lng, address } = req.body;
      const location = { lat: lat ? Number(lat) : null, lng: lng ? Number(lng) : null, address: address || '' };

      let punch = await PartTimePunch.findOne({ driver: driverId, date: today });

      if (action === 'punchin') {
        if (punch) return res.status(400).json({ message: 'Already punched in today' });
        let photoUrl = '';
        if (req.file) {
          try {
            const result = await uploadToCloudinary(
              req.file.buffer,
              `growmore/parttime/${driverId}`,
              `punchin_${today}`,
              'image'
            );
            photoUrl = result.secure_url;
          } catch (uploadErr) {
            console.warn('[PT Punch Photo Upload]', uploadErr.message);
          }
        }
        punch = await PartTimePunch.create({
          driver: driverId,
          date: today,
          punchInTime: new Date(),
          location,
          punchInPhotoUrl: photoUrl,
          venue: (await assignmentFor(driverId, today))?.venueName || '',
        });
      } else if (action === 'punchout') {
        if (!punch) return res.status(400).json({ message: 'Punch in first' });
        if (punch.punchOutTime) return res.status(400).json({ message: 'Already punched out today' });
        let photoUrl = '';
        if (req.file) {
          try {
            const result = await uploadToCloudinary(
              req.file.buffer,
              `growmore/parttime/${driverId}`,
              `punchout_${today}`,
              'image'
            );
            photoUrl = result.secure_url;
          } catch (uploadErr) {
            console.warn('[PT Punchout Photo Upload]', uploadErr.message);
          }
        }
        punch.punchOutTime = new Date();
        punch.punchOutLocation = location;
        punch.punchOutPhotoUrl = photoUrl;
        await punch.save();
      } else {
        return res.status(400).json({ message: 'Invalid action. Use punchin or punchout.' });
      }

      return res.json({ success: true, punch });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
);

// PT Driver: get own assigned days for a month, with venue + pay for each
router.get('/schedule/parttime/me', requirePartTimeDriverAuth, async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ message: 'month and year required' });
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${endDay}`;
    const schedules = await DaySchedule.find({
      date: { $gte: start, $lte: end },
      partTimeDrivers: req.ptDriver.id,
    });
    return res.json({
      schedules: schedules.map(sc => {
        const mine = sc.partTimeAssignments.find(a => String(a.driver) === String(req.ptDriver.id));
        return {
          date: sc.date,
          notes: sc.notes,
          myAssignment: mine ? { venueName: mine.venueName, amount: mine.amount } : null,
        };
      }),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ─── FULL-TIME DRIVER PROFILE / DOCUMENTS (authenticated via driver_token) ────

router.get('/fulltime/me', requireDriverAuth, async (req, res) => {
  try {
    const employee = await Employee.findById(req.driver.id).select('-password');
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    return res.json({ employee });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.post(
  '/fulltime/me/docs/:doc',
  requireDriverAuth,
  upload.single('file'),
  driverUploadDocHandler(Employee, FULL_TIME_DOCS, req => req.driver.id, 'growmore/fulltime', 'employee')
);

module.exports = router;
