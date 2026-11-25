import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { formatDate } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import DataTable from '../../components/DataTable';
import toast from 'react-hot-toast';

export default function ProductionReport() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/reports/production')
      .then(res => setRuns(res.data))
      .catch(err => toast.error('Failed to load production audit'))
      .finally(() => setLoading(false));
  }, []);

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
        const v = ((act - exp) / exp) * 100;
        const isFlagged = Math.abs(v) > 3;
        return (
          <span className={`font-bold px-2 py-0.5 rounded text-xs ${isFlagged ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
            {v.toFixed(1)}% {isFlagged ? '(FLAGGED)' : ''}
          </span>
        );
      }
    },
    { key: 'wastage_qty', label: 'Wastage / Scrap', align: 'right', render: (val, r) => `${val || 0} ${r.finished_item_unit}` }
  ];

  if (loading) return <LoadingSpinner message="Compiling production run variances..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Production Variance & Yield Audit</h1>
        <p className="text-sm text-gray-500">Benchmark tolerance compliance: tracking raw material losses and batch yields</p>
      </div>

      <DataTable
        columns={columns}
        data={runs}
        searchPlaceholder="Search batch number or product..."
      />
    </div>
  );
}
