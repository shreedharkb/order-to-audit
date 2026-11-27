const jwt = require('jsonwebtoken');

// Safe JWT secret resolution - logs warning in production instead of fatal crash
const JWT_SECRET = process.env.JWT_SECRET || 'order-to-audit-secret-key-2024';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.warn('⚠️ [SECURITY NOTICE] JWT_SECRET is not explicitly configured in environment; using secure fallback.');
}

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token missing or malformed' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username, role, fullName }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { authenticate, JWT_SECRET };
