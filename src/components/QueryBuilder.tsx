'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/lib/store';

export default function QueryBuilder() {
  const {
    connectionConfig,
    selectedDatabase,
    selectedSchema,
    selectedTable,
    schemas,
    englishQuery,
    setEnglishQuery,
    generatedSQL,
    setGeneratedSQL,
    queryExplanation,
    setQueryExplanation,
    queryConfidence,
    setQueryConfidence,
    isBuilding,
    setBuilding,
    setQueryResult,
    isExecuting,
    setExecuting,
    setQueryError,
    queryError,
    currentPage,
    setCurrentPage,
    pageSize,
  } = useAppStore();

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isEditingSQL, setIsEditingSQL] = useState(false);
  const [editedSQL, setEditedSQL] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Get table context for the query builder
  const getQueryContext = useCallback(() => {
    if (!selectedDatabase || !selectedSchema) return null;

    const schemaInfo = schemas.find(
      (s) => s.database === selectedDatabase && s.schema === selectedSchema
    );
    if (!schemaInfo) return null;

    return {
      database: selectedDatabase,
      schema: selectedSchema,
      tables: schemaInfo.tables.map((t) => ({
        name: t.name,
        columns: t.columns,
        rowCount: t.rowCount,
      })),
    };
  }, [selectedDatabase, selectedSchema, schemas]);

  // Build query from English (debounced)
  const buildQuery = useCallback(
    async (query: string) => {
      const context = getQueryContext();
      if (!query.trim() || !context) return;

      setBuilding(true);
      try {
        const res = await fetch('/api/query/build', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ englishQuery: query, context }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setGeneratedSQL(data.sql);
        setEditedSQL(data.sql);
        setQueryExplanation(data.explanation);
        setQueryConfidence(data.confidence);
        setSuggestions(data.suggestions || []);
      } catch (err) {
        setQueryError((err as Error).message);
      } finally {
        setBuilding(false);
      }
    },
    [getQueryContext, setBuilding, setGeneratedSQL, setQueryExplanation, setQueryConfidence, setQueryError]
  );

  // Debounced query building
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (englishQuery.trim()) {
        buildQuery(englishQuery);
      }
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [englishQuery, buildQuery]);

  // Execute the query
  async function handleExecute() {
    const sql = isEditingSQL ? editedSQL : generatedSQL;
    if (!sql || !connectionConfig) return;

    setExecuting(true);
    setQueryError(null);
    setCurrentPage(1);

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...connectionConfig,
          sql,
          page: 1,
          pageSize,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQueryResult(data);
    } catch (err) {
      setQueryError((err as Error).message);
    } finally {
      setExecuting(false);
    }
  }

  function handleSuggestionClick(suggestion: string) {
    setEnglishQuery(suggestion);
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [englishQuery]);

  const hasContext = selectedDatabase && selectedSchema;

  return (
    <div className="space-y-4">
      {/* English Query Input */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-100">Query Builder</h3>
          {selectedTable && (
            <span className="text-xs bg-snow-900/50 text-snow-300 px-2 py-1 rounded-full">
              {selectedSchema}.{selectedTable}
            </span>
          )}
        </div>

        {!hasContext ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="h-12 w-12 mx-auto mb-3 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
            <p className="text-sm">Select a database and schema from the browser to start building queries.</p>
          </div>
        ) : (
          <>
            <div className="relative">
              <textarea
                ref={textareaRef}
                className="input-field text-base min-h-[80px] pr-12"
                placeholder="Type your query in plain English... e.g., 'Show all orders where amount is greater than 100 sorted by date descending'"
                value={englishQuery}
                onChange={(e) => setEnglishQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleExecute();
                  }
                }}
              />
              {isBuilding && (
                <div className="absolute right-3 top-3">
                  <svg className="animate-spin h-5 w-5 text-snow-400" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && !englishQuery && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-2">Try these:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-full transition-colors"
                      onClick={() => handleSuggestionClick(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Generated SQL */}
      {generatedSQL && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h4 className="text-sm font-medium text-gray-300">Generated SQL</h4>
              <div className="flex items-center gap-1.5">
                <div
                  className={`h-2 w-2 rounded-full ${
                    queryConfidence >= 0.7
                      ? 'bg-green-500'
                      : queryConfidence >= 0.5
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                />
                <span className="text-xs text-gray-500">
                  {Math.round(queryConfidence * 100)}% confidence
                </span>
              </div>
            </div>
            <button
              type="button"
              className="text-xs text-snow-400 hover:text-snow-300"
              onClick={() => {
                setIsEditingSQL(!isEditingSQL);
                setEditedSQL(generatedSQL);
              }}
            >
              {isEditingSQL ? 'Use Generated' : 'Edit SQL'}
            </button>
          </div>

          {queryExplanation && (
            <p className="text-xs text-gray-500 mb-3 italic">{queryExplanation}</p>
          )}

          {isEditingSQL ? (
            <textarea
              className="input-field font-mono text-sm min-h-[120px]"
              value={editedSQL}
              onChange={(e) => setEditedSQL(e.target.value)}
            />
          ) : (
            <pre className="bg-gray-800 text-gray-200 p-3 rounded-lg text-sm font-mono overflow-x-auto whitespace-pre-wrap">
              {highlightSQL(generatedSQL)}
            </pre>
          )}

          <div className="flex gap-3 mt-4">
            <button
              type="button"
              className="btn-primary flex items-center gap-2"
              onClick={handleExecute}
              disabled={isExecuting}
            >
              {isExecuting ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Running...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                  Run Query
                </>
              )}
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => {
                navigator.clipboard.writeText(isEditingSQL ? editedSQL : generatedSQL);
              }}
            >
              Copy SQL
            </button>
          </div>

          {queryError && (
            <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-lg p-3 mt-3">
              {queryError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function highlightSQL(sql: string): string {
  // Simple SQL syntax highlighting for display
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
    'CROSS', 'ON', 'GROUP', 'BY', 'ORDER', 'ASC', 'DESC', 'LIMIT', 'OFFSET', 'HAVING',
    'DISTINCT', 'AS', 'IN', 'NOT', 'NULL', 'IS', 'LIKE', 'BETWEEN', 'EXISTS', 'UNION',
    'ALL', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'DROP',
    'ALTER', 'TABLE', 'INDEX', 'VIEW', 'WITH', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  ];

  // Return raw SQL for pre tag - highlighting done via CSS classes
  return sql;
}
