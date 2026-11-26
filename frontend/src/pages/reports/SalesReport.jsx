import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/format';
import { downloadBlob } from '../../utils/download';
import LoadingSpinner from '../../components/LoadingSpinner';
import DataTable from '../../components/DataTable';
import DateRangeFilter from '../../components/DateRangeFilter';
import toast from 'react-hot-toast';

export default function SalesReport() {
  const [report, setReport] = useState(null);
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '' });
  const [loading, setLoading] = useState(true);

  const fetchReport = (range = filters) => {
    setLoading(true);
    client.get('/reports/sales', { params: range })
      .then(res => setReport(res.data))
      .catch(() => toast.error('Failed to load sales register'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReport({ dateFrom: '', dateTo: '' });
  }, []);

  const handleApply = range => {
    setFilters(range);
    fetchReport(range);
  };

  const handleExport = async () => {
    try {
      const res = await client.get('/reports/export/sales', { params: filters, responseType: 'blob' });
      downloadBlob(res.data, `Sales_Register_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Sales Register exported to Excel');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const invoiceColumns = [
    { key: 'invoice_number', label: 'Invoice No' },
    { key: 'invoice_date', label: 'Date', render: val => formatDate(val) },
    { key: 'customer_name', label: 'Customer' },
    { key: 'customer_state', label: 'State' },
    { key: 'subtotal_paisa', label: 'Taxable (Rs)', align: 'right', render: val => formatCurrency(val) },
    { key: 'cgst_paisa', label: 'CGST', align: 'right', render: val => formatCurrency(val) },
    { key: 'sgst_paisa', label: 'SGST', align: 'right', render: val => formatCurrency(val) },
    { key: 'igst_paisa', label: 'IGST', align: 'right', render: val => formatCurrency(val) },
    { key: 'total_paisa', label: 'Invoice Total', align: 'right', render: val => <span className="font-bold">{formatCurrency(val)}</span> }
  ];

  const customerColumns = [
    { key: 'customer_name', label: 'Customer' },
    { key: 'customer_state', label: 'State' },
    { key: 'invoice_count', label: 'Invoices', align: 'right' },
    { key: 'taxable_paisa', label: 'Taxable', align: 'right', render: val => formatCurrency(val) },
    { key: 'total_paisa', label: 'Total Sales', align: 'right', render: val => <span className="font-bold">{formatCurrency(val)}</span> }
  ];

  const productColumns = [
    { key: 'item_name', label: 'Product' },
    { key: 'hsn_code', label: 'HSN' },
    { key: 'total_qty', label: 'Quantity', align: 'right' },
    { key: 'unit', label: 'Unit' },
    { key: 'taxable_paisa', label: 'Taxable', align: 'right', render: val => formatCurrency(val) },
    { key: 'total_paisa', label: 'Total Sales', align: 'right', render: val => <span className="font-bold">{formatCurrency(val)}</span> }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Sales Register & Outward Supplies</h1>
        <p className="page-subtitle">Auditor-grade register with customer-wise and product-wise breakdowns</p>
      </div>

      <DateRangeFilter onApply={handleApply} loading={loading} />

      {loading ? <LoadingSpinner message="Generating Sales Register..." /> : (
        <div className="space-y-6">
          <DataTable columns={invoiceColumns} data={report?.invoices || []} onExport={handleExport} exportLabel="Download Excel" />
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Customer-wise Sales</h2>
            <DataTable columns={customerColumns} data={report?.customerSummary || []} searchable={false} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Product-wise Sales</h2>
            <DataTable columns={productColumns} data={report?.productSummary || []} searchable={false} />
          </div>
        </div>
      )}
    </div>
  );
}
