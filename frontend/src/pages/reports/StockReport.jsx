import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/format';
import { downloadBlob } from '../../utils/download';
import LoadingSpinner from '../../components/LoadingSpinner';
import StockBadge from '../../components/StockBadge';
import DataTable from '../../components/DataTable';
import DateRangeFilter from '../../components/DateRangeFilter';
import toast from 'react-hot-toast';

export default function StockReport() {
  const [stockSummary, setStockSummary] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [ledgerFilters, setLedgerFilters] = useState({ dateFrom: '', dateTo: '' });
  const [itemId, setItemId] = useState('');

  const fetchLedger = (range = ledgerFilters, selectedItem = itemId) => {
    setLedgerLoading(true);
    client.get('/reports/stock-ledger', { params: { ...range, itemId: selectedItem } })
      .then(res => setLedger(res.data))
      .catch(() => toast.error('Failed to load stock ledger'))
      .finally(() => setLedgerLoading(false));
  };

  useEffect(() => {
    client.get('/reports/stock-summary')
      .then(res => setStockSummary(res.data))
      .catch(() => toast.error('Failed to load stock report'))
      .finally(() => setLoading(false));
    fetchLedger({ dateFrom: '', dateTo: '' }, '');
  }, []);

  const handleExport = async () => {
    try {
      const res = await client.get('/reports/export/stock', { responseType: 'blob' });
      downloadBlob(res.data, `Stock_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Stock summary exported to Excel');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const handleLedgerExport = async () => {
    try {
      const res = await client.get('/reports/export/stock-ledger', {
        params: { ...ledgerFilters, itemId },
        responseType: 'blob'
      });
      downloadBlob(res.data, `Stock_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Stock ledger exported to Excel');
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

  const ledgerColumns = [
    { key: 'txn_date', label: 'Date', render: val => formatDate(val) },
    { key: 'item_name', label: 'Item' },
    { key: 'txn_type', label: 'Movement', render: val => val.replaceAll('_', ' ') },
    { key: 'txn_ref_type', label: 'Source', render: (val, row) => val ? `${val.replaceAll('_', ' ')} #${row.txn_ref_id}` : '-' },
    { key: 'qty_in', label: 'Qty In', align: 'right', render: (val, row) => val > 0 ? `${val} ${row.unit}` : '-' },
    { key: 'qty_out', label: 'Qty Out', align: 'right', render: (val, row) => val > 0 ? `${val} ${row.unit}` : '-' },
    { key: 'running_balance', label: 'Running Balance', align: 'right', render: (val, row) => <span className="font-bold">{val} {row.unit}</span> }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Stock Valuation & Audit Report</h1>
        <p className="page-subtitle">Current balances and source-linked ledger movements across all inventory categories</p>
      </div>

      {loading ? <LoadingSpinner message="Compiling inventory balances..." /> : (
        <DataTable columns={columns} data={stockSummary} onExport={handleExport} exportLabel="Download Summary" />
      )}

      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">Stock Ledger</h2>
        <DateRangeFilter
          loading={ledgerLoading}
          onApply={range => {
            setLedgerFilters(range);
            fetchLedger(range, itemId);
          }}
        />
        <label className="block mt-3 text-xs font-semibold text-gray-600">
          Item
          <select
            value={itemId}
            onChange={event => {
              setItemId(event.target.value);
              fetchLedger(ledgerFilters, event.target.value);
            }}
            className="mt-1 block max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
          >
            <option value="">All items</option>
            {stockSummary.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </div>

      {ledgerLoading ? <LoadingSpinner message="Loading stock movements..." /> : (
        <DataTable columns={ledgerColumns} data={ledger} onExport={handleLedgerExport} exportLabel="Download Ledger" searchPlaceholder="Search item or source..." />
      )}
    </div>
  );
}
