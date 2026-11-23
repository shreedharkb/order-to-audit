const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { logAudit } = require('../middleware/auditLog');
const stockService = require('../services/stockService');

router.use(authenticate);

/**
 * POST /api/purchases
 * Record a raw material / packaging purchase -> raw stock goes up
 */
router.post('/', authorize('admin', 'production', 'owner'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { supplierId, purchaseDate, invoiceNumber, items, notes } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required in a purchase' });
    }

    let totalPaisa = 0;
    const linesToInsert = [];

    for (const it of items) {
      const qty = parseFloat(it.qty);
      const ratePaisa = parseInt(it.ratePaisa, 10);
      const amountPaisa = Math.round(qty * ratePaisa);
      totalPaisa += amountPaisa;

      linesToInsert.push({
        itemId: it.itemId,
        qty,
        unit: it.unit,
        ratePaisa,
        amountPaisa
      });
    }

    const purchaseRes = await client.query(
      `INSERT INTO purchases (supplier_id, purchase_date, invoice_number, total_paisa, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [supplierId || null, purchaseDate || new Date(), invoiceNumber || null, totalPaisa, notes || null, req.user.id]
    );
    const newPurchase = purchaseRes.rows[0];

    for (const line of linesToInsert) {
      await client.query(
        `INSERT INTO purchase_lines (purchase_id, item_id, qty, unit, rate_paisa, amount_paisa)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newPurchase.id, line.itemId, line.qty, line.unit, line.ratePaisa, line.amountPaisa]
      );

      // Stock ledger movement: Inward movement
      await stockService.addStockMovement(client, {
        itemId: line.itemId,
        txnDate: purchaseDate || new Date(),
        txnType: 'purchase',
        txnRefType: 'purchase',
        txnRefId: newPurchase.id,
        qtyIn: line.qty,
        qtyOut: 0,
        unit: line.unit,
        ratePaisa: line.ratePaisa,
        notes: `Purchase from invoice ${invoiceNumber || 'direct'}`,
        createdBy: req.user.id
      });
    }

    await client.query('COMMIT');
    await logAudit(pool, 'purchases', newPurchase.id, 'create', null, newPurchase, req.user.id);

    res.status(201).json({
      message: 'Purchase recorded and raw stock updated',
      purchase: newPurchase
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/purchases
 * List purchases
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, s.name AS supplier_name
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      ORDER BY p.purchase_date DESC, p.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/purchases/:id
 * Purchase detail with lines
 */
router.get('/:id', async (req, res) => {
  try {
    const pRes = await pool.query(`
      SELECT p.*, s.name AS supplier_name, s.gstin AS supplier_gstin
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = $1
    `, [req.params.id]);

    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Purchase not found' });
    const purchase = pRes.rows[0];

    const linesRes = await pool.query(`
      SELECT pl.*, i.name AS item_name
      FROM purchase_lines pl
      JOIN items i ON pl.item_id = i.id
      WHERE pl.purchase_id = $1
    `, [purchase.id]);

    purchase.lines = linesRes.rows;
    res.json(purchase);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
