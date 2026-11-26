import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import { formatCurrency } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/button';

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
        <h1 className="page-title">New sales order</h1>
        <p className="page-subtitle">Select a customer and enter the quantities to book.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Customer Selection */}
        <div className="card space-y-3">
          <label htmlFor="order-customer" className="label">Customer</label>
          <select
            id="order-customer"
            value={selectedCustomerId}
            onChange={e => setSelectedCustomerId(e.target.value)}
            className="input-field"
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
        <div className="card space-y-4">
          <h2 className="section-title">Products and quantities</h2>

          <div className="divide-y divide-slate-100">
            {products.map(p => {
              const currentQty = quantities[p.id] || '';

              return (
                <div key={p.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-ink-950">{p.name}</h3>
                    <p className="mt-0.5 text-xs text-ink-500">{p.description || 'Packaged snack'}</p>
                    <p className="mt-1 text-xs font-medium text-primary-700">
                      {formatCurrency(p.selling_price_paisa)} / {p.unit}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={currentQty}
                      onChange={e => handleQtyChange(p.id, e.target.value)}
                      className="input-field w-24 text-center"
                      aria-label={`Quantity for ${p.name}`}
                    />
                    <span className="w-12 text-xs text-ink-500">{p.unit}s</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 3: Order Remarks */}
        <div className="card space-y-2">
          <label htmlFor="order-notes" className="label">Order remarks <span className="font-normal text-ink-500">(optional)</span></label>
          <textarea
            id="order-notes"
            rows="2"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Delivery instructions or urgent timing"
            className="input-field"
          ></textarea>
        </div>

        {/* Sticky Mobile Summary Bar */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
            <div>
              <p className="text-xs text-ink-500">Total order value</p>
              <p className="text-xl font-semibold text-ink-950">{formatCurrency(orderTotalPaisa)}</p>
            </div>
            <Button
              type="submit"
              disabled={submitting || itemsToSubmit.length === 0 || !selectedCustomerId}
            >
              {submitting ? 'Submitting...' : 'Submit order'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
