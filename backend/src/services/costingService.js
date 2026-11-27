/**
 * Costing Service - Production Cost & Packet Margin Engine
 * Valuation Method: Weighted Average Costing
 * Overhead Allocation: Direct allocation per production run
 */

const calculateRunCost = async (pool, runId) => {
  // 1. Calculate raw materials and packaging cost from production_issues
  const issuesRes = await pool.query(
    `SELECT COALESCE(SUM(amount_paisa), 0) AS total_material_cost
     FROM production_issues
     WHERE run_id = $1`,
    [runId]
  );
  const totalMaterialCost = parseInt(issuesRes.rows[0].total_material_cost || 0, 10);

  // 2. Fetch overheads from overhead_entries
  const overheadEntriesRes = await pool.query(
    `SELECT category, COALESCE(SUM(amount_paisa), 0) AS total
     FROM overhead_entries
     WHERE run_id = $1
     GROUP BY category`,
    [runId]
  );

  let labourCost = 0;
  let utilityOverhead = 0;

  overheadEntriesRes.rows.forEach(r => {
    const amt = parseInt(r.total, 10);
    if (r.category === 'labour') {
      labourCost += amt;
    } else {
      utilityOverhead += amt;
    }
  });

  // 3. Fetch production run details
  const runRes = await pool.query(
    `SELECT actual_output, labour_cost_paisa, overhead_cost_paisa
     FROM production_runs
     WHERE id = $1`,
    [runId]
  );

  if (runRes.rows.length === 0) return null;

  const run = runRes.rows[0];
  // If overhead_entries was populated, use that; otherwise fallback to columns
  const finalLabour = labourCost > 0 ? labourCost : parseInt(run.labour_cost_paisa || 0, 10);
  const finalOverhead = utilityOverhead > 0 ? utilityOverhead : parseInt(run.overhead_cost_paisa || 0, 10);
  const actualOutput = parseFloat(run.actual_output || 0);

  const totalCost = totalMaterialCost + finalLabour + finalOverhead;
  const costPerUnit = actualOutput > 0 ? Math.round(totalCost / actualOutput) : 0;

  // 4. Update the production_run record with consolidated costs
  await pool.query(
    `UPDATE production_runs
     SET total_material_cost_paisa = $1,
         labour_cost_paisa = $2,
         overhead_cost_paisa = $3,
         total_cost_paisa = $4,
         cost_per_unit_paisa = $5,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $6`,
    [totalMaterialCost, finalLabour, finalOverhead, totalCost, costPerUnit, runId]
  );

  // 5. Ledger Immutability:
  // If the initial production_output has rate_paisa = 0 (unvalued pending overheads), set initial valuation.
  // If rate_paisa is already set, record an explicit cost_adjustment movement to preserve ledger audit trail.
  const existingLedger = await pool.query(
    `SELECT id, rate_paisa, item_id, unit, created_by FROM stock_ledger
     WHERE txn_ref_type = 'production_run' AND txn_ref_id = $1 AND txn_type = 'production_output'
     LIMIT 1`,
    [runId]
  );

  if (existingLedger.rows.length > 0) {
    const row = existingLedger.rows[0];
    const prevRate = parseInt(row.rate_paisa || 0, 10);
    if (prevRate === 0) {
      // Set initial absorption rate for new run
      await pool.query(
        `UPDATE stock_ledger SET rate_paisa = $1 WHERE id = $2`,
        [costPerUnit, row.id]
      );
    } else if (prevRate !== costPerUnit) {
      // Historical rate already recorded; log an explicit cost_adjustment movement
      await pool.query(
        `INSERT INTO stock_ledger (
           item_id, txn_date, txn_type, txn_ref_type, txn_ref_id,
           qty_in, qty_out, unit, rate_paisa, notes, created_by
         )
         VALUES ($1, CURRENT_DATE, 'adjustment', 'production_run', $2, 0, 0, $3, $4, $5, $6)`,
        [
          row.item_id,
          runId,
          row.unit,
          costPerUnit - prevRate,
          `Cost adjustment for Batch run #${runId}: overhead absorption revised from ₹${(prevRate/100).toFixed(2)} to ₹${(costPerUnit/100).toFixed(2)}/unit`,
          row.created_by
        ]
      );
    }
  }

  return {
    totalMaterialCost,
    labourCost: finalLabour,
    overheadCost: finalOverhead,
    totalCost,
    costPerUnit,
    actualOutput
  };
};

module.exports = {
  calculateRunCost
};
