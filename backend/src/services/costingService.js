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
