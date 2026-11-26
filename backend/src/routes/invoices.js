const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { logAudit } = require('../middleware/auditLog');
const gstService = require('../services/gstService');
const stockService = require('../services/stockService');
const pdfService = require('../services/pdfService');

router.use(authenticate);

/**
 * POST /api/invoices
 * Raise GST Invoice from Approved Order
 */
router.post('/', authorize('admin', 'owner'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { orderId } = req.body;

    const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = orderRes.rows[0];

    if (order.status !== 'approved') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Cannot invoice order with status '${order.status}'. Order must be 'approved'.` });
    }

    // Company state
    const companyStateRes = await client.query("SELECT value FROM settings WHERE key = 'company_state_code'");
    const companyStateCode = companyStateRes.rows[0]?.value || '33'; // Tamil Nadu = 33

    // Customer details
    const customerRes = await client.query('SELECT * FROM customers WHERE id = $1', [order.customer_id]);
    const customer = customerRes.rows[0];
    if (!customer) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Customer not found' });
    }

    const isIGST = gstService.isInterState(companyStateCode, customer.state_code);
    const invoiceNumber = await gstService.generateInvoiceNumber(client);

    // Fetch order lines
    const linesRes = await client.query(`
      SELECT ol.*, i.name AS item_name, i.hsn_code, i.gst_rate_percent, i.unit
      FROM order_lines ol
      JOIN items i ON ol.item_id = i.id
      WHERE ol.order_id = $1
    `, [order.id]);

    if (linesRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot invoice an order without line items' });
    }

    let subtotalPaisa = 0;
    let cgstTotalPaisa = 0;
    let sgstTotalPaisa = 0;
    let igstTotalPaisa = 0;

    const invoiceLinesData = [];

    for (const line of linesRes.rows) {
      const taxable = line.amount_paisa;
      const gstCalc = gstService.calculateGST({
        taxableAmountPaisa: taxable,
        gstRatePercent: line.gst_rate_percent,
        isIGST
      });

      subtotalPaisa += gstCalc.taxableAmountPaisa;
      cgstTotalPaisa += gstCalc.cgstPaisa;
      sgstTotalPaisa += gstCalc.sgstPaisa;
      igstTotalPaisa += gstCalc.igstPaisa;

      invoiceLinesData.push({
        itemId: line.item_id,
        description: line.item_name,
        hsnCode: line.hsn_code,
        qty: line.qty,
        unit: line.unit,
        ratePaisa: line.price_paisa,
        taxableAmountPaisa: gstCalc.taxableAmountPaisa,
        gstRatePercent: gstCalc.gstRatePercent,
        cgstPercent: gstCalc.cgstPercent,
        cgstPaisa: gstCalc.cgstPaisa,
        sgstPercent: gstCalc.sgstPercent,
        sgstPaisa: gstCalc.sgstPaisa,
        igstPercent: gstCalc.igstPercent,
        igstPaisa: gstCalc.igstPaisa,
        totalPaisa: gstCalc.totalPaisa
      });
    }

    const totalTaxPaisa = cgstTotalPaisa + sgstTotalPaisa + igstTotalPaisa;
    const grandTotalPaisa = subtotalPaisa + totalTaxPaisa;

    // Insert Invoice
    const invoiceRes = await client.query(`
      INSERT INTO invoices (
        invoice_number, invoice_date, order_id, customer_id,
        place_of_supply_state, place_of_supply_code, is_igst,
        subtotal_paisa, cgst_paisa, sgst_paisa, igst_paisa, total_tax_paisa, total_paisa,
        status, created_by
      )
      VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active', $13)
      RETURNING *
    `, [
      invoiceNumber,
      order.id,
      order.customer_id,
      customer.state,
      customer.state_code,
      isIGST,
      subtotalPaisa,
      cgstTotalPaisa,
      sgstTotalPaisa,
      igstTotalPaisa,
      totalTaxPaisa,
      grandTotalPaisa,
      req.user.id
    ]);

    const newInvoice = invoiceRes.rows[0];

    // Insert Invoice Lines
    for (const il of invoiceLinesData) {
      await client.query(`
        INSERT INTO invoice_lines (
          invoice_id, item_id, description, hsn_code, qty, unit,
          rate_paisa, taxable_amount_paisa, gst_rate_percent,
          cgst_percent, cgst_paisa, sgst_percent, sgst_paisa,
          igst_percent, igst_paisa, total_paisa
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        newInvoice.id, il.itemId, il.description, il.hsnCode, il.qty, il.unit,
        il.ratePaisa, il.taxableAmountPaisa, il.gstRatePercent,
        il.cgstPercent, il.cgstPaisa, il.sgstPercent, il.sgstPaisa,
        il.igstPercent, il.igstPaisa, il.totalPaisa
      ]);
    }

    // Update Order Status
    await client.query("UPDATE orders SET status = 'invoiced', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [order.id]);

    await logAudit(client, 'invoices', newInvoice.id, 'create', null, newInvoice, req.user.id);
    await client.query('COMMIT');

    res.status(201).json(newInvoice);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/invoices
 * List all invoices
 */
router.get('/', authorize('admin', 'owner', 'accountant'), async (req, res) => {
  try {
    const { status } = req.query;
    let queryText = `
      SELECT i.*, c.name AS customer_name, c.state AS customer_state
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
    `;
    const params = [];
    if (status) {
      queryText += ' WHERE i.status = $1';
      params.push(status);
    }
    queryText += ' ORDER BY i.created_at DESC';

    const result = await pool.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/invoices/:id
 * Invoice detail with lines
 */
router.get('/:id', authorize('admin', 'owner', 'accountant'), async (req, res) => {
  try {
    const invRes = await pool.query(`
      SELECT i.*, c.name AS customer_name, c.gstin AS customer_gstin, c.address AS customer_address,
             c.city AS customer_city, c.state AS customer_state, c.state_code AS customer_state_code,
             c.phone AS customer_phone
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.id = $1
    `, [req.params.id]);

    if (invRes.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    const invoice = invRes.rows[0];

    const linesRes = await pool.query('SELECT * FROM invoice_lines WHERE invoice_id = $1 ORDER BY id', [invoice.id]);
    invoice.lines = linesRes.rows;

    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/invoices/:id/dispatch
 * Dispatch goods -> finished-goods stock goes down
 */
router.post('/:id/dispatch', authorize('admin', 'owner'), async (req, res) => {
  const client = await pool.connect();
  const fail = async (status, error) => {
    await client.query('ROLLBACK');
    return res.status(status).json({ error });
  };

  try {
    await client.query('BEGIN');
    const invoiceId = req.params.id;

    const invRes = await client.query('SELECT * FROM invoices WHERE id = $1 FOR UPDATE', [invoiceId]);
    if (invRes.rows.length === 0) return fail(404, 'Invoice not found');
    const invoice = invRes.rows[0];

    if (invoice.status !== 'active') return fail(400, 'Cancelled invoices cannot be dispatched');
    if (invoice.is_dispatched) return fail(400, 'Invoice has already been marked as dispatched');

    const linesRes = await client.query('SELECT * FROM invoice_lines WHERE invoice_id = $1', [invoice.id]);
    if (linesRes.rows.length === 0) return fail(400, 'Invoice has no line items');

    for (const line of linesRes.rows) {
      await client.query('SELECT id FROM items WHERE id = $1 FOR UPDATE', [line.item_id]);
      const balance = await stockService.getStockBalance(client, line.item_id);
      if (balance < parseFloat(line.qty)) {
        return fail(400, `Insufficient stock for invoice ${invoice.invoice_number}: ${balance} ${line.unit} available, ${line.qty} ${line.unit} required`);
      }
    }

    for (const line of linesRes.rows) {
      const ratePaisa = await stockService.getWeightedAvgCost(client, line.item_id);
      await stockService.addStockMovement(client, {
        itemId: line.item_id,
        txnDate: new Date(),
        txnType: 'sale_dispatch',
        txnRefType: 'invoice',
        txnRefId: invoice.id,
        qtyIn: 0,
        qtyOut: line.qty,
        unit: line.unit,
        ratePaisa,
        notes: `Dispatch for Invoice ${invoice.invoice_number}`,
        createdBy: req.user.id
      });
    }

    await client.query(
      "UPDATE invoices SET is_dispatched = TRUE, dispatch_date = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [invoice.id]
    );

    if (invoice.order_id) {
      await client.query(
        "UPDATE orders SET status = 'dispatched', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [invoice.order_id]
      );
    }

    await logAudit(client, 'invoices', invoice.id, 'update', { is_dispatched: false }, { is_dispatched: true }, req.user.id);
    await client.query('COMMIT');

    res.json({ message: 'Invoice dispatched and finished goods stock deducted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/invoices/:id/pdf
 * Download GST invoice as PDF
 */
router.get('/:id/pdf', authorize('admin', 'owner', 'accountant'), async (req, res) => {
  try {
    const invRes = await pool.query(`
      SELECT i.*, c.name AS customer_name, c.gstin AS customer_gstin, c.address AS customer_address,
             c.city AS customer_city, c.state AS customer_state, c.state_code AS customer_state_code,
             c.phone AS customer_phone
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.id = $1
    `, [req.params.id]);

    if (invRes.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    const invoice = invRes.rows[0];

    const linesRes = await pool.query('SELECT * FROM invoice_lines WHERE invoice_id = $1 ORDER BY id', [invoice.id]);

    // Fetch company settings
    const settingsRes = await pool.query("SELECT key, value FROM settings WHERE key LIKE 'company_%'");
    const company = {};
    settingsRes.rows.forEach(r => {
      const field = r.key.replace('company_', '');
      company[field] = r.value;
    });

    const pdfBuffer = await pdfService.generateInvoicePDF({
      company,
      customer: {
        name: invoice.customer_name,
        gstin: invoice.customer_gstin,
        address: invoice.customer_address,
        city: invoice.customer_city,
        state: invoice.customer_state,
        state_code: invoice.customer_state_code,
        phone: invoice.customer_phone
      },
      invoice,
      lines: linesRes.rows,
      totals: {
        subtotal_paisa: invoice.subtotal_paisa,
        cgst_paisa: invoice.cgst_paisa,
        sgst_paisa: invoice.sgst_paisa,
        igst_paisa: invoice.igst_paisa,
        total_paisa: invoice.total_paisa
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice_${invoice.invoice_number.replace(/\//g, '_')}.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/invoices/:id/cancel
 * Cancel invoice via audit trail (never delete)
 */
router.post('/:id/cancel', authorize('admin', 'owner'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { reason } = req.body;
    const invRes = await client.query('SELECT * FROM invoices WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (invRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invoice not found' });
    }
    const invoice = invRes.rows[0];
    if (invoice.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only active invoices can be cancelled' });
    }

    if (invoice.is_dispatched) {
      const movements = await client.query(
        "SELECT * FROM stock_ledger WHERE txn_ref_type = 'invoice' AND txn_ref_id = $1 AND txn_type = 'sale_dispatch'",
        [invoice.id]
      );
      for (const movement of movements.rows) {
        await stockService.addStockMovement(client, {
          itemId: movement.item_id,
          txnDate: new Date(),
          txnType: 'sale_return',
          txnRefType: 'invoice',
          txnRefId: invoice.id,
          qtyIn: movement.qty_out,
          qtyOut: 0,
          unit: movement.unit,
          ratePaisa: movement.rate_paisa,
          notes: `Stock reversed for credit note on ${invoice.invoice_number}`,
          createdBy: req.user.id
        });
      }
    }

    await client.query('UPDATE payments SET is_reversed = TRUE WHERE invoice_id = $1', [invoice.id]);
    const creditNoteNumber = await gstService.generateCreditNoteNumber(client);

    const cancelled = await client.query(
      `UPDATE invoices
       SET status = 'cancelled', cancelled_reason = $1, cancelled_at = CURRENT_TIMESTAMP,
           credit_note_number = $2, is_dispatched = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [reason || 'Cancelled by Admin', creditNoteNumber, invoice.id]
    );

    if (invoice.order_id) {
      await client.query("UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [invoice.order_id]);
    }

    await logAudit(client, 'invoices', invoice.id, 'cancel', invoice, cancelled.rows[0], req.user.id);
    await client.query('COMMIT');
    res.json({ message: 'Invoice cancelled with credit note and any dispatched stock reversed', invoice: cancelled.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
