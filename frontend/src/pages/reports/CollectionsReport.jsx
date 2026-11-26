import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/format';
import { downloadBlob } from '../../utils/download';
import LoadingSpinner from '../../components/LoadingSpinner';
import DataTable from '../../components/DataTable';
import DateRangeFilter from '../../components/DateRangeFilter';
import toast from 'react-hot-toast';

export default function CollectionsReport() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '' });
  const [loading, setLoading] = useState(true);

  const fetchReport = (range = filters) => {
    setLoading(true);
    client.get('/reports/collections', { params: range })
      .then(res => setRows(res.data))
      .catch(() => toast.error('Failed to load collections register'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReport({ dateFrom: '', dateTo: '' });
  }, []);

  const handleExport = async () => {
    try {
      const res = await client.get('/reports/export/collections', { params: filters, responseType: 'blob' });
      downloadBlob(res.data, `Collections_Register_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Collections register exported to Excel');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const columns = [
    { key: 'payment_date', label: 'Date', render: val => formatDate(val) },
    { key: 'customer_name', label: 'Customer' },
    { key: 'invoice_number', label: 'Invoice', render: val => val || 'On account' },
    { key: 'mode', label: 'Mode', render: val => val.toUpperCase() },
    { key: 'reference_number', label: 'Reference', render: val => val || '-' },
    { key: 'amount_paisa', label: 'Amount', align: 'right', render: val => <span className="font-bold">{formatCurrency(val)}</span> },
    {
      key: 'is_reversed',
      label: 'Status',
      render: val => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${val ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {val ? 'Reversed' : 'Collected'}
        </span>
      )
    },
    { key: 'recorded_by_name', label: 'Recorded By', render: val => val || '-' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Payments & Collections Register</h1>
        <p className="page-subtitle">Customer receipts, payment modes, invoice references, and reversal status</p>
      </div>
      <DateRangeFilter
        loading={loading}
        onApply={range => {
          setFilters(range);
          fetchReport(range);
        }}
      />
      {loading ? <LoadingSpinner message="Loading collections register..." /> : (
        <DataTable columns={columns} data={rows} onExport={handleExport} exportLabel="Download Excel" searchPlaceholder="Search customer or invoice..." />
      )}
    </div>
  );
}
