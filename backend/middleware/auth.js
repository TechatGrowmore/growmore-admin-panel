const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'growmore-admin-secret-change-me';

/**
 * Express middleware: verifies the JWT from httpOnly cookie or Authorization header.
 * Attaches decoded payload to req.user on success.
 */
function requireAuth(req, res, next) {
  try {
    const token =
      req.cookies?.admin_token ||
      req.headers['authorization']?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized: no token' });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized: invalid or expired token' });
  }
}

/**
 * Express middleware: requires the authenticated user to be a superadmin.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ message: 'Forbidden: Super Admin access required' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, JWT_SECRET };
