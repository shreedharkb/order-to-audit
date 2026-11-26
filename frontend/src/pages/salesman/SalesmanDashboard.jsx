import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, getStatusLabel, getStatusVariant } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';

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

  if (loading) return <LoadingSpinner message="Loading sales dashboard..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Field sales</p>
          <h1 className="mt-2 page-title">Welcome, {user.full_name || user.fullName || user.username}</h1>
          <p className="page-subtitle">Book orders to the factory and track their progress.</p>
        </div>
        <Button asChild>
          <Link to="/salesman/new-order">
            <Plus className="h-4 w-4" /> Take new order
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="metric-card border-blue-200 border-t-blue-400 bg-blue-50/70">
          <p className="metric-label">Today's orders</p>
          <p className="metric-value text-blue-950">{data?.today?.count || 0}</p>
          <p className="metric-detail">{formatCurrency(data?.today?.totalPaisa || 0)} booked today</p>
        </Card>

        <Card className="metric-card border-violet-200 border-t-violet-400 bg-violet-50/70">
          <p className="metric-label">This month</p>
          <p className="metric-value text-violet-950">{data?.month?.count || 0}</p>
          <p className="metric-detail">{formatCurrency(data?.month?.totalPaisa || 0)} total value</p>
        </Card>

        <Card className="metric-card border-emerald-200 border-t-emerald-400 bg-emerald-50/70 sm:col-span-2 lg:col-span-1">
          <p className="metric-label">Customer reach</p>
          <p className="metric-value text-emerald-950">{data?.customerSales?.length || 0}</p>
          <p className="metric-detail">Customers with booked orders</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/60 px-5 py-4">
          <div>
            <h2 className="section-title">Recent orders</h2>
            <p className="mt-1 text-xs text-ink-500">Your latest field orders and their status</p>
          </div>
          <Link to="/salesman/orders" className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-primary-700 transition hover:bg-primary-50 hover:text-primary-800">
            View all
          </Link>
        </div>

        <div className="divide-y divide-slate-200">
          {!data?.recentOrders?.length ? (
            <div className="px-5 py-10 text-center text-sm text-ink-500">No orders booked yet.</div>
          ) : (
            data.recentOrders.map(order => (
              <div key={order.id} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-ink-950">{order.order_number}</span>
                    <Badge variant={getStatusVariant(order.status)}>{getStatusLabel(order.status)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-600">{order.customer_name} ({order.customer_state})</p>
                  <p className="mt-0.5 text-xs text-ink-400">{formatDate(order.order_date)}</p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-ink-950 sm:text-right">{formatCurrency(order.total_paisa)}</p>
              </div>
            ))
          )}
        </div>
      </Card>

      {data?.customerSales?.length > 0 && (
        <Card className="p-5 sm:p-6">
          <h2 className="section-title">Customer-wise sales</h2>
          <div className="mt-4 divide-y divide-slate-200">
            {data.customerSales.map((customer, index) => (
              <div key={index} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-ink-800">{customer.customer_name}</p>
                  <p className="mt-0.5 text-xs text-ink-400">{customer.order_count} orders</p>
                </div>
                <span className="font-semibold tabular-nums text-ink-950">{formatCurrency(customer.total_paisa)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
