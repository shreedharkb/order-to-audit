const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { logAudit } = require('../middleware/auditLog');
const stockService = require('../services/stockService');
const costingService = require('../services/costingService');

router.use(authenticate);

/**
 * POST /api/production/runs
 * Start a new production run from a BOM
 */
router.post('/runs', authorize('production', 'admin', 'owner'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { bomId, runDate, batchMultiplier = 1, notes } = req.body;

    const bomRes = await client.query(`
      SELECT b.*, i.name AS finished_item_name, i.unit AS finished_item_unit
      FROM bom b
      JOIN items i ON b.finished_item_id = i.id
      WHERE b.id = $1
    `, [bomId]);

    if (bomRes.rows.length === 0) return res.status(404).json({ error: 'BOM not found' });
    const bom = bomRes.rows[0];

    const mult = parseFloat(batchMultiplier) || 1;
    const expectedOutput = parseFloat(bom.expected_yield) * mult;

    // Batch number generation
    const year = new Date().getFullYear();
    const countRes = await client.query(
      "SELECT COUNT(*) FROM production_runs WHERE batch_number LIKE $1",
      [`BATCH/${year}/%`]
    );
    const count = parseInt(countRes.rows[0].count, 10) + 1;
    const batchNumber = `BATCH/${year}/${count.toString().padStart(4, '0')}`;

    const runRes = await client.query(`
      INSERT INTO production_runs (
        bom_id, run_date, batch_number, batch_multiplier,
        expected_output, actual_output, status, notes, created_by
      )
      VALUES ($1, $2, $3, $4, $5, 0, 'draft', $6, $7)
      RETURNING *
    `, [bom.id, runDate || new Date(), batchNumber, mult, expectedOutput, notes || null, req.user.id]);

    const run = runRes.rows[0];

    await client.query('COMMIT');
    await logAudit(pool, 'production_runs', run.id, 'create', null, run, req.user.id);

    res.status(201).json({
      message: 'Production run created',
      run
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/production/runs
 * List production runs
 */
router.get('/runs', async (req, res) => {
  try {
    const runsRes = await pool.query(`
      SELECT pr.*, b.batch_name, i.name AS finished_item_name, i.unit AS finished_item_unit,
             i.selling_price_paisa
      FROM production_runs pr
      JOIN bom b ON pr.bom_id = b.id
      JOIN items i ON b.finished_item_id = i.id
      ORDER BY pr.run_date DESC, pr.id DESC
    `);
    res.json(runsRes.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/production/runs/:id
 * Get single production run details with issues, overheads, and variance
 */
router.get('/runs/:id', async (req, res) => {
  try {
    const runRes = await pool.query(`
      SELECT pr.*, b.batch_name, b.expected_yield AS bom_expected_yield,
             i.name AS finished_item_name, i.unit AS finished_item_unit,
             i.selling_price_paisa, i.id AS finished_item_id
      FROM production_runs pr
      JOIN bom b ON pr.bom_id = b.id
      JOIN items i ON b.finished_item_id = i.id
      WHERE pr.id = $1
    `, [req.params.id]);

    if (runRes.rows.length === 0) return res.status(404).json({ error: 'Production run not found' });
    const run = runRes.rows[0];

    // Issues (Materials consumed)
    const issuesRes = await pool.query(`
      SELECT pi.*, i.name AS item_name, i.type AS item_type
      FROM production_issues pi
      JOIN items i ON pi.item_id = i.id
      WHERE pi.run_id = $1
      ORDER BY i.type, i.name
    `, [run.id]);
    run.issues = issuesRes.rows;

    // Overheads
    const overheadsRes = await pool.query(`
      SELECT * FROM overhead_entries WHERE run_id = $1 ORDER BY id
    `, [run.id]);
    run.overheads = overheadsRes.rows;

    // BOM lines for reference (especially if draft)
    const bomLinesRes = await pool.query(`
      SELECT bl.*, i.name AS item_name, i.type AS item_type,
             (bl.qty_per_batch * $1) AS planned_qty
      FROM bom_lines bl
      JOIN items i ON bl.item_id = i.id
      WHERE bl.bom_id = $2
      ORDER BY i.type, i.name
    `, [run.batch_multiplier, run.bom_id]);
    run.bom_lines = bomLinesRes.rows;

    // Fetch variance tolerance from settings
    const tolRes = await pool.query("SELECT value FROM settings WHERE key = 'variance_tolerance_percent'");
    const tolerance = parseFloat(tolRes.rows[0]?.value || 3);
    run.tolerance_percent = tolerance;

    // Compute yield variance
    const expected = parseFloat(run.expected_output || 0);
    const actual = parseFloat(run.actual_output || 0);
    const yieldVarianceQty = actual - expected;
    const yieldVariancePercent = expected > 0 ? (yieldVarianceQty / expected) * 100 : 0;
    const yieldVarianceFlagged = Math.abs(yieldVariancePercent) > tolerance;

    run.yield_analysis = {
      expectedOutput: expected,
      actualOutput: actual,
      varianceQty: yieldVarianceQty,
      variancePercent: parseFloat(yieldVariancePercent.toFixed(2)),
      isFlagged: yieldVarianceFlagged
    };

    res.json(run);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/production/runs/:id/issue
 * Issue raw materials to production run (Raw stock goes down per BOM planned vs actual)
 */
router.post('/runs/:id/issue', authorize('production', 'admin', 'owner'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const runId = req.params.id;
    const { items } = req.body; // array of { itemId, actualQty, unit }

    const runRes = await client.query('SELECT * FROM production_runs WHERE id = $1', [runId]);
    if (runRes.rows.length === 0) return res.status(404).json({ error: 'Production run not found' });
    const run = runRes.rows[0];

    const bomLinesRes = await client.query('SELECT * FROM bom_lines WHERE bom_id = $1', [run.bom_id]);
    const bomMap = {};
    bomLinesRes.rows.forEach(bl => {
      bomMap[bl.item_id] = parseFloat(bl.qty_per_batch) * parseFloat(run.batch_multiplier);
    });

    const recordedIssues = [];

    for (const it of items) {
      const itemId = it.itemId;
      const actualQty = parseFloat(it.actualQty);
      const plannedQty = bomMap[itemId] !== undefined ? bomMap[itemId] : actualQty;
      const unit = it.unit;

      // Rate: weighted average cost
      const ratePaisa = await stockService.getWeightedAvgCost(client, itemId);
      const amountPaisa = Math.round(actualQty * ratePaisa);

      const varianceQty = actualQty - plannedQty;
      const variancePercent = plannedQty > 0 ? (varianceQty / plannedQty) * 100 : 0;

      // Insert issue record
      const issueRes = await client.query(`
        INSERT INTO production_issues (
          run_id, item_id, planned_qty, actual_qty, unit, rate_paisa, amount_paisa, variance_qty, variance_percent
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [run.id, itemId, plannedQty, actualQty, unit, ratePaisa, amountPaisa, varianceQty, variancePercent]);

      recordedIssues.push(issueRes.rows[0]);

      // Deduct from stock_ledger: Raw stock goes DOWN
      await stockService.addStockMovement(client, {
        itemId,
        txnDate: run.run_date,
        txnType: 'production_issue',
        txnRefType: 'production_run',
        txnRefId: run.id,
        qtyIn: 0,
        qtyOut: actualQty,
        unit,
        ratePaisa,
        notes: `Issued to Production Run ${run.batch_number}`,
        createdBy: req.user.id
      });
    }

    await client.query("UPDATE production_runs SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [run.id]);

    await client.query('COMMIT');
    res.json({
      message: 'Materials issued to production run successfully',
      issues: recordedIssues
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/production/runs/:id/complete
 * Complete production run:
 * - Finished goods stock goes UP
 * - Packaging material (pouches, cartons, wastage) deducted
 * - Planned vs actual yield and consumption computed and flagged
 */
router.post('/runs/:id/complete', authorize('production', 'admin', 'owner'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const runId = req.params.id;
    const { actualOutput, wastageQty = 0, wastageNotes, damagedPouches = 0, cartonsUsed = 0 } = req.body;

    const runRes = await client.query(`
      SELECT pr.*, b.finished_item_id, i.unit AS finished_unit, b.id AS bom_id
      FROM production_runs pr
      JOIN bom b ON pr.bom_id = b.id
      JOIN items i ON b.finished_item_id = i.id
      WHERE pr.id = $1
    `, [runId]);

    if (runRes.rows.length === 0) return res.status(404).json({ error: 'Production run not found' });
    const run = runRes.rows[0];

    const goodPackets = parseFloat(actualOutput);
    const numDamagedPouches = parseFloat(damagedPouches);
    const numCartonsUsed = parseFloat(cartonsUsed);

    // 1. Finished goods stock goes UP
    await stockService.addStockMovement(client, {
      itemId: run.finished_item_id,
      txnDate: run.run_date,
      txnType: 'production_output',
      txnRefType: 'production_run',
      txnRefId: run.id,
      qtyIn: goodPackets,
      qtyOut: 0,
      unit: run.finished_unit,
      ratePaisa: 0, // will be updated when costing is finalized
      notes: `Produced in Batch ${run.batch_number}`,
      createdBy: req.user.id
    });

    // 2. Packaging Materials Consumption
    // Find pouch item and carton item from BOM lines
    const packagingRes = await client.query(`
      SELECT bl.*, i.name AS item_name, i.type AS item_type
      FROM bom_lines bl
      JOIN items i ON bl.item_id = i.id
      WHERE bl.bom_id = $1 AND i.type = 'packaging'
    `, [run.bom_id]);

    for (const pkg of packagingRes.rows) {
      let actualConsumed = 0;
      const plannedQty = parseFloat(pkg.qty_per_batch) * parseFloat(run.batch_multiplier);

      if (pkg.item_name.toLowerCase().includes('pouch')) {
        // Pouch consumption = Good packets produced + Damaged pouches
        actualConsumed = goodPackets + numDamagedPouches;
      } else if (pkg.item_name.toLowerCase().includes('carton')) {
        // Cartons consumption = explicitly reported cartons used or calculated
        actualConsumed = numCartonsUsed > 0 ? numCartonsUsed : Math.ceil(goodPackets / 20);
      } else {
        actualConsumed = plannedQty;
      }

      const ratePaisa = await stockService.getWeightedAvgCost(client, pkg.item_id);
      const amountPaisa = Math.round(actualConsumed * ratePaisa);
      const varianceQty = actualConsumed - plannedQty;
      const variancePercent = plannedQty > 0 ? (varianceQty / plannedQty) * 100 : 0;

      // Record in production_issues
      await client.query(`
        INSERT INTO production_issues (
          run_id, item_id, planned_qty, actual_qty, unit, rate_paisa, amount_paisa, variance_qty, variance_percent
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [run.id, pkg.item_id, plannedQty, actualConsumed, pkg.unit, ratePaisa, amountPaisa, varianceQty, variancePercent]);

      // Deduct from stock_ledger
      await stockService.addStockMovement(client, {
        itemId: pkg.item_id,
        txnDate: run.run_date,
        txnType: 'production_issue',
        txnRefType: 'production_run',
        txnRefId: run.id,
        qtyIn: 0,
        qtyOut: actualConsumed,
        unit: pkg.unit,
        ratePaisa,
        notes: `Packaging consumed for Batch ${run.batch_number} (${pkg.item_name.toLowerCase().includes('pouch') && numDamagedPouches > 0 ? `${numDamagedPouches} damaged` : ''})`,
        createdBy: req.user.id
      });
    }

    // 3. Update Run Status to 'completed'
    await client.query(`
      UPDATE production_runs
      SET actual_output = $1,
          wastage_qty = $2,
          wastage_notes = $3,
          status = 'completed',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [goodPackets, parseFloat(wastageQty), wastageNotes || null, run.id]);

    await client.query('COMMIT');

    // 4. Calculate Run Cost
    const costSummary = await costingService.calculateRunCost(pool, run.id);

    // 5. Evaluate Variances
    const tolRes = await pool.query("SELECT value FROM settings WHERE key = 'variance_tolerance_percent'");
    const tolerance = parseFloat(tolRes.rows[0]?.value || 3);

    const issuesRes = await pool.query(`
      SELECT pi.*, i.name AS item_name
      FROM production_issues pi
      JOIN items i ON pi.item_id = i.id
      WHERE pi.run_id = $1
    `, [run.id]);

    const flaggedVariances = [];
    issuesRes.rows.forEach(iss => {
      if (Math.abs(parseFloat(iss.variance_percent)) > tolerance) {
        flaggedVariances.push({
          itemName: iss.item_name,
          planned: parseFloat(iss.planned_qty),
          actual: parseFloat(iss.actual_qty),
          variancePercent: parseFloat(iss.variance_percent),
          unit: iss.unit
        });
      }
    });

    const expectedOutput = parseFloat(run.expected_output);
    const yieldVariancePercent = ((goodPackets - expectedOutput) / expectedOutput) * 100;
    const isYieldFlagged = Math.abs(yieldVariancePercent) > tolerance;

    await logAudit(pool, 'production_runs', run.id, 'update', { status: 'in_progress' }, { status: 'completed', actualOutput: goodPackets }, req.user.id);

    res.json({
      message: 'Production run completed and finished goods stock updated',
      actualOutput: goodPackets,
      costSummary,
      yieldVariance: {
        expected: expectedOutput,
        actual: goodPackets,
        variancePercent: parseFloat(yieldVariancePercent.toFixed(2)),
        isFlagged: isYieldFlagged
      },
      flaggedVariances,
      hasVarianceAlerts: isYieldFlagged || flaggedVariances.length > 0
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/production/runs/:id/overhead
 * Add labour and overhead expenses to a production run
 */
router.post('/runs/:id/overhead', authorize('production', 'admin', 'owner'), async (req, res) => {
  try {
    const runId = req.params.id;
    const { items } = req.body; // array of { category, description, amountPaisa }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Overhead items array required' });
    }

    for (const item of items) {
      await pool.query(`
        INSERT INTO overhead_entries (run_id, category, description, amount_paisa, created_by)
        VALUES ($1, $2, $3, $4, $5)
      `, [runId, item.category, item.description || null, parseInt(item.amountPaisa, 10), req.user.id]);
    }

    const costSummary = await costingService.calculateRunCost(pool, runId);
    res.json({
      message: 'Overheads added and cost per packet updated',
      costSummary
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/production/runs/:id/variance
 * Detailed variance report for a production run
 */
router.get('/runs/:id/variance', async (req, res) => {
  try {
    const runId = req.params.id;
    const runRes = await pool.query(`
      SELECT pr.*, b.batch_name, i.name AS finished_item_name, i.unit AS finished_item_unit
      FROM production_runs pr
      JOIN bom b ON pr.bom_id = b.id
      JOIN items i ON b.finished_item_id = i.id
      WHERE pr.id = $1
    `, [runId]);

    if (runRes.rows.length === 0) return res.status(404).json({ error: 'Run not found' });
    const run = runRes.rows[0];

    const tolRes = await pool.query("SELECT value FROM settings WHERE key = 'variance_tolerance_percent'");
    const tolerance = parseFloat(tolRes.rows[0]?.value || 3);

    const issuesRes = await pool.query(`
      SELECT pi.*, i.name AS item_name, i.type AS item_type
      FROM production_issues pi
      JOIN items i ON pi.item_id = i.id
      WHERE pi.run_id = $1
      ORDER BY i.type, i.name
    `, [runId]);

    const materialVariances = issuesRes.rows.map(iss => {
      const vPercent = parseFloat(iss.variance_percent || 0);
      return {
        ...iss,
        is_flagged: Math.abs(vPercent) > tolerance
      };
    });

    const expected = parseFloat(run.expected_output || 0);
    const actual = parseFloat(run.actual_output || 0);
    const yieldVarPercent = expected > 0 ? ((actual - expected) / expected) * 100 : 0;

    res.json({
      runId: run.id,
      batchNumber: run.batch_number,
      product: run.finished_item_name,
      tolerancePercent: tolerance,
      yieldVariance: {
        expected,
        actual,
        varianceQty: actual - expected,
        variancePercent: parseFloat(yieldVarPercent.toFixed(2)),
        isFlagged: Math.abs(yieldVarPercent) > tolerance
      },
      materialVariances
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
