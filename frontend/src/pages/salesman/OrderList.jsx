import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import DataTable from '../../components/DataTable';
import { ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';

export default function OrderList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [orderDetails, setOrderDetails] = useState({});

  const fetchOrders = () => {
    setLoading(true);
    let url = '/orders';
    if (statusFilter) url += `?status=${statusFilter}`;
    client.get(url)
      .then(res => setOrders(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const toggleExpand = async (orderId) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }
    setExpandedOrderId(orderId);
    if (!orderDetails[orderId]) {
      try {
        const res = await client.get(`/orders/${orderId}`);
        setOrderDetails(prev => ({ ...prev, [orderId]: res.data }));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const columns = [
    { key: 'order_number', label: 'Order No' },
    { key: 'order_date', label: 'Date', render: (val) => formatDate(val) },
    { key: 'customer_name', label: 'Customer' },
    { key: 'total_paisa', label: 'Amount', align: 'right', render: (val) => <span className="font-bold">{formatCurrency(val)}</span> },
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
      label: 'Details',
      render: (_, row) => (
        <button
          onClick={() => toggleExpand(row.id)}
          className="text-xs font-semibold text-orange-600 hover:text-orange-700 inline-flex items-center gap-1"
        >
          {expandedOrderId === row.id ? <>Hide <ChevronUp className="w-3.5 h-3.5" /></> : <>Items <ChevronDown className="w-3.5 h-3.5" /></>}
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Orders Register</h1>
          <p className="text-sm text-gray-500">Track and monitor field orders and fulfillment status</p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-gray-200/70 rounded-xl text-xs font-bold">
          {['', 'submitted', 'approved', 'invoiced', 'dispatched', 'rejected'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === st ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {st ? getStatusLabel(st) : 'All Statuses'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Fetching orders..." />
      ) : (
        <div className="space-y-4">
          <DataTable
            columns={columns}
            data={orders}
            searchPlaceholder="Search order number or customer..."
          />

          {/* Expanded Drawer preview */}
          {expandedOrderId && orderDetails[expandedOrderId] && (
            <div className="bg-orange-50/70 border border-orange-200 rounded-2xl p-5 animate-in fade-in space-y-3">
              <h3 className="font-bold text-orange-950 text-sm">
                Line Items for {orderDetails[expandedOrderId].order_number} ({orderDetails[expandedOrderId].customer_name})
              </h3>
              <div className="bg-white rounded-xl border border-orange-200/60 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-orange-100/50 text-orange-950 font-semibold border-b border-orange-200/60">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3 text-right">Quantity</th>
                      <th className="p-3 text-right">Price</th>
                      <th className="p-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orderDetails[expandedOrderId].lines?.map((line, idx) => (
                      <tr key={idx}>
                        <td className="p-3 font-medium text-gray-800">{line.item_name}</td>
                        <td className="p-3 text-right font-bold text-gray-900">{parseFloat(line.qty)} {line.unit}s</td>
                        <td className="p-3 text-right text-gray-600">{formatCurrency(line.price_paisa)}</td>
                        <td className="p-3 text-right font-extrabold text-orange-700">{formatCurrency(line.amount_paisa)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
