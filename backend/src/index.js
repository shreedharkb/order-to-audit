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

// CORS configuration - allow browser frontend and Vercel domains
app.use(cors({
  origin: true,
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

// One-click reset to clean Section 5 benchmark opening state
app.all('/api/reset-benchmark', async (req, res) => {
  try {
    await pool.query(`
      TRUNCATE payments, invoice_lines, invoices, order_lines, orders,
               overhead_entries, production_issues, production_runs, stock_ledger CASCADE;
      INSERT INTO stock_ledger (item_id, txn_date, txn_type, qty_in, qty_out, unit, rate_paisa, notes, created_by)
      SELECT id, CURRENT_DATE, 'opening_balance', 100, 0, 'kg', 4200, 'Opening stock', 1 FROM items WHERE name = 'Rice Flour';
      INSERT INTO stock_ledger (item_id, txn_date, txn_type, qty_in, qty_out, unit, rate_paisa, notes, created_by)
      SELECT id, CURRENT_DATE, 'opening_balance', 30, 0, 'litre', 14000, 'Opening stock', 1 FROM items WHERE name = 'Cooking Oil';
      INSERT INTO stock_ledger (item_id, txn_date, txn_type, qty_in, qty_out, unit, rate_paisa, notes, created_by)
      SELECT id, CURRENT_DATE, 'opening_balance', 5, 0, 'kg', 20000, 'Opening stock', 1 FROM items WHERE name = 'Salt and Spice Mix';
      INSERT INTO stock_ledger (item_id, txn_date, txn_type, qty_in, qty_out, unit, rate_paisa, notes, created_by)
      SELECT id, CURRENT_DATE, 'opening_balance', 500, 0, 'piece', 250, 'Opening stock', 1 FROM items WHERE name = '200g Pouch';
      INSERT INTO stock_ledger (item_id, txn_date, txn_type, qty_in, qty_out, unit, rate_paisa, notes, created_by)
      SELECT id, CURRENT_DATE, 'opening_balance', 30, 0, 'piece', 1500, 'Opening stock', 1 FROM items WHERE name = 'Carton (20 packets)';
      INSERT INTO stock_ledger (item_id, txn_date, txn_type, qty_in, qty_out, unit, rate_paisa, notes, created_by)
      SELECT id, CURRENT_DATE, 'opening_balance', 50, 0, 'packet', 0, 'Opening stock - 50 packets', 1 FROM items WHERE name = 'Murukku 200g';
      DELETE FROM settings WHERE key LIKE '%counter%';
    `);
    res.json({
      success: true,
      message: 'Database reset to fresh Section 5 opening balances (Flour: 100kg, Oil: 30L, Murukku: 50pkts, etc.)'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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
