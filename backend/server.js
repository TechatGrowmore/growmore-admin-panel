require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const path = require('path');

const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const proxyRoutes = require('./routes/proxy');

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
      // Allow requests with no origin (e.g., mobile apps, curl, Render health checks)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true, // required for httpOnly cookies
  })
);

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(cookieParser());

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/proxy', proxyRoutes);

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
  // All non-API routes → return React app (client-side routing)
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendBuild, 'index.html'));
    }
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
