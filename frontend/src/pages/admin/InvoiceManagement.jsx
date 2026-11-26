import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import DataTable from '../../components/DataTable';
import toast from 'react-hot-toast';
import { FileDown, Truck, Eye } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';

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
        <Badge variant={val ? 'secondary' : 'info'}>
          {val ? 'Inter-State (IGST)' : 'Intra-State (CGST+SGST)'}
        </Badge>
      )
    },
    { key: 'subtotal_paisa', label: 'Taxable (Rs)', align: 'right', render: (val) => formatCurrency(val) },
    { key: 'total_tax_paisa', label: 'GST Tax (Rs)', align: 'right', render: (val) => formatCurrency(val) },
    { key: 'total_paisa', label: 'Invoice Total', align: 'right', render: (val) => <span className="font-semibold text-ink-950">{formatCurrency(val)}</span> },
    {
      key: 'is_dispatched',
      label: 'Fulfillment',
      render: (val, row) => (
        <Badge variant={row.status === 'cancelled' ? 'danger' : val ? 'success' : 'warning'}>
          {row.status === 'cancelled' ? 'Cancelled' : val ? 'Dispatched' : 'Pending dispatch'}
        </Badge>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end space-x-1.5">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8" aria-label={`View invoice ${row.invoice_number}`}>
            <Link to={`/admin/invoices/${row.id}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>

          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownloadPDF(row.id, row.invoice_number)} aria-label={`Download PDF for ${row.invoice_number}`}>
            <FileDown className="h-4 w-4" />
          </Button>

          {row.status === 'active' && !row.is_dispatched && (
            <Button size="sm" onClick={() => handleDispatch(row.id)} className="bg-emerald-600 hover:bg-emerald-700">
              <Truck className="h-3.5 w-3.5" />
              Dispatch
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">GST Tax Invoices</h1>
          <p className="page-subtitle">Statutory GST outward supply invoices, dispatch logging, and PDF generation</p>
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
