const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { logAudit } = require('../middleware/auditLog');

router.use(authenticate);

/**
 * POST /api/payments
 * Record a collection from customer against an invoice or on account
 */
router.post('/', authorize('admin', 'owner', 'accountant'), async (req, res) => {
  try {
    const { customerId, invoiceId, amountPaisa, paymentDate, mode, referenceNumber, notes } = req.body;

    if (!customerId || !amountPaisa) {
      return res.status(400).json({ error: 'Customer ID and amount are required' });
    }

    const payRes = await pool.query(`
      INSERT INTO payments (
        customer_id, invoice_id, payment_date, amount_paisa, mode, reference_number, notes, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      customerId,
      invoiceId || null,
      paymentDate || new Date(),
      parseInt(amountPaisa, 10),
      mode || 'cash',
      referenceNumber || null,
      notes || null,
      req.user.id
    ]);

    const payment = payRes.rows[0];
    await logAudit(pool, 'payments', payment.id, 'create', null, payment, req.user.id);

    res.status(201).json({
      message: 'Payment recorded successfully',
      payment
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/payments
 * List payment collections
 */
router.get('/', async (req, res) => {
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

/**
 * GET /api/payments/outstanding
 * Customer receivables with ageing analysis (0-30, 31-60, 61-90, 90+ days)
 */
router.get('/outstanding', async (req, res) => {
  try {
    // 1. Fetch all customers
    const custRes = await pool.query('SELECT id, name, type, gstin, city, state, phone FROM customers ORDER BY name');
    const customers = custRes.rows;

    const report = [];

    for (const cust of customers) {
      // Invoiced total (active invoices only)
      const invRes = await pool.query(`
        SELECT id, invoice_number, invoice_date, total_paisa,
               (CURRENT_DATE - invoice_date) AS age_days
        FROM invoices
        WHERE customer_id = $1 AND status = 'active'
        ORDER BY invoice_date ASC
      `, [cust.id]);

      // Paid total
      const paidRes = await pool.query(`
        SELECT COALESCE(SUM(amount_paisa), 0) AS total_paid
        FROM payments
        WHERE customer_id = $1
      `, [cust.id]);

      let totalInvoiced = 0;
      invRes.rows.forEach(inv => totalInvoiced += parseInt(inv.total_paisa, 10));
      const totalPaid = parseInt(paidRes.rows[0]?.total_paid || 0, 10);
      const outstanding = totalInvoiced - totalPaid;

      // Ageing buckets calculation
      let current0to30 = 0;
      let days31to60 = 0;
      let days61to90 = 0;
      let days90Plus = 0;

      // Unallocated remaining payments applied FIFO to oldest invoices
      let remainingPayment = totalPaid;

      for (const inv of invRes.rows) {
        const invTotal = parseInt(inv.total_paisa, 10);
        let unpaidPortion = 0;

        if (remainingPayment >= invTotal) {
          remainingPayment -= invTotal;
          unpaidPortion = 0;
        } else {
          unpaidPortion = invTotal - remainingPayment;
          remainingPayment = 0;
        }

        if (unpaidPortion > 0) {
          const age = parseInt(inv.age_days || 0, 10);
          if (age <= 30) current0to30 += unpaidPortion;
          else if (age <= 60) days31to60 += unpaidPortion;
          else if (age <= 90) days61to90 += unpaidPortion;
          else days90Plus += unpaidPortion;
        }
      }

      report.push({
        customerId: cust.id,
        customerName: cust.name,
        customerType: cust.type,
        state: cust.state,
        phone: cust.phone,
        totalInvoicedPaisa: totalInvoiced,
        totalPaidPaisa: totalPaid,
        outstandingPaisa: outstanding,
        ageing: {
          current0to30Paisa: current0to30,
          days31to60Paisa: days31to60,
          days61to90Paisa: days61to90,
          days90PlusPaisa: days90Plus
        }
      });
    }

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
