import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client';
import LoadingSpinner from '../../components/LoadingSpinner';
import StockBadge from '../../components/StockBadge';
import { Factory, PlayCircle, AlertOctagon, CheckCircle2 } from 'lucide-react';

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

  if (loading) return <LoadingSpinner message="Connecting to production floor..." />;

  const activeRuns = runs.filter(r => r.status === 'draft' || r.status === 'in_progress');
  const completedRuns = runs.filter(r => r.status === 'completed');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Production Floor Hub</h1>
          <p className="text-sm text-gray-500">BOM recipe execution, planned vs actual consumption, yield variance</p>
        </div>
        <Link
          to="/production/runs"
          className="inline-flex items-center space-x-2 px-5 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 shadow-md"
        >
          <PlayCircle className="w-5 h-5" />
          <span>Start Production Run</span>
        </Link>
      </div>

      {/* Floor Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
            <Factory className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Active Floor Runs</p>
            <h3 className="text-2xl font-bold text-gray-900">{activeRuns.length}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Completed Runs</p>
            <h3 className="text-2xl font-bold text-gray-900">{completedRuns.length}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Variance Tolerance</p>
            <h3 className="text-2xl font-bold text-gray-900">±3.0%</h3>
          </div>
        </div>
      </div>

      {/* Key Raw Materials & Packaging Balances */}
      <div className="bg-white rounded-2xl p-6 border shadow-sm space-y-4">
        <h2 className="text-base font-bold text-gray-900">Current Material Balances for Batch Planning</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {stockSummary.filter(s => s.type !== 'finished_good').map(item => (
            <div key={item.id} className="p-3.5 bg-gray-50 rounded-xl border flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500 uppercase">{item.type.replace('_', ' ')}</p>
              </div>
              <StockBadge balance={item.current_balance} reorderLevel={item.reorder_level} unit={item.unit} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
