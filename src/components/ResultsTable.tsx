'use client';

import { useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAppStore } from '@/lib/store';

export default function ResultsTable() {
  const {
    connectionConfig,
    queryResult,
    setQueryResult,
    isExecuting,
    setExecuting,
    setQueryError,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    generatedSQL,
  } = useAppStore();

  const parentRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => queryResult?.rows || [], [queryResult]);
  const columns = useMemo(() => queryResult?.columns || [], [queryResult]);

  // Virtual row rendering for performance
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 20,
  });

  // Fetch a specific page
  const fetchPage = useCallback(
    async (page: number) => {
      if (!connectionConfig || !generatedSQL) return;
      setExecuting(true);
      setQueryError(null);

      try {
        const res = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...connectionConfig,
            sql: generatedSQL,
            page,
            pageSize,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setQueryResult(data);
        setCurrentPage(page);
      } catch (err) {
        setQueryError((err as Error).message);
      } finally {
        setExecuting(false);
      }
    },
    [connectionConfig, generatedSQL, pageSize, setCurrentPage, setExecuting, setQueryError, setQueryResult]
  );

  // Column width calculation for optimal layout
  const columnWidths = useMemo(() => {
    if (columns.length === 0) return {};
    const widths: Record<string, number> = {};
    for (const col of columns) {
      const headerLen = col.name.length;
      let maxDataLen = 0;
      for (let i = 0; i < Math.min(rows.length, 50); i++) {
        const val = String(rows[i]?.[col.name] ?? '');
        maxDataLen = Math.max(maxDataLen, val.length);
      }
      const charWidth = Math.max(headerLen, Math.min(maxDataLen, 40));
      widths[col.name] = Math.max(80, charWidth * 9 + 24);
    }
    return widths;
  }, [columns, rows]);

  const totalWidth = Object.values(columnWidths).reduce((a, b) => a + b, 0);

  if (!queryResult) {
    return (
      <div className="card flex items-center justify-center h-64 text-gray-600">
        <div className="text-center">
          <svg className="h-16 w-16 mx-auto mb-3 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">Build and run a query to see results here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-0 overflow-hidden">
      {/* Results header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-4">
          <h4 className="text-sm font-medium text-gray-300">Results</h4>
          <span className="text-xs text-gray-500">
            {queryResult.totalRows >= 0
              ? `${queryResult.totalRows.toLocaleString()} total rows`
              : `${rows.length} rows returned`}
          </span>
          <span className="text-xs text-gray-600">
            {queryResult.executionTimeMs}ms
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Page size selector */}
          <select
            className="bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 px-2 py-1"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              fetchPage(1);
            }}
          >
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
            <option value={250}>250 rows</option>
            <option value={500}>500 rows</option>
          </select>

          {/* Export */}
          <button
            type="button"
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
            onClick={() => exportCSV(columns, rows)}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Loading overlay */}
      {isExecuting && (
        <div className="absolute inset-0 bg-gray-950/50 flex items-center justify-center z-10">
          <svg className="animate-spin h-8 w-8 text-snow-400" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: totalWidth }}>
          {/* Header */}
          <div className="flex border-b border-gray-700 bg-gray-800/50 sticky top-0 z-[5]">
            {columns.map((col) => (
              <div
                key={col.name}
                className="px-3 py-2 text-xs font-semibold text-gray-300 uppercase tracking-wider flex-shrink-0 border-r border-gray-800 last:border-r-0"
                style={{ width: columnWidths[col.name] }}
                title={`${col.name} (${col.type}${col.nullable ? ', nullable' : ''})`}
              >
                <div className="truncate">{col.name}</div>
                <div className="text-[10px] text-gray-600 font-normal normal-case">{col.type}</div>
              </div>
            ))}
          </div>

          {/* Virtual rows */}
          <div
            ref={parentRef}
            className="virtual-table overflow-y-auto"
            style={{ maxHeight: 'calc(100vh - 420px)', minHeight: '300px' }}
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                  <div
                    key={virtualRow.index}
                    className={`flex absolute w-full border-b border-gray-800/50 ${
                      virtualRow.index % 2 === 0 ? 'bg-gray-900/30' : ''
                    } hover:bg-gray-800/50 transition-colors duration-75`}
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {columns.map((col) => (
                      <div
                        key={col.name}
                        className="px-3 py-2 text-sm text-gray-300 flex-shrink-0 border-r border-gray-800/30 last:border-r-0 truncate"
                        style={{ width: columnWidths[col.name] }}
                        title={String(row?.[col.name] ?? '')}
                      >
                        {formatCellValue(row?.[col.name])}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Pagination */}
      {queryResult.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800 bg-gray-900/50">
          <div className="text-xs text-gray-500">
            Page {currentPage} of {queryResult.totalPages}
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              className="btn-secondary text-xs px-3 py-1"
              disabled={currentPage <= 1 || isExecuting}
              onClick={() => fetchPage(1)}
            >
              First
            </button>
            <button
              type="button"
              className="btn-secondary text-xs px-3 py-1"
              disabled={currentPage <= 1 || isExecuting}
              onClick={() => fetchPage(currentPage - 1)}
            >
              Prev
            </button>

            {/* Page number buttons */}
            {getPageNumbers(currentPage, queryResult.totalPages).map((p) => (
              <button
                key={p}
                type="button"
                className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                  p === currentPage
                    ? 'bg-snow-600 text-white'
                    : 'btn-secondary'
                }`}
                disabled={isExecuting}
                onClick={() => fetchPage(p)}
              >
                {p}
              </button>
            ))}

            <button
              type="button"
              className="btn-secondary text-xs px-3 py-1"
              disabled={currentPage >= queryResult.totalPages || isExecuting}
              onClick={() => fetchPage(currentPage + 1)}
            >
              Next
            </button>
            <button
              type="button"
              className="btn-secondary text-xs px-3 py-1"
              disabled={currentPage >= queryResult.totalPages || isExecuting}
              onClick={() => fetchPage(queryResult.totalPages)}
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getPageNumbers(current: number, total: number): number[] {
  const pages: number[] = [];
  const range = 2;
  let start = Math.max(1, current - range);
  let end = Math.min(total, current + range);

  if (end - start < range * 2) {
    if (start === 1) end = Math.min(total, start + range * 2);
    else start = Math.max(1, end - range * 2);
  }

  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
}

function exportCSV(
  columns: { name: string }[],
  rows: Record<string, unknown>[]
): void {
  const header = columns.map((c) => `"${c.name}"`).join(',');
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const val = row[c.name];
          if (val === null || val === undefined) return '';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',')
    )
    .join('\n');

  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `query_results_${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
