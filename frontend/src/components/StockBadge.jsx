import React from 'react';
import { formatQty } from '../utils/format';
import { Badge } from './ui/badge';

export default function StockBadge({ balance = 0, reorderLevel = 0, unit = '' }) {
  const numBalance = parseFloat(balance || 0);
  const numReorder = parseFloat(reorderLevel || 0);

  let variant = 'success';
  let label = 'In stock';

  if (numBalance <= 0) {
    variant = 'danger';
    label = 'Out of stock';
  } else if (numReorder > 0 && numBalance <= numReorder) {
    variant = 'warning';
    label = 'Low stock';
  }

  return (
    <Badge variant={variant} className="whitespace-nowrap">
      {formatQty(numBalance, unit)} ({label})
    </Badge>
  );
}
