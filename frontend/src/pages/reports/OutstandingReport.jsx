import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { formatCurrency } from '../../utils/format';
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

  const columns = [
    { key: 'customerName', label: 'Customer' },
    { key: 'state', label: 'State' },
    { key: 'totalInvoicedPaisa', label: 'Total Invoiced', align: 'right', render: val => formatCurrency(val) },
    { key: 'totalPaidPaisa', label: 'Collections', align: 'right', render: val => formatCurrency(val) },
    {
      key: 'outstandingPaisa',
      label: 'Balance Dues',
      align: 'right',
      render: val => <span className={`font-black ${val > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatCurrency(val)}</span>
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
      label: '61+ Days',
      align: 'right',
      render: val => formatCurrency((val?.days61to90Paisa || 0) + (val?.days90PlusPaisa || 0))
    }
  ];

  if (loading) return <LoadingSpinner message="Calculating customer ageing..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Accounts Receivable & Ageing Analysis</h1>
        <p className="text-sm text-gray-500">Customer outstanding balances stratified into FIFO ageing time buckets</p>
      </div>

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search customer..."
      />
    </div>
  );
}
