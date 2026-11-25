const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { logAudit } = require('../middleware/auditLog');
const receivablesService = require('../services/receivablesService');

router.use(authenticate);

router.post('/', authorize('admin', 'owner'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { customerId, invoiceId, amountPaisa, paymentDate, mode, referenceNumber, notes } = req.body;
    const amount = Number(amountPaisa);

    if (!customerId || !Number.isInteger(amount) || amount <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Customer ID and a positive integer paisa amount are required' });
    }

    const customerRes = await client.query('SELECT id FROM customers WHERE id = $1 FOR UPDATE', [customerId]);
    if (customerRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Customer not found' });
    }

    if (invoiceId) {
      const invoiceRes = await client.query(
        "SELECT id, customer_id, total_paisa, status FROM invoices WHERE id = $1 FOR UPDATE",
        [invoiceId]
      );
      const invoice = invoiceRes.rows[0];
      if (!invoice) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Invoice not found' });
      }
      if (invoice.customer_id !== customerRes.rows[0].id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invoice does not belong to this customer' });
      }
      if (invoice.status !== 'active') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Cannot collect against a cancelled invoice' });
      }

      const paidRes = await client.query(
        'SELECT COALESCE(SUM(amount_paisa), 0) AS paid FROM payments WHERE invoice_id = $1 AND is_reversed = FALSE',
        [invoice.id]
      );
      const invoicePaid = parseInt(paidRes.rows[0].paid, 10);
      if (invoicePaid + amount > parseInt(invoice.total_paisa, 10)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Payment exceeds the invoice balance' });
      }
    }

    const balanceRes = await client.query(`
      SELECT
        (SELECT COALESCE(SUM(total_paisa), 0) FROM invoices WHERE customer_id = $1 AND status = 'active') AS invoiced,
        (SELECT COALESCE(SUM(amount_paisa), 0) FROM payments WHERE customer_id = $1 AND is_reversed = FALSE) AS paid
    `, [customerId]);
    const outstanding = parseInt(balanceRes.rows[0].invoiced, 10) - parseInt(balanceRes.rows[0].paid, 10);
    if (outstanding <= 0 || amount > outstanding) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Payment exceeds the customer outstanding balance' });
    }

    const payRes = await client.query(`
      INSERT INTO payments (
        customer_id, invoice_id, payment_date, amount_paisa, mode, reference_number, notes, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      customerId,
      invoiceId || null,
      paymentDate || new Date(),
      amount,
      mode || 'cash',
      referenceNumber || null,
      notes || null,
      req.user.id
    ]);

    const payment = payRes.rows[0];
    await logAudit(client, 'payments', payment.id, 'create', null, payment, req.user.id);
    await client.query('COMMIT');

    res.status(201).json({ message: 'Payment recorded successfully', payment });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.get('/', authorize('admin', 'owner', 'accountant'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.name AS customer_name, i.invoice_number, u.full_name AS recorded_by_name
      FROM payments p
      JOIN customers c ON p.customer_id = c.id
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN users u ON p.created_by = u.id
      ORDER BY p.payment_date DESC, p.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/outstanding', authorize('admin', 'owner', 'accountant'), async (req, res) => {
  try {
    res.json(await receivablesService.getOutstandingReport(pool));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
