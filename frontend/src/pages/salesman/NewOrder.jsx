import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import { formatCurrency } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { Store, ShoppingCart, CheckCircle2 } from 'lucide-react';

export default function NewOrder() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [quantities, setQuantities] = useState({}); // { itemId: qty }
  const [notes, setNotes] = useState('');

  useEffect(() => {
    Promise.all([
      client.get('/masters/customers'),
      client.get('/masters/items?type=finished_good')
    ])
      .then(([custRes, prodRes]) => {
        setCustomers(custRes.data);
        setProducts(prodRes.data);
      })
      .catch(err => {
        toast.error('Failed to load customers or products');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleQtyChange = (itemId, val) => {
    const num = parseFloat(val) || 0;
    setQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(0, num)
    }));
  };

  const selectedCustomer = customers.find(c => String(c.id) === String(selectedCustomerId));

  // Compute total
  let orderTotalPaisa = 0;
  const itemsToSubmit = [];

  products.forEach(p => {
    const qty = quantities[p.id] || 0;
    if (qty > 0) {
      const pricePaisa = parseInt(p.selling_price_paisa || 0, 10);
      orderTotalPaisa += qty * pricePaisa;
      itemsToSubmit.push({
        itemId: p.id,
        qty,
        name: p.name,
        pricePaisa,
        unit: p.unit
      });
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      toast.error('Please select a retailer or distributor');
      return;
    }
    if (itemsToSubmit.length === 0) {
      toast.error('Please enter quantity for at least one item');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customerId: parseInt(selectedCustomerId, 10),
        items: itemsToSubmit.map(i => ({ itemId: i.itemId, qty: i.qty })),
        notes
      };

      const res = await client.post('/orders', payload);
      toast.success(`Order ${res.data.order?.order_number || ''} submitted to factory!`);
      navigate('/salesman/orders');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit order');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner message="Preparing catalog..." />;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Quick Order Booking</h1>
        <p className="text-sm text-gray-500">Fast 1-minute order booking for field salesmen</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Customer Selection */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm space-y-3">
          <label className="flex items-center space-x-2 text-sm font-bold text-gray-900">
            <Store className="w-4 h-4 text-orange-600" />
            <span>Select Customer (Retailer / Distributor)</span>
          </label>
          <select
            value={selectedCustomerId}
            onChange={e => setSelectedCustomerId(e.target.value)}
            className="w-full p-3.5 bg-gray-50 border border-gray-300 rounded-xl font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
            required
          >
            <option value="">-- Choose a customer --</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type.toUpperCase()}) - {c.state} [{c.city || ''}]
              </option>
            ))}
          </select>

          {selectedCustomer && (
            <div className="mt-2 p-3 bg-orange-50/70 rounded-xl text-xs text-orange-900 border border-orange-200/50 space-y-0.5">
              <p className="font-bold">{selectedCustomer.name}</p>
              <p>GSTIN: <span className="font-mono font-medium">{selectedCustomer.gstin || 'Unregistered'}</span></p>
              <p>State: {selectedCustomer.state} (Code: {selectedCustomer.state_code})</p>
            </div>
          )}
        </div>

        {/* Step 2: Product Catalogue with direct Quantity inputs */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm space-y-4">
          <label className="flex items-center space-x-2 text-sm font-bold text-gray-900">
            <ShoppingCart className="w-4 h-4 text-orange-600" />
            <span>Add Products & Quantities</span>
          </label>

          <div className="divide-y divide-gray-100">
            {products.map(p => {
              const currentQty = quantities[p.id] || '';

              return (
                <div key={p.id} className="py-4 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-sm sm:text-base">{p.name}</h3>
                    <p className="text-xs text-gray-500">{p.description || 'Packaged snack'}</p>
                    <p className="text-xs font-bold text-orange-600 mt-1">
                      {formatCurrency(p.selling_price_paisa)} / {p.unit}
                    </p>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="w-24">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        value={currentQty}
                        onChange={e => handleQtyChange(p.id, e.target.value)}
                        className="w-full text-center py-2.5 px-2 border-2 border-orange-200 rounded-xl font-bold text-gray-900 focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600 text-base"
                      />
                    </div>
                    <span className="text-xs text-gray-500 font-medium w-12">{p.unit}s</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 3: Order Remarks */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm space-y-2">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Order Remarks (Optional)</label>
          <textarea
            rows="2"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Delivery instructions, urgent timing..."
            className="w-full p-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
          ></textarea>
        </div>

        {/* Sticky Mobile Summary Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-2xl z-20">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-gray-500 font-semibold">Total Order Value</p>
              <p className="text-xl sm:text-2xl font-black text-gray-900">{formatCurrency(orderTotalPaisa)}</p>
            </div>
            <button
              type="submit"
              disabled={submitting || itemsToSubmit.length === 0 || !selectedCustomerId}
              className="inline-flex items-center justify-center space-x-2 px-6 py-3.5 bg-orange-600 text-white rounded-xl font-bold text-sm sm:text-base hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-orange-900/20 transition-all"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{submitting ? 'Transmitting...' : 'Submit Order'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
