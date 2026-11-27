const getOutstandingReport = async (pool) => {
  const custRes = await pool.query('SELECT id, name, type, gstin, city, state, phone FROM customers ORDER BY name');
  const report = [];

  for (const cust of custRes.rows) {
    const invRes = await pool.query(`
      SELECT id, invoice_number, invoice_date, total_paisa,
             (CURRENT_DATE - invoice_date) AS age_days
      FROM invoices
      WHERE customer_id = $1 AND status = 'active'
      ORDER BY invoice_date ASC, id ASC
    `, [cust.id]);

    const paidRes = await pool.query(`
      SELECT id, invoice_id, payment_date, amount_paisa
      FROM payments
      WHERE customer_id = $1 AND is_reversed = FALSE
      ORDER BY payment_date ASC, id ASC
    `, [cust.id]);

    const invoices = invRes.rows;
    const allocated = new Map(invoices.map(inv => [inv.id, 0]));
    let unallocated = 0;

    for (const payment of paidRes.rows) {
      if (payment.invoice_id && allocated.has(payment.invoice_id)) {
        allocated.set(payment.invoice_id, allocated.get(payment.invoice_id) + parseInt(payment.amount_paisa, 10));
      } else {
        unallocated += parseInt(payment.amount_paisa, 10);
      }
    }

    let current0to30 = 0;
    let days31to60 = 0;
    let days61to90 = 0;
    let days90Plus = 0;

    for (const inv of invoices) {
      const invTotal = parseInt(inv.total_paisa, 10);
      const fromUnallocated = Math.min(Math.max(0, invTotal - allocated.get(inv.id)), unallocated);
      allocated.set(inv.id, allocated.get(inv.id) + fromUnallocated);
      unallocated -= fromUnallocated;

      const unpaidPortion = Math.max(0, invTotal - allocated.get(inv.id));
      if (unpaidPortion === 0) continue;

      const age = parseInt(inv.age_days || 0, 10);
      if (age <= 30) current0to30 += unpaidPortion;
      else if (age <= 60) days31to60 += unpaidPortion;
      else if (age <= 90) days61to90 += unpaidPortion;
      else days90Plus += unpaidPortion;
    }

    const totalInvoiced = invoices.reduce((sum, inv) => sum + parseInt(inv.total_paisa, 10), 0);
    const totalPaid = paidRes.rows.reduce((sum, payment) => sum + parseInt(payment.amount_paisa, 10), 0);

    report.push({
      customerId: cust.id,
      customerName: cust.name,
      customerType: cust.type,
      state: cust.state,
      phone: cust.phone,
      totalInvoicedPaisa: totalInvoiced,
      totalPaidPaisa: totalPaid,
      outstandingPaisa: totalInvoiced - totalPaid,
      ageing: {
        current0to30Paisa: current0to30,
        days31to60Paisa: days31to60,
        days61to90Paisa: days61to90,
        days90PlusPaisa: days90Plus
      }
    });
  }

  return report;
};

const getCustomerOutstanding = async (pool, customerId) => {
  const report = await getOutstandingReport(pool);
  return report.find(r => r.customerId === customerId) || { outstandingPaisa: 0 };
};

module.exports = { getOutstandingReport, getCustomerOutstanding };
