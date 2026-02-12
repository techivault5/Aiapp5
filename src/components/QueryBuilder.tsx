'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAppStore } from '@/lib/store';

export default function QueryBuilder() {
  const {
    connectionConfig, selectedDatabase, selectedSchema, selectedTable, schemas,
    englishQuery, setEnglishQuery, generatedSQL, setGeneratedSQL,
    queryExplanation, setQueryExplanation, queryConfidence, setQueryConfidence,
    isBuilding, setBuilding, setQueryResult, isExecuting, setExecuting,
    setQueryError, queryError, setCurrentPage, pageSize,
    addDebugLog, addQueryHistory, setShowColumnStats, showColumnStats,
  } = useAppStore();

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isEditingSQL, setIsEditingSQL] = useState(false);
  const [editedSQL, setEditedSQL] = useState('');
  const [copiedSQL, setCopiedSQL] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  const getQueryContext = useCallback(() => {
    if (!selectedDatabase || !selectedSchema) return null;
    const schemaInfo = schemas.find((s) => s.database === selectedDatabase && s.schema === selectedSchema);
    if (!schemaInfo) return null;
    return { database: selectedDatabase, schema: selectedSchema, tables: schemaInfo.tables.map((t) => ({ name: t.name, columns: t.columns, rowCount: t.rowCount })) };
  }, [selectedDatabase, selectedSchema, schemas]);

  const buildQuery = useCallback(async (query: string) => {
    const context = getQueryContext();
    if (!query.trim() || !context) return;
    setBuilding(true);
    addDebugLog({ level: 'info', message: `Building query: "${query}"` });
    try {
      const res = await fetch('/api/query/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ englishQuery: query, context }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGeneratedSQL(data.sql);
      setEditedSQL(data.sql);
      setQueryExplanation(data.explanation);
      setQueryConfidence(data.confidence);
      setSuggestions(data.suggestions || []);
      addDebugLog({ level: 'success', message: `Query built: ${Math.round(data.confidence * 100)}% confidence` });
      addDebugLog({ level: 'sql', message: data.sql });
    } catch (err) {
      setQueryError((err as Error).message);
      addDebugLog({ level: 'error', message: `Build failed: ${(err as Error).message}` });
    } finally { setBuilding(false); }
  }, [getQueryContext, setBuilding, setGeneratedSQL, setQueryExplanation, setQueryConfidence, setQueryError, addDebugLog]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { if (englishQuery.trim()) buildQuery(englishQuery); }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [englishQuery, buildQuery]);

  async function handleExecute() {
    const sql = isEditingSQL ? editedSQL : generatedSQL;
    if (!sql || !connectionConfig) return;
    setExecuting(true);
    setQueryError(null);
    setCurrentPage(1);
    addDebugLog({ level: 'sql', message: `Executing: ${sql}` });
    const startTime = Date.now();
    try {
      const res = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...connectionConfig, sql, page: 1, pageSize }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQueryResult(data);
      const elapsed = Date.now() - startTime;
      addDebugLog({ level: 'success', message: `Query returned ${data.rows.length} rows (${data.totalRows} total)`, detail: `${elapsed}ms` });
      addDebugLog({ level: 'timing', message: `Server: ${data.executionTimeMs}ms | Network: ${elapsed - data.executionTimeMs}ms | Total: ${elapsed}ms` });
      addQueryHistory({ englishQuery, sql, timestamp: Date.now(), executionTimeMs: data.executionTimeMs, totalRows: data.totalRows, status: 'success' });
    } catch (err) {
      setQueryError((err as Error).message);
      addDebugLog({ level: 'error', message: `Query failed: ${(err as Error).message}` });
      addQueryHistory({ englishQuery, sql, timestamp: Date.now(), executionTimeMs: Date.now() - startTime, totalRows: -1, status: 'error', error: (err as Error).message });
    } finally { setExecuting(false); }
  }

  useEffect(() => {
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'; }
  }, [englishQuery]);

  const hasContext = selectedDatabase && selectedSchema;

  const highlightedSQL = useMemo(() => {
    if (!generatedSQL) return '';
    return tokenizeSQL(generatedSQL);
  }, [generatedSQL]);

  return (
    <div className="space-y-4">
      {/* English Query Input */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-100">Query Builder</h3>
            {hasContext && <span className="badge badge-blue">{selectedSchema}{selectedTable ? `.${selectedTable}` : ''}</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="kbd">Ctrl</span><span className="text-gray-600 text-xs">+</span><span className="kbd">Enter</span>
            <span className="text-[10px] text-gray-600 ml-1">to run</span>
          </div>
        </div>

        {!hasContext ? (
          <div className="text-center py-10 text-gray-500">
            <svg className="h-14 w-14 mx-auto mb-4 text-gray-700/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
            <p className="text-sm">Select a database and schema from the browser to start.</p>
          </div>
        ) : (
          <>
            <div className="relative">
              <textarea
                ref={textareaRef}
                className="input-field text-base min-h-[80px] pr-12"
                placeholder="Type in plain English... e.g. 'Show top 10 orders where amount is greater than 100 sorted by date descending'"
                value={englishQuery}
                onChange={(e) => setEnglishQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleExecute(); } }}
              />
              {isBuilding && (
                <div className="absolute right-3 top-3">
                  <svg className="animate-spin h-5 w-5 text-snow-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                </div>
              )}
            </div>
            {suggestions.length > 0 && !englishQuery && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-2">Suggestions:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s, i) => (
                    <button key={i} type="button" className="text-xs bg-white/5 hover:bg-white/10 text-gray-300 px-3 py-1.5 rounded-full border border-white/10 hover:border-white/20 transition-all" onClick={() => setEnglishQuery(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Generated SQL */}
      {generatedSQL && (
        <div className="card animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h4 className="text-sm font-medium text-gray-300">Generated SQL</h4>
              <ConfidenceBadge confidence={queryConfidence} />
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="btn-ghost text-xs" onClick={() => { setIsEditingSQL(!isEditingSQL); setEditedSQL(generatedSQL); }}>
                {isEditingSQL ? 'Use Generated' : 'Edit SQL'}
              </button>
            </div>
          </div>

          {queryExplanation && <p className="text-xs text-gray-500 mb-3 italic">{queryExplanation}</p>}

          {isEditingSQL ? (
            <textarea className="input-field font-mono text-sm min-h-[120px]" value={editedSQL} onChange={(e) => setEditedSQL(e.target.value)} />
          ) : (
            <pre className="bg-white/[0.03] border border-white/[0.06] text-gray-200 p-4 rounded-xl text-sm font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{ __html: highlightedSQL }} />
          )}

          <div className="flex items-center gap-3 mt-4">
            <button type="button" className="btn-primary flex items-center gap-2" onClick={handleExecute} disabled={isExecuting}>
              {isExecuting ? (
                <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Running...</>
              ) : (
                <><svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>Run Query</>
              )}
            </button>
            <button type="button" className="btn-secondary text-sm" onClick={() => { navigator.clipboard.writeText(isEditingSQL ? editedSQL : generatedSQL); setCopiedSQL(true); setTimeout(() => setCopiedSQL(false), 2000); }}>
              {copiedSQL ? 'Copied!' : 'Copy SQL'}
            </button>
            <button type="button" className={`btn-ghost text-xs ${showColumnStats ? 'text-purple-400' : ''}`} onClick={() => setShowColumnStats(!showColumnStats)} title="Column Statistics">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </button>
          </div>

          {queryError && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-xl p-3 mt-3">
              <svg className="h-4 w-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
              {queryError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const cls = pct >= 70 ? 'badge-green' : pct >= 50 ? 'badge-yellow' : 'badge-red';
  return <span className={`badge ${cls}`}>{pct}% match</span>;
}

function tokenizeSQL(sql: string): string {
  const keywords = new Set(['SELECT','FROM','WHERE','AND','OR','JOIN','LEFT','RIGHT','INNER','OUTER','CROSS','ON','GROUP','BY','ORDER','ASC','DESC','LIMIT','OFFSET','HAVING','DISTINCT','AS','IN','NOT','NULL','IS','LIKE','BETWEEN','EXISTS','UNION','ALL','COUNT','SUM','AVG','MIN','MAX','CASE','WHEN','THEN','ELSE','END','WITH','INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE','DROP','ALTER','TABLE','VIEW','INDEX']);
  return sql.replace(/(".*?"|'.*?'|\b\d+\.?\d*\b|\b[A-Z_]+\b|\*|[(),])/g, (match) => {
    if ((match.startsWith("'") && match.endsWith("'")) || (match.startsWith('"') && match.endsWith('"'))) return `<span class="sql-string">${match}</span>`;
    if (/^\d+\.?\d*$/.test(match)) return `<span class="sql-number">${match}</span>`;
    if (keywords.has(match.toUpperCase())) return `<span class="sql-keyword">${match}</span>`;
    if (match === '*') return `<span class="sql-number">${match}</span>`;
    return match;
  });
}
