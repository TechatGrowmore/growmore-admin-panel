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

const app = express();
const PORT = process.env.PORT || 5000;

// ─── CORS ─────────────────────────────────────────────────────────────────────
// In production, frontend is served by this same Express server (same origin),
// so CORS is only needed for local development.
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // In production, same-origin requests have no Origin header — always allow
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // In production, allow same Render domain
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
  // SPA catch-all: serve index.html for any non-API route (client-side routing)
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
  .then(() => {
    console.log('✅  Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`🚀  Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌  MongoDB connection failed:', err.message);
    process.exit(1);
  });
