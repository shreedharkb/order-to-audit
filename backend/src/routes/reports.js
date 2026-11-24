const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const stockService = require('../services/stockService');

router.use(authenticate);

/**
 * GET /api/reports/sales
 * Sales Register with customer-wise and product-wise breakdowns
 */
router.get('/sales', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    let whereClauses = ["i.status = 'active'"];
    let params = [];
    let pIdx = 1;

    if (dateFrom) {
      whereClauses.push(`i.invoice_date >= $${pIdx++}`);
      params.push(dateFrom);
    }
    if (dateTo) {
      whereClauses.push(`i.invoice_date <= $${pIdx++}`);
      params.push(dateTo);
    }

    const whereStr = `WHERE ${whereClauses.join(' AND ')}`;

    // 1. Invoices list
    const invoicesRes = await pool.query(`
      SELECT i.*, c.name AS customer_name, c.state AS customer_state, c.gstin AS customer_gstin
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      ${whereStr}
      ORDER BY i.invoice_date DESC, i.id DESC
    `, params);

    // 2. Customer-wise aggregation
    const custAggRes = await pool.query(`
      SELECT c.name AS customer_name, c.state AS customer_state,
             COUNT(i.id) AS invoice_count,
             SUM(i.subtotal_paisa) AS taxable_paisa,
             SUM(i.cgst_paisa) AS cgst_paisa,
             SUM(i.sgst_paisa) AS sgst_paisa,
             SUM(i.igst_paisa) AS igst_paisa,
             SUM(i.total_paisa) AS total_paisa
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      ${whereStr}
      GROUP BY c.id, c.name, c.state
      ORDER BY total_paisa DESC
    `, params);

    // 3. Product-wise aggregation
    const prodAggRes = await pool.query(`
      SELECT il.description AS item_name, il.hsn_code,
             SUM(il.qty) AS total_qty,
             il.unit,
             SUM(il.taxable_amount_paisa) AS taxable_paisa,
             SUM(il.total_paisa) AS total_paisa
      FROM invoice_lines il
      JOIN invoices i ON il.invoice_id = i.id
      ${whereStr}
      GROUP BY il.description, il.hsn_code, il.unit
      ORDER BY total_paisa DESC
    `, params);

    res.json({
      invoices: invoicesRes.rows,
      customerSummary: custAggRes.rows,
      productSummary: prodAggRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/reports/gst-summary
 * GST Outward Supplies summary matching GSTR-1 / GSTR-3B schedule
 */
router.get('/gst-summary', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    let whereClauses = ["i.status = 'active'"];
    let params = [];
    let pIdx = 1;

    if (dateFrom) {
      whereClauses.push(`i.invoice_date >= $${pIdx++}`);
      params.push(dateFrom);
    }
    if (dateTo) {
      whereClauses.push(`i.invoice_date <= $${pIdx++}`);
      params.push(dateTo);
    }

    const whereStr = `WHERE ${whereClauses.join(' AND ')}`;

    // Group by GST Rate and Supply Type (Intra vs Inter)
    const sql = `
      SELECT 
        il.gst_rate_percent,
        i.is_igst,
        SUM(il.taxable_amount_paisa) AS taxable_amount_paisa,
        SUM(il.cgst_paisa) AS cgst_paisa,
        SUM(il.sgst_paisa) AS sgst_paisa,
        SUM(il.igst_paisa) AS igst_paisa,
        SUM(il.total_paisa) AS total_paisa
      FROM invoice_lines il
      JOIN invoices i ON il.invoice_id = i.id
      ${whereStr}
      GROUP BY il.gst_rate_percent, i.is_igst
      ORDER BY il.gst_rate_percent ASC, i.is_igst ASC
    `;

    const result = await pool.query(sql, params);

    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let grandTotal = 0;

    const rates = result.rows.map(r => {
      const taxable = parseInt(r.taxable_amount_paisa || 0);
      const cgst = parseInt(r.cgst_paisa || 0);
      const sgst = parseInt(r.sgst_paisa || 0);
      const igst = parseInt(r.igst_paisa || 0);
      const tot = parseInt(r.total_paisa || 0);

      totalTaxable += taxable;
      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;
      grandTotal += tot;

      return {
        gstRatePercent: parseFloat(r.gst_rate_percent),
        supplyType: r.is_igst ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)',
        taxableAmountPaisa: taxable,
        cgstPaisa: cgst,
        sgstPaisa: sgst,
        igstPaisa: igst,
        totalTaxPaisa: cgst + sgst + igst,
        totalPaisa: tot
      };
    });

    res.json({
      rates,
      consolidated: {
        totalTaxablePaisa: totalTaxable,
        totalCgstPaisa: totalCgst,
        totalSgstPaisa: totalSgst,
        totalIgstPaisa: totalIgst,
        totalTaxPaisa: totalCgst + totalSgst + totalIgst,
        grandTotalPaisa: grandTotal
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/reports/stock-summary
 */
router.get('/stock-summary', async (req, res) => {
  try {
    const { type } = req.query;
    const summary = await stockService.getStockSummary(pool, type);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/reports/stock-ledger
 */
router.get('/stock-ledger', async (req, res) => {
  try {
    const { itemId, dateFrom, dateTo } = req.query;
    const ledger = await stockService.getStockLedger(pool, itemId, dateFrom, dateTo);
    res.json(ledger);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/reports/production
 * Production Runs variance report
 */
router.get('/production', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    let whereClauses = [];
    let params = [];
    let pIdx = 1;

    if (dateFrom) {
      whereClauses.push(`pr.run_date >= $${pIdx++}`);
      params.push(dateFrom);
    }
    if (dateTo) {
      whereClauses.push(`pr.run_date <= $${pIdx++}`);
      params.push(dateTo);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const runsRes = await pool.query(`
      SELECT pr.*, b.batch_name, i.name AS finished_item_name, i.unit AS finished_item_unit
      FROM production_runs pr
      JOIN bom b ON pr.bom_id = b.id
      JOIN items i ON b.finished_item_id = i.id
      ${whereStr}
      ORDER BY pr.run_date DESC, pr.id DESC
    `, params);

    const runs = runsRes.rows;
    for (const r of runs) {
      const issuesRes = await pool.query(`
        SELECT pi.*, i.name AS item_name, i.type AS item_type
        FROM production_issues pi
        JOIN items i ON pi.item_id = i.id
        WHERE pi.run_id = $1
      `, [r.id]);
      r.issues = issuesRes.rows;
    }

    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/reports/cost-analysis
 * Cost per packet and product margins
 */
router.get('/cost-analysis', async (req, res) => {
  try {
    const sql = `
      SELECT 
        i.id AS item_id,
        i.name AS product_name,
        i.unit,
        i.selling_price_paisa,
        COUNT(pr.id) AS run_count,
        SUM(pr.actual_output) AS total_output,
        SUM(pr.total_material_cost_paisa) AS total_material_paisa,
        SUM(pr.labour_cost_paisa) AS total_labour_paisa,
        SUM(pr.overhead_cost_paisa) AS total_overhead_paisa,
        SUM(pr.total_cost_paisa) AS grand_total_cost_paisa
      FROM items i
      JOIN bom b ON b.finished_item_id = i.id
      JOIN production_runs pr ON pr.bom_id = b.id
      WHERE pr.status = 'completed' AND pr.actual_output > 0
      GROUP BY i.id, i.name, i.unit, i.selling_price_paisa
    `;

    const result = await pool.query(sql);

    const analysis = result.rows.map(r => {
      const output = parseFloat(r.total_output || 0);
      const totalCost = parseInt(r.grand_total_cost_paisa || 0);
      const costPerUnit = output > 0 ? Math.round(totalCost / output) : 0;
      const sellingPrice = parseInt(r.selling_price_paisa || 0);
      const marginPaisa = sellingPrice - costPerUnit;
      const marginPercent = sellingPrice > 0 ? (marginPaisa / sellingPrice) * 100 : 0;

      return {
        itemId: r.item_id,
        productName: r.product_name,
        unit: r.unit,
        totalOutput: output,
        sellingPricePaisa: sellingPrice,
        costPerUnitPaisa: costPerUnit,
        marginPaisa,
        marginPercent: parseFloat(marginPercent.toFixed(2)),
        materialCostPerUnitPaisa: output > 0 ? Math.round(parseInt(r.total_material_paisa || 0) / output) : 0,
        labourCostPerUnitPaisa: output > 0 ? Math.round(parseInt(r.total_labour_paisa || 0) / output) : 0,
        overheadCostPerUnitPaisa: output > 0 ? Math.round(parseInt(r.total_overhead_paisa || 0) / output) : 0
      };
    });

    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/reports/export/:type
 * Excel export for Auditor and Management
 */
router.get('/export/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sri Lakshmi Foods ERP';
    workbook.created = new Date();

    if (type === 'sales') {
      const worksheet = workbook.addWorksheet('Sales Register');
      worksheet.columns = [
        { header: 'Invoice No', key: 'invoice_number', width: 18 },
        { header: 'Date', key: 'invoice_date', width: 14 },
        { header: 'Customer', key: 'customer_name', width: 25 },
        { header: 'State', key: 'customer_state', width: 15 },
        { header: 'GSTIN', key: 'customer_gstin', width: 18 },
        { header: 'Taxable (Rs)', key: 'taxable', width: 15 },
        { header: 'CGST (Rs)', key: 'cgst', width: 12 },
        { header: 'SGST (Rs)', key: 'sgst', width: 12 },
        { header: 'IGST (Rs)', key: 'igst', width: 12 },
        { header: 'Total (Rs)', key: 'total', width: 16 }
      ];

      const invRes = await pool.query(`
        SELECT i.*, c.name AS customer_name, c.state AS customer_state, c.gstin AS customer_gstin
        FROM invoices i
        JOIN customers c ON i.customer_id = c.id
        WHERE i.status = 'active'
        ORDER BY i.invoice_date ASC
      `);

      invRes.rows.forEach(r => {
        worksheet.addRow({
          invoice_number: r.invoice_number,
          invoice_date: new Date(r.invoice_date).toLocaleDateString('en-IN'),
          customer_name: r.customer_name,
          customer_state: r.customer_state,
          customer_gstin: r.customer_gstin || 'Unregistered',
          taxable: (r.subtotal_paisa / 100).toFixed(2),
          cgst: (r.cgst_paisa / 100).toFixed(2),
          sgst: (r.sgst_paisa / 100).toFixed(2),
          igst: (r.igst_paisa / 100).toFixed(2),
          total: (r.total_paisa / 100).toFixed(2)
        });
      });
    } else if (type === 'stock') {
      const worksheet = workbook.addWorksheet('Stock Summary');
      worksheet.columns = [
        { header: 'Item Name', key: 'name', width: 25 },
        { header: 'Category', key: 'type', width: 18 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Current Balance', key: 'balance', width: 18 },
        { header: 'Weighted Avg Rate (Rs)', key: 'rate', width: 22 },
        { header: 'Stock Value (Rs)', key: 'value', width: 18 },
        { header: 'Status', key: 'status', width: 15 }
      ];

      const summary = await stockService.getStockSummary(pool);
      summary.forEach(r => {
        worksheet.addRow({
          name: r.name,
          type: r.type,
          unit: r.unit,
          balance: parseFloat(r.current_balance),
          rate: (r.weighted_avg_rate_paisa / 100).toFixed(2),
          value: (r.stock_value_paisa / 100).toFixed(2),
          status: r.status
        });
      });
    } else {
      // Default general worksheet
      const worksheet = workbook.addWorksheet('Report');
      worksheet.addRow(['Report type', type]);
      worksheet.addRow(['Generated at', new Date().toISOString()]);
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Report_${type}_${new Date().toISOString().slice(0, 10)}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
