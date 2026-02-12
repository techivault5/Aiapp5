'use client';

import { useAppStore } from '@/lib/store';

export default function ColumnStatsPanel() {
  const {
    queryResult,
    columnStats,
    showColumnStats,
    setShowColumnStats,
    isValidating,
    validatedRowCount,
  } = useAppStore();

  if (!showColumnStats || !queryResult) return null;

  const columns = queryResult.columns;
  const rows = queryResult.rows;

  // Compute client-side column stats from current page data
  const computedStats = columns.map((col) => {
    const values = rows.map((r) => r[col.name]);
    const nullCount = values.filter((v) => v === null || v === undefined).length;
    const nonNull = values.filter((v) => v !== null && v !== undefined);
    const distinctSet = new Set(nonNull.map(String));

    let minValue: string | undefined;
    let maxValue: string | undefined;
    let avgValue: string | undefined;

    const numericValues = nonNull.map(Number).filter((n) => !isNaN(n));
    if (numericValues.length > 0) {
      minValue = Math.min(...numericValues).toString();
      maxValue = Math.max(...numericValues).toString();
      avgValue = (numericValues.reduce((a, b) => a + b, 0) / numericValues.length).toFixed(2);
    } else if (nonNull.length > 0) {
      const sorted = nonNull.map(String).sort();
      minValue = sorted[0];
      maxValue = sorted[sorted.length - 1];
    }

    // Use server-side stats if available
    const serverStat = columnStats.find((s) => s.column === col.name);
    if (serverStat) {
      return serverStat;
    }

    return {
      column: col.name,
      type: col.type,
      nullCount,
      distinctCount: distinctSet.size,
      totalCount: values.length,
      minValue,
      maxValue,
      avgValue,
    };
  });

  return (
    <div className="card-elevated animate-fade-in mt-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <svg className="h-5 w-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h4 className="text-sm font-semibold text-gray-200">Column Statistics & Validation</h4>
          {validatedRowCount !== null && (
            <span className="badge badge-green">
              Validated: {validatedRowCount.toLocaleString()} rows
            </span>
          )}
          {isValidating && (
            <span className="badge badge-yellow">
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Validating...
            </span>
          )}
        </div>
        <button type="button" className="btn-ghost text-xs" onClick={() => setShowColumnStats(false)}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="stat-card">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Columns</span>
          <span className="text-lg font-bold text-gray-100">{columns.length}</span>
        </div>
        <div className="stat-card">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Page Rows</span>
          <span className="text-lg font-bold text-gray-100">{rows.length}</span>
        </div>
        <div className="stat-card">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Total Rows</span>
          <span className="text-lg font-bold text-gray-100">
            {queryResult.totalRows >= 0 ? queryResult.totalRows.toLocaleString() : '?'}
          </span>
        </div>
        <div className="stat-card">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Exec Time</span>
          <span className="text-lg font-bold text-gray-100">{queryResult.executionTimeMs}ms</span>
        </div>
      </div>

      {/* Column details table */}
      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              <th className="text-left px-3 py-2 text-gray-500 font-medium">Column</th>
              <th className="text-left px-3 py-2 text-gray-500 font-medium">Type</th>
              <th className="text-right px-3 py-2 text-gray-500 font-medium">Nulls</th>
              <th className="text-right px-3 py-2 text-gray-500 font-medium">Distinct</th>
              <th className="text-left px-3 py-2 text-gray-500 font-medium">Fill Rate</th>
              <th className="text-left px-3 py-2 text-gray-500 font-medium">Min</th>
              <th className="text-left px-3 py-2 text-gray-500 font-medium">Max</th>
              <th className="text-left px-3 py-2 text-gray-500 font-medium">Avg</th>
            </tr>
          </thead>
          <tbody>
            {computedStats.map((stat) => {
              const fillRate = stat.totalCount > 0
                ? ((stat.totalCount - stat.nullCount) / stat.totalCount * 100)
                : 0;
              return (
                <tr key={stat.column} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="px-3 py-2 font-mono text-gray-300">{stat.column}</td>
                  <td className="px-3 py-2">
                    <span className="badge badge-blue">{stat.type}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className={stat.nullCount > 0 ? 'text-yellow-400' : 'text-gray-500'}>
                      {stat.nullCount}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-300">{stat.distinctCount}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            fillRate >= 90 ? 'bg-emerald-500' : fillRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${fillRate}%` }}
                        />
                      </div>
                      <span className="text-gray-500 tabular-nums">{fillRate.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-400 font-mono truncate max-w-[120px]" title={stat.minValue}>
                    {stat.minValue ?? '-'}
                  </td>
                  <td className="px-3 py-2 text-gray-400 font-mono truncate max-w-[120px]" title={stat.maxValue}>
                    {stat.maxValue ?? '-'}
                  </td>
                  <td className="px-3 py-2 text-gray-400 font-mono">{stat.avgValue ?? '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
