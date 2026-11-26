import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { formatCurrency, formatDate, formatQty } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import StockBadge from '../../components/StockBadge';
import DataTable from '../../components/DataTable';
import toast from 'react-hot-toast';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';

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
      .catch(() => toast.error('Failed to load inventory'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStock();
  }, [activeTab]);

  const viewLedger = async item => {
    setSelectedItemLedger(item);
    setLoadingLedger(true);
    try {
      const res = await client.get(`/reports/stock-ledger?itemId=${item.id}`);
      setLedgerMovements(res.data);
    } catch {
      toast.error('Failed to fetch stock movements');
    } finally {
      setLoadingLedger(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Item name' },
    {
      key: 'type',
      label: 'Category',
      render: value => <Badge variant="outline" className="capitalize">{value.replaceAll('_', ' ')}</Badge>
    },
    {
      key: 'current_balance',
      label: 'Balance on floor',
      align: 'right',
      render: (value, row) => <StockBadge balance={value} reorderLevel={row.reorder_level} unit={row.unit} />
    },
    {
      key: 'weighted_avg_rate_paisa',
      label: 'Valuation rate',
      align: 'right',
      render: (value, row) => `${formatCurrency(value)} / ${row.unit}`
    },
    {
      key: 'stock_value_paisa',
      label: 'Inventory value',
      align: 'right',
      render: value => <span className="font-semibold text-ink-950">{formatCurrency(value)}</span>
    },
    {
      key: 'actions',
      label: 'Traceability',
      align: 'right',
      render: (_, row) => (
        <Button type="button" variant="ghost" size="sm" className="h-auto px-0 text-primary-700 hover:bg-transparent hover:text-primary-800" onClick={() => viewLedger(row)}>
          View movements
        </Button>
      )
    }
  ];

  const tabs = [
    { id: 'all', label: 'All items' },
    { id: 'raw_material', label: 'Raw materials' },
    { id: 'packaging', label: 'Packaging' },
    { id: 'finished_good', label: 'Finished goods' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="page-title">Stock balances and ledger</h1>
          <p className="page-subtitle">Opening balance + receipts − issues = closing balance.</p>
        </div>

        <div className="scrollbar-none flex gap-1 overflow-x-auto rounded-lg bg-slate-200/70 p-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium transition-colors ${activeTab === tab.id ? 'bg-white text-ink-950 shadow-sm' : 'text-ink-600 hover:text-ink-950'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Reconciling stock ledger..." />
      ) : (
        <DataTable columns={columns} data={stockSummary} searchPlaceholder="Search material or finished product..." />
      )}

      <Dialog open={Boolean(selectedItemLedger)} onOpenChange={open => { if (!open) setSelectedItemLedger(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Stock movement ledger</DialogTitle>
            <DialogDescription>{selectedItemLedger?.name} · Every stock entry tied to its source transaction.</DialogDescription>
          </DialogHeader>

          <div className="mt-5 min-h-40 flex-1 overflow-auto">
            {loadingLedger ? (
              <LoadingSpinner message="Loading movement rows..." />
            ) : ledgerMovements.length === 0 ? (
              <div className="py-12 text-center text-sm text-ink-500">No movements recorded yet.</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-ink-600">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Date</th>
                      <th className="px-3 py-2.5 font-medium">Type</th>
                      <th className="px-3 py-2.5 font-medium">Notes</th>
                      <th className="px-3 py-2.5 text-right font-medium text-emerald-700">Qty in</th>
                      <th className="px-3 py-2.5 text-right font-medium text-red-700">Qty out</th>
                      <th className="px-3 py-2.5 text-right font-medium">Running balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {ledgerMovements.map(movement => (
                      <tr key={movement.id}>
                        <td className="px-3 py-2.5 text-ink-600">{formatDate(movement.txn_date)}</td>
                        <td className="px-3 py-2.5"><Badge variant="outline" className="capitalize">{movement.txn_type.replaceAll('_', ' ')}</Badge></td>
                        <td className="max-w-xs truncate px-3 py-2.5 text-ink-600">{movement.notes || '-'}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-emerald-700">
                          {parseFloat(movement.qty_in) > 0 ? `+${formatQty(movement.qty_in, movement.unit)}` : '-'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-red-700">
                          {parseFloat(movement.qty_out) > 0 ? `-${formatQty(movement.qty_out, movement.unit)}` : '-'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-ink-950">{formatQty(movement.running_balance, movement.unit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
