import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

export default function DateRangeFilter({ onApply, loading = false }) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const apply = () => {
    if (dateFrom && dateTo && dateFrom > dateTo) return;
    onApply({ dateFrom, dateTo });
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end">
      <p className="mr-auto text-sm font-medium text-ink-800">Report period</p>
      <div className="space-y-1.5">
        <Label htmlFor="report-date-from">From</Label>
        <Input id="report-date-from" type="date" value={dateFrom} max={dateTo || undefined} onChange={event => setDateFrom(event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="report-date-to">To</Label>
        <Input id="report-date-to" type="date" value={dateTo} min={dateFrom || undefined} onChange={event => setDateTo(event.target.value)} />
      </div>
      <Button onClick={apply} disabled={loading || Boolean(dateFrom && dateTo && dateFrom > dateTo)}>
        Apply
      </Button>
    </div>
  );
}
