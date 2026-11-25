import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/format';
import { downloadBlob } from '../../utils/download';
import LoadingSpinner from '../../components/LoadingSpinner';
import DataTable from '../../components/DataTable';
import DateRangeFilter from '../../components/DateRangeFilter';
import toast from 'react-hot-toast';

export default function ProductionReport() {
  const [runs, setRuns] = useState([]);
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '' });
  const [loading, setLoading] = useState(true);

  const fetchReport = (range = filters) => {
    setLoading(true);
    client.get('/reports/production', { params: range })
      .then(res => setRuns(res.data))
      .catch(() => toast.error('Failed to load production audit'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReport({ dateFrom: '', dateTo: '' });
  }, []);

  const handleApply = range => {
    setFilters(range);
    fetchReport(range);
  };

  const handleExport = async () => {
    try {
      const res = await client.get('/reports/export/production', { params: filters, responseType: 'blob' });
      downloadBlob(res.data, `Production_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Production report exported to Excel');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const columns = [
    { key: 'batch_number', label: 'Batch No' },
    { key: 'run_date', label: 'Date', render: val => formatDate(val) },
    { key: 'finished_item_name', label: 'Product' },
    { key: 'expected_output', label: 'Target Yield', align: 'right', render: (val, r) => `${val} ${r.finished_item_unit}` },
    { key: 'actual_output', label: 'Actual Output', align: 'right', render: (val, r) => <span className="font-bold">{val} {r.finished_item_unit}</span> },
    {
      key: 'yield_variance',
      label: 'Yield Variance',
      align: 'right',
      render: (_, r) => {
        const exp = parseFloat(r.expected_output);
        const act = parseFloat(r.actual_output);
        if (exp <= 0 || act <= 0) return '-';
        const variance = ((act - exp) / exp) * 100;
        const isFlagged = Math.abs(variance) > 3;
        return (
          <span className={`font-bold px-2 py-0.5 rounded text-xs ${isFlagged ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
            {variance.toFixed(1)}% {isFlagged ? '(FLAGGED)' : ''}
          </span>
        );
      }
    },
    { key: 'wastage_qty', label: 'Wastage / Scrap', align: 'right', render: (val, r) => `${val || 0} ${r.finished_item_unit}` },
    { key: 'cost_per_unit_paisa', label: 'Cost / Packet', align: 'right', render: val => formatCurrency(val) }
  ];

  const materialRows = runs.flatMap(run => run.issues.map(issue => ({
    id: `${run.id}-${issue.id}`,
    batch: run.batch_number,
    product: run.finished_item_name,
    material: issue.item_name,
    planned: issue.planned_qty,
    actual: issue.actual_qty,
    unit: issue.unit,
    varianceQty: issue.variance_qty,
    variancePercent: issue.variance_percent,
    flagged: issue.is_flagged
  })));

  const materialColumns = [
    { key: 'batch', label: 'Batch No' },
    { key: 'product', label: 'Product' },
    { key: 'material', label: 'Material' },
    { key: 'planned', label: 'Planned Qty', align: 'right', render: (val, row) => `${val} ${row.unit}` },
    { key: 'actual', label: 'Actual Qty', align: 'right', render: (val, row) => `${val} ${row.unit}` },
    { key: 'varianceQty', label: 'Variance Qty', align: 'right', render: (val, row) => `${val} ${row.unit}` },
    {
      key: 'variancePercent',
      label: 'Variance %',
      align: 'right',
      render: (val, row) => (
        <span className={`font-bold px-2 py-0.5 rounded text-xs ${row.flagged ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
          {parseFloat(val).toFixed(1)}% {row.flagged ? '(FLAGGED)' : ''}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Production Variance & Yield Audit</h1>
        <p className="text-sm text-gray-500">Planned versus actual material consumption, yield, scrap, and tolerance alerts</p>
      </div>

      <DateRangeFilter onApply={handleApply} loading={loading} />

      {loading ? <LoadingSpinner message="Compiling production run variances..." /> : (
        <div className="space-y-6">
          <DataTable columns={columns} data={runs} onExport={handleExport} exportLabel="Download Excel" searchPlaceholder="Search batch number or product..." />
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Planned vs Actual Material Consumption</h2>
            <DataTable columns={materialColumns} data={materialRows} searchPlaceholder="Search batch or material..." />
          </div>
        </div>
      )}
    </div>
  );
}
