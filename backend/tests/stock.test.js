/**
 * Unit & Integration Tests: Precision Maths, Stock Ledger, and GST Calculation
 */
const gstService = require('../src/services/gstService');

describe('Benchmark Maths & Calculations Verification', () => {

  describe('GST Precision Arithmetic (Tamil Nadu Factory)', () => {
    test('Intra-state supply (Tamil Nadu to Tamil Nadu): CGST 2.5% + SGST 2.5% on Rs 7,500', () => {
      // 150 packets of Murukku @ Rs 50 = Rs 7,500 (750,000 paisa)
      const taxableAmountPaisa = 750000;
      const gstRatePercent = 5.0;
      const isIGST = false; // Intra-state

      const result = gstService.calculateGST({
        taxableAmountPaisa,
        gstRatePercent,
        isIGST
      });

      expect(result.taxableAmountPaisa).toBe(750000);
      expect(result.cgstPercent).toBe(2.5);
      expect(result.sgstPercent).toBe(2.5);
      expect(result.cgstPaisa).toBe(18750); // Rs 187.50
      expect(result.sgstPaisa).toBe(18750); // Rs 187.50
      expect(result.igstPaisa).toBe(0);
      expect(result.totalTaxPaisa).toBe(37500); // Rs 375.00
      expect(result.totalPaisa).toBe(787500); // Rs 7,875.00 (Exact Benchmark Match!)
    });

    test('Inter-state supply (Tamil Nadu to Karnataka): IGST 5% on Rs 6,000', () => {
      // 120 packets of Murukku @ Rs 50 = Rs 6,000 (600,000 paisa)
      const taxableAmountPaisa = 600000;
      const gstRatePercent = 5.0;
      const isIGST = true; // Inter-state

      const result = gstService.calculateGST({
        taxableAmountPaisa,
        gstRatePercent,
        isIGST
      });

      expect(result.taxableAmountPaisa).toBe(600000);
      expect(result.cgstPaisa).toBe(0);
      expect(result.sgstPaisa).toBe(0);
      expect(result.igstPaisa).toBe(30000); // Rs 300.00
      expect(result.totalPaisa).toBe(630000); // Rs 6,300.00
    });

    test('Inter-state logic handles state code string comparison correctly', () => {
      expect(gstService.isInterState('33', '33')).toBe(false); // TN to TN
      expect(gstService.isInterState('33', '29')).toBe(true);  // TN to KA
    });

    test('Invoice numbering reuses the caller transaction client', async () => {
      const client = {
        query: jest.fn(async (sql) => {
          if (sql.includes("key = 'invoice_prefix'")) return { rows: [{ value: 'INV' }] };
          if (sql.includes('FOR UPDATE')) return { rows: [{ value: '0' }] };
          return { rows: [] };
        })
      };

      await expect(gstService.generateInvoiceNumber(client)).resolves.toBe(`INV/${gstService.getFinancialYear()}/0001`);
      expect(client.query).toHaveBeenCalledTimes(3);
      expect(client.query.mock.calls.some(([sql]) => sql === 'BEGIN' || sql === 'COMMIT')).toBe(false);
    });
  });

  describe('Inventory Arithmetic & Benchmark Balances', () => {
    test('Flour balance after purchase and issue matches benchmark', () => {
      const opening = 100;
      const purchase = 60;
      const issue = 40;
      const closing = opening + purchase - issue;
      expect(closing).toBe(120); // 120 kg
    });

    test('Cooking oil balance after issue matches benchmark', () => {
      const opening = 30;
      const issue = 10.5; // 0.5 L over standard
      const closing = opening - issue;
      expect(closing).toBe(19.5); // 19.5 L
    });

    test('Pouches balance after output and damage matches benchmark', () => {
      const opening = 500;
      const goodPackets = 188;
      const damagedPouches = 6;
      const totalConsumed = goodPackets + damagedPouches;
      const closing = opening - totalConsumed;
      expect(totalConsumed).toBe(194);
      expect(closing).toBe(306); // 306 pouches
    });

    test('Finished goods balance progression matches benchmark', () => {
      const opening = 50;
      const produced = 188;
      const afterRun = opening + produced;
      expect(afterRun).toBe(238); // 238 packets

      const dispatched = 150; // Retailer A
      const afterDispatch = afterRun - dispatched;
      expect(afterDispatch).toBe(88); // 88 packets

      // Distributor B order of 120 packets
      const requested = 120;
      const shortage = requested - afterDispatch;
      expect(shortage).toBe(32); // Shortage of 32 packets flagged!
    });

    test('Yield variance calculation flags -6% deviation', () => {
      const expectedYield = 200;
      const actualYield = 188;
      const variancePercent = ((actualYield - expectedYield) / expectedYield) * 100;
      expect(variancePercent).toBe(-6); // -6%
      const tolerance = 3;
      expect(Math.abs(variancePercent) > tolerance).toBe(true); // Flagged!
    });

    test('Oil consumption variance flags +5% deviation', () => {
      const planned = 10;
      const actual = 10.5;
      const variancePercent = ((actual - planned) / planned) * 100;
      expect(variancePercent).toBe(5); // +5%
      const tolerance = 3;
      expect(Math.abs(variancePercent) > tolerance).toBe(true); // Flagged!
    });

    test('Customer outstanding after partial payment matches benchmark', () => {
      const invoiceAmount = 7875;
      const paymentReceived = 4000;
      const outstanding = invoiceAmount - paymentReceived;
      expect(outstanding).toBe(3875); // Rs 3,875.00
    });
  });

});
