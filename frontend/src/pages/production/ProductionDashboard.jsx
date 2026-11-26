import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client';
import LoadingSpinner from '../../components/LoadingSpinner';
import StockBadge from '../../components/StockBadge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';

export default function ProductionDashboard() {
  const [runs, setRuns] = useState([]);
  const [stockSummary, setStockSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      client.get('/production/runs'),
      client.get('/reports/stock-summary')
    ])
      .then(([runsRes, stockRes]) => {
        setRuns(runsRes.data);
        setStockSummary(stockRes.data);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading production dashboard..." />;

  const activeRuns = runs.filter(run => run.status === 'draft' || run.status === 'in_progress');
  const completedRuns = runs.filter(run => run.status === 'completed');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Manufacturing operations</p>
          <h1 className="mt-2 page-title">Production floor</h1>
          <p className="page-subtitle">BOM execution, material consumption, and yield variance.</p>
        </div>
        <Button asChild>
          <Link to="/production/runs">Start production run</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="metric-card border-amber-200 border-t-amber-400 bg-amber-50/70">
          <p className="metric-label">Active floor runs</p>
          <p className="metric-value text-amber-950">{activeRuns.length}</p>
          <p className="metric-detail">Draft and in-progress batches</p>
        </Card>
        <Card className="metric-card border-emerald-200 border-t-emerald-400 bg-emerald-50/70">
          <p className="metric-label">Completed runs</p>
          <p className="metric-value text-emerald-950">{completedRuns.length}</p>
          <p className="metric-detail">Batches closed with output</p>
        </Card>
        <Card className="metric-card border-blue-200 border-t-blue-400 bg-blue-50/70">
          <p className="metric-label">Variance tolerance</p>
          <p className="metric-value text-blue-950">±3.0%</p>
          <p className="metric-detail">Standard yield threshold</p>
        </Card>
      </div>

      <Card className="p-5 sm:p-6">
        <div>
          <h2 className="section-title">Material balances for batch planning</h2>
          <p className="mt-1 text-xs text-ink-500">Raw material and packaging availability</p>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stockSummary.filter(item => item.type !== 'finished_good').map(item => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3.5">
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
  );
}
