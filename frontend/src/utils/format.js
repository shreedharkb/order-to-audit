export function formatCurrency(paisa) {
  if (paisa === null || paisa === undefined) return '₹0.00';
  const rupees = paisa / 100;
  return '₹' + rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatDate(dateString) {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(dateString) {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatQty(value, unit) {
  if (value === null || value === undefined) return '-';
  const num = parseFloat(value);
  const formatted = Number.isInteger(num) ? num.toString() : num.toFixed(2);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function getStatusColor(status) {
  const colors = {
    submitted: 'badge-submitted',
    approved: 'badge-approved',
    invoiced: 'badge-invoiced',
    dispatched: 'badge-dispatched',
    rejected: 'badge-rejected',
    cancelled: 'badge-cancelled',
    draft: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    active: 'bg-green-100 text-green-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getStatusLabel(status) {
  const labels = {
    submitted: 'Submitted',
    approved: 'Approved',
    invoiced: 'Invoiced',
    dispatched: 'Dispatched',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    draft: 'Draft',
    in_progress: 'In Progress',
    completed: 'Completed',
    active: 'Active',
  };
  return labels[status] || status;
}
