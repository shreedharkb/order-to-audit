import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import DataTable from '../../components/DataTable';
import toast from 'react-hot-toast';
import { FileDown, Truck, Eye, ShieldCheck } from 'lucide-react';

export default function InvoiceManagement() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = () => {
    setLoading(true);
    client.get('/invoices')
      .then(res => setInvoices(res.data))
      .catch(err => toast.error('Failed to load invoices'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleDownloadPDF = async (invoiceId, invoiceNumber) => {
    try {
      const res = await client.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Invoice_${invoiceNumber.replace(/\//g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Invoice PDF downloaded');
    } catch (err) {
      toast.error('Failed to download invoice PDF');
    }
  };

  const handleDispatch = async (invoiceId) => {
    if (!confirm('Confirm goods dispatch? Finished goods inventory will be reduced automatically.')) return;
    try {
      await client.post(`/invoices/${invoiceId}/dispatch`);
      toast.success('Invoice dispatched and finished goods stock reduced!');
      fetchInvoices();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Dispatch failed');
    }
  };

  const columns = [
    { key: 'invoice_number', label: 'Invoice No' },
    { key: 'invoice_date', label: 'Date', render: (val) => formatDate(val) },
    { key: 'customer_name', label: 'Customer' },
    {
      key: 'is_igst',
      label: 'Supply Type',
      render: (val) => (
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${val ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
          {val ? 'Inter-State (IGST)' : 'Intra-State (CGST+SGST)'}
        </span>
      )
    },
    { key: 'subtotal_paisa', label: 'Taxable (Rs)', align: 'right', render: (val) => formatCurrency(val) },
    { key: 'total_tax_paisa', label: 'GST Tax (Rs)', align: 'right', render: (val) => formatCurrency(val) },
    { key: 'total_paisa', label: 'Invoice Total', align: 'right', render: (val) => <span className="font-extrabold text-gray-900">{formatCurrency(val)}</span> },
    {
      key: 'is_dispatched',
      label: 'Fulfillment',
      render: (val) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${val ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
          {val ? 'Dispatched' : 'Pending Dispatch'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end space-x-1.5">
          <Link
            to={`/admin/invoices/${row.id}`}
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            title="View Invoice"
          >
            <Eye className="w-4 h-4" />
          </Link>

          <button
            onClick={() => handleDownloadPDF(row.id, row.invoice_number)}
            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg"
            title="Download GST PDF"
          >
            <FileDown className="w-4 h-4" />
          </button>

          {!row.is_dispatched && (
            <button
              onClick={() => handleDispatch(row.id)}
              className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg inline-flex items-center gap-1 shadow-sm"
              title="Record Dispatch"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Dispatch</span>
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">GST Tax Invoices</h1>
          <p className="text-sm text-gray-500">Statutory GST outward supply invoices, dispatch logging, and PDF generation</p>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading invoices..." />
      ) : (
        <DataTable
          columns={columns}
          data={invoices}
          searchPlaceholder="Search invoice number, customer..."
        />
      )}
    </div>
  );
}
