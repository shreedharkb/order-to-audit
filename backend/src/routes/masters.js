const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { logAudit } = require('../middleware/auditLog');

router.use(authenticate);

// ==========================================
// ITEMS (Raw Material, Packaging, Finished Goods)
// ==========================================

router.get('/items', async (req, res) => {
  try {
    const { type } = req.query;
    let queryText = 'SELECT * FROM items WHERE is_active = TRUE';
    let params = [];
    if (type) {
      queryText += ' AND type = $1';
      params.push(type);
    }
    queryText += ' ORDER BY type, name';

    const result = await pool.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/items', authorize('admin'), async (req, res) => {
  try {
    const { name, type, unit, hsn_code, gst_rate_percent, selling_price_paisa, reorder_level, description } = req.body;
    const result = await pool.query(
      `INSERT INTO items (name, type, unit, hsn_code, gst_rate_percent, selling_price_paisa, reorder_level, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, type, unit, hsn_code, gst_rate_percent || 0, selling_price_paisa || 0, reorder_level || 0, description]
    );
    await logAudit(pool, 'items', result.rows[0].id, 'create', null, result.rows[0], req.user.id);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// CUSTOMERS (Retailers, Distributors)
// ==========================================

router.get('/customers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customers ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/customers', authorize('admin', 'salesman'), async (req, res) => {
  try {
    const { name, type, gstin, address, city, state, state_code, pincode, phone, email, credit_limit_paisa } = req.body;
    const result = await pool.query(
      `INSERT INTO customers (name, type, gstin, address, city, state, state_code, pincode, phone, email, credit_limit_paisa, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [name, type, gstin, address, city, state, state_code, pincode, phone, email, credit_limit_paisa || 0, req.user.id]
    );
    await logAudit(pool, 'customers', result.rows[0].id, 'create', null, result.rows[0], req.user.id);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// SUPPLIERS
// ==========================================

router.get('/suppliers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM suppliers ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/suppliers', authorize('admin', 'production'), async (req, res) => {
  try {
    const { name, gstin, address, city, state, state_code, phone, email } = req.body;
    const result = await pool.query(
      `INSERT INTO suppliers (name, gstin, address, city, state, state_code, phone, email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, gstin, address, city, state, state_code, phone, email]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// BILL OF MATERIALS (BOM)
// ==========================================

router.get('/bom', async (req, res) => {
  try {
    const bomsRes = await pool.query(`
      SELECT b.*, i.name AS finished_item_name, i.unit AS finished_item_unit
      FROM bom b
      JOIN items i ON b.finished_item_id = i.id
      WHERE b.is_active = TRUE
      ORDER BY i.name
    `);

    const boms = bomsRes.rows;
    for (const b of boms) {
      const linesRes = await pool.query(`
        SELECT bl.*, i.name AS item_name, i.type AS item_type
        FROM bom_lines bl
        JOIN items i ON bl.item_id = i.id
        WHERE bl.bom_id = $1
        ORDER BY i.type, i.name
      `, [b.id]);
      b.lines = linesRes.rows;
    }

    res.json(boms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/bom/:id', async (req, res) => {
  try {
    const bomRes = await pool.query(`
      SELECT b.*, i.name AS finished_item_name, i.unit AS finished_item_unit
      FROM bom b
      JOIN items i ON b.finished_item_id = i.id
      WHERE b.id = $1
    `, [req.params.id]);

    if (bomRes.rows.length === 0) return res.status(404).json({ error: 'BOM not found' });
    const bom = bomRes.rows[0];

    const linesRes = await pool.query(`
      SELECT bl.*, i.name AS item_name, i.type AS item_type
      FROM bom_lines bl
      JOIN items i ON bl.item_id = i.id
      WHERE bl.bom_id = $1
      ORDER BY i.type, i.name
    `, [bom.id]);

    bom.lines = linesRes.rows;
    res.json(bom);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bom', authorize('admin', 'production'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { finished_item_id, batch_name, expected_yield, yield_unit, notes, lines } = req.body;

    const bomRes = await client.query(
      `INSERT INTO bom (finished_item_id, batch_name, expected_yield, yield_unit, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [finished_item_id, batch_name, expected_yield, yield_unit || 'packet', notes]
    );
    const newBom = bomRes.rows[0];

    if (Array.isArray(lines)) {
      for (const line of lines) {
        await client.query(
          `INSERT INTO bom_lines (bom_id, item_id, qty_per_batch, unit)
           VALUES ($1, $2, $3, $4)`,
          [newBom.id, line.item_id, line.qty_per_batch, line.unit]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json(newBom);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
