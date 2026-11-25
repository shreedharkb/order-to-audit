import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { formatCurrency } from '../../utils/format';
import { downloadBlob } from '../../utils/download';
import LoadingSpinner from '../../components/LoadingSpinner';
import DateRangeFilter from '../../components/DateRangeFilter';
import DataTable from '../../components/DataTable';
import toast from 'react-hot-toast';

export default function CostReport() {
  const [data, setData] = useState([]);
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '' });
  const [loading, setLoading] = useState(true);

  const fetchReport = (range = filters) => {
    setLoading(true);
    client.get('/reports/cost-analysis', { params: range })
      .then(res => setData(res.data))
      .catch(() => toast.error('Failed to load cost analysis'))
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
      const res = await client.get('/reports/export/cost', { params: filters, responseType: 'blob' });
      downloadBlob(res.data, `Cost_Analysis_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Cost analysis exported to Excel');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const columns = [
    { key: 'productName', label: 'Product' },
    { key: 'totalOutput', label: 'Packets Produced', align: 'right', render: (val, r) => `${val} ${r.unit}s` },
    { key: 'materialCostPerUnitPaisa', label: 'Raw & Pkg Cost / pkt', align: 'right', render: val => formatCurrency(val) },
    { key: 'labourCostPerUnitPaisa', label: 'Labour / pkt', align: 'right', render: val => formatCurrency(val) },
    { key: 'overheadCostPerUnitPaisa', label: 'Power/Gas / pkt', align: 'right', render: val => formatCurrency(val) },
    { key: 'costPerUnitPaisa', label: 'Cost per Packet', align: 'right', render: val => <span className="font-black text-orange-700">{formatCurrency(val)}</span> },
    { key: 'sellingPricePaisa', label: 'Selling Price', align: 'right', render: val => formatCurrency(val) },
    {
      key: 'marginPercent',
      label: 'Gross Margin %',
      align: 'right',
      render: (val, r) => (
        <span className="font-extrabold text-emerald-700">
          {formatCurrency(r.marginPaisa)} ({val}%)
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Packet Unit Costing & Gross Margins</h1>
        <p className="text-sm text-gray-500">Weighted-average raw material costs + direct batch labour & utilities allocation</p>
      </div>

      <DateRangeFilter onApply={handleApply} loading={loading} />

      {loading ? <LoadingSpinner message="Calculating packet unit economics..." /> : (
        <DataTable
          columns={columns}
          data={data}
          onExport={handleExport}
          exportLabel="Download Excel"
          searchPlaceholder="Search product..."
        />
      )}
    </div>
  );
}
