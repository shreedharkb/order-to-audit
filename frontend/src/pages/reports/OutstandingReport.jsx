import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/format';
import { downloadBlob } from '../../utils/download';
import LoadingSpinner from '../../components/LoadingSpinner';
import DataTable from '../../components/DataTable';
import toast from 'react-hot-toast';

export default function OutstandingReport() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/payments/outstanding')
      .then(res => setData(res.data))
      .catch(err => toast.error('Failed to load receivables report'))
      .finally(() => setLoading(false));
  }, []);

  const handleExport = async () => {
    try {
      const res = await client.get('/reports/export/outstanding', { responseType: 'blob' });
      downloadBlob(res.data, `Outstanding_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Outstanding report exported to Excel');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const columns = [
    { key: 'customerName', label: 'Customer' },
    { key: 'state', label: 'State' },
    { key: 'totalInvoicedPaisa', label: 'Total Invoiced', align: 'right', render: val => formatCurrency(val) },
    { key: 'totalPaidPaisa', label: 'Collections', align: 'right', render: val => formatCurrency(val) },
    {
      key: 'outstandingPaisa',
      label: 'Balance Dues',
      align: 'right',
      render: val => <span className={`font-semibold ${val > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatCurrency(val)}</span>
    },
    {
      key: 'ageing',
      label: '0 - 30 Days',
      align: 'right',
      render: val => formatCurrency(val?.current0to30Paisa || 0)
    },
    {
      key: 'ageing',
      label: '31 - 60 Days',
      align: 'right',
      render: val => formatCurrency(val?.days31to60Paisa || 0)
    },
    {
      key: 'ageing',
      label: '61 - 90 Days',
      align: 'right',
      render: val => formatCurrency(val?.days61to90Paisa || 0)
    },
    {
      key: 'ageing',
      label: '90+ Days',
      align: 'right',
      render: val => formatCurrency(val?.days90PlusPaisa || 0)
    }
  ];

  if (loading) return <LoadingSpinner message="Calculating customer ageing..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Accounts Receivable & Ageing Analysis</h1>
        <p className="page-subtitle">Current customer balances as of {formatDate(new Date())}, aged using FIFO allocation</p>
      </div>

      <DataTable
        columns={columns}
        data={data}
        onExport={handleExport}
        exportLabel="Download Excel"
        searchPlaceholder="Search customer..."
      />
    </div>
  );
}
