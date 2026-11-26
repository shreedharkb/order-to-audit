import React, { useEffect, useMemo, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

export default function DataTable({
  columns = [],
  data = [],
  searchable = true,
  searchPlaceholder = 'Search records...',
  pagination = true,
  pageSize = 10,
  onExport,
  exportLabel = 'Export Excel',
  emptyMessage = 'No records found',
  mobileCards = true
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredData = useMemo(() => data.filter(row => {
    if (!searchTerm.trim()) return true;
    return columns.some(column => {
      const value = row[column.key];
      if (value === null || value === undefined) return false;
      return String(value).toLowerCase().includes(searchTerm.toLowerCase());
    });
  }), [columns, data, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = pagination ? filteredData.slice(startIndex, startIndex + pageSize) : filteredData;

  useEffect(() => {
    setCurrentPage(page => Math.min(page, totalPages));
  }, [totalPages]);

  const renderValue = (column, row) => column.render ? column.render(row[column.key], row) : (row[column.key] ?? '-');

  return (
    <div className="surface overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        {searchable ? (
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input
              type="search"
              className="h-10 pl-10 pr-10"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={event => {
                setSearchTerm(event.target.value);
                setCurrentPage(1);
              }}
              aria-label={searchPlaceholder}
            />
            {searchTerm && (
              <Button type="button" variant="ghost" size="icon" onClick={() => { setSearchTerm(''); setCurrentPage(1); }} className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2" aria-label="Clear search">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : <div />}

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="text-xs text-ink-500">{filteredData.length} {filteredData.length === 1 ? 'record' : 'records'}</span>
          {onExport && (
            <Button type="button" variant="secondary" size="sm" onClick={onExport}>
              <Download className="h-4 w-4" />
              {exportLabel}
            </Button>
          )}
        </div>
      </div>

      {mobileCards && (
        <div className="divide-y divide-slate-200 md:hidden">
          {paginatedData.length === 0 ? (
            <div className="empty-state">
              <p className="text-sm font-medium text-ink-700">{emptyMessage}</p>
              <p className="mt-1 text-xs text-ink-500">Try changing your search or filters.</p>
            </div>
          ) : paginatedData.map((row, rowIndex) => (
            <article key={row.id || `${startIndex}-${rowIndex}`} className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {columns.filter(column => column.key !== 'actions').map((column, columnIndex) => (
                  <div key={`${column.key}-${columnIndex}`} className={column.align === 'right' ? 'text-right' : ''}>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-ink-400">{column.label}</p>
                    <div className="mt-1 break-words text-sm text-ink-800">{renderValue(column, row)}</div>
                  </div>
                ))}
              </div>
              {columns.some(column => column.key === 'actions') && (
                <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3">
                  {columns.filter(column => column.key === 'actions').map((column, columnIndex) => (
                    <div key={`actions-${columnIndex}`}>{renderValue(column, row)}</div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <div className={`${mobileCards ? 'hidden md:block' : ''} overflow-x-auto`}>
        <table className="w-full min-w-[720px] border-collapse text-left">
          <caption className="sr-only">Data report</caption>
          <thead>
            <tr className="border-b border-slate-200">
              {columns.map((column, index) => (
                <th key={`${column.key}-${index}`} scope="col" className={`table-header ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : ''}`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-14 text-center">
                  <p className="text-sm font-medium text-ink-700">{emptyMessage}</p>
                  <p className="mt-1 text-xs text-ink-500">Try changing your search or filters.</p>
                </td>
              </tr>
            ) : paginatedData.map((row, rowIndex) => (
              <tr key={row.id || `${startIndex}-${rowIndex}`} className="transition-colors hover:bg-slate-50">
                {columns.map((column, columnIndex) => (
                  <td key={`${column.key}-${columnIndex}`} className={`table-cell ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : ''}`}>
                    {renderValue(column, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && filteredData.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3.5 text-xs text-ink-500 sm:px-5">
          <span>
            Showing <strong className="font-medium text-ink-700">{startIndex + 1}–{Math.min(startIndex + pageSize, filteredData.length)}</strong> of <strong className="font-medium text-ink-700">{filteredData.length}</strong>
          </span>
          <div className="flex items-center gap-1.5">
            <Button type="button" variant="secondary" size="icon" onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={currentPage === 1} className="h-9 w-9" aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[54px] px-1 text-center font-medium text-ink-600">{currentPage} / {totalPages}</span>
            <Button type="button" variant="secondary" size="icon" onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="h-9 w-9" aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
