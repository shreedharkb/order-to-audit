import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

export default function ProductionRunPage() {
  const [runs, setRuns] = useState([]);
  const [boms, setBoms] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [runDetail, setRunDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  // New Run Form State
  const [selectedBomId, setSelectedBomId] = useState('');
  const [batchMultiplier, setBatchMultiplier] = useState(1);
  const [creating, setCreating] = useState(false);

  // Issue Materials Form State
  const [actualIssues, setActualIssues] = useState({});

  // Complete Run Form State
  const [actualOutput, setActualOutput] = useState('');
  const [damagedPouches, setDamagedPouches] = useState('');
  const [cartonsUsed, setCartonsUsed] = useState('');
  const [wastageNotes, setWastageNotes] = useState('');

  // Overhead Form State
  const [labourAmount, setLabourAmount] = useState('');
  const [gasPowerAmount, setGasPowerAmount] = useState('');

  const fetchRunsAndBoms = () => {
    setLoading(true);
    Promise.all([
      client.get('/production/runs'),
      client.get('/masters/bom')
    ])
      .then(([runsRes, bomsRes]) => {
        setRuns(runsRes.data);
        setBoms(bomsRes.data);
        if (runsRes.data.length > 0 && !selectedRunId) {
          setSelectedRunId(runsRes.data[0].id);
        }
      })
      .catch(err => toast.error('Failed to load production runs'))
      .finally(() => setLoading(false));
  };

  const fetchRunDetail = (id) => {
    client.get(`/production/runs/${id}`)
      .then(res => {
        setRunDetail(res.data);
        // Pre-fill issue inputs with planned quantities
        const prefill = {};
        res.data.bom_lines?.forEach(bl => {
          prefill[bl.item_id] = bl.planned_qty;
        });
        setActualIssues(prefill);
      })
      .catch(err => toast.error('Failed to load run details'));
  };

  useEffect(() => {
    fetchRunsAndBoms();
  }, []);

  useEffect(() => {
    if (selectedRunId) {
      fetchRunDetail(selectedRunId);
    }
  }, [selectedRunId]);

  const handleCreateRun = async (e) => {
    e.preventDefault();
    if (!selectedBomId) {
      toast.error('Please select a BOM recipe');
      return;
    }
    setCreating(true);
    try {
      const res = await client.post('/production/runs', {
        bomId: parseInt(selectedBomId, 10),
        batchMultiplier: parseFloat(batchMultiplier) || 1
      });
      toast.success(`Production Run ${res.data.run.batch_number} created!`);
      fetchRunsAndBoms();
      setSelectedRunId(res.data.run.id);
    } catch (err) {
      toast.error('Failed to create run');
    } finally {
      setCreating(false);
    }
  };

  const handleIssueMaterials = async () => {
    if (!runDetail) return;
    const items = runDetail.bom_lines
      .filter(bl => bl.item_type !== 'packaging') // Issue raw materials first
      .map(bl => ({
        itemId: bl.item_id,
        actualQty: parseFloat(actualIssues[bl.item_id]) || parseFloat(bl.planned_qty),
        unit: bl.unit
      }));

    try {
      await client.post(`/production/runs/${runDetail.id}/issue`, { items });
      toast.success('Raw materials issued & deducted from inventory!');
      fetchRunDetail(runDetail.id);
      fetchRunsAndBoms();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Issue failed');
    }
  };

  const handleCompleteRun = async () => {
    if (!actualOutput) {
      toast.error('Please enter actual packets produced');
      return;
    }

    try {
      const res = await client.post(`/production/runs/${runDetail.id}/complete`, {
        actualOutput: parseFloat(actualOutput),
        damagedPouches: parseFloat(damagedPouches) || 0,
        cartonsUsed: parseFloat(cartonsUsed) || 0,
        wastageNotes
      });

      if (res.data.hasVarianceAlerts) {
        toast((
          <div>
            <p className="font-bold text-red-900">Run completed with variance alerts!</p>
            <p className="text-xs text-red-800">Yield or material consumption exceeded 3% tolerance.</p>
          </div>
        ), { duration: 6000 });
      } else {
        toast.success('Production run completed & finished stock increased!');
      }

      fetchRunDetail(runDetail.id);
      fetchRunsAndBoms();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Completion failed');
    }
  };

  const handleAddOverheads = async () => {
    const items = [];
    if (labourAmount) {
      items.push({
        category: 'labour',
        description: 'Direct bakery labour for batch',
        amountPaisa: Math.round(parseFloat(labourAmount) * 100)
      });
    }
    if (gasPowerAmount) {
      items.push({
        category: 'power_gas',
        description: 'LPG gas and electricity for frying',
        amountPaisa: Math.round(parseFloat(gasPowerAmount) * 100)
      });
    }

    if (items.length === 0) {
      toast.error('Enter at least labour or power/gas cost');
      return;
    }

    try {
      await client.post(`/production/runs/${runDetail.id}/overhead`, { items });
      toast.success('Overheads allocated and cost per packet recalculated!');
      setLabourAmount('');
      setGasPowerAmount('');
      fetchRunDetail(runDetail.id);
      fetchRunsAndBoms();
    } catch (err) {
      toast.error('Failed to add overheads');
    }
  };

  // Quick fill helper for Benchmark Step 2, 3, 8
  const prefillBenchmark = () => {
    // Flour: 40kg, Oil: 10.5L (0.5L over), Spice mix: 1.2kg
    if (!runDetail) return;
    const prefill = {};
    runDetail.bom_lines?.forEach(bl => {
      const name = bl.item_name.toLowerCase();
      if (name.includes('oil')) prefill[bl.item_id] = 10.5; // Benchmark: 0.5L over standard
      else if (name.includes('flour')) prefill[bl.item_id] = 40;
      else if (name.includes('spice')) prefill[bl.item_id] = 1.2;
      else prefill[bl.item_id] = bl.planned_qty;
    });
    setActualIssues(prefill);
    setActualOutput('188');
    setDamagedPouches('6');
    setCartonsUsed('9');
    setLabourAmount('1200');
    setGasPowerAmount('600');
    toast.success('Benchmark Step 2, 3, 8 inputs pre-filled!');
  };

  if (loading) return <LoadingSpinner message="Loading production engine..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Production runs</h1>
        <p className="page-subtitle">Record material issues, finished output, overheads, and yield variance.</p>
      </div>

      {/* Start New Run Box */}
      <div className="card space-y-4">
        <h2 className="section-title">Start a production run</h2>

        <form onSubmit={handleCreateRun} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="production-bom" className="label">Recipe</label>
            <select
              id="production-bom"
              value={selectedBomId}
              onChange={e => setSelectedBomId(e.target.value)}
              className="input-field"
              required
            >
              <option value="">-- Select Recipe / BOM --</option>
              {boms.map(b => (
                <option key={b.id} value={b.id}>
                  {b.batch_name} (Yield: {b.expected_yield} {b.yield_unit}s)
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-40">
            <label htmlFor="batch-multiplier" className="label">Batch multiplier</label>
            <input
              id="batch-multiplier"
              type="number"
              step="0.5"
              min="0.5"
              value={batchMultiplier}
              onChange={e => setBatchMultiplier(e.target.value)}
              className="input-field"
            />
          </div>

          <Button type="submit" disabled={creating} className="w-full sm:w-auto">
            {creating ? 'Creating...' : 'Start run'}
          </Button>
        </form>
      </div>

      {/* Main Production Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Runs Sidebar List */}
        <div className="surface p-4">
          <h3 className="mb-2 px-2 text-sm font-semibold text-ink-950">Production history</h3>
          <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
            {runs.map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedRunId(r.id)}
                className={`w-full text-left p-3 rounded-xl transition-all border ${
                  selectedRunId === r.id
                    ? 'bg-orange-50/80 border-orange-500 shadow-sm'
                    : 'bg-white hover:bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-ink-950">{r.batch_number}</span>
                  <Badge variant={r.status === 'completed' ? 'success' : 'info'}>{r.status}</Badge>
                </div>
                <p className="text-xs text-gray-600 font-medium mt-1">{r.finished_item_name}</p>
                <p className="text-[10px] text-gray-400">{formatDate(r.run_date)} | Exp: {r.expected_output} pkts</p>
              </button>
            ))}
          </div>
        </div>

        {/* Run Detailed Workbench */}
        {runDetail ? (
          <div className="lg:col-span-2 space-y-6">
            {/* Header info */}
            <div className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="eyebrow">Active workbench</p>
                <h2 className="mt-1 text-xl font-semibold text-ink-950">{runDetail.batch_number} · {runDetail.finished_item_name}</h2>
                <p className="mt-1 text-xs text-ink-500">
                  Target yield: <strong className="font-medium text-ink-900">{runDetail.expected_output} {runDetail.finished_item_unit}s</strong>
                </p>
              </div>

              <Button variant="secondary" size="sm" onClick={prefillBenchmark}>
                Pre-fill benchmark
              </Button>
            </div>

            {/* Step 2: Issue Materials */}
            <div className="card space-y-4">
              <div>
                <h3 className="section-title">Raw material consumption</h3>
                <p className="mt-1 text-xs text-ink-500">Compare planned quantities with actual issues. Deviations are flagged.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 font-bold text-gray-700 border-b">
                      <th className="p-2.5">Material</th>
                      <th className="p-2.5 text-right">Standard / Planned</th>
                      <th className="p-2.5 text-right">Actual Issued</th>
                      <th className="p-2.5">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {runDetail.bom_lines?.filter(bl => bl.item_type !== 'packaging').map((bl) => (
                      <tr key={bl.item_id}>
                        <td className="p-2.5 font-bold text-gray-900">{bl.item_name}</td>
                        <td className="p-2.5 text-right font-medium text-gray-600">{bl.planned_qty}</td>
                        <td className="p-2.5 text-right">
                          {runDetail.status === 'draft' ? (
                            <input
                              type="number"
                              step="any"
                              value={actualIssues[bl.item_id] ?? bl.planned_qty}
                              onChange={e => setActualIssues({ ...actualIssues, [bl.item_id]: e.target.value })}
                              className="input-field w-24 text-right"
                              aria-label={`Actual quantity for ${bl.item_name}`}
                            />
                          ) : (
                            <span className="font-bold text-gray-900">
                              {runDetail.issues?.find(i => i.item_id === bl.item_id)?.actual_qty || bl.planned_qty}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-gray-500">{bl.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {runDetail.status === 'draft' && (
                <Button size="sm" onClick={handleIssueMaterials}>
                  Confirm material issue
                </Button>
              )}
            </div>

            {/* Step 3: Complete Run & Output Entry */}
            <div className="card space-y-4">
              <h3 className="section-title">Output and packaging</h3>

              {runDetail.status !== 'completed' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="actual-output" className="label">Good packets output</label>
                    <input
                      id="actual-output"
                      type="number"
                      step="any"
                      placeholder="e.g. 188"
                      value={actualOutput}
                      onChange={e => setActualOutput(e.target.value)}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label htmlFor="damaged-pouches" className="label">Damaged pouches</label>
                    <input
                      id="damaged-pouches"
                      type="number"
                      step="any"
                      placeholder="e.g. 6"
                      value={damagedPouches}
                      onChange={e => setDamagedPouches(e.target.value)}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label htmlFor="cartons-used" className="label">Cartons used</label>
                    <input
                      id="cartons-used"
                      type="number"
                      step="any"
                      placeholder="e.g. 9"
                      value={cartonsUsed}
                      onChange={e => setCartonsUsed(e.target.value)}
                      className="input-field"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <Button onClick={handleCompleteRun} className="w-full bg-emerald-600 hover:bg-emerald-700">
                      Complete run
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-emerald-800 font-semibold">Production Run Completed</p>
                    <p className="text-lg font-semibold text-emerald-950">
                      Actual Yield: {runDetail.actual_output} {runDetail.finished_item_unit}s
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-emerald-800">Yield Variance:</p>
                    <p className={`text-base font-semibold ${runDetail.yield_analysis?.isFlagged ? 'text-red-700' : 'text-emerald-700'}`}>
                      {runDetail.yield_analysis?.variancePercent}% {runDetail.yield_analysis?.isFlagged ? '(FLAGGED >3%)' : '(OK)'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Step 8: Add Overheads & Packet Costing */}
            {runDetail.status === 'completed' && (
              <div className="card space-y-4">
                <h3 className="section-title">Cost allocation</h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="labour-amount" className="label">Direct labour (Rs)</label>
                    <input
                      id="labour-amount"
                      type="number"
                      placeholder="e.g. 1200"
                      value={labourAmount}
                      onChange={e => setLabourAmount(e.target.value)}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label htmlFor="power-gas-amount" className="label">Power and gas (Rs)</label>
                    <input
                      id="power-gas-amount"
                      type="number"
                      placeholder="e.g. 600"
                      value={gasPowerAmount}
                      onChange={e => setGasPowerAmount(e.target.value)}
                      className="input-field"
                    />
                  </div>

                  <div className="flex items-end">
                    <Button variant="secondary" onClick={handleAddOverheads} className="w-full">
                      Allocate overheads
                    </Button>
                  </div>
                </div>

                {/* Live Cost per packet card */}
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-4">
                  <div className="bg-slate-50 p-4">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-ink-500">Raw material cost</p>
                    <p className="mt-1 text-base font-semibold text-ink-950">{formatCurrency(runDetail.total_material_cost_paisa)}</p>
                  </div>
                  <div className="bg-slate-50 p-4">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-ink-500">Total overheads</p>
                    <p className="mt-1 text-base font-semibold text-ink-950">{formatCurrency(parseInt(runDetail.labour_cost_paisa || 0) + parseInt(runDetail.overhead_cost_paisa || 0))}</p>
                  </div>
                  <div className="bg-slate-50 p-4">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-ink-500">Cost per packet</p>
                    <p className="mt-1 text-lg font-semibold text-primary-700">{formatCurrency(runDetail.cost_per_unit_paisa)}</p>
                  </div>
                  <div className="bg-slate-50 p-4">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-ink-500">Selling margin</p>
                    <p className="mt-1 text-lg font-semibold text-emerald-700">
                      {formatCurrency(parseInt(runDetail.selling_price_paisa || 0) - parseInt(runDetail.cost_per_unit_paisa || 0))}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
