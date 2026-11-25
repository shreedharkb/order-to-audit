const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const stockService = require('../services/stockService');
const receivablesService = require('../services/receivablesService');

const financeRoles = ['admin', 'owner', 'accountant'];
const operationsReadRoles = [...financeRoles, 'production'];

router.use(authenticate);

const addDateFilters = (column, dateFrom, dateTo, params) => {
  const clauses = [];
  if (dateFrom) {
    clauses.push(`${column} >= $${params.length + 1}`);
    params.push(dateFrom);
  }
  if (dateTo) {
    clauses.push(`${column} <= $${params.length + 1}`);
    params.push(dateTo);
  }
  return clauses;
};

const rupees = paisa => Number(paisa || 0) / 100;

const getSalesReport = async (dateFrom, dateTo) => {
  const params = [];
  const whereClauses = ["i.status = 'active'", ...addDateFilters('i.invoice_date', dateFrom, dateTo, params)];
  const whereStr = `WHERE ${whereClauses.join(' AND ')}`;

  const invoicesRes = await pool.query(`
    SELECT i.*, c.name AS customer_name, c.state AS customer_state, c.gstin AS customer_gstin
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    ${whereStr}
    ORDER BY i.invoice_date DESC, i.id DESC
  `, params);

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

  return {
    invoices: invoicesRes.rows,
    customerSummary: custAggRes.rows,
    productSummary: prodAggRes.rows
  };
};

const getGstSummary = async (dateFrom, dateTo) => {
  const params = [];
  const whereClauses = ["i.status = 'active'", ...addDateFilters('i.invoice_date', dateFrom, dateTo, params)];
  const result = await pool.query(`
    SELECT il.gst_rate_percent, i.is_igst,
           SUM(il.taxable_amount_paisa) AS taxable_amount_paisa,
           SUM(il.cgst_paisa) AS cgst_paisa,
           SUM(il.sgst_paisa) AS sgst_paisa,
           SUM(il.igst_paisa) AS igst_paisa,
           SUM(il.total_paisa) AS total_paisa
    FROM invoice_lines il
    JOIN invoices i ON il.invoice_id = i.id
    WHERE ${whereClauses.join(' AND ')}
    GROUP BY il.gst_rate_percent, i.is_igst
    ORDER BY il.gst_rate_percent ASC, i.is_igst ASC
  `, params);

  const consolidated = {
    totalTaxablePaisa: 0,
    totalCgstPaisa: 0,
    totalSgstPaisa: 0,
    totalIgstPaisa: 0,
    totalTaxPaisa: 0,
    grandTotalPaisa: 0
  };

  const rates = result.rows.map(row => {
    const taxableAmountPaisa = parseInt(row.taxable_amount_paisa || 0, 10);
    const cgstPaisa = parseInt(row.cgst_paisa || 0, 10);
    const sgstPaisa = parseInt(row.sgst_paisa || 0, 10);
    const igstPaisa = parseInt(row.igst_paisa || 0, 10);
    const totalPaisa = parseInt(row.total_paisa || 0, 10);
    const totalTaxPaisa = cgstPaisa + sgstPaisa + igstPaisa;

    consolidated.totalTaxablePaisa += taxableAmountPaisa;
    consolidated.totalCgstPaisa += cgstPaisa;
    consolidated.totalSgstPaisa += sgstPaisa;
    consolidated.totalIgstPaisa += igstPaisa;
    consolidated.totalTaxPaisa += totalTaxPaisa;
    consolidated.grandTotalPaisa += totalPaisa;

    return {
      gstRatePercent: parseFloat(row.gst_rate_percent),
      supplyType: row.is_igst ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)',
      taxableAmountPaisa,
      cgstPaisa,
      sgstPaisa,
      igstPaisa,
      totalTaxPaisa,
      totalPaisa
    };
  });

  return { rates, consolidated };
};

