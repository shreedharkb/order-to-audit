import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import { PlusCircle, ShoppingBag, TrendingUp, Calendar, ArrowRight } from 'lucide-react';

export default function SalesmanDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/dashboard/salesman')
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading your sales dashboard..." />;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-600 rounded-2xl p-6 text-white shadow-lg shadow-orange-900/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-white/20 mb-2">
            Field Mobile View
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Vanakkam, {user.full_name}!</h1>
          <p className="text-orange-100 text-sm mt-1">Book orders directly to factory with live inventory verification.</p>
        </div>
        <Link
          to="/salesman/new-order"
          className="inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-white text-orange-700 font-bold hover:bg-orange-50 shadow-md hover:shadow-lg transition-all"
        >
          <PlusCircle className="w-5 h-5" />
          <span>Take New Order</span>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Today's Orders</p>
            <h3 className="text-2xl font-bold text-gray-900">{data?.today?.count || 0}</h3>
            <p className="text-xs text-orange-600 font-medium">{formatCurrency(data?.today?.totalPaisa || 0)} booked</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">This Month</p>
            <h3 className="text-2xl font-bold text-gray-900">{data?.month?.count || 0}</h3>
            <p className="text-xs text-amber-700 font-medium">{formatCurrency(data?.month?.totalPaisa || 0)} total</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex items-center space-x-4 sm:col-span-2 lg:col-span-1">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer Reach</p>
            <h3 className="text-2xl font-bold text-gray-900">{data?.customerSales?.length || 0}</h3>
            <p className="text-xs text-emerald-600 font-medium">Active retail points</p>
          </div>
        </div>
      </div>

      {/* Recent Orders List */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Recent Orders Taken</h2>
          <Link to="/salesman/orders" className="text-sm font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1">
            <span>View All</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="divide-y divide-gray-100">
          {!data?.recentOrders?.length ? (
            <div className="p-8 text-center text-gray-400 font-medium">
              No orders booked yet. Click "Take New Order" to create one.
            </div>
          ) : (
            data.recentOrders.map(order => (
              <div key={order.id} className="p-4 sm:p-5 hover:bg-orange-50/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-gray-900 text-sm sm:text-base">{order.order_number}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 font-medium">{order.customer_name} ({order.customer_state})</p>
                  <p className="text-xs text-gray-400">{formatDate(order.order_date)}</p>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-base font-extrabold text-gray-900">{formatCurrency(order.total_paisa)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Customer-wise Sales Summary */}
      {data?.customerSales?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">Customer-wise Sales</h2>
          <div className="space-y-3">
            {data.customerSales.map((cs, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="font-semibold text-gray-800">{cs.customer_name}</p>
                  <p className="text-xs text-gray-400">{cs.order_count} order(s)</p>
                </div>
                <span className="font-bold text-gray-900">{formatCurrency(cs.total_paisa)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
