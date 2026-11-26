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
  const rateValue = Number(gstRatePercent);
  if (!Number.isFinite(rateValue) || rateValue < 0) {
    throw new Error('GST rate must be a non-negative number');
  }
  const rateBasisPoints = Math.round(rateValue * 100);
  const rate = rateBasisPoints / 100;

  if (!Number.isInteger(taxable) || taxable < 0) {
    throw new Error('Taxable amount must be a non-negative integer paisa value');
  }

  let cgstPaisa = 0;
  let sgstPaisa = 0;
  let igstPaisa = 0;
  let cgstPercent = 0;
  let sgstPercent = 0;
  let igstPercent = 0;

  if (isIGST) {
    igstPercent = rate;
    igstPaisa = Math.round((taxable * rateBasisPoints) / 10000);
  } else {
    cgstPercent = rate / 2;
    sgstPercent = rate / 2;
    cgstPaisa = Math.round((taxable * rateBasisPoints) / 20000);
    sgstPaisa = Math.round((taxable * rateBasisPoints) / 20000);
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

const getFinancialYear = (date = new Date()) => {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
};

const generateInvoiceNumber = async (client, date = new Date()) => {
  const prefixRes = await client.query("SELECT value FROM settings WHERE key = 'invoice_prefix'");
  const prefix = prefixRes.rows[0]?.value || 'INV';
  const financialYear = getFinancialYear(date);
  const counterKey = `invoice_counter_${financialYear}`;

  await client.query(
    `INSERT INTO settings (key, value, description)
     SELECT $1, COALESCE(MAX(CAST(SPLIT_PART(invoice_number, '/', 3) AS INTEGER)), 0)::TEXT, $2
     FROM invoices
     WHERE invoice_number LIKE $3
     ON CONFLICT (key) DO NOTHING`,
    [counterKey, `Invoice counter for ${financialYear}`, `${prefix}/${financialYear}/%`]
  );

  const counterRes = await client.query(
    'SELECT value FROM settings WHERE key = $1 FOR UPDATE',
    [counterKey]
  );
  const counter = parseInt(counterRes.rows[0]?.value || '0', 10) + 1;

  await client.query(
    'UPDATE settings SET value = $1, updated_at = CURRENT_TIMESTAMP WHERE key = $2',
    [counter.toString(), counterKey]
  );

  return `${prefix}/${financialYear}/${counter.toString().padStart(4, '0')}`;
};

const generateCreditNoteNumber = async (client, date = new Date()) => {
  const financialYear = getFinancialYear(date);
  const counterKey = `credit_note_counter_${financialYear}`;

  await client.query(
    `INSERT INTO settings (key, value, description)
     SELECT $1, COALESCE(MAX(CAST(SPLIT_PART(credit_note_number, '/', 3) AS INTEGER)), 0)::TEXT, $2
     FROM invoices
     WHERE credit_note_number LIKE $3
     ON CONFLICT (key) DO NOTHING`,
    [counterKey, `Credit note counter for ${financialYear}`, `CN/${financialYear}/%`]
  );

  const counterRes = await client.query(
    'SELECT value FROM settings WHERE key = $1 FOR UPDATE',
    [counterKey]
  );
  const counter = parseInt(counterRes.rows[0]?.value || '0', 10) + 1;

  await client.query(
    'UPDATE settings SET value = $1, updated_at = CURRENT_TIMESTAMP WHERE key = $2',
    [counter.toString(), counterKey]
  );

  return `CN/${financialYear}/${counter.toString().padStart(4, '0')}`;
};

module.exports = {
  calculateGST,
  isInterState,
  getFinancialYear,
  generateInvoiceNumber,
  generateCreditNoteNumber
};