const getProductionReport = async (dateFrom, dateTo) => {
  const params = [];
  const whereClauses = addDateFilters('pr.run_date', dateFrom, dateTo, params);
  const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const runsRes = await pool.query(`
    SELECT pr.*, b.batch_name, i.name AS finished_item_name, i.unit AS finished_item_unit
    FROM production_runs pr
    JOIN bom b ON pr.bom_id = b.id
    JOIN items i ON b.finished_item_id = i.id
    ${whereStr}
    ORDER BY pr.run_date DESC, pr.id DESC
  `, params);

  const toleranceRes = await pool.query("SELECT value FROM settings WHERE key = 'variance_tolerance_percent'");
  const tolerance = parseFloat(toleranceRes.rows[0]?.value || 3);
  const runs = runsRes.rows;

  for (const run of runs) {
    const issuesRes = await pool.query(`
      SELECT pi.*, i.name AS item_name, i.type AS item_type
      FROM production_issues pi
      JOIN items i ON pi.item_id = i.id
      WHERE pi.run_id = $1
      ORDER BY i.type, i.name
    `, [run.id]);
    run.issues = issuesRes.rows.map(issue => ({
      ...issue,
      is_flagged: Math.abs(parseFloat(issue.variance_percent || 0)) > tolerance
    }));
  }

  return runs;
};

const getCostAnalysis = async (dateFrom, dateTo) => {
  const params = [];
  const whereClauses = ["pr.status = 'completed'", 'pr.actual_output > 0', ...addDateFilters('pr.run_date', dateFrom, dateTo, params)];
  const result = await pool.query(`
    SELECT i.id AS item_id, i.name AS product_name, i.unit, i.selling_price_paisa,
           COUNT(pr.id) AS run_count,
           SUM(pr.actual_output) AS total_output,
           SUM(pr.total_material_cost_paisa) AS total_material_paisa,
           SUM(pr.labour_cost_paisa) AS total_labour_paisa,
           SUM(pr.overhead_cost_paisa) AS total_overhead_paisa,
           SUM(pr.total_cost_paisa) AS grand_total_cost_paisa
    FROM items i
    JOIN bom b ON b.finished_item_id = i.id
    JOIN production_runs pr ON pr.bom_id = b.id
    WHERE ${whereClauses.join(' AND ')}
    GROUP BY i.id, i.name, i.unit, i.selling_price_paisa
  `, params);

  return result.rows.map(row => {
    const output = parseFloat(row.total_output || 0);
    const totalCost = parseInt(row.grand_total_cost_paisa || 0, 10);
    const costPerUnit = output > 0 ? Math.round(totalCost / output) : 0;
    const sellingPrice = parseInt(row.selling_price_paisa || 0, 10);
    const marginPaisa = sellingPrice - costPerUnit;
    const marginPercent = sellingPrice > 0 ? (marginPaisa / sellingPrice) * 100 : 0;

    return {
      itemId: row.item_id,
      productName: row.product_name,
      unit: row.unit,
      totalOutput: output,
      sellingPricePaisa: sellingPrice,
      costPerUnitPaisa: costPerUnit,
      marginPaisa,
      marginPercent: parseFloat(marginPercent.toFixed(2)),
      materialCostPerUnitPaisa: output > 0 ? Math.round(parseInt(row.total_material_paisa || 0) / output) : 0,
      labourCostPerUnitPaisa: output > 0 ? Math.round(parseInt(row.total_labour_paisa || 0) / output) : 0,
      overheadCostPerUnitPaisa: output > 0 ? Math.round(parseInt(row.total_overhead_paisa || 0) / output) : 0
    };
  });
};

const getPurchaseRows = async (dateFrom, dateTo) => {
  const params = [];
  const whereClauses = addDateFilters('p.purchase_date', dateFrom, dateTo, params);
  const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const result = await pool.query(`
    SELECT p.id AS purchase_id, p.purchase_date, p.invoice_number,
           s.name AS supplier_name, pl.item_id, i.name AS item_name,
           pl.qty, pl.unit, pl.rate_paisa, pl.amount_paisa
    FROM purchases p
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    JOIN purchase_lines pl ON pl.purchase_id = p.id
    JOIN items i ON i.id = pl.item_id
    ${whereStr}
    ORDER BY p.purchase_date, p.id, pl.id
  `, params);
  return result.rows;
};

