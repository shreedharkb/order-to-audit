require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const masterRoutes = require('./routes/masters');
const orderRoutes = require('./routes/orders');
const invoiceRoutes = require('./routes/invoices');
const purchaseRoutes = require('./routes/purchases');
const productionRoutes = require('./routes/production');
const paymentRoutes = require('./routes/payments');
const reportRoutes = require('./routes/reports');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

// Security and utility middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow inline scripts/styles for dev
}));

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost',
  'https://frontend-fawn-ten-48.vercel.app'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(new Error(`CORS origin ${origin} not permitted`));
  },
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API Route Mounts
app.use('/api/auth', authRoutes);
app.use('/api/masters', masterRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);

const { pool } = require('./config/db');
const { setupDatabase } = require('./db/dbSetup');

// Health check with database diagnostics
app.get('/api/health', async (req, res) => {
  try {
    const dbRes = await pool.query('SELECT NOW() as now, COUNT(*) as users_count FROM users');
    res.json({
      status: 'healthy',
      database: 'connected',
      usersInDb: parseInt(dbRes.rows[0].users_count, 10),
      service: 'FactoryLoop - Food Manufacturing ERP',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(200).json({
      status: 'degraded',
      database: 'disconnected',
      dbError: err.message,
      service: 'FactoryLoop - Food Manufacturing ERP',
      hint: 'Set DATABASE_URL in Vercel environment variables and open /api/setup-db to initialize schema',
      timestamp: new Date().toISOString()
    });
  }
});

// Remote database setup endpoint for cloud deployments (e.g. Supabase, Neon on Vercel)
app.all('/api/setup-db', async (req, res) => {
  try {
    const result = await setupDatabase();
    res.json({
      success: true,
      message: 'Database schema and Section 5 benchmark seed data initialized successfully!',
      result
    });
  } catch (err) {
    console.error('Remote DB setup error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      hint: 'Ensure DATABASE_URL environment variable is correctly configured on Vercel'
    });
  }
});

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `Endpoint ${req.method} ${req.originalUrl} not found` });
});

// Central error handler
app.use((err, req, res, next) => {
  console.error('Unhandled application error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`======================================================`);
    console.log(`🏭 FactoryLoop ERP Server running on port ${PORT}`);
    console.log(`🌐 Base API: http://localhost:${PORT}/api`);
    console.log(`======================================================`);
  });
}

module.exports = app;
