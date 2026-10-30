require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const path = require('path');

const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const proxyRoutes = require('./routes/proxy');
const managerRoutes = require('./routes/managers');
const logRoutes = require('./routes/logs');
const { router: hrAuthRouter } = require('./routes/hrAuth');
const { router: driverAuthRouter } = require('./routes/driverAuth');
const employeeRoutes = require('./routes/employees');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (process.env.NODE_ENV === 'production') return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(cookieParser());

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/proxy', proxyRoutes);
app.use('/api/managers', managerRoutes);
app.use('/api/logs', logRoutes);

// HR System Routes
app.use('/api/hr/auth', hrAuthRouter);
app.use('/api/driver/auth', driverAuthRouter);
app.use('/api/employees', employeeRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// ─── Serve React Frontend in Production ───────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const frontendBuild = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(frontendBuild));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuild, 'index.html'));
  });
}

// ─── MongoDB Connection + Server Start ────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI is not set. Add it to your .env file.');
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log('✅  Connected to MongoDB');

    // Auto-seed HR/Accountant users if they don't exist
    try {
      const HRUser = require('./models/HRUser');
      const crypto = require('crypto');
      const hash = (str) => crypto.createHash('sha256').update(str).digest('hex');
      const defaults = [
        { name: 'HR Manager', username: 'hr', password: hash('hr@growmore'), role: 'hr' },
        { name: 'Accountant', username: 'accountant', password: hash('accountant@growmore'), role: 'accountant' },
      ];
      for (const u of defaults) {
        const exists = await HRUser.findOne({ username: u.username });
        if (!exists) {
          await HRUser.create(u);
          console.log(`✅  Seeded ${u.role} user: ${u.username}`);
        }
      }
    } catch (seedErr) {
      console.warn('⚠️  HR user seed warning:', seedErr.message);
    }

    app.listen(PORT, () => {
      console.log(`🚀  Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌  MongoDB connection failed:', err.message);
    process.exit(1);
  });
