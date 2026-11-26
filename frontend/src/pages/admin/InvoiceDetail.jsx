import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { FileDown, Truck, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/button';

export default function InvoiceDetail() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchInvoice = () => {
    setLoading(true);
    client.get(`/invoices/${id}`)
      .then(res => setInvoice(res.data))
      .catch(err => toast.error('Failed to load invoice'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const handleDownloadPDF = async () => {
    try {
      const res = await client.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Invoice_${invoice.invoice_number.replace(/\//g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Invoice PDF downloaded');
    } catch (err) {
      toast.error('PDF download failed');
    }
  };

  const handleDispatch = async () => {
    if (!confirm('Dispatch finished goods for this invoice?')) return;
    try {
      await client.post(`/invoices/${id}/dispatch`);
      toast.success('Invoice dispatched and finished goods stock deducted!');
      fetchInvoice();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Dispatch failed');
    }
  };

  if (loading) return <LoadingSpinner message="Rendering tax invoice..." />;
  if (!invoice) return <div className="text-center p-8">Invoice not found</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/admin/invoices" className="inline-flex items-center gap-1 text-sm font-medium text-ink-600 hover:text-ink-950">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Invoices</span>
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={handleDownloadPDF}>
            <FileDown className="h-4 w-4" />
            Download PDF
          </Button>

          {invoice.status === 'active' && !invoice.is_dispatched && (
            <Button onClick={handleDispatch} className="bg-emerald-600 hover:bg-emerald-700">
              <Truck className="h-4 w-4" />
              Record dispatch
            </Button>
          )}
        </div>
      </div>

      {/* Invoice Sheet Preview */}
      <div className="surface space-y-6 p-5 sm:p-8">
        {/* Banner */}
        <div className="flex flex-col gap-4 border-b-2 border-primary-600 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-ink-950">SRI LAKSHMI FOODS</h1>
            <p className="mt-1 text-xs text-ink-500">12, Industrial Estate, Srirangam, Tiruchirappalli - 620006</p>
            <p className="mt-1 font-mono text-xs font-medium text-primary-700">GSTIN: 33AABCS1429B1ZB | State: Tamil Nadu (33)</p>
          </div>
          <div className="text-left sm:text-right">
            <span className="inline-block px-3 py-1 rounded bg-orange-100 text-orange-900 font-semibold text-xs uppercase tracking-wider mb-1">
              TAX INVOICE
            </span>
            <p className="text-lg font-semibold text-gray-900">{invoice.invoice_number}</p>
            <p className="text-xs text-gray-500">Date: {formatDate(invoice.invoice_date)}</p>
          </div>
        </div>

        {/* Bill To & Supply Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Bill To (Customer)</p>
            <h3 className="font-bold text-gray-900 text-base">{invoice.customer_name}</h3>
            <p className="text-xs text-gray-600">{invoice.customer_address}</p>
            <p className="text-xs text-gray-600">{invoice.customer_city}, {invoice.customer_state} ({invoice.customer_state_code})</p>
            <p className="text-xs font-mono font-bold text-gray-900 mt-1">GSTIN: {invoice.customer_gstin || 'Unregistered'}</p>
          </div>
          <div className="text-left sm:text-right space-y-1 text-xs">
            <p><span className="text-gray-500">Place of Supply:</span> <strong className="text-gray-900">{invoice.place_of_supply_state} ({invoice.place_of_supply_code})</strong></p>
            <p><span className="text-gray-500">Supply Type:</span> <strong className="text-orange-700">{invoice.is_igst ? 'Inter-State (IGST 5%)' : 'Intra-State (CGST 2.5% + SGST 2.5%)'}</strong></p>
            <p><span className="text-gray-500">Dispatch Status:</span> <strong className={invoice.status === 'cancelled' ? 'text-red-700' : invoice.is_dispatched ? 'text-green-700' : 'text-amber-700'}>{invoice.status === 'cancelled' ? 'Cancelled' : invoice.is_dispatched ? 'Dispatched' : 'Pending'}</strong></p>
          </div>
        </div>

        {/* Lines Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 font-bold text-gray-700 border-b">
                <th className="p-3">#</th>
                <th className="p-3">Description</th>
                <th className="p-3">HSN</th>
                <th className="p-3 text-right">Qty</th>
                <th className="p-3 text-right">Rate</th>
                <th className="p-3 text-right">Taxable</th>
                {invoice.is_igst ? (
                  <th className="p-3 text-right">IGST</th>
                ) : (
                  <>
                    <th className="p-3 text-right">CGST</th>
                    <th className="p-3 text-right">SGST</th>
                  </>
                )}
                <th className="p-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoice.lines?.map((line, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-400">{idx + 1}</td>
                  <td className="p-3 font-bold text-gray-900">{line.description}</td>
                  <td className="p-3 font-mono text-gray-600">{line.hsn_code}</td>
                  <td className="p-3 text-right font-bold text-gray-800">{parseFloat(line.qty)} {line.unit}</td>
                  <td className="p-3 text-right text-gray-700">{formatCurrency(line.rate_paisa)}</td>
                  <td className="p-3 text-right font-semibold text-gray-900">{formatCurrency(line.taxable_amount_paisa)}</td>
                  {invoice.is_igst ? (
                    <td className="p-3 text-right text-gray-700">{formatCurrency(line.igst_paisa)} ({line.igst_percent}%)</td>
                  ) : (
                    <>
                      <td className="p-3 text-right text-gray-700">{formatCurrency(line.cgst_paisa)} ({line.cgst_percent}%)</td>
                      <td className="p-3 text-right text-gray-700">{formatCurrency(line.sgst_paisa)} ({line.sgst_percent}%)</td>
                    </>
                  )}
                  <td className="p-3 text-right font-semibold text-gray-900">{formatCurrency(line.total_paisa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Box */}
        <div className="flex justify-end pt-4 border-t">
          <div className="w-full sm:w-72 space-y-2 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal (Taxable Value):</span>
              <span className="font-semibold">{formatCurrency(invoice.subtotal_paisa)}</span>
            </div>
            {invoice.is_igst ? (
              <div className="flex justify-between text-gray-600">
                <span>IGST:</span>
                <span className="font-semibold">{formatCurrency(invoice.igst_paisa)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-gray-600">
                  <span>CGST (2.5%):</span>
                  <span className="font-semibold">{formatCurrency(invoice.cgst_paisa)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>SGST (2.5%):</span>
                  <span className="font-semibold">{formatCurrency(invoice.sgst_paisa)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-base font-semibold text-gray-900 pt-2 border-t border-gray-200">
              <span>Total Invoice Amount:</span>
              <span className="text-orange-700">{formatCurrency(invoice.total_paisa)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
