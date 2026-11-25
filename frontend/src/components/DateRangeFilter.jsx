import React, { useState } from 'react';
import { CalendarDays, Filter } from 'lucide-react';

export default function DateRangeFilter({ onApply, loading = false }) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const apply = () => {
    if (dateFrom && dateTo && dateFrom > dateTo) return;
    onApply({ dateFrom, dateTo });
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-bold text-gray-700 mr-auto">
        <CalendarDays className="w-4 h-4 text-orange-600" />
        Report period
      </div>
      <label className="text-xs font-semibold text-gray-600">
        From
        <input
          type="date"
          value={dateFrom}
          max={dateTo || undefined}
          onChange={event => setDateFrom(event.target.value)}
          className="mt-1 block px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
        />
      </label>
      <label className="text-xs font-semibold text-gray-600">
        To
        <input
          type="date"
          value={dateTo}
          min={dateFrom || undefined}
          onChange={event => setDateTo(event.target.value)}
          className="mt-1 block px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
        />
      </label>
      <button
        onClick={apply}
        disabled={loading || Boolean(dateFrom && dateTo && dateFrom > dateTo)}
        className="px-4 py-2 bg-orange-600 text-white text-sm font-bold rounded-lg hover:bg-orange-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
      >
        <Filter className="w-4 h-4" /> Apply
      </button>
    </div>
  );
}
