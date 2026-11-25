import React from 'react';
import { formatQty } from '../utils/format';

export default function StockBadge({ balance = 0, reorderLevel = 0, unit = '' }) {
  const numBalance = parseFloat(balance || 0);
  const numReorder = parseFloat(reorderLevel || 0);

  let badgeClass = 'bg-green-100 text-green-800 border-green-200';
  let label = 'In Stock';

  if (numBalance <= 0) {
    badgeClass = 'bg-red-100 text-red-800 border-red-200';
    label = 'Out of Stock';
  } else if (numReorder > 0 && numBalance <= numReorder) {
    badgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
    label = 'Low Stock';
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeClass}`}>
      <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-current"></span>
      {formatQty(numBalance, unit)} ({label})
    </span>
  );
}
