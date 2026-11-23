/**
 * GST Service - Indian Goods and Services Tax Calculator
 * Features:
 * - Intra-state vs Inter-state supply determination
 * - CGST + SGST (split equally) or IGST (full)
 * - Exact paisa arithmetic without floating-point drift
 * - Sequential GST invoice numbering per financial year
 */

const calculateGST = ({ taxableAmountPaisa, gstRatePercent, isIGST }) => {
  const taxable = Math.round(Number(taxableAmountPaisa));
  const rate = parseFloat(gstRatePercent);

  let cgstPaisa = 0;
  let sgstPaisa = 0;
  let igstPaisa = 0;
  let cgstPercent = 0;
  let sgstPercent = 0;
  let igstPercent = 0;

  if (isIGST) {
    igstPercent = rate;
    igstPaisa = Math.round((taxable * rate) / 100);
  } else {
    // Intra-state supply: split equally into CGST and SGST
    cgstPercent = rate / 2;
    sgstPercent = rate / 2;
    cgstPaisa = Math.round((taxable * cgstPercent) / 100);
    sgstPaisa = Math.round((taxable * sgstPercent) / 100);
  }

  const totalTaxPaisa = cgstPaisa + sgstPaisa + igstPaisa;
  const totalPaisa = taxable + totalTaxPaisa;

  return {
    taxableAmountPaisa: taxable,
    gstRatePercent: rate,
    cgstPercent,
    cgstPaisa,
    sgstPercent,
    sgstPaisa,
    igstPercent,
    igstPaisa,
    totalTaxPaisa,
    totalPaisa
  };
};

const isInterState = (companyStateCode, customerStateCode) => {
  return String(companyStateCode).trim() !== String(customerStateCode).trim();
};

const generateInvoiceNumber = async (pool) => {
  // Use atomic row update on settings table
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Read FY and prefix
    const fyRes = await client.query("SELECT value FROM settings WHERE key = 'financial_year'");
    const fy = fyRes.rows[0]?.value || '2024-25';

    const prefixRes = await client.query("SELECT value FROM settings WHERE key = 'invoice_prefix'");
    const prefix = prefixRes.rows[0]?.value || 'INV';

    // Lock counter row for update
    const counterRes = await client.query(
      "SELECT value FROM settings WHERE key = 'invoice_counter' FOR UPDATE"
    );
    let counter = parseInt(counterRes.rows[0]?.value || '0', 10) + 1;

    await client.query(
      "UPDATE settings SET value = $1, updated_at = CURRENT_TIMESTAMP WHERE key = 'invoice_counter'",
      [counter.toString()]
    );

    await client.query('COMMIT');

    const formattedNumber = `${prefix}/${fy}/${counter.toString().padStart(4, '0')}`;
    return formattedNumber;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  calculateGST,
  isInterState,
  generateInvoiceNumber
};
