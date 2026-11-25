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
router.post('/', authorize('salesman', 'admin', 'owner'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { customerId, items, notes } = req.body;

    if (!customerId || !Array.isArray(items) || items.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Customer ID and at least one item are required' });
    }

    const customerRes = await client.query('SELECT id FROM customers WHERE id = $1', [customerId]);
    if (customerRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Customer not found' });
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
      const numQty = Number(qty);
      if (!Number.isFinite(numQty) || numQty <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Every order line needs a positive quantity' });
      }

      const itemRes = await client.query('SELECT * FROM items WHERE id = $1', [itemId]);
      if (!itemRes.rows[0] || itemRes.rows[0].type !== 'finished_good') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Orders can contain only finished goods' });
      }

      // Price lookup: 1. Customer-specific, 2. Default price list, 3. Item master price
      const priceRes = await client.query(
        `SELECT price_paisa FROM price_lists
         WHERE item_id = $1 AND (customer_id = $2 OR customer_id IS NULL)
         ORDER BY customer_id NULLS LAST LIMIT 1`,
        [itemId, customerId]
      );

      const pricePaisa = priceRes.rows.length > 0
        ? parseInt(priceRes.rows[0].price_paisa, 10)
        : parseInt(itemRes.rows[0].selling_price_paisa || 0, 10);
      const amountPaisa = Math.round(numQty * pricePaisa);
      totalPaisa += amountPaisa;

      processedLines.push({
        itemId,
        qty: numQty,
        unit: itemRes.rows[0].unit,
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
        `INSERT INTO order_lines (order_id, item_id, qty, unit, price_paisa, amount_paisa)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newOrder.id, pl.itemId, pl.qty, pl.unit, pl.pricePaisa, pl.amountPaisa]
      );
    }

    await logAudit(client, 'orders', newOrder.id, 'create', null, newOrder, req.user.id);
    await client.query('COMMIT');

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
router.get('/', authorize('salesman', 'admin', 'owner'), async (req, res) => {
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
router.get('/:id', authorize('salesman', 'admin', 'owner'), async (req, res) => {
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
    if (req.user.role === 'salesman' && order.salesman_id !== req.user.id) {
      return res.status(403).json({ error: 'You can view only your own orders' });
    }

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
router.get('/stock-check/:id', authorize('salesman', 'admin', 'owner'), async (req, res) => {
  try {
    const orderRes = await pool.query('SELECT salesman_id FROM orders WHERE id = $1', [req.params.id]);
    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    if (req.user.role === 'salesman' && orderRes.rows[0].salesman_id !== req.user.id) {
      return res.status(403).json({ error: 'You can check only your own orders' });
    }

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
 * PUT /api/orders/:id
 * Admin edits quantities and prices before approval
 */
router.put('/:id', authorize('admin', 'owner'), async (req, res) => {
  const client = await pool.connect();
  const fail = async (status, error) => {
    await client.query('ROLLBACK');
    return res.status(status).json({ error });
  };

  try {
    await client.query('BEGIN');
    const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (orderRes.rows.length === 0) return fail(404, 'Order not found');
    const order = orderRes.rows[0];
    if (order.status !== 'submitted') return fail(400, 'Only submitted orders can be edited');

    const { items, notes } = req.body;
    if (!Array.isArray(items) || items.length === 0) return fail(400, 'At least one order line is required');

    const existingRes = await client.query('SELECT * FROM order_lines WHERE order_id = $1', [order.id]);
    const existingByItem = {};
    existingRes.rows.forEach(line => { existingByItem[line.item_id] = line; });

    let totalPaisa = 0;
    const lines = [];
    const seenItems = new Set();
    for (const item of items) {
      const itemId = Number(item.itemId);
      const qty = Number(item.qty);
      if (seenItems.has(itemId)) return fail(400, 'Duplicate order line item');
      seenItems.add(itemId);
      if (!Number.isFinite(qty) || qty <= 0) return fail(400, 'Every order line needs a positive quantity');

      const itemRes = await client.query('SELECT * FROM items WHERE id = $1', [itemId]);
      if (!itemRes.rows[0] || itemRes.rows[0].type !== 'finished_good') return fail(400, 'Orders can contain only finished goods');

      const requestedPrice = item.pricePaisa === undefined
        ? existingByItem[itemId]?.price_paisa
        : Number(item.pricePaisa);
      const pricePaisa = requestedPrice === undefined
        ? parseInt(itemRes.rows[0].selling_price_paisa || 0, 10)
        : requestedPrice;
      if (!Number.isInteger(pricePaisa) || pricePaisa < 0) return fail(400, 'Price must be a non-negative integer paisa amount');

      const amountPaisa = Math.round(qty * pricePaisa);
      totalPaisa += amountPaisa;
      lines.push({ itemId, qty, unit: itemRes.rows[0].unit, pricePaisa, amountPaisa });
    }

    await client.query('DELETE FROM order_lines WHERE order_id = $1', [order.id]);
    for (const line of lines) {
      await client.query(
        'INSERT INTO order_lines (order_id, item_id, qty, unit, price_paisa, amount_paisa) VALUES ($1, $2, $3, $4, $5, $6)',
        [order.id, line.itemId, line.qty, line.unit, line.pricePaisa, line.amountPaisa]
      );
    }

    const updated = await client.query(
      'UPDATE orders SET total_paisa = $1, notes = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [totalPaisa, notes === undefined ? order.notes : notes, order.id]
    );
    await logAudit(client, 'orders', order.id, 'update', { ...order, lines: existingRes.rows }, { ...updated.rows[0], lines }, req.user.id);
    await client.query('COMMIT');

    res.json({ message: 'Order updated', order: updated.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/orders/:id/approve
 * Admin approves order with stock alert
 */
router.put('/:id/approve', authorize('admin', 'owner'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = orderRes.rows[0];
    if (order.status !== 'submitted') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Only submitted orders can be approved' });
    }

    const linesRes = await client.query(`
      SELECT ol.*, i.name AS item_name, i.unit
      FROM order_lines ol
      JOIN items i ON ol.item_id = i.id
      WHERE ol.order_id = $1
    `, [order.id]);

    const warnings = [];
    for (const line of linesRes.rows) {
      const balance = await stockService.getStockBalance(client, line.item_id);
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

    await client.query(
      "UPDATE orders SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [order.id]
    );
    await logAudit(client, 'orders', order.id, 'update', { status: order.status }, { status: 'approved' }, req.user.id);
    await client.query('COMMIT');

    res.json({
      message: 'Order approved successfully',
      warnings: warnings.length > 0 ? warnings : null,
      hasStockShortage: warnings.length > 0
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/orders/:id/reject
 * Admin rejects order with reason
 */
router.put('/:id/reject', authorize('admin', 'owner'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { reason } = req.body;
    const orderRes = await client.query(
      "UPDATE orders SET status = 'rejected', rejection_reason = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND status = 'submitted' RETURNING *",
      [reason || 'Rejected by Admin', req.params.id]
    );
    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Only submitted orders can be rejected' });
    }
    await logAudit(client, 'orders', orderRes.rows[0].id, 'update', { status: 'submitted' }, orderRes.rows[0], req.user.id);
    await client.query('COMMIT');
    res.json({ message: 'Order rejected', order: orderRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
