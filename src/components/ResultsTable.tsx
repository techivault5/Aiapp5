'use client';

import { useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAppStore } from '@/lib/store';

export default function ResultsTable() {
  const {
    connectionConfig, queryResult, setQueryResult, isExecuting, setExecuting,
    setQueryError, currentPage, setCurrentPage, pageSize, setPageSize,
    generatedSQL, addDebugLog, validatedRowCount, setValidatedRowCount,
    setIsValidating, isValidating,
  } = useAppStore();

  const parentRef = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => queryResult?.rows || [], [queryResult]);
  const columns = useMemo(() => queryResult?.columns || [], [queryResult]);

  const rowVirtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => parentRef.current, estimateSize: () => 36, overscan: 20 });

  const fetchPage = useCallback(async (page: number) => {
    if (!connectionConfig || !generatedSQL) return;
    setExecuting(true);
    setQueryError(null);
    addDebugLog({ level: 'info', message: `Fetching page ${page}...` });
    try {
      const res = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...connectionConfig, sql: generatedSQL, page, pageSize }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQueryResult(data);
      setCurrentPage(page);
      addDebugLog({ level: 'success', message: `Page ${page}: ${data.rows.length} rows`, detail: `${data.executionTimeMs}ms` });
    } catch (err) {
      setQueryError((err as Error).message);
      addDebugLog({ level: 'error', message: `Page fetch failed: ${(err as Error).message}` });
    } finally { setExecuting(false); }
  }, [connectionConfig, generatedSQL, pageSize, setCurrentPage, setExecuting, setQueryError, setQueryResult, addDebugLog]);

  async function handleValidateCount() {
    if (!connectionConfig || !generatedSQL) return;
    setIsValidating(true);
    addDebugLog({ level: 'info', message: 'Validating record count...' });
    try {
      const countSql = `SELECT COUNT(*) AS VALIDATED_COUNT FROM (${generatedSQL.replace(/;$/, '')})`;
      const res = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...connectionConfig, sql: countSql, page: 1, pageSize: 1 }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const count = Number(data.rows[0]?.VALIDATED_COUNT ?? 0);
      setValidatedRowCount(count);
      addDebugLog({ level: 'success', message: `Validated count: ${count.toLocaleString()} rows`, detail: `${data.executionTimeMs}ms` });
    } catch (err) {
      addDebugLog({ level: 'error', message: `Validation failed: ${(err as Error).message}` });
    } finally { setIsValidating(false); }
  }

  const columnWidths = useMemo(() => {
    if (columns.length === 0) return {};
    const widths: Record<string, number> = {};
    for (const col of columns) {
      const headerLen = col.name.length;
      let maxDataLen = 0;
      for (let i = 0; i < Math.min(rows.length, 50); i++) { maxDataLen = Math.max(maxDataLen, String(rows[i]?.[col.name] ?? '').length); }
      widths[col.name] = Math.max(80, Math.max(headerLen, Math.min(maxDataLen, 40)) * 9 + 24);
    }
    return widths;
  }, [columns, rows]);

  const totalWidth = Object.values(columnWidths).reduce((a, b) => a + b, 0) + 48; // +48 for row number col

  if (!queryResult) {
    return (
      <div className="card flex items-center justify-center h-64 text-gray-600">
        <div className="text-center">
          <svg className="h-14 w-14 mx-auto mb-3 text-gray-800/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">Run a query to see results here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-0 overflow-hidden relative">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-4">
          <h4 className="text-sm font-semibold text-gray-300">Results</h4>
          <span className="badge badge-blue">
            {queryResult.totalRows >= 0 ? `${queryResult.totalRows.toLocaleString()} rows` : `${rows.length} returned`}
          </span>
          {validatedRowCount !== null && (
            <span className="badge badge-green">Validated: {validatedRowCount.toLocaleString()}</span>
          )}
          <span className="badge badge-purple">{queryResult.executionTimeMs}ms</span>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" className={`btn-ghost text-xs flex items-center gap-1 ${isValidating ? 'text-yellow-400' : ''}`} onClick={handleValidateCount} disabled={isValidating} title="Validate exact record count">
            {isValidating ? <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            Validate Count
          </button>
          <select className="bg-white/5 border border-white/10 rounded-lg text-xs text-gray-300 px-2 py-1.5" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); fetchPage(1); }}>
            <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option><option value={250}>250</option><option value={500}>500</option>
          </select>
          <button type="button" className="btn-ghost text-xs" onClick={() => exportCSV(columns, rows)}>CSV</button>
          <button type="button" className="btn-ghost text-xs" onClick={() => exportJSON(rows)}>JSON</button>
        </div>
      </div>

      {/* Loading */}
      {isExecuting && (
        <div className="absolute inset-0 bg-[#0a0e17]/60 flex items-center justify-center z-10 backdrop-blur-sm">
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-5 py-3">
            <svg className="animate-spin h-5 w-5 text-snow-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            <span className="text-sm text-gray-300">Loading...</span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: totalWidth }}>
          {/* Header */}
          <div className="flex border-b border-white/[0.06] bg-white/[0.02] sticky top-0 z-[5]">
            <div className="w-12 flex-shrink-0 px-3 py-2 text-[10px] text-gray-600 uppercase">#</div>
            {columns.map((col) => (
              <div key={col.name} className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0 border-l border-white/[0.04]" style={{ width: columnWidths[col.name] }} title={`${col.name} (${col.type}${col.nullable ? ', nullable' : ''})`}>
                <div className="truncate">{col.name}</div>
                <div className="text-[10px] text-gray-600 font-normal normal-case mt-0.5">{col.type}</div>
              </div>
            ))}
          </div>

          {/* Virtual rows */}
          <div ref={parentRef} className="virtual-table overflow-y-auto" style={{ maxHeight: 'calc(100vh - 460px)', minHeight: '240px' }}>
            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];
                const rowNum = (currentPage - 1) * pageSize + virtualRow.index + 1;
                return (
                  <div key={virtualRow.index} className={`flex absolute w-full border-b border-white/[0.03] ${virtualRow.index % 2 === 0 ? 'bg-white/[0.01]' : ''} hover:bg-white/[0.04] transition-colors duration-75`} style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}>
                    <div className="w-12 flex-shrink-0 px-3 py-2 row-number">{rowNum}</div>
                    {columns.map((col) => (
                      <div key={col.name} className="px-3 py-2 text-sm flex-shrink-0 border-l border-white/[0.02] truncate" style={{ width: columnWidths[col.name] }} title={String(row?.[col.name] ?? '')}>
                        {formatCell(row?.[col.name])}
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06] bg-white/[0.02]">
          <div className="text-xs text-gray-500">
            Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, queryResult.totalRows)} of {queryResult.totalRows.toLocaleString()}
          </div>
          <div className="flex gap-1">
            <PageBtn label="First" disabled={currentPage <= 1 || isExecuting} onClick={() => fetchPage(1)} />
            <PageBtn label="Prev" disabled={currentPage <= 1 || isExecuting} onClick={() => fetchPage(currentPage - 1)} />
            {getPageNumbers(currentPage, queryResult.totalPages).map((p) => (
              <button key={p} type="button" disabled={isExecuting} onClick={() => fetchPage(p)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-all ${p === currentPage ? 'bg-snow-600 text-white shadow-lg shadow-snow-600/20' : 'btn-secondary text-xs'}`}>{p}</button>
            ))}
            <PageBtn label="Next" disabled={currentPage >= queryResult.totalPages || isExecuting} onClick={() => fetchPage(currentPage + 1)} />
            <PageBtn label="Last" disabled={currentPage >= queryResult.totalPages || isExecuting} onClick={() => fetchPage(queryResult.totalPages)} />
          </div>
        </div>
      )}
    </div>
  );
}

function PageBtn({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return <button type="button" className="btn-secondary text-xs px-3 py-1.5" disabled={disabled} onClick={onClick}>{label}</button>;
}

function formatCell(value: unknown): JSX.Element {
  if (value === null || value === undefined) return <span className="cell-null">NULL</span>;
  if (typeof value === 'object') return <span className="text-purple-300 text-xs font-mono">{JSON.stringify(value)}</span>;
  if (typeof value === 'number') return <span className="text-amber-300 tabular-nums">{value.toLocaleString()}</span>;
  if (typeof value === 'boolean') return <span className={`badge ${value ? 'badge-green' : 'badge-red'}`}>{String(value)}</span>;
  return <span className="text-gray-300">{String(value)}</span>;
}

function getPageNumbers(current: number, total: number): number[] {
  const pages: number[] = [];
  let start = Math.max(1, current - 2);
  let end = Math.min(total, current + 2);
  if (end - start < 4) { if (start === 1) end = Math.min(total, start + 4); else start = Math.max(1, end - 4); }
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
}

function exportCSV(columns: { name: string }[], rows: Record<string, unknown>[]): void {
  const header = columns.map((c) => `"${c.name}"`).join(',');
  const body = rows.map((row) => columns.map((c) => { const v = row[c.name]; if (v == null) return ''; return `"${String(v).replace(/"/g, '""')}"`; }).join(',')).join('\n');
  downloadBlob(`${header}\n${body}`, 'text/csv', `results_${Date.now()}.csv`);
}

function exportJSON(rows: Record<string, unknown>[]): void {
  downloadBlob(JSON.stringify(rows, null, 2), 'application/json', `results_${Date.now()}.json`);
}

function downloadBlob(content: string, type: string, filename: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
