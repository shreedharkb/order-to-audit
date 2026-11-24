const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const stockService = require('../services/stockService');

router.use(authenticate);

/**
 * GET /api/dashboard/owner
 * Factory Owner & Admin High-Level Command Center
 */
router.get('/owner', authorize('owner', 'admin'), async (req, res) => {
  try {
    // 1. Today's orders
    const todayOrdersRes = await pool.query(`
      SELECT COUNT(*) AS count, COALESCE(SUM(total_paisa), 0) AS total_val
      FROM orders
      WHERE order_date = CURRENT_DATE
    `);

    // 2. Pending orders count
    const pendingOrdersRes = await pool.query(
      "SELECT COUNT(*) AS count FROM orders WHERE status = 'submitted'"
    );

    // 3. Stock levels & Low stock alerts
    const stockSummary = await stockService.getStockSummary(pool);
    const lowStockItems = stockSummary.filter(s => s.status === 'low_stock' || s.status === 'out_of_stock');

    // 4. Production Variance Alerts
    const tolRes = await pool.query("SELECT value FROM settings WHERE key = 'variance_tolerance_percent'");
    const tolerance = parseFloat(tolRes.rows[0]?.value || 3);

    const varianceRunsRes = await pool.query(`
      SELECT pr.id, pr.batch_number, pr.run_date, pr.expected_output, pr.actual_output,
             i.name AS finished_item_name,
             ROUND(((pr.actual_output - pr.expected_output) / pr.expected_output * 100), 2) AS yield_variance_percent
      FROM production_runs pr
      JOIN bom b ON pr.bom_id = b.id
      JOIN items i ON b.finished_item_id = i.id
      WHERE pr.status = 'completed' AND pr.expected_output > 0
        AND ABS((pr.actual_output - pr.expected_output) / pr.expected_output * 100) > $1
      ORDER BY pr.run_date DESC LIMIT 5
    `, [tolerance]);

    // 5. Total outstanding
    const invTotalRes = await pool.query("SELECT COALESCE(SUM(total_paisa), 0) AS total FROM invoices WHERE status = 'active'");
    const payTotalRes = await pool.query("SELECT COALESCE(SUM(amount_paisa), 0) AS total FROM payments");
    const totalOutstanding = parseInt(invTotalRes.rows[0].total) - parseInt(payTotalRes.rows[0].total);

    // 6. Recent submitted orders
    const recentOrdersRes = await pool.query(`
      SELECT o.*, c.name AS customer_name
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      ORDER BY o.created_at DESC LIMIT 5
    `);

    res.json({
      metrics: {
        todayOrdersCount: parseInt(todayOrdersRes.rows[0].count),
        todayOrdersTotalPaisa: parseInt(todayOrdersRes.rows[0].total_val),
        pendingApprovalsCount: parseInt(pendingOrdersRes.rows[0].count),
        lowStockCount: lowStockItems.length,
        totalOutstandingPaisa: totalOutstanding
      },
      lowStockAlerts: lowStockItems,
      varianceAlerts: varianceRunsRes.rows,
      recentOrders: recentOrdersRes.rows,
      stockSummary: stockSummary.slice(0, 8)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/dashboard/salesman
 * Field Salesman Mobile Dashboard
 */
router.get('/salesman', authorize('salesman', 'admin'), async (req, res) => {
  try {
    const salesmanId = req.user.id;

    // Today's orders
    const todayRes = await pool.query(`
      SELECT COUNT(*) AS count, COALESCE(SUM(total_paisa), 0) AS total_val
      FROM orders
      WHERE salesman_id = $1 AND order_date = CURRENT_DATE
    `, [salesmanId]);

    // Monthly orders
    const monthRes = await pool.query(`
      SELECT COUNT(*) AS count, COALESCE(SUM(total_paisa), 0) AS total_val
      FROM orders
      WHERE salesman_id = $1 AND order_date >= DATE_TRUNC('month', CURRENT_DATE)
    `, [salesmanId]);

    // Recent orders
    const recentOrdersRes = await pool.query(`
      SELECT o.*, c.name AS customer_name, c.state AS customer_state
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE o.salesman_id = $1
      ORDER BY o.created_at DESC LIMIT 10
    `, [salesmanId]);

    // Customer-wise sales summary
    const custSalesRes = await pool.query(`
      SELECT c.name AS customer_name, COUNT(o.id) AS order_count, SUM(o.total_paisa) AS total_paisa
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE o.salesman_id = $1 AND o.status != 'rejected' AND o.status != 'cancelled'
      GROUP BY c.id, c.name
      ORDER BY total_paisa DESC
    `, [salesmanId]);

    res.json({
      salesman: req.user.fullName,
      today: {
        count: parseInt(todayRes.rows[0].count),
        totalPaisa: parseInt(todayRes.rows[0].total_val)
      },
      month: {
        count: parseInt(monthRes.rows[0].count),
        totalPaisa: parseInt(monthRes.rows[0].total_val)
      },
      recentOrders: recentOrdersRes.rows,
      customerSales: custSalesRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
