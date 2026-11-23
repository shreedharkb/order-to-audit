/**
 * Stock Service - Ledger-based Inventory Engine
 * Rule: Stock balances are ALWAYS derived from or reconciled against the stock_ledger.
 * Opening balance + Receipts - Issues or Sales ± Adjustments = Closing balance.
 */

/**
 * Get current stock balance for an item
 */
const getStockBalance = async (pool, itemId) => {
  const res = await pool.query(
    `SELECT COALESCE(SUM(qty_in) - SUM(qty_out), 0) AS balance
     FROM stock_ledger
     WHERE item_id = $1`,
    [itemId]
  );
  return parseFloat(res.rows[0].balance || 0);
};

/**
 * Get weighted average cost in paisa for an item from all inward movements
 */
const getWeightedAvgCost = async (pool, itemId) => {
  const res = await pool.query(
    `SELECT 
       COALESCE(SUM(qty_in * rate_paisa), 0) AS total_val,
       COALESCE(SUM(qty_in), 0) AS total_qty
     FROM stock_ledger
     WHERE item_id = $1 AND qty_in > 0 AND rate_paisa > 0`,
    [itemId]
  );
  const totalVal = parseFloat(res.rows[0].total_val || 0);
  const totalQty = parseFloat(res.rows[0].total_qty || 0);
  if (totalQty <= 0) return 0;
  return Math.round(totalVal / totalQty);
};

/**
 * Record a stock ledger movement with complete traceability
 */
const addStockMovement = async (pool, {
  itemId,
  txnDate = new Date(),
  txnType, // 'purchase', 'production_issue', 'production_output', 'sale_dispatch', 'adjustment', 'opening_balance'
  txnRefType = null, // 'purchase', 'production_run', 'invoice', 'adjustment'
  txnRefId = null,
  qtyIn = 0,
  qtyOut = 0,
  unit,
  ratePaisa = 0,
  batchNumber = null,
  expiryDate = null,
  notes = null,
  createdBy = null
}) => {
  const res = await pool.query(
    `INSERT INTO stock_ledger (
       item_id, txn_date, txn_type, txn_ref_type, txn_ref_id,
       qty_in, qty_out, unit, rate_paisa, batch_number, expiry_date, notes, created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      itemId,
      txnDate,
      txnType,
      txnRefType,
      txnRefId,
      qtyIn,
      qtyOut,
      unit,
      ratePaisa,
      batchNumber,
      expiryDate,
      notes,
      createdBy
    ]
  );
  return res.rows[0];
};

/**
 * Get detailed stock movements (ledger) for an item with running balance
 */
const getStockLedger = async (pool, itemId = null, dateFrom = null, dateTo = null) => {
  let whereClauses = [];
  let params = [];
  let paramIdx = 1;

  if (itemId) {
    whereClauses.push(`sl.item_id = $${paramIdx++}`);
    params.push(itemId);
  }
  if (dateFrom) {
    whereClauses.push(`sl.txn_date >= $${paramIdx++}`);
    params.push(dateFrom);
  }
  if (dateTo) {
    whereClauses.push(`sl.txn_date <= $${paramIdx++}`);
    params.push(dateTo);
  }

  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT 
      sl.*,
      i.name AS item_name,
      i.type AS item_type,
      u.full_name AS created_by_name
    FROM stock_ledger sl
    JOIN items i ON sl.item_id = i.id
    LEFT JOIN users u ON sl.created_by = u.id
    ${whereStr}
    ORDER BY sl.txn_date ASC, sl.id ASC
  `;

  const res = await pool.query(sql, params);
  
  // Compute running balance
  let running = 0;
  const rows = res.rows.map(r => {
    const inQty = parseFloat(r.qty_in || 0);
    const outQty = parseFloat(r.qty_out || 0);
    running += (inQty - outQty);
    return {
      ...r,
      running_balance: running
    };
  });

  return rows;
};

/**
 * Get stock summary for all items with current balances, rates, and values
 */
const getStockSummary = async (pool, type = null) => {
  let whereClause = '';
  let params = [];
  if (type) {
    whereClause = 'WHERE i.type = $1';
    params.push(type);
  }

  const sql = `
    SELECT 
      i.id,
      i.name,
      i.type,
      i.unit,
      i.hsn_code,
      i.gst_rate_percent,
      i.selling_price_paisa,
      i.reorder_level,
      COALESCE(SUM(sl.qty_in) - SUM(sl.qty_out), 0) AS current_balance,
      COALESCE(
        CASE 
          WHEN SUM(CASE WHEN sl.qty_in > 0 THEN sl.qty_in ELSE 0 END) > 0 
          THEN SUM(CASE WHEN sl.qty_in > 0 THEN sl.qty_in * sl.rate_paisa ELSE 0 END) / 
               SUM(CASE WHEN sl.qty_in > 0 THEN sl.qty_in ELSE 0 END)
          ELSE 0 
        END, 
        0
      )::BIGINT AS weighted_avg_rate_paisa
    FROM items i
    LEFT JOIN stock_ledger sl ON i.id = sl.item_id
    ${whereClause}
    GROUP BY i.id
    ORDER BY i.type, i.name
  `;

  const res = await pool.query(sql, params);
  return res.rows.map(r => {
    const balance = parseFloat(r.current_balance || 0);
    const rate = parseInt(r.weighted_avg_rate_paisa || 0);
    const stockValuePaisa = Math.round(balance * rate);
    const reorder = parseFloat(r.reorder_level || 0);

    let status = 'in_stock';
    if (balance <= 0) {
      status = 'out_of_stock';
    } else if (reorder > 0 && balance <= reorder) {
      status = 'low_stock';
    }

    return {
      ...r,
      current_balance: balance,
      weighted_avg_rate_paisa: rate,
      stock_value_paisa: stockValuePaisa,
      status
    };
  });
};

module.exports = {
  getStockBalance,
  getWeightedAvgCost,
  addStockMovement,
  getStockLedger,
  getStockSummary
};
