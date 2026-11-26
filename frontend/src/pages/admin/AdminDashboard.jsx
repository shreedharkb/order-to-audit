import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client';
import { formatCurrency, formatDate, getStatusLabel, getStatusVariant } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import StockBadge from '../../components/StockBadge';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';

const metrics = [
  {
    key: 'pendingApprovalsCount',
    label: 'Pending verification',
    format: value => value,
    surface: 'border-amber-200 border-t-amber-400 bg-amber-50/70',
    accent: 'text-amber-950'
  },
  {
    key: 'todayOrdersTotalPaisa',
    label: "Today's booked orders",
    format: value => formatCurrency(value),
    surface: 'border-blue-200 border-t-blue-400 bg-blue-50/70',
    accent: 'text-blue-950'
  },
  {
    key: 'lowStockCount',
    label: 'Items low or out of stock',
    format: value => value,
    surface: 'border-rose-200 border-t-rose-400 bg-rose-50/70',
    accent: 'text-rose-950'
  },
  {
    key: 'totalOutstandingPaisa',
    label: 'Total receivables',
    format: value => formatCurrency(value),
    surface: 'border-emerald-200 border-t-emerald-400 bg-emerald-50/70',
    accent: 'text-emerald-950'
  }
];

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/dashboard/owner')
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading admin dashboard..." />;

  const { recentOrders, stockSummary } = data || {};

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Factory administration</p>
        <h1 className="mt-2 page-title">Factory Admin Console</h1>
        <p className="page-subtitle">Order verification, GST billing, dispatch, and inventory oversight.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {metrics.map(metric => (
          <Card key={metric.key} className={`metric-card ${metric.surface}`}>
            <p className="metric-label">{metric.label}</p>
            <p className={`metric-value ${metric.accent}`}>
              {metric.format(data?.metrics?.[metric.key] || 0)}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/60 px-5 py-4">
            <div>
              <h2 className="section-title">Incoming sales orders</h2>
              <p className="mt-1 text-xs text-ink-500">Latest orders across the verification queue</p>
            </div>
            <Link to="/admin/orders" className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-primary-700 transition hover:bg-primary-50 hover:text-primary-800">
              View all
            </Link>
          </div>

          <div className="divide-y divide-slate-200">
            {!recentOrders?.length ? (
              <div className="px-5 py-10 text-center text-sm text-ink-500">No incoming orders.</div>
            ) : (
              recentOrders.map(order => (
                <div key={order.id} className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-slate-50/80">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-ink-950">{order.order_number}</span>
                      <Badge variant={getStatusVariant(order.status)}>{getStatusLabel(order.status)}</Badge>
                    </div>
                    <p className="mt-1 truncate text-sm text-ink-600">{order.customer_name}</p>
                    <p className="mt-0.5 text-xs text-ink-400">{formatDate(order.order_date)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-ink-950">{formatCurrency(order.total_paisa)}</p>
                    {order.status === 'submitted' && (
                      <Link to="/admin/orders" className="mt-1 inline-block text-xs font-medium text-primary-700 hover:underline">
                        Review order
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/60 px-5 py-4">
            <div>
              <h2 className="section-title">Inventory balances</h2>
              <p className="mt-1 text-xs text-ink-500">Current stock position across key materials</p>
            </div>
            <Link to="/production/inventory" className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-primary-700 transition hover:bg-primary-50 hover:text-primary-800">
              Stock ledger
            </Link>
          </div>

          <div className="divide-y divide-slate-200">
            {!stockSummary?.length ? (
              <div className="px-5 py-10 text-center text-sm text-ink-500">No stock records.</div>
            ) : (
              stockSummary.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-slate-50/80">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-ink-950">{item.name}</h3>
                    <p className="mt-0.5 text-xs capitalize text-ink-400">{item.type.replaceAll('_', ' ')}</p>
                  </div>
                  <StockBadge balance={item.current_balance} reorderLevel={item.reorder_level} unit={item.unit} />
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
