const { pool } = require('../config/db');

async function resetBenchmark() {
  console.log('Resetting database to clean Section 5 opening state...');
  try {
    await pool.query(`
      TRUNCATE payments, invoice_lines, invoices, order_lines, orders,
               overhead_entries, production_issues, production_runs, stock_ledger CASCADE;
    `);

    await pool.query(`
      INSERT INTO stock_ledger (item_id, txn_date, txn_type, qty_in, qty_out, unit, rate_paisa, notes, created_by)
      SELECT id, CURRENT_DATE, 'opening_balance', 100, 0, 'kg', 4200, 'Opening stock', 1 FROM items WHERE name = 'Rice Flour';

      INSERT INTO stock_ledger (item_id, txn_date, txn_type, qty_in, qty_out, unit, rate_paisa, notes, created_by)
      SELECT id, CURRENT_DATE, 'opening_balance', 30, 0, 'litre', 14000, 'Opening stock', 1 FROM items WHERE name = 'Cooking Oil';

      INSERT INTO stock_ledger (item_id, txn_date, txn_type, qty_in, qty_out, unit, rate_paisa, notes, created_by)
      SELECT id, CURRENT_DATE, 'opening_balance', 5, 0, 'kg', 20000, 'Opening stock', 1 FROM items WHERE name = 'Salt and Spice Mix';

      INSERT INTO stock_ledger (item_id, txn_date, txn_type, qty_in, qty_out, unit, rate_paisa, notes, created_by)
      SELECT id, CURRENT_DATE, 'opening_balance', 500, 0, 'piece', 250, 'Opening stock', 1 FROM items WHERE name = '200g Pouch';

      INSERT INTO stock_ledger (item_id, txn_date, txn_type, qty_in, qty_out, unit, rate_paisa, notes, created_by)
      SELECT id, CURRENT_DATE, 'opening_balance', 30, 0, 'piece', 1500, 'Opening stock', 1 FROM items WHERE name = 'Carton (20 packets)';

      INSERT INTO stock_ledger (item_id, txn_date, txn_type, qty_in, qty_out, unit, rate_paisa, notes, created_by)
      SELECT id, CURRENT_DATE, 'opening_balance', 50, 0, 'packet', 0, 'Opening stock - 50 packets', 1 FROM items WHERE name = 'Murukku 200g';
    `);

    await pool.query(`DELETE FROM settings WHERE key LIKE '%counter%'`);

    const res = await pool.query(`
      SELECT i.name, COALESCE(SUM(sl.qty_in) - SUM(sl.qty_out), 0) AS balance
      FROM items i
      LEFT JOIN stock_ledger sl ON i.id = sl.item_id
      GROUP BY i.id, i.name
      ORDER BY i.name
    `);

    console.log('✅ Benchmark opening stock restored successfully:');
    res.rows.forEach(r => console.log(`   - ${r.name}: ${r.balance}`));
    process.exit(0);
  } catch (err) {
    console.error('❌ Reset failed:', err);
    process.exit(1);
  }
}

resetBenchmark();
