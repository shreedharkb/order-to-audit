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
app.use(cors());
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Order-to-Audit Food Manufacturing ERP',
    timestamp: new Date().toISOString()
  });
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
    console.log(`🏭 Order-to-Audit ERP Server running on port ${PORT}`);
    console.log(`🌐 Base API: http://localhost:${PORT}/api`);
    console.log(`======================================================`);
  });
}

module.exports = app;
