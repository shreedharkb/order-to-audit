const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { logAudit } = require('../middleware/auditLog');
const stockService = require('../services/stockService');

router.use(authenticate);

/**
 * POST /api/orders
 * Salesman places an order (Mobile optimized)
 */
router.post('/', authorize('salesman', 'admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { customerId, items, notes } = req.body;

    if (!customerId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Customer ID and at least one item are required' });
    }

    // Generate Order Number: ORD/YYYY/XXXX
    const year = new Date().getFullYear();
    const countRes = await client.query(
      "SELECT COUNT(*) FROM orders WHERE order_number LIKE $1",
      [`ORD/${year}/%`]
    );
    const count = parseInt(countRes.rows[0].count, 10) + 1;
    const orderNumber = `ORD/${year}/${count.toString().padStart(4, '0')}`;

    let totalPaisa = 0;
    const processedLines = [];

    for (const item of items) {
      const { itemId, qty } = item;
      const numQty = parseFloat(qty);
      if (numQty <= 0) continue;

      // Price lookup: 1. Customer-specific, 2. Default price list, 3. Item master price
      const priceRes = await client.query(
        `SELECT price_paisa FROM price_lists 
         WHERE item_id = $1 AND (customer_id = $2 OR customer_id IS NULL)
         ORDER BY customer_id NULLS LAST LIMIT 1`,
        [itemId, customerId]
      );

      let pricePaisa = 0;
      if (priceRes.rows.length > 0) {
        pricePaisa = parseInt(priceRes.rows[0].price_paisa, 10);
      } else {
        const itemRes = await client.query('SELECT selling_price_paisa, unit FROM items WHERE id = $1', [itemId]);
        pricePaisa = parseInt(itemRes.rows[0]?.selling_price_paisa || 0, 10);
      }

      const amountPaisa = Math.round(numQty * pricePaisa);
      totalPaisa += amountPaisa;

      processedLines.push({
        itemId,
        qty: numQty,
        pricePaisa,
        amountPaisa
      });
    }

    const orderRes = await client.query(
      `INSERT INTO orders (order_number, customer_id, salesman_id, order_date, total_paisa, notes, status)
       VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, 'submitted')
       RETURNING *`,
      [orderNumber, customerId, req.user.id, totalPaisa, notes]
    );
    const newOrder = orderRes.rows[0];

    for (const pl of processedLines) {
      await client.query(
        `INSERT INTO order_lines (order_id, item_id, qty, price_paisa, amount_paisa)
         VALUES ($1, $2, $3, $4, $5)`,
        [newOrder.id, pl.itemId, pl.qty, pl.pricePaisa, pl.amountPaisa]
      );
    }

    await client.query('COMMIT');
    await logAudit(pool, 'orders', newOrder.id, 'create', null, newOrder, req.user.id);

    res.status(201).json({
      message: 'Order submitted successfully',
      order: newOrder
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/orders
 * List orders (Salesman sees own; Admin/Owner sees all)
 */
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let queryText = `
      SELECT o.*, c.name AS customer_name, c.state AS customer_state, c.type AS customer_type, u.full_name AS salesman_name
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      JOIN users u ON o.salesman_id = u.id
    `;
    let conditions = [];
    let params = [];
    let pIdx = 1;

    if (req.user.role === 'salesman') {
      conditions.push(`o.salesman_id = $${pIdx++}`);
      params.push(req.user.id);
    }

    if (status) {
      conditions.push(`o.status = $${pIdx++}`);
      params.push(status);
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }

    queryText += ' ORDER BY o.created_at DESC';

    const result = await pool.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/orders/:id
 * Get single order detail with line items
 */
router.get('/:id', async (req, res) => {
  try {
    const orderRes = await pool.query(`
      SELECT o.*, c.name AS customer_name, c.gstin AS customer_gstin, c.state AS customer_state,
             c.state_code AS customer_state_code, c.address AS customer_address, u.full_name AS salesman_name
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      JOIN users u ON o.salesman_id = u.id
      WHERE o.id = $1
    `, [req.params.id]);

    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = orderRes.rows[0];

    const linesRes = await pool.query(`
      SELECT ol.*, i.name AS item_name, i.unit, i.hsn_code, i.gst_rate_percent
      FROM order_lines ol
      JOIN items i ON ol.item_id = i.id
      WHERE ol.order_id = $1
    `, [order.id]);

    order.lines = linesRes.rows;
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/orders/stock-check/:id
 * Stock check for order line items
 */
router.get('/stock-check/:id', async (req, res) => {
  try {
    const linesRes = await pool.query(`
      SELECT ol.*, i.name AS item_name, i.unit
      FROM order_lines ol
      JOIN items i ON ol.item_id = i.id
      WHERE ol.order_id = $1
    `, [req.params.id]);

    const checks = [];
    let hasShortage = false;

    for (const line of linesRes.rows) {
      const balance = await stockService.getStockBalance(pool, line.item_id);
      const requested = parseFloat(line.qty);
      const isSufficient = balance >= requested;
      const shortage = isSufficient ? 0 : requested - balance;
      if (!isSufficient) hasShortage = true;

      checks.push({
        itemId: line.item_id,
        itemName: line.item_name,
        unit: line.unit,
        requested,
        available: balance,
        isSufficient,
        shortage
      });
    }

    res.json({
      orderId: req.params.id,
      canFulfill: !hasShortage,
      items: checks
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/orders/:id/approve
 * Admin approves order with stock alert
 */
router.put('/:id/approve', authorize('admin', 'owner'), async (req, res) => {
  try {
    const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = orderRes.rows[0];

    // Check stock availability
    const linesRes = await pool.query(`
      SELECT ol.*, i.name AS item_name, i.unit
      FROM order_lines ol
      JOIN items i ON ol.item_id = i.id
      WHERE ol.order_id = $1
    `, [order.id]);

    const warnings = [];
    for (const line of linesRes.rows) {
      const balance = await stockService.getStockBalance(pool, line.item_id);
      const requested = parseFloat(line.qty);
      if (balance < requested) {
        warnings.push({
          itemName: line.item_name,
          requested,
          available: balance,
          shortage: requested - balance,
          unit: line.unit
        });
      }
    }

    await pool.query(
      "UPDATE orders SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [order.id]
    );

    await logAudit(pool, 'orders', order.id, 'update', { status: order.status }, { status: 'approved' }, req.user.id);

    res.json({
      message: 'Order approved successfully',
      warnings: warnings.length > 0 ? warnings : null,
      hasStockShortage: warnings.length > 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/orders/:id/reject
 * Admin rejects order with reason
 */
router.put('/:id/reject', authorize('admin', 'owner'), async (req, res) => {
  try {
    const { reason } = req.body;
    const orderRes = await pool.query(
      "UPDATE orders SET status = 'rejected', rejection_reason = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",
      [reason || 'Rejected by Admin', req.params.id]
    );
    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: 'Order rejected', order: orderRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
