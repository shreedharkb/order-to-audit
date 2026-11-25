import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import StockBadge from '../../components/StockBadge';
import {
  TrendingUp,
  AlertTriangle,
  Receipt,
  Wallet,
  ArrowRight,
  ShieldCheck,
  Building2,
  Factory
} from 'lucide-react';

export default function OwnerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/dashboard/owner')
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Connecting to executive command center..." />;

  const { metrics, lowStockAlerts, varianceAlerts, recentOrders, stockSummary } = data || {};

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-orange-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-600/30 text-orange-400 border border-orange-500/30">
              Executive Overview
            </span>
            <h1 className="text-2xl sm:text-3xl font-black mt-2 tracking-tight">Sri Lakshmi Foods Operations</h1>
            <p className="text-stone-300 text-sm mt-1">Real-time Order-to-Audit status across Sales, Production, and Finance</p>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              to="/reports"
              className="px-5 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm shadow-lg transition-colors"
            >
              Auditor Portal →
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Booked Orders Today</p>
          <h3 className="text-2xl font-black text-gray-900 mt-1">{formatCurrency(metrics?.todayOrdersTotalPaisa || 0)}</h3>
          <p className="text-xs text-orange-600 font-bold mt-0.5">{metrics?.todayOrdersCount || 0} order(s)</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending Orders</p>
          <h3 className="text-2xl font-black text-gray-900 mt-1">{metrics?.pendingApprovalsCount || 0}</h3>
          <p className="text-xs text-blue-600 font-medium mt-0.5">Awaiting verification</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Variance Alerts</p>
          <h3 className="text-2xl font-black text-red-600 mt-1">{varianceAlerts?.length || 0}</h3>
          <p className="text-xs text-red-500 font-medium mt-0.5">Exceeded 3% tolerance</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Receivables</p>
          <h3 className="text-2xl font-black text-emerald-700 mt-1">{formatCurrency(metrics?.totalOutstandingPaisa || 0)}</h3>
          <p className="text-xs text-emerald-600 font-medium mt-0.5">Customer balance dues</p>
        </div>
      </div>

      {/* Variance Alerts & Low Stock Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Production Variance Flags */}
        <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span>Recipe & Yield Variance Alerts (>3%)</span>
          </h2>

          <div className="space-y-3">
            {!varianceAlerts?.length ? (
              <p className="text-xs text-gray-400 p-4 text-center">All recent production runs operated within tolerance</p>
            ) : (
              varianceAlerts.map(v => (
                <div key={v.id} className="p-3.5 bg-red-50/70 border border-red-200 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-red-950">{v.batch_number} - {v.finished_item_name}</p>
                    <p className="text-xs text-red-800">
                      Expected: {v.expected_output} pkts | Actual: {v.actual_output} pkts
                    </p>
                  </div>
                  <span className="text-xs font-black px-2.5 py-1 rounded-full bg-red-200 text-red-900">
                    {v.yield_variance_percent}% Variance
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Stock Alerts */}
        <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Factory className="w-5 h-5 text-orange-600" />
            <span>Inventory Balances</span>
          </h2>

          <div className="space-y-2">
            {stockSummary?.slice(0, 5).map(item => (
              <div key={item.id} className="p-3 bg-gray-50 rounded-xl flex items-center justify-between">
                <div>
                  <p className="font-bold text-xs text-gray-900">{item.name}</p>
                  <p className="text-[10px] text-gray-500 uppercase">{item.type.replace('_', ' ')}</p>
                </div>
                <StockBadge balance={item.current_balance} reorderLevel={item.reorder_level} unit={item.unit} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
