import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { formatCurrency } from '../../utils/format';
import { downloadBlob } from '../../utils/download';
import LoadingSpinner from '../../components/LoadingSpinner';
import DateRangeFilter from '../../components/DateRangeFilter';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';

export default function GSTReport() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '' });
  const [loading, setLoading] = useState(true);

  const fetchReport = (range = filters) => {
    setLoading(true);
    client.get('/reports/gst-summary', { params: range })
      .then(res => setData(res.data))
      .catch(() => toast.error('Failed to load GST summary'))
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
      const res = await client.get('/reports/export/gst', { params: filters, responseType: 'blob' });
      downloadBlob(res.data, `GST_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('GST summary exported to Excel');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  if (loading) return <LoadingSpinner message="Calculating GST outward tax schedules..." />;

  const { rates = [], consolidated = {} } = data || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">GST Outward Supplies (GSTR-1 / 3B)</h1>
          <p className="page-subtitle">Statutory tax summary grouped by HSN tax rates for direct GST filing</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">GSTIN: 33AABCS1429B1ZB (Tamil Nadu)</Badge>
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" /> Download Excel
          </Button>
        </div>
      </div>

      <DateRangeFilter onApply={handleApply} loading={loading} />

      {/* Summary Schedule Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50/70 font-bold text-gray-800 text-sm">
          Table 4 & 5: Taxable Outward Supplies Schedule
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100/70 font-bold text-gray-700 border-b">
                <th className="p-3">Rate %</th>
                <th className="p-3">Supply Nature</th>
                <th className="p-3 text-right">Taxable Value (Rs)</th>
                <th className="p-3 text-right">Central Tax (CGST)</th>
                <th className="p-3 text-right">State Tax (SGST)</th>
                <th className="p-3 text-right">Integrated Tax (IGST)</th>
                <th className="p-3 text-right font-semibold">Total Tax (Rs)</th>
                <th className="p-3 text-right font-semibold">Gross Invoiced (Rs)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rates.map((r, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="p-3 font-semibold text-gray-900">{r.gstRatePercent}%</td>
                  <td className="p-3 font-semibold text-gray-700">{r.supplyType}</td>
                  <td className="p-3 text-right font-medium">{formatCurrency(r.taxableAmountPaisa)}</td>
                  <td className="p-3 text-right text-gray-700">{formatCurrency(r.cgstPaisa)}</td>
                  <td className="p-3 text-right text-gray-700">{formatCurrency(r.sgstPaisa)}</td>
                  <td className="p-3 text-right text-gray-700">{formatCurrency(r.igstPaisa)}</td>
                  <td className="p-3 text-right font-bold text-orange-700">{formatCurrency(r.totalTaxPaisa)}</td>
                  <td className="p-3 text-right font-semibold text-gray-900">{formatCurrency(r.totalPaisa)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold border-t-2 border-gray-300">
              <tr>
                <td colSpan={2} className="p-3 text-gray-900">Consolidated Grand Total</td>
                <td className="p-3 text-right text-gray-900">{formatCurrency(consolidated.totalTaxablePaisa)}</td>
                <td className="p-3 text-right text-gray-900">{formatCurrency(consolidated.totalCgstPaisa)}</td>
                <td className="p-3 text-right text-gray-900">{formatCurrency(consolidated.totalSgstPaisa)}</td>
                <td className="p-3 text-right text-gray-900">{formatCurrency(consolidated.totalIgstPaisa)}</td>
                <td className="p-3 text-right text-orange-700">{formatCurrency(consolidated.totalTaxPaisa)}</td>
                <td className="p-3 text-right text-emerald-800">{formatCurrency(consolidated.grandTotalPaisa)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
