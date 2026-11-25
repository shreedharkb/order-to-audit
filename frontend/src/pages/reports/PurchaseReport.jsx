import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/format';
import { downloadBlob } from '../../utils/download';
import LoadingSpinner from '../../components/LoadingSpinner';
import DataTable from '../../components/DataTable';
import DateRangeFilter from '../../components/DateRangeFilter';
import toast from 'react-hot-toast';

export default function PurchaseReport() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '' });
  const [loading, setLoading] = useState(true);

  const fetchReport = (range = filters) => {
    setLoading(true);
    client.get('/reports/purchases', { params: range })
      .then(res => setRows(res.data))
      .catch(() => toast.error('Failed to load purchase register'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReport({ dateFrom: '', dateTo: '' });
  }, []);

  const handleExport = async () => {
    try {
      const res = await client.get('/reports/export/purchases', { params: filters, responseType: 'blob' });
      downloadBlob(res.data, `Purchase_Register_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Purchase register exported to Excel');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const columns = [
    { key: 'purchase_date', label: 'Date', render: val => formatDate(val) },
    { key: 'invoice_number', label: 'Supplier Invoice', render: val => val || '-' },
    { key: 'supplier_name', label: 'Supplier', render: val => val || 'Direct / Unspecified' },
    { key: 'item_name', label: 'Item' },
    { key: 'qty', label: 'Quantity', align: 'right', render: (val, row) => `${val} ${row.unit}` },
    { key: 'rate_paisa', label: 'Rate', align: 'right', render: val => formatCurrency(val) },
    { key: 'amount_paisa', label: 'Amount', align: 'right', render: val => <span className="font-bold">{formatCurrency(val)}</span> }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Purchase Register</h1>
        <p className="text-sm text-gray-500">Raw material and packaging receipts with supplier, quantity, rate, and value</p>
      </div>
      <DateRangeFilter
        loading={loading}
        onApply={range => {
          setFilters(range);
          fetchReport(range);
        }}
      />
      {loading ? <LoadingSpinner message="Loading purchase register..." /> : (
        <DataTable columns={columns} data={rows} onExport={handleExport} exportLabel="Download Excel" searchPlaceholder="Search supplier, invoice, or item..." />
      )}
    </div>
  );
}
