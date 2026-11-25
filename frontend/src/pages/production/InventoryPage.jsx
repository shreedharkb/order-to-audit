import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { formatCurrency, formatDate, formatQty } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import StockBadge from '../../components/StockBadge';
import DataTable from '../../components/DataTable';
import toast from 'react-hot-toast';
import { Package, BookOpen, Layers } from 'lucide-react';

export default function InventoryPage() {
  const [stockSummary, setStockSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedItemLedger, setSelectedItemLedger] = useState(null);
  const [ledgerMovements, setLedgerMovements] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const fetchStock = () => {
    setLoading(true);
    let url = '/reports/stock-summary';
    if (activeTab !== 'all') url += `?type=${activeTab}`;
    client.get(url)
      .then(res => setStockSummary(res.data))
      .catch(err => toast.error('Failed to load inventory'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStock();
  }, [activeTab]);

  const viewLedger = async (item) => {
    setSelectedItemLedger(item);
    setLoadingLedger(true);
    try {
      const res = await client.get(`/reports/stock-ledger?itemId=${item.id}`);
      setLedgerMovements(res.data);
    } catch (err) {
      toast.error('Failed to fetch stock movements');
    } finally {
      setLoadingLedger(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Item Name' },
    {
      key: 'type',
      label: 'Category',
      render: val => <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100">{val.replace('_', ' ')}</span>
    },
    {
      key: 'current_balance',
      label: 'Balance on Floor',
      align: 'right',
      render: (val, r) => <StockBadge balance={val} reorderLevel={r.reorder_level} unit={r.unit} />
    },
    {
      key: 'weighted_avg_rate_paisa',
      label: 'Valuation Rate',
      align: 'right',
      render: (val, r) => `${formatCurrency(val)} / ${r.unit}`
    },
    {
      key: 'stock_value_paisa',
      label: 'Inventory Value',
      align: 'right',
      render: val => <span className="font-extrabold text-gray-900">{formatCurrency(val)}</span>
    },
    {
      key: 'actions',
      label: 'Traceability',
      align: 'right',
      render: (_, row) => (
        <button
          onClick={() => viewLedger(row)}
          className="text-xs font-bold text-orange-600 hover:text-orange-700 underline"
        >
          View Movements →
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Stock Balances & Audit Ledger</h1>
          <p className="text-sm text-gray-500">Continuous ledger reconciliation: Opening + Receipts − Issues = Closing</p>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1.5 p-1 bg-gray-200/70 rounded-xl text-xs font-bold">
          {[
            { id: 'all', label: 'All Items' },
            { id: 'raw_material', label: 'Raw Materials' },
            { id: 'packaging', label: 'Packaging' },
            { id: 'finished_good', label: 'Finished Goods' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Reconciling stock ledger..." />
      ) : (
        <DataTable
          columns={columns}
          data={stockSummary}
          searchPlaceholder="Search material or finished product..."
        />
      )}

      {/* Movement Ledger Modal for Selected Item */}
      {selectedItemLedger && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-orange-600" />
                  <span>Audit Trail Ledger: {selectedItemLedger.name}</span>
                </h3>
                <p className="text-xs text-gray-500">Every stock in/out entry tied to source transactions</p>
              </div>
              <button onClick={() => setSelectedItemLedger(null)} className="text-gray-400 hover:text-gray-600 font-bold">&times;</button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingLedger ? (
                <LoadingSpinner message="Extracting movement rows..." />
              ) : ledgerMovements.length === 0 ? (
                <div className="text-center p-8 text-gray-400">No movements recorded yet</div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-50 font-bold text-gray-700 sticky top-0 border-b">
                    <tr>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Notes</th>
                      <th className="p-2.5 text-right text-emerald-700">Qty In (+)</th>
                      <th className="p-2.5 text-right text-red-700">Qty Out (-)</th>
                      <th className="p-2.5 text-right font-black">Running Bal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ledgerMovements.map(m => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="p-2.5 text-gray-600">{formatDate(m.txn_date)}</td>
                        <td className="p-2.5 font-bold uppercase text-[10px]">
                          <span className="px-2 py-0.5 rounded bg-gray-100">{m.txn_type.replace('_', ' ')}</span>
                        </td>
                        <td className="p-2.5 text-gray-600 truncate max-w-xs">{m.notes || '-'}</td>
                        <td className="p-2.5 text-right font-bold text-emerald-700">
                          {parseFloat(m.qty_in) > 0 ? `+${formatQty(m.qty_in, m.unit)}` : '-'}
                        </td>
                        <td className="p-2.5 text-right font-bold text-red-700">
                          {parseFloat(m.qty_out) > 0 ? `-${formatQty(m.qty_out, m.unit)}` : '-'}
                        </td>
                        <td className="p-2.5 text-right font-black text-gray-900">
                          {formatQty(m.running_balance, m.unit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="pt-3 border-t flex justify-end">
              <button
                onClick={() => setSelectedItemLedger(null)}
                className="px-5 py-2 text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
