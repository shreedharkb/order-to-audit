import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import DataTable from '../../components/DataTable';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';

export default function PaymentManagement() {
  const [payments, setPayments] = useState([]);
  const [outstanding, setOutstanding] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [customerId, setCustomerId] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [mode, setMode] = useState('cash');
  const [referenceNumber, setReferenceNumber] = useState('');

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      client.get('/payments'),
      client.get('/payments/outstanding'),
      client.get('/masters/customers')
    ])
      .then(([payRes, outRes, custRes]) => {
        setPayments(payRes.data);
        setOutstanding(outRes.data);
        setCustomers(custRes.data);
      })
      .catch(err => toast.error('Failed to load collections'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!customerId || !amountRupees) {
      toast.error('Customer and amount are required');
      return;
    }

    setSubmitting(true);
    try {
      await client.post('/payments', {
        customerId: parseInt(customerId, 10),
        amountPaisa: Math.round(parseFloat(amountRupees) * 100),
        mode,
        referenceNumber
      });
      toast.success('Payment recorded successfully!');
      setAmountRupees('');
      setReferenceNumber('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const paymentColumns = [
    { key: 'payment_date', label: 'Date', render: val => formatDate(val) },
    { key: 'customer_name', label: 'Customer' },
    { key: 'mode', label: 'Mode', render: val => <span className="uppercase text-xs font-bold px-2 py-0.5 rounded bg-gray-100">{val}</span> },
    { key: 'reference_number', label: 'Reference', render: val => val || '-' },
    { key: 'amount_paisa', label: 'Amount Received', align: 'right', render: val => <span className="font-bold text-emerald-700">{formatCurrency(val)}</span> }
  ];

  const outstandingColumns = [
    { key: 'customerName', label: 'Customer' },
    { key: 'state', label: 'State' },
    { key: 'totalInvoicedPaisa', label: 'Total Invoiced', align: 'right', render: val => formatCurrency(val) },
    { key: 'totalPaidPaisa', label: 'Total Received', align: 'right', render: val => formatCurrency(val) },
    {
      key: 'outstandingPaisa',
      label: 'Balance Due',
      align: 'right',
      render: val => <span className={`font-semibold ${val > 0 ? 'text-red-700' : 'text-green-700'}`}>{formatCurrency(val)}</span>
    }
  ];

  if (loading) return <LoadingSpinner message="Loading collections and receivables..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Collections and receivables</h1>
        <p className="page-subtitle">Record customer remittances against outstanding GST invoices.</p>
      </div>

      {/* Record Payment Card */}
      <div className="card space-y-4">
        <h2 className="section-title">Record customer payment</h2>

        <form onSubmit={handleRecordPayment} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="label">Customer</label>
            <select
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              className="input-field"
              required
            >
              <option value="">Select Customer</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Amount (Rs)</label>
            <input
              type="number"
              step="any"
              placeholder="e.g. 4000"
              value={amountRupees}
              onChange={e => setAmountRupees(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold"
              required
            />
          </div>

          <div>
            <label className="label">Mode</label>
            <select
              value={mode}
              onChange={e => setMode(e.target.value)}
              className="input-field"
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI / GPay</option>
              <option value="neft">NEFT / Bank Transfer</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>

          <div>
            <label className="label">Ref / Cheque No</label>
            <input
              type="text"
              placeholder="UPI ref or Cheque#"
              value={referenceNumber}
              onChange={e => setReferenceNumber(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="btn-success w-full"
            >
              <Plus className="w-4 h-4" />
              <span>Record Payment</span>
            </button>
          </div>
        </form>

        <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-950 sm:flex-row sm:items-center sm:justify-between">
          <span><strong>Quick fill:</strong> Select <em>Retailer A</em>, amount <strong>Rs 4,000</strong> to test the balance reduction.</span>
          <button
            type="button"
            onClick={() => {
              const retA = customers.find(c => c.name.toLowerCase().includes('retailer a'));
              if (retA) setCustomerId(retA.id);
              setAmountRupees('4000');
              setMode('upi');
              setReferenceNumber('UPI-BENCHMARK-4000');
            }}
            className="font-bold underline text-emerald-700 hover:text-emerald-900"
          >
            Fill Step 7 Data
          </button>
        </div>
      </div>

      {/* Outstanding Summary */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-gray-900">Current Customer Outstanding Balances</h2>
        <DataTable
          columns={outstandingColumns}
          data={outstanding}
          searchPlaceholder="Search customer balance..."
        />
      </div>

      {/* History */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-gray-900">Payment Collection History</h2>
        <DataTable
          columns={paymentColumns}
          data={payments}
          searchPlaceholder="Search payment record..."
        />
      </div>
    </div>
  );
}
