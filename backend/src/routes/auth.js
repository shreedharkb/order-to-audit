const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

/**
 * POST /api/auth/login
 * Authenticate user and return JWT
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const result = await pool.query(
      'SELECT id, username, password_hash, full_name, role, is_active FROM users WHERE username = $1',
      [username.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'User account is deactivated' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.full_name
      },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.full_name
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    const isDbErr = err.code || err.message?.includes('connect') || err.message?.includes('relation') || err.message?.includes('database');
    res.status(500).json({
      error: isDbErr
        ? 'Database connection or schema error. Ensure DATABASE_URL is configured and tables are seeded.'
        : 'Internal server error during login'
    });
  }
});

/**
 * GET /api/auth/me
 * Fetch authenticated user profile
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, full_name, role, email, phone, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

module.exports = router;
