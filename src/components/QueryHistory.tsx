'use client';

import { useAppStore } from '@/lib/store';

export default function QueryHistory() {
  const {
    queryHistory,
    showQueryHistory,
    setShowQueryHistory,
    clearQueryHistory,
    setEnglishQuery,
    setGeneratedSQL,
  } = useAppStore();

  if (!showQueryHistory) return null;

  return (
    <div className="w-80 border-l border-white/[0.06] bg-[#0c1019] flex flex-col animate-slide-in flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-semibold text-gray-300">History</span>
          <span className="badge badge-gray">{queryHistory.length}</span>
        </div>
        <div className="flex items-center gap-1">
          {queryHistory.length > 0 && (
            <button type="button" className="btn-ghost text-xs" onClick={clearQueryHistory}>
              Clear
            </button>
          )}
          <button type="button" className="btn-ghost text-xs" onClick={() => setShowQueryHistory(false)}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* History list */}
      <div className="flex-1 overflow-y-auto">
        {queryHistory.length === 0 && (
          <div className="flex items-center justify-center h-32 text-gray-600 text-xs">
            No queries yet
          </div>
        )}
        {queryHistory.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="w-full text-left px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors group"
            onClick={() => {
              setEnglishQuery(entry.englishQuery);
              setGeneratedSQL(entry.sql);
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`badge ${entry.status === 'success' ? 'badge-green' : 'badge-red'}`}>
                {entry.status === 'success' ? 'OK' : 'ERR'}
              </span>
              <span className="text-[10px] text-gray-600">{formatTimeAgo(entry.timestamp)}</span>
            </div>
            {entry.englishQuery && (
              <p className="text-xs text-gray-400 mb-1 truncate">{entry.englishQuery}</p>
            )}
            <p className="text-[11px] font-mono text-gray-500 truncate group-hover:text-gray-400 transition-colors">
              {entry.sql}
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[10px] text-gray-600">{entry.executionTimeMs}ms</span>
              {entry.totalRows >= 0 && (
                <span className="text-[10px] text-gray-600">{entry.totalRows.toLocaleString()} rows</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
