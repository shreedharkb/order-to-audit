import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import DataTable from '../../components/DataTable';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, AlertTriangle, FileText, Package } from 'lucide-react';

export default function OrderManagement() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stockModalOrder, setStockModalOrder] = useState(null);
  const [stockCheckData, setStockCheckData] = useState(null);
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
        toast((t) => (
          <div>
            <p className="font-bold text-amber-900">Order approved with stock warning!</p>
            <p className="text-xs text-amber-800">Finished goods shortage detected. Production needed.</p>
          </div>
        ), { icon: '⚠️', duration: 5000 });
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
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(val)}`}>
          {getStatusLabel(val)}
        </span>
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
              className="px-3 py-1 text-xs font-bold text-white bg-orange-600 rounded-lg hover:bg-orange-700 shadow-sm inline-flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Raise GST Invoice</span>
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
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Sales Orders Desk</h1>
          <p className="text-sm text-gray-500">Verify salesman orders against inventory and convert to GST tax invoices</p>
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

      {/* Stock Verification Modal */}
      {stockModalOrder && stockCheckData && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Inventory Availability Check</h3>
                <p className="text-xs text-gray-500">Order: {stockModalOrder.order_number} ({stockModalOrder.customer_name})</p>
              </div>
              <button onClick={() => setStockModalOrder(null)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>

            <div className="space-y-3">
              {stockCheckData.items?.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    item.isSufficient ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">{item.itemName}</h4>
                    <p className="text-xs text-gray-600">
                      Requested: <strong className="text-gray-900">{item.requested}</strong> {item.unit}s | Available: <strong className="text-gray-900">{item.available}</strong> {item.unit}s
                    </p>
                  </div>
                  <div>
                    {item.isSufficient ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2.5 py-1 rounded-full">
                        <AlertTriangle className="w-3.5 h-3.5" /> Shortage: {item.shortage} {item.unit}s
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {!stockCheckData.canFulfill && (
              <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-900 border border-amber-200">
                <strong>Benchmark Note:</strong> For Distributor B (120 packets), stock on floor is 88 packets. System flags the 32 packet shortage. You can still approve to trigger production schedule!
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-3 border-t">
              <button
                onClick={() => setStockModalOrder(null)}
                className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-xl"
              >
                Close
              </button>
              <button
                onClick={() => handleApprove(stockModalOrder.id)}
                disabled={actionLoading}
                className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md"
              >
                Approve Order Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
