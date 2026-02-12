'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';

export default function TablePreview() {
  const {
    connectionConfig,
    selectedDatabase,
    selectedSchema,
    selectedTable,
    previewData,
    setPreviewData,
    showPreview,
    setShowPreview,
    isLoadingPreview,
    setIsLoadingPreview,
    addDebugLog,
  } = useAppStore();

  useEffect(() => {
    if (showPreview && selectedDatabase && selectedSchema && selectedTable && connectionConfig) {
      fetchPreview();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPreview, selectedTable]);

  async function fetchPreview() {
    if (!connectionConfig || !selectedDatabase || !selectedSchema || !selectedTable) return;

    setIsLoadingPreview(true);
    addDebugLog({ level: 'info', message: `Loading preview for ${selectedSchema}.${selectedTable}` });

    try {
      const sql = `SELECT * FROM "${selectedDatabase}"."${selectedSchema}"."${selectedTable}" LIMIT 10`;
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...connectionConfig,
          sql,
          page: 1,
          pageSize: 10,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setPreviewData({ columns: data.columns, rows: data.rows });
      addDebugLog({ level: 'success', message: `Preview loaded: ${data.rows.length} rows`, detail: `${data.executionTimeMs}ms` });
    } catch (err) {
      addDebugLog({ level: 'error', message: `Preview failed: ${(err as Error).message}` });
    } finally {
      setIsLoadingPreview(false);
    }
  }

  if (!showPreview) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center" onClick={() => setShowPreview(false)}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-5xl max-h-[80vh] bg-[#111827] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden animate-fade-in m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-gray-200">Table Preview</h3>
              <p className="text-xs text-gray-500">
                {selectedSchema}.{selectedTable} - First 10 rows
              </p>
            </div>
          </div>
          <button type="button" className="btn-ghost" onClick={() => setShowPreview(false)}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-auto max-h-[calc(80vh-72px)]">
          {isLoadingPreview && (
            <div className="flex items-center justify-center h-48">
              <div className="flex items-center gap-3">
                <svg className="animate-spin h-5 w-5 text-snow-400" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm text-gray-400">Loading preview...</span>
              </div>
            </div>
          )}

          {!isLoadingPreview && previewData && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#111827]">
                <tr className="border-b border-white/[0.06]">
                  <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium w-12">#</th>
                  {previewData.columns.map((col) => (
                    <th key={col.name} className="px-3 py-2 text-left text-xs font-medium text-gray-400">
                      <div>{col.name}</div>
                      <div className="text-[10px] text-gray-600 font-normal">{col.type}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.rows.map((row, i) => (
                  <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-2 row-number">{i + 1}</td>
                    {previewData.columns.map((col) => (
                      <td key={col.name} className="px-3 py-2 text-gray-300 font-mono text-xs max-w-[200px] truncate">
                        {row[col.name] === null || row[col.name] === undefined ? (
                          <span className="cell-null">NULL</span>
                        ) : (
                          String(row[col.name])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!isLoadingPreview && !previewData && (
            <div className="flex items-center justify-center h-48 text-gray-600 text-sm">
              Select a table to preview its data
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
