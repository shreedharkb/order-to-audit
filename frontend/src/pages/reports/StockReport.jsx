import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { formatCurrency, formatQty } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import StockBadge from '../../components/StockBadge';
import DataTable from '../../components/DataTable';
import toast from 'react-hot-toast';

export default function StockReport() {
  const [stockSummary, setStockSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/reports/stock-summary')
      .then(res => setStockSummary(res.data))
      .catch(err => toast.error('Failed to load stock report'))
      .finally(() => setLoading(false));
  }, []);

  const handleExport = async () => {
    try {
      const res = await client.get('/reports/export/stock', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Stock_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Stock report exported to Excel');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const columns = [
    { key: 'name', label: 'Item Name' },
    { key: 'type', label: 'Category', render: val => <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100">{val.replace('_', ' ')}</span> },
    { key: 'current_balance', label: 'Stock Balance', align: 'right', render: (val, r) => <StockBadge balance={val} reorderLevel={r.reorder_level} unit={r.unit} /> },
    { key: 'weighted_avg_rate_paisa', label: 'Cost Valuation Rate', align: 'right', render: (val, r) => `${formatCurrency(val)} / ${r.unit}` },
    { key: 'stock_value_paisa', label: 'Valuation Total', align: 'right', render: val => <span className="font-extrabold text-gray-900">{formatCurrency(val)}</span> }
  ];

  if (loading) return <LoadingSpinner message="Compiling inventory balances..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Stock Valuation & Audit Report</h1>
          <p className="text-sm text-gray-500">Real-time balances across raw materials, packaging, and packaged finished goods</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={stockSummary}
        onExport={handleExport}
        exportLabel="Download Excel"
      />
    </div>
  );
}
