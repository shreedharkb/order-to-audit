import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { formatCurrency, formatDate, getStatusLabel } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import DataTable from '../../components/DataTable';
import toast from 'react-hot-toast';
import { Pencil, Save } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';

export default function OrderManagement() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stockModalOrder, setStockModalOrder] = useState(null);
  const [stockCheckData, setStockCheckData] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editLines, setEditLines] = useState([]);
  const [editNotes, setEditNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrders = () => {
    setLoading(true);
    client.get('/orders')
      .then(res => setOrders(res.data))
      .catch(err => toast.error('Failed to load orders'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleStockCheck = async (order) => {
    setStockModalOrder(order);
    setStockCheckData(null);
    try {
      const res = await client.get(`/orders/stock-check/${order.id}`);
      setStockCheckData(res.data);
    } catch (err) {
      toast.error('Stock check failed');
    }
  };

  const handleApprove = async (orderId) => {
    setActionLoading(true);
    try {
      const res = await client.put(`/orders/${orderId}/approve`);
      if (res.data.hasStockShortage) {
        toast((
          <div>
            <p className="font-bold text-amber-900">Order approved with stock warning!</p>
            <p className="text-xs text-amber-800">Finished goods shortage detected. Production needed.</p>
          </div>
        ), { duration: 5000 });
      } else {
        toast.success('Order approved successfully!');
      }
      setStockModalOrder(null);
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (orderId) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      await client.put(`/orders/${orderId}/reject`, { reason });
      toast.success('Order rejected');
      fetchOrders();
    } catch (err) {
      toast.error('Rejection failed');
    }
  };

  const handleEditOrder = async (order) => {
    try {
      const res = await client.get(`/orders/${order.id}`);
      setEditingOrder(res.data);
      setEditLines(res.data.lines.map(line => ({
        itemId: line.item_id,
        name: line.item_name,
        unit: line.unit,
        qty: line.qty,
        price: (line.price_paisa / 100).toFixed(2)
      })));
      setEditNotes(res.data.notes || '');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load order for editing');
    }
  };

  const handleSaveOrder = async () => {
    setActionLoading(true);
    try {
      await client.put(`/orders/${editingOrder.id}`, {
        notes: editNotes,
        items: editLines.map(line => ({
          itemId: line.itemId,
          qty: Number(line.qty),
          pricePaisa: Math.round(Number(line.price) * 100)
        }))
      });
      toast.success('Order updated');
      setEditingOrder(null);
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateInvoice = async (orderId) => {
    try {
      const res = await client.post('/invoices', { orderId });
      toast.success(`GST Invoice ${res.data.invoice_number} generated!`);
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to raise GST invoice');
    }
  };

  const columns = [
    { key: 'order_number', label: 'Order No' },
    { key: 'order_date', label: 'Date', render: (val) => formatDate(val) },
    { key: 'customer_name', label: 'Customer' },
    { key: 'customer_state', label: 'State' },
    { key: 'salesman_name', label: 'Booked By' },
    { key: 'total_paisa', label: 'Taxable Value', align: 'right', render: (val) => <span className="font-bold">{formatCurrency(val)}</span> },
    {
      key: 'status',
      label: 'Status',
      render: (val) => (
        <Badge variant="outline">{getStatusLabel(val)}</Badge>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end space-x-2">
          {row.status === 'submitted' && (
            <>
              <button
                onClick={() => handleEditOrder(row)}
                className="px-2.5 py-1 text-xs font-bold text-gray-700 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 inline-flex items-center gap-1"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                onClick={() => handleStockCheck(row)}
                className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
              >
                Stock Check
              </button>
              <button
                onClick={() => handleApprove(row.id)}
                className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
              >
                Approve
              </button>
              <button
                onClick={() => handleReject(row.id)}
                className="px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg"
              >
                Reject
              </button>
            </>
          )}

          {row.status === 'approved' && (
            <button
              onClick={() => handleCreateInvoice(row.id)}
              className="px-3 py-1 text-xs font-bold text-white bg-orange-600 rounded-lg hover:bg-orange-700 shadow-sm"
            >
              Raise GST invoice
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Sales orders</h1>
          <p className="page-subtitle">Verify orders against inventory and convert them to GST invoices.</p>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading orders..." />
      ) : (
        <DataTable
          columns={columns}
          data={orders}
          searchPlaceholder="Search order, customer, state..."
        />
      )}

      <Dialog open={Boolean(editingOrder)} onOpenChange={open => { if (!open) setEditingOrder(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Verify order</DialogTitle>
            <DialogDescription>{editingOrder?.order_number} · {editingOrder?.customer_name}</DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-3">
            {editLines.map((line, index) => (
              <div key={line.itemId} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_100px_130px] sm:items-center">
                <div>
                  <p className="text-sm font-medium text-ink-950">{line.name}</p>
                  <p className="text-xs text-ink-500">Quantity in {line.unit}</p>
                </div>
                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={line.qty}
                  onChange={event => setEditLines(lines => lines.map((item, i) => i === index ? { ...item, qty: event.target.value } : item))}
                  className="input-field"
                  aria-label={`Quantity for ${line.name}`}
                />
                <div className="relative">
                  <span className="absolute left-3 top-2 text-sm text-ink-500">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.price}
                    onChange={event => setEditLines(lines => lines.map((item, i) => i === index ? { ...item, price: event.target.value } : item))}
                    className="input-field pl-7"
                    aria-label={`Price for ${line.name}`}
                  />
                </div>
              </div>
            ))}
          </div>

          <textarea
            value={editNotes}
            onChange={event => setEditNotes(event.target.value)}
            placeholder="Order notes"
            rows={2}
            className="input-field mt-4"
          />

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSaveOrder} disabled={actionLoading}>
              <Save className="h-4 w-4" /> Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Verification Modal */}
      <Dialog open={Boolean(stockModalOrder && stockCheckData)} onOpenChange={open => { if (!open) setStockModalOrder(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Inventory availability</DialogTitle>
            <DialogDescription>{stockModalOrder?.order_number} · {stockModalOrder?.customer_name}</DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-3">
            {stockCheckData?.items?.map((item, index) => (
              <div key={index} className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ${item.isSufficient ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                <div>
                  <h4 className="text-sm font-medium text-ink-950">{item.itemName}</h4>
                  <p className="mt-1 text-xs text-ink-600">
                    Requested {item.requested} {item.unit}; available {item.available} {item.unit}
                  </p>
                </div>
                <Badge variant={item.isSufficient ? 'success' : 'danger'}>
                  {item.isSufficient ? 'Ready' : `Shortage: ${item.shortage} ${item.unit}`}
                </Badge>
              </div>
            ))}
          </div>

          {stockCheckData && !stockCheckData.canFulfill && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              Stock is insufficient for this order. Approving it will flag the shortage for production planning.
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Close</Button>
            </DialogClose>
            <Button onClick={() => handleApprove(stockModalOrder.id)} disabled={actionLoading}>
              Approve order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
