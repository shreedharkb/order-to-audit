const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { logAudit } = require('../middleware/auditLog');
const stockService = require('../services/stockService');
const unitService = require('../services/unitService');

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
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'At least one item is required in a purchase' });
    }

    if (supplierId) {
      const supplierRes = await client.query('SELECT id FROM suppliers WHERE id = $1', [supplierId]);
      if (supplierRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Supplier not found' });
      }
    }

    let totalPaisa = 0;
    const linesToInsert = [];
    const seenItems = new Set();

    for (const it of items) {
      const itemId = Number(it.itemId);
      const qty = Number(it.qty);
      const ratePaisa = Number(it.ratePaisa);
      if (seenItems.has(itemId)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Duplicate purchase line item' });
      }
      seenItems.add(itemId);
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(ratePaisa) || ratePaisa < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Purchase quantities must be positive and rates non-negative integer paisa' });
      }

      const itemRes = await client.query('SELECT * FROM items WHERE id = $1 FOR UPDATE', [itemId]);
      const item = itemRes.rows[0];
      if (!item || !['raw_material', 'packaging'].includes(item.type)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Purchases can contain only raw materials and packaging' });
      }

      let normalizedQty;
      try {
        normalizedQty = unitService.normalizeQuantity(qty, it.unit || item.unit, item.unit);
      } catch (unitErr) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: unitErr.message });
      }

      const amountPaisa = Math.round(normalizedQty * ratePaisa);
      totalPaisa += amountPaisa;
      linesToInsert.push({
        itemId,
        qty: normalizedQty,
        unit: item.unit,
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

    await logAudit(client, 'purchases', newPurchase.id, 'create', null, newPurchase, req.user.id);
    await client.query('COMMIT');

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
router.get('/', authorize('admin', 'production', 'owner', 'accountant'), async (req, res) => {
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
router.get('/:id', authorize('admin', 'production', 'owner', 'accountant'), async (req, res) => {
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
