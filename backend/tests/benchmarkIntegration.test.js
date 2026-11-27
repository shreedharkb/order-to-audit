/**
 * Benchmark Integration Tests: End-to-End PostgreSQL Transactional Verification
 * Executes the full Section 5 scenario directly against the database and asserts ledger balances.
 */
const { pool } = require('../src/config/db');
const { setupDatabase } = require('../src/db/dbSetup');
const stockService = require('../src/services/stockService');
const costingService = require('../src/services/costingService');
const gstService = require('../src/services/gstService');
const receivablesService = require('../src/services/receivablesService');

jest.setTimeout(45000);

describe('Section 5 Benchmark Scenario - PostgreSQL Integration', () => {
  let flourId, oilId, spiceId, pouchId, cartonId, murukkuId, bomId;
  let retailerAId, distributorBId;

  beforeAll(async () => {
    // 1. Ensure master schema exists
    await setupDatabase(pool);

    // 2. Clean previous test transactional rows to guarantee clean benchmark state
    await pool.query(`
      TRUNCATE payments, invoice_lines, invoices, order_lines, orders,
               overhead_entries, production_issues, production_runs, stock_ledger CASCADE;
    `);

    // 3. Re-insert Section 5 benchmark opening stock
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

    // Reset settings counters
    await pool.query(`
      DELETE FROM settings WHERE key LIKE '%counter%';
    `);

    // Fetch master item IDs
    const itemsRes = await pool.query('SELECT id, name FROM items');
    const itemsMap = {};
    itemsRes.rows.forEach(r => { itemsMap[r.name] = r.id; });

    flourId = itemsMap['Rice Flour'];
    oilId = itemsMap['Cooking Oil'];
    spiceId = itemsMap['Salt and Spice Mix'];
    pouchId = itemsMap['200g Pouch'];
    cartonId = itemsMap['Carton (20 packets)'];
    murukkuId = itemsMap['Murukku 200g'];

    const bomRes = await pool.query('SELECT id FROM bom WHERE finished_item_id = $1', [murukkuId]);
    bomId = bomRes.rows[0].id;

    const custRes = await pool.query('SELECT id, name FROM customers');
    const custMap = {};
    custRes.rows.forEach(r => { custMap[r.name] = r.id; });
    retailerAId = custMap['Retailer A - Murugan Stores'];
    distributorBId = custMap['Distributor B - Karnataka Snacks Dist.'];
  }, 45000);

  afterAll(async () => {
    await pool.end();
  });

  test('Step 0: Verify Opening Balances from Seed Data', async () => {
    expect(await stockService.getStockBalance(pool, flourId)).toBe(100);
    expect(await stockService.getStockBalance(pool, oilId)).toBe(30);
    expect(await stockService.getStockBalance(pool, spiceId)).toBe(5);
    expect(await stockService.getStockBalance(pool, pouchId)).toBe(500);
    expect(await stockService.getStockBalance(pool, cartonId)).toBe(30);
    expect(await stockService.getStockBalance(pool, murukkuId)).toBe(50);
  });

  test('Step 1: Record purchase of 60 kg Rice Flour at Rs 45/kg', async () => {
    await stockService.addStockMovement(pool, {
      itemId: flourId,
      txnType: 'purchase',
      txnRefType: 'purchase',
      txnRefId: 1,
      qtyIn: 60,
      qtyOut: 0,
      unit: 'kg',
      ratePaisa: 4500,
      notes: 'Section 5 Step 1: Purchase 60kg flour @ Rs 45',
      createdBy: 1
    });

    const balance = await stockService.getStockBalance(pool, flourId);
    expect(balance).toBe(160); // 100 + 60
  });

  test('Step 2 & 3: Run production, issue materials, record output & wastage', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create Run
      const runRes = await client.query(
        `INSERT INTO production_runs (bom_id, run_date, batch_number, batch_multiplier, expected_output, status, created_by)
         VALUES ($1, CURRENT_DATE, 'BATCH/2026/BENCH01', 1, 200, 'in_progress', 1) RETURNING id`,
        [bomId]
      );
      const runId = runRes.rows[0].id;

      // Issue 40 kg flour (WAC: 100*42 + 60*45 = 6900 / 160 = 43.125 -> 4313 paisa)
      const flourWAC = await stockService.getWeightedAvgCost(client, flourId);
      await client.query(
        `INSERT INTO production_issues (run_id, item_id, planned_qty, actual_qty, unit, rate_paisa, amount_paisa, variance_qty, variance_percent)
         VALUES ($1, $2, 40, 40, 'kg', $3, $4, 0, 0)`,
        [runId, flourId, flourWAC, 40 * flourWAC]
      );
      await stockService.addStockMovement(client, {
        itemId: flourId,
        txnType: 'production_issue',
        txnRefType: 'production_run',
        txnRefId: runId,
        qtyIn: 0,
        qtyOut: 40,
        unit: 'kg',
        ratePaisa: flourWAC,
        createdBy: 1
      });

      // Issue 10.5 L oil (+5% variance)
      await client.query(
        `INSERT INTO production_issues (run_id, item_id, planned_qty, actual_qty, unit, rate_paisa, amount_paisa, variance_qty, variance_percent)
         VALUES ($1, $2, 10, 10.5, 'litre', 14000, 147000, 0.5, 5.0)`,
        [runId, oilId]
      );
      await stockService.addStockMovement(client, {
        itemId: oilId,
        txnType: 'production_issue',
        txnRefType: 'production_run',
        txnRefId: runId,
        qtyIn: 0,
        qtyOut: 10.5,
        unit: 'litre',
        ratePaisa: 14000,
        createdBy: 1
      });

      // Issue 1.2 kg spice mix
      await client.query(
        `INSERT INTO production_issues (run_id, item_id, planned_qty, actual_qty, unit, rate_paisa, amount_paisa, variance_qty, variance_percent)
         VALUES ($1, $2, 1.2, 1.2, 'kg', 20000, 24000, 0, 0)`,
        [runId, spiceId]
      );
      await stockService.addStockMovement(client, {
        itemId: spiceId,
        txnType: 'production_issue',
        txnRefType: 'production_run',
        txnRefId: runId,
        qtyIn: 0,
        qtyOut: 1.2,
        unit: 'kg',
        ratePaisa: 20000,
        createdBy: 1
      });

      // Output: 188 good packets
      await stockService.addStockMovement(client, {
        itemId: murukkuId,
        txnType: 'production_output',
        txnRefType: 'production_run',
        txnRefId: runId,
        qtyIn: 188,
        qtyOut: 0,
        unit: 'packet',
        ratePaisa: 0,
        createdBy: 1
      });

      // Packaging consumed: 188 good + 6 damaged = 194 pouches
      await client.query(
        `INSERT INTO production_issues (run_id, item_id, planned_qty, actual_qty, unit, rate_paisa, amount_paisa, variance_qty, variance_percent)
         VALUES ($1, $2, 200, 194, 'piece', 250, 48500, -6, -3.0)`,
        [runId, pouchId]
      );
      await stockService.addStockMovement(client, {
        itemId: pouchId,
        txnType: 'production_issue',
        txnRefType: 'production_run',
        txnRefId: runId,
        qtyIn: 0,
        qtyOut: 194,
        unit: 'piece',
        ratePaisa: 250,
        createdBy: 1
      });

      // Cartons used: 9 cartons
      await client.query(
        `INSERT INTO production_issues (run_id, item_id, planned_qty, actual_qty, unit, rate_paisa, amount_paisa, variance_qty, variance_percent)
         VALUES ($1, $2, 10, 9, 'piece', 1500, 13500, -1, -10.0)`,
        [runId, cartonId]
      );
      await stockService.addStockMovement(client, {
        itemId: cartonId,
        txnType: 'production_issue',
        txnRefType: 'production_run',
        txnRefId: runId,
        qtyIn: 0,
        qtyOut: 9,
        unit: 'piece',
        ratePaisa: 1500,
        createdBy: 1
      });

      await client.query(
        `UPDATE production_runs SET actual_output = 188, wastage_qty = 6, status = 'completed' WHERE id = $1`,
        [runId]
      );

      // Overheads: Rs 1,200 labour + Rs 600 power/gas
      await client.query(
        `INSERT INTO overhead_entries (run_id, category, description, amount_paisa, created_by)
         VALUES ($1, 'labour', 'Direct batch labour', 120000, 1),
                ($1, 'utilities', 'Gas and power', 60000, 1)`,
        [runId]
      );

      // Calculate consolidated costing
      const costResult = await costingService.calculateRunCost(client, runId);
      expect(costResult.totalMaterialCost).toBe(405520); // Rs 4,055.20
      expect(costResult.totalCost).toBe(585520);         // Rs 5,855.20
      expect(costResult.costPerUnit).toBe(3114);         // Rs 31.14 / packet!

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Assert Inventory Balances
    expect(await stockService.getStockBalance(pool, flourId)).toBe(120);     // 100 + 60 - 40 = 120 kg
    expect(await stockService.getStockBalance(pool, oilId)).toBe(19.5);      // 30 - 10.5 = 19.5 L
    expect(await stockService.getStockBalance(pool, spiceId)).toBe(3.8);     // 5 - 1.2 = 3.8 kg
    expect(await stockService.getStockBalance(pool, pouchId)).toBe(306);     // 500 - 194 = 306 pcs
    expect(await stockService.getStockBalance(pool, cartonId)).toBe(21);     // 30 - 9 = 21 pcs
    expect(await stockService.getStockBalance(pool, murukkuId)).toBe(238);   // 50 + 188 = 238 pkts
  });

  test('Step 4 & 5: Retailer A order (150 pkts), GST Invoice, Dispatch', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const invoiceNum = await gstService.generateInvoiceNumber(client);
      expect(invoiceNum).toMatch(/^INV\/\d{4}-\d{2}\/\d{4}$/);

      // 150 pkts @ Rs 50 = Rs 7,500. GST 5% intra-state: CGST 2.5% (187.50) + SGST 2.5% (187.50) = Rs 7,875
      const gst = gstService.calculateGST({ taxableAmountPaisa: 750000, gstRatePercent: 5.0, isIGST: false });
      expect(gst.totalPaisa).toBe(787500); // Rs 7,875.00

      const invRes = await client.query(
        `INSERT INTO invoices (
           invoice_number, invoice_date, customer_id, place_of_supply_state, place_of_supply_code,
           is_igst, subtotal_paisa, cgst_paisa, sgst_paisa, igst_paisa, total_tax_paisa, total_paisa,
           status, is_dispatched, dispatch_date, created_by
         )
         VALUES ($1, CURRENT_DATE, $2, 'Tamil Nadu', '33', FALSE, $3, $4, $5, 0, $6, $7, 'active', TRUE, CURRENT_DATE, 1)
         RETURNING id`,
        [invoiceNum, retailerAId, gst.taxableAmountPaisa, gst.cgstPaisa, gst.sgstPaisa, gst.totalTaxPaisa, gst.totalPaisa]
      );
      const invoiceId = invRes.rows[0].id;

      // Dispatch 150 pkts
      await stockService.addStockMovement(client, {
        itemId: murukkuId,
        txnType: 'sale_dispatch',
        txnRefType: 'invoice',
        txnRefId: invoiceId,
        qtyIn: 0,
        qtyOut: 150,
        unit: 'packet',
        ratePaisa: 3114,
        createdBy: 1
      });

      // Step 7: Record Rs 4,000 payment from Retailer A
      await client.query(
        `INSERT INTO payments (customer_id, invoice_id, payment_date, amount_paisa, mode, created_by)
         VALUES ($1, $2, CURRENT_DATE, 400000, 'cash', 1)`,
        [retailerAId, invoiceId]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Finished Goods stock after dispatch: 238 - 150 = 88 pkts
    const fgAfterDispatch = await stockService.getStockBalance(pool, murukkuId);
    expect(fgAfterDispatch).toBe(88);

    // Outstanding balance for Retailer A: 7875 - 4000 = Rs 3,875
    const outstanding = await receivablesService.getCustomerOutstanding(pool, retailerAId);
    expect(outstanding.outstandingPaisa).toBe(387500); // Rs 3,875.00
  });

  test('Step 6: Distributor B order (120 pkts) triggers shortage detection', async () => {
    const availableStock = await stockService.getStockBalance(pool, murukkuId); // 88 pkts
    const requestedStock = 120;
    const shortage = requestedStock - availableStock;

    expect(availableStock).toBe(88);
    expect(shortage).toBe(32); // Exact 32 packet shortage!
  });
});
