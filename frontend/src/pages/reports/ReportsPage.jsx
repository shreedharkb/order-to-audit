import React from 'react';
import { Link } from 'react-router-dom';

const reports = [
  { title: 'Sales register', desc: 'Customer and product sales with CGST, SGST, and IGST breakdown.', path: '/reports/sales' },
  { title: 'GST outward supplies', desc: 'GSTR-1 and GSTR-3B schedules by tax rate and supply type.', path: '/reports/gst' },
  { title: 'Stock summary and ledger', desc: 'Live balances, valuation rates, and inventory movement history.', path: '/reports/stock' },
  { title: 'Purchase register', desc: 'Supplier receipts for raw materials and packaging.', path: '/reports/purchases' },
  { title: 'Production variance', desc: 'Recipe consumption, actual yield, scrap, and tolerance alerts.', path: '/reports/production' },
  { title: 'Payments and collections', desc: 'Customer receipts by date, mode, and invoice reference.', path: '/reports/collections' },
  { title: 'Receivables and ageing', desc: 'Outstanding balances grouped into ageing buckets.', path: '/reports/outstanding' },
  { title: 'Cost and margins', desc: 'Weighted material costs, overheads, and cost per packet.', path: '/reports/cost' }
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Auditor reports</h1>
        <p className="page-subtitle">Exportable registers and analysis for monthly sign-off.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report, index) => (
          <Link
            key={report.path}
            to={report.path}
            className="group flex min-h-[190px] flex-col rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-primary-300 hover:bg-primary-50/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            <span className="text-xs font-medium tabular-nums text-ink-400">{String(index + 1).padStart(2, '0')}</span>
            <h2 className="mt-4 text-base font-semibold text-ink-950">{report.title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-500">{report.desc}</p>
            <span className="mt-auto pt-5 text-sm font-medium text-primary-700 group-hover:underline">Open report</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
