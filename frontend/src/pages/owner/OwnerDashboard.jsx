import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client';
import { formatCurrency } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import StockBadge from '../../components/StockBadge';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';

export default function OwnerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/dashboard/owner')
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading executive dashboard..." />;

  const { metrics, varianceAlerts, materialVarianceAlerts, latestRunCost, stockSummary } = data || {};
  const alertCount = (varianceAlerts?.length || 0) + (materialVarianceAlerts?.length || 0);

  const cards = [
    {
      label: 'Booked orders today',
      value: formatCurrency(metrics?.todayOrdersTotalPaisa || 0),
      detail: `${metrics?.todayOrdersCount || 0} orders`,
      surface: 'border-blue-200 border-t-blue-400 bg-blue-50/70',
      accent: 'text-blue-950'
    },
    {
      label: 'Pending orders',
      value: metrics?.pendingApprovalsCount || 0,
      detail: 'Awaiting verification',
      surface: 'border-amber-200 border-t-amber-400 bg-amber-50/70',
      accent: 'text-amber-950'
    },
    {
      label: 'Variance alerts',
      value: alertCount,
      detail: 'Beyond configured tolerance',
      surface: 'border-rose-200 border-t-rose-400 bg-rose-50/70',
      accent: 'text-rose-950'
    },
    {
      label: 'Latest packet cost',
      value: latestRunCost ? formatCurrency(latestRunCost.cost_per_unit_paisa) : '—',
      detail: latestRunCost ? latestRunCost.batch_number : 'No completed run',
      surface: 'border-violet-200 border-t-violet-400 bg-violet-50/70',
      accent: 'text-violet-950'
    },
    {
      label: 'Total receivables',
      value: formatCurrency(metrics?.totalOutstandingPaisa || 0),
      detail: 'Customer balance dues',
      surface: 'border-emerald-200 border-t-emerald-400 bg-emerald-50/70',
      accent: 'text-emerald-950'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Executive overview</p>
          <h1 className="mt-2 page-title">Operations overview</h1>
          <p className="page-subtitle">Sales, production, inventory, and finance in one view.</p>
        </div>
        <Button asChild variant="secondary">
          <Link to="/reports">Open auditor portal</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
        {cards.map(card => (
          <Card key={card.label} className={`metric-card ${card.surface}`}>
            <p className="metric-label">{card.label}</p>
            <p className={`metric-value ${card.accent}`}>{card.value}</p>
            <p className="metric-detail">{card.detail}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-title">Material and yield variance</h2>
            <Badge variant={alertCount ? 'danger' : 'success'}>
              {alertCount ? `${alertCount} alerts` : 'Within tolerance'}
            </Badge>
          </div>

          <div className="mt-4 space-y-3">
            {!alertCount ? (
              <p className="rounded-lg border border-slate-200 px-4 py-8 text-center text-sm text-ink-500">
                All recent production runs are within tolerance.
              </p>
            ) : (
              <>
                {varianceAlerts?.map(alert => (
                  <div key={`yield-${alert.id}`} className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-red-950">{alert.batch_number} · {alert.finished_item_name}</p>
                        <p className="mt-1 text-xs text-red-800">
                          Expected {alert.expected_output} packets, actual {alert.actual_output} packets
                        </p>
                      </div>
                      <Badge variant="danger">{alert.yield_variance_percent}% yield</Badge>
                    </div>
                  </div>
                ))}
                {materialVarianceAlerts?.map(alert => (
                  <div key={`material-${alert.id}`} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-amber-950">{alert.batch_number} · {alert.item_name}</p>
                        <p className="mt-1 text-xs text-amber-800">
                          Planned {alert.planned_qty} {alert.unit}, actual {alert.actual_qty} {alert.unit}
                        </p>
                      </div>
                      <Badge variant="warning">{alert.variance_percent}% usage</Badge>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="section-title">Inventory balances</h2>
          <div className="mt-4 divide-y divide-slate-200">
            {stockSummary?.slice(0, 5).map(item => (
              <div key={item.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-950">{item.name}</p>
                  <p className="mt-0.5 text-xs capitalize text-ink-400">{item.type.replaceAll('_', ' ')}</p>
                </div>
                <StockBadge balance={item.current_balance} reorderLevel={item.reorder_level} unit={item.unit} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
