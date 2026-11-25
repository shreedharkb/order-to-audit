import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import StockBadge from '../../components/StockBadge';
import {
  ClipboardCheck,
  AlertTriangle,
  Receipt,
  Wallet,
  ArrowRight,
  ShieldAlert,
  PackageCheck
} from 'lucide-react';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/dashboard/owner')
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading Factory Admin Console..." />;

  const { metrics, lowStockAlerts, varianceAlerts, recentOrders, stockSummary } = data || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Factory Admin Console</h1>
        <p className="text-sm text-gray-500">Order verification, GST billing, dispatch, and inventory oversight</p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="flex items-center justify-between text-orange-600 mb-2">
            <ClipboardCheck className="w-6 h-6" />
            <span className="text-xs font-bold uppercase tracking-wider bg-orange-100 px-2 py-0.5 rounded-full">Orders</span>
          </div>
          <h3 className="text-2xl font-black text-gray-900">{metrics?.pendingApprovalsCount || 0}</h3>
          <p className="text-xs text-gray-500 font-medium">Pending verification</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <Receipt className="w-6 h-6" />
            <span className="text-xs font-bold uppercase tracking-wider bg-blue-100 px-2 py-0.5 rounded-full">Sales</span>
          </div>
          <h3 className="text-2xl font-black text-gray-900">{formatCurrency(metrics?.todayOrdersTotalPaisa || 0)}</h3>
          <p className="text-xs text-gray-500 font-medium">Today's booked orders</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="flex items-center justify-between text-red-600 mb-2">
            <AlertTriangle className="w-6 h-6" />
            <span className="text-xs font-bold uppercase tracking-wider bg-red-100 px-2 py-0.5 rounded-full">Alerts</span>
          </div>
          <h3 className="text-2xl font-black text-gray-900">{metrics?.lowStockCount || 0}</h3>
          <p className="text-xs text-red-600 font-medium">Items low / out of stock</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <Wallet className="w-6 h-6" />
            <span className="text-xs font-bold uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded-full">Dues</span>
          </div>
          <h3 className="text-2xl font-black text-gray-900">{formatCurrency(metrics?.totalOutstandingPaisa || 0)}</h3>
          <p className="text-xs text-emerald-700 font-medium">Total receivables</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Orders Waiting For Admin Approval */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-orange-600" />
              <span>Incoming Sales Orders</span>
            </h2>
            <Link to="/admin/orders" className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1">
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-gray-100">
            {!recentOrders?.length ? (
              <div className="p-8 text-center text-gray-400 font-medium text-sm">No incoming orders</div>
            ) : (
              recentOrders.map(order => (
                <div key={order.id} className="p-4 hover:bg-gray-50 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-gray-900 text-sm">{order.order_number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">{order.customer_name}</p>
                    <p className="text-[10px] text-gray-400">{formatDate(order.order_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-gray-900">{formatCurrency(order.total_paisa)}</p>
                    {order.status === 'submitted' && (
                      <Link
                        to="/admin/orders"
                        className="inline-block mt-1 text-xs font-bold text-orange-600 hover:underline"
                      >
                        Verify & Approve →
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Inventory Snapshot */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <span>Inventory Balances</span>
            </h2>
            <Link to="/production/inventory" className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1">
              <span>Stock Ledger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-gray-100">
            {!stockSummary?.length ? (
              <div className="p-8 text-center text-gray-400 font-medium text-sm">No stock records</div>
            ) : (
              stockSummary.map(item => (
                <div key={item.id} className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-gray-900">{item.name}</h3>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">{item.type.replace('_', ' ')}</p>
                  </div>
                  <StockBadge balance={item.current_balance} reorderLevel={item.reorder_level} unit={item.unit} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