const getCollectionRows = async (dateFrom, dateTo) => {
  const params = [];
  const whereClauses = addDateFilters('p.payment_date', dateFrom, dateTo, params);
  const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const result = await pool.query(`
    SELECT p.*, c.name AS customer_name, i.invoice_number, u.full_name AS recorded_by_name
    FROM payments p
    JOIN customers c ON c.id = p.customer_id
    LEFT JOIN invoices i ON i.id = p.invoice_id
    LEFT JOIN users u ON u.id = p.created_by
    ${whereStr}
    ORDER BY p.payment_date, p.id
  `, params);
  return result.rows;
};

const addWorksheet = (workbook, name, columns, rows) => {
  const worksheet = workbook.addWorksheet(name);
  worksheet.columns = columns;
  rows.forEach(row => worksheet.addRow(row));
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  return worksheet;
};

router.get('/sales', authorize(...financeRoles), async (req, res) => {
  try {
    res.json(await getSalesReport(req.query.dateFrom, req.query.dateTo));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/gst-summary', authorize(...financeRoles), async (req, res) => {
  try {
    res.json(await getGstSummary(req.query.dateFrom, req.query.dateTo));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stock-summary', authorize(...operationsReadRoles), async (req, res) => {
  try {
    res.json(await stockService.getStockSummary(pool, req.query.type));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stock-ledger', authorize(...operationsReadRoles), async (req, res) => {
  try {
    res.json(await stockService.getStockLedger(pool, req.query.itemId, req.query.dateFrom, req.query.dateTo));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/production', authorize(...operationsReadRoles), async (req, res) => {
  try {
    res.json(await getProductionReport(req.query.dateFrom, req.query.dateTo));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cost-analysis', authorize(...operationsReadRoles), async (req, res) => {
  try {
    res.json(await getCostAnalysis(req.query.dateFrom, req.query.dateTo));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/purchases', authorize(...financeRoles), async (req, res) => {
  try {
    res.json(await getPurchaseRows(req.query.dateFrom, req.query.dateTo));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/collections', authorize(...financeRoles), async (req, res) => {
  try {
    res.json(await getCollectionRows(req.query.dateFrom, req.query.dateTo));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const authorizeReportExport = (req, res, next) => {
  const operationalReports = ['stock', 'stock-ledger', 'production', 'cost'];
  const roles = operationalReports.includes(req.params.type) ? operationsReadRoles : financeRoles;
  return authorize(...roles)(req, res, next);
};

router.get('/export/:type', authorizeReportExport, async (req, res) => {
  try {
    const { type } = req.params;
    const supportedTypes = ['sales', 'gst', 'stock', 'stock-ledger', 'production', 'purchases', 'collections', 'outstanding', 'cost'];
    if (!supportedTypes.includes(type)) return res.status(400).json({ error: 'Unsupported report type' });

    const { dateFrom, dateTo, itemId } = req.query;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sri Lakshmi Foods ERP';
    workbook.created = new Date();

    if (type === 'sales') {
      const report = await getSalesReport(dateFrom, dateTo);
      addWorksheet(workbook, 'Sales Register', [
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
      ], report.invoices.map(row => ({
        invoice_number: row.invoice_number,
        invoice_date: row.invoice_date,
        customer_name: row.customer_name,
        customer_state: row.customer_state,
        customer_gstin: row.customer_gstin || 'Unregistered',
        taxable: rupees(row.subtotal_paisa),
        cgst: rupees(row.cgst_paisa),
        sgst: rupees(row.sgst_paisa),
        igst: rupees(row.igst_paisa),
        total: rupees(row.total_paisa)
      })));
      addWorksheet(workbook, 'Customer Summary', [
        { header: 'Customer', key: 'customer_name', width: 25 },
        { header: 'State', key: 'customer_state', width: 15 },
        { header: 'Invoices', key: 'invoice_count', width: 12 },
        { header: 'Taxable (Rs)', key: 'taxable', width: 15 },
        { header: 'CGST (Rs)', key: 'cgst', width: 12 },
        { header: 'SGST (Rs)', key: 'sgst', width: 12 },
        { header: 'IGST (Rs)', key: 'igst', width: 12 },
        { header: 'Total (Rs)', key: 'total', width: 16 }
      ], report.customerSummary.map(row => ({
        customer_name: row.customer_name,
        customer_state: row.customer_state,
        invoice_count: parseInt(row.invoice_count, 10),
        taxable: rupees(row.taxable_paisa),
        cgst: rupees(row.cgst_paisa),
        sgst: rupees(row.sgst_paisa),
        igst: rupees(row.igst_paisa),
        total: rupees(row.total_paisa)
      })));
      addWorksheet(workbook, 'Product Summary', [
        { header: 'Product', key: 'item_name', width: 25 },
        { header: 'HSN', key: 'hsn_code', width: 12 },
        { header: 'Quantity', key: 'total_qty', width: 12 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Taxable (Rs)', key: 'taxable', width: 15 },
        { header: 'Total (Rs)', key: 'total', width: 16 }
      ], report.productSummary.map(row => ({
        item_name: row.item_name,
        hsn_code: row.hsn_code,
        total_qty: parseFloat(row.total_qty),
        unit: row.unit,
        taxable: rupees(row.taxable_paisa),
        total: rupees(row.total_paisa)
      })));
    } else if (type === 'gst') {
      const report = await getGstSummary(dateFrom, dateTo);
      addWorksheet(workbook, 'GST Outward Supplies', [
        { header: 'Rate %', key: 'gstRatePercent', width: 10 },
        { header: 'Supply Type', key: 'supplyType', width: 25 },
        { header: 'Taxable (Rs)', key: 'taxable', width: 15 },
        { header: 'CGST (Rs)', key: 'cgst', width: 12 },
        { header: 'SGST (Rs)', key: 'sgst', width: 12 },
        { header: 'IGST (Rs)', key: 'igst', width: 12 },
        { header: 'Total Tax (Rs)', key: 'tax', width: 15 },
        { header: 'Gross (Rs)', key: 'total', width: 15 }
      ], report.rates.map(row => ({
        gstRatePercent: row.gstRatePercent,
        supplyType: row.supplyType,
        taxable: rupees(row.taxableAmountPaisa),
        cgst: rupees(row.cgstPaisa),
        sgst: rupees(row.sgstPaisa),
        igst: rupees(row.igstPaisa),
        tax: rupees(row.totalTaxPaisa),
        total: rupees(row.totalPaisa)
      })));
    } else if (type === 'stock') {
      const summary = await stockService.getStockSummary(pool);
      addWorksheet(workbook, 'Stock Summary', [
        { header: 'Item Name', key: 'name', width: 25 },
        { header: 'Category', key: 'type', width: 18 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Current Balance', key: 'balance', width: 18 },
        { header: 'Weighted Avg Rate (Rs)', key: 'rate', width: 22 },
        { header: 'Stock Value (Rs)', key: 'value', width: 18 },
        { header: 'Status', key: 'status', width: 15 }
      ], summary.map(row => ({
        name: row.name,
        type: row.type,
        unit: row.unit,
        balance: row.current_balance,
        rate: rupees(row.weighted_avg_rate_paisa),
        value: rupees(row.stock_value_paisa),
        status: row.status
      })));
    } else if (type === 'stock-ledger') {
      const ledger = await stockService.getStockLedger(pool, itemId, dateFrom, dateTo);
      addWorksheet(workbook, 'Stock Ledger', [
        { header: 'Date', key: 'txn_date', width: 14 },
        { header: 'Item', key: 'item_name', width: 25 },
        { header: 'Type', key: 'item_type', width: 18 },
        { header: 'Movement', key: 'txn_type', width: 20 },
        { header: 'Source Type', key: 'txn_ref_type', width: 18 },
        { header: 'Source ID', key: 'txn_ref_id', width: 12 },
        { header: 'Qty In', key: 'qty_in', width: 12 },
        { header: 'Qty Out', key: 'qty_out', width: 12 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Rate (Rs)', key: 'rate', width: 12 },
        { header: 'Running Balance', key: 'running_balance', width: 18 }
      ], ledger.map(row => ({
        txn_date: row.txn_date,
        item_name: row.item_name,
        item_type: row.item_type,
        txn_type: row.txn_type,
        txn_ref_type: row.txn_ref_type,
        txn_ref_id: row.txn_ref_id,
        qty_in: parseFloat(row.qty_in),
        qty_out: parseFloat(row.qty_out),
        unit: row.unit,
        rate: rupees(row.rate_paisa),
        running_balance: row.running_balance
      })));
    } else if (type === 'production') {
      const runs = await getProductionReport(dateFrom, dateTo);
      const materialRows = runs.flatMap(run => run.issues.map(issue => ({
        batch: run.batch_number,
        date: run.run_date,
        product: run.finished_item_name,
        material: issue.item_name,
        planned: parseFloat(issue.planned_qty),
        actual: parseFloat(issue.actual_qty),
        unit: issue.unit,
        varianceQty: parseFloat(issue.variance_qty),
        variancePercent: parseFloat(issue.variance_percent),
        flagged: issue.is_flagged ? 'YES' : ''
      })));
      addWorksheet(workbook, 'Material Usage', [
        { header: 'Batch', key: 'batch', width: 18 },
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Product', key: 'product', width: 25 },
        { header: 'Material', key: 'material', width: 25 },
        { header: 'Planned Qty', key: 'planned', width: 14 },
        { header: 'Actual Qty', key: 'actual', width: 14 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Variance Qty', key: 'varianceQty', width: 14 },
        { header: 'Variance %', key: 'variancePercent', width: 14 },
        { header: 'Flagged', key: 'flagged', width: 12 }
      ], materialRows);
      addWorksheet(workbook, 'Production Runs', [
        { header: 'Batch', key: 'batch', width: 18 },
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Product', key: 'product', width: 25 },
        { header: 'Expected Output', key: 'expected', width: 18 },
        { header: 'Actual Output', key: 'actual', width: 18 },
        { header: 'Wastage', key: 'wastage', width: 14 },
        { header: 'Cost per Packet (Rs)', key: 'cost', width: 22 }
      ], runs.map(run => ({
        batch: run.batch_number,
        date: run.run_date,
        product: run.finished_item_name,
        expected: parseFloat(run.expected_output),
        actual: parseFloat(run.actual_output),
        wastage: parseFloat(run.wastage_qty || 0),
        cost: rupees(run.cost_per_unit_paisa)
      })));
    } else if (type === 'purchases') {
      const rows = await getPurchaseRows(dateFrom, dateTo);
      addWorksheet(workbook, 'Purchase Register', [
        { header: 'Purchase ID', key: 'purchase_id', width: 12 },
        { header: 'Date', key: 'purchase_date', width: 14 },
        { header: 'Supplier Invoice', key: 'invoice_number', width: 20 },
        { header: 'Supplier', key: 'supplier_name', width: 25 },
        { header: 'Item', key: 'item_name', width: 25 },
        { header: 'Quantity', key: 'qty', width: 12 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Rate (Rs)', key: 'rate', width: 12 },
        { header: 'Amount (Rs)', key: 'amount', width: 15 }
      ], rows.map(row => ({
        purchase_id: row.purchase_id,
        purchase_date: row.purchase_date,
        invoice_number: row.invoice_number,
        supplier_name: row.supplier_name,
        item_name: row.item_name,
        qty: parseFloat(row.qty),
        unit: row.unit,
        rate: rupees(row.rate_paisa),
        amount: rupees(row.amount_paisa)
      })));
    } else if (type === 'collections') {
      const rows = await getCollectionRows(dateFrom, dateTo);
      addWorksheet(workbook, 'Collections Register', [
        { header: 'Date', key: 'payment_date', width: 14 },
        { header: 'Customer', key: 'customer_name', width: 25 },
        { header: 'Invoice', key: 'invoice_number', width: 18 },
        { header: 'Mode', key: 'mode', width: 12 },
        { header: 'Reference', key: 'reference_number', width: 20 },
        { header: 'Amount (Rs)', key: 'amount', width: 15 },
        { header: 'Reversed', key: 'reversed', width: 12 },
        { header: 'Recorded By', key: 'recorded_by_name', width: 20 }
      ], rows.map(row => ({
        payment_date: row.payment_date,
        customer_name: row.customer_name,
        invoice_number: row.invoice_number,
        mode: row.mode,
        reference_number: row.reference_number,
        amount: rupees(row.amount_paisa),
        reversed: row.is_reversed ? 'YES' : '',
        recorded_by_name: row.recorded_by_name
      })));
    } else if (type === 'outstanding') {
      const rows = await receivablesService.getOutstandingReport(pool);
      addWorksheet(workbook, 'Outstanding & Ageing', [
        { header: 'Customer', key: 'customerName', width: 25 },
        { header: 'State', key: 'state', width: 15 },
        { header: 'Invoiced (Rs)', key: 'invoiced', width: 15 },
        { header: 'Collected (Rs)', key: 'paid', width: 15 },
        { header: 'Outstanding (Rs)', key: 'outstanding', width: 18 },
        { header: '0-30 Days (Rs)', key: 'current', width: 16 },
        { header: '31-60 Days (Rs)', key: 'days31to60', width: 18 },
        { header: '61-90 Days (Rs)', key: 'days61to90', width: 18 },
        { header: '90+ Days (Rs)', key: 'days90Plus', width: 16 }
      ], rows.map(row => ({
        customerName: row.customerName,
        state: row.state,
        invoiced: rupees(row.totalInvoicedPaisa),
        paid: rupees(row.totalPaidPaisa),
        outstanding: rupees(row.outstandingPaisa),
        current: rupees(row.ageing.current0to30Paisa),
        days31to60: rupees(row.ageing.days31to60Paisa),
        days61to90: rupees(row.ageing.days61to90Paisa),
        days90Plus: rupees(row.ageing.days90PlusPaisa)
      })));
    } else if (type === 'cost') {
      const rows = await getCostAnalysis(dateFrom, dateTo);
      addWorksheet(workbook, 'Cost Analysis', [
        { header: 'Product', key: 'productName', width: 25 },
        { header: 'Output', key: 'totalOutput', width: 12 },
        { header: 'Material / Unit (Rs)', key: 'material', width: 22 },
        { header: 'Labour / Unit (Rs)', key: 'labour', width: 20 },
        { header: 'Overhead / Unit (Rs)', key: 'overhead', width: 22 },
        { header: 'Cost / Unit (Rs)', key: 'cost', width: 18 },
        { header: 'Selling Price (Rs)', key: 'selling', width: 18 },
        { header: 'Margin (Rs)', key: 'margin', width: 15 },
        { header: 'Margin %', key: 'marginPercent', width: 12 }
      ], rows.map(row => ({
        productName: row.productName,
        totalOutput: row.totalOutput,
        material: rupees(row.materialCostPerUnitPaisa),
        labour: rupees(row.labourCostPerUnitPaisa),
        overhead: rupees(row.overheadCostPerUnitPaisa),
        cost: rupees(row.costPerUnitPaisa),
        selling: rupees(row.sellingPricePaisa),
        margin: rupees(row.marginPaisa),
        marginPercent: row.marginPercent
      })));
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
