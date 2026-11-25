import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import DataTable from '../../components/DataTable';
import toast from 'react-hot-toast';

export default function SalesReport() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = () => {
    setLoading(true);
    client.get('/reports/sales')
      .then(res => setReport(res.data))
      .catch(err => toast.error('Failed to load sales register'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handleExport = async () => {
    try {
      const res = await client.get('/reports/export/sales', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Sales_Register_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
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

  if (loading) return <LoadingSpinner message="Generating Sales Register..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Sales Register & Outward Supplies</h1>
          <p className="text-sm text-gray-500">Auditor-grade register with customer-wise and product-wise breakdowns</p>
        </div>
      </div>

      <div className="space-y-4">
        <DataTable
          columns={invoiceColumns}
          data={report?.invoices || []}
          onExport={handleExport}
          exportLabel="Download Excel"
        />
      </div>
    </div>
  );
}
