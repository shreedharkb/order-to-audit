import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import DataTable from '../../components/DataTable';
import toast from 'react-hot-toast';
import { ShoppingCart, Plus, Check } from 'lucide-react';

export default function PurchaseManagement() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [rawItems, setRawItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State for Benchmark Step 1: 60kg flour at Rs 45/kg
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [qty, setQty] = useState('');
  const [rateRupees, setRateRupees] = useState('');

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      client.get('/purchases'),
      client.get('/masters/suppliers'),
      client.get('/masters/items')
    ])
      .then(([purRes, supRes, itemRes]) => {
        setPurchases(purRes.data);
        setSuppliers(supRes.data);
        setRawItems(itemRes.data.filter(i => i.type !== 'finished_good'));
      })
      .catch(err => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRecordPurchase = async (e) => {
    e.preventDefault();
    if (!selectedItemId || !qty || !rateRupees) {
      toast.error('Please specify material, quantity, and rate');
      return;
    }

    const itemObj = rawItems.find(i => String(i.id) === String(selectedItemId));
    const ratePaisa = Math.round(parseFloat(rateRupees) * 100);

    setSubmitting(true);
    try {
      const payload = {
        supplierId: supplierId ? parseInt(supplierId, 10) : null,
        invoiceNumber,
        items: [
          {
            itemId: parseInt(selectedItemId, 10),
            qty: parseFloat(qty),
            unit: itemObj?.unit || 'kg',
            ratePaisa
          }
        ]
      };

      await client.post('/purchases', payload);
      toast.success('Raw material purchase recorded and stock ledger updated!');
      setQty('');
      setRateRupees('');
      setInvoiceNumber('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Purchase failed');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: 'invoice_number', label: 'Supplier Inv No', render: val => val || 'Direct Receipt' },
    { key: 'purchase_date', label: 'Date', render: val => formatDate(val) },
    { key: 'supplier_name', label: 'Supplier', render: val => val || 'Walk-in Vendor' },
    { key: 'total_paisa', label: 'Total Value', align: 'right', render: val => <span className="font-bold">{formatCurrency(val)}</span> }
  ];

  if (loading) return <LoadingSpinner message="Loading raw purchases ledger..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Raw Materials & Packaging Purchases</h1>
        <p className="text-sm text-gray-500">Record inward shipments into the stock ledger to update raw stock and weighted average costing</p>
      </div>

      {/* Record Purchase Card (Pre-fill helper for Benchmark Step 1) */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-orange-600" />
          <span>Inward Material Entry (Benchmark Step 1)</span>
        </h2>

        <form onSubmit={handleRecordPurchase} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">Supplier</label>
            <select
              value={supplierId}
              onChange={e => setSupplierId(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm"
            >
              <option value="">Select Supplier</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">Item</label>
            <select
              value={selectedItemId}
              onChange={e => setSelectedItemId(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-semibold"
              required
            >
              <option value="">Select Raw Item</option>
              {rawItems.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">Quantity</label>
            <input
              type="number"
              step="any"
              placeholder="e.g. 60"
              value={qty}
              onChange={e => setQty(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">Rate (Rs / unit)</label>
            <input
              type="number"
              step="any"
              placeholder="e.g. 45"
              value={rateRupees}
              onChange={e => setRateRupees(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold"
              required
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>Record</span>
            </button>
          </div>
        </form>

        <div className="p-3 bg-orange-50 rounded-xl text-xs text-orange-950 flex items-center justify-between">
          <span>💡 <strong>Benchmark Quick Fill:</strong> Select <em>Rice Flour</em>, Qty: <strong>60 kg</strong>, Rate: <strong>Rs 45</strong> to execute Benchmark Step 1.</span>
          <button
            type="button"
            onClick={() => {
              const flour = rawItems.find(i => i.name.toLowerCase().includes('flour'));
              if (flour) setSelectedItemId(flour.id);
              setQty('60');
              setRateRupees('45');
              setInvoiceNumber('PUR-BENCH-01');
            }}
            className="font-bold underline text-orange-700 hover:text-orange-900"
          >
            Fill Benchmark
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={purchases}
        searchPlaceholder="Search supplier or invoice number..."
      />
    </div>
  );
}
