'use client';

import { useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { SchemaInfo, ColumnInfo } from '@/lib/snowflake';

export default function SchemaBrowser() {
  const {
    connectionConfig,
    databases,
    selectedDatabase,
    setSelectedDatabase,
    schemas,
    setSchemas,
    selectedSchema,
    setSelectedSchema,
    selectedTable,
    setSelectedTable,
    isScanning,
    setScanning,
    scanProgress,
    setScanProgress,
  } = useAppStore();

  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [tableColumns, setTableColumns] = useState<Record<string, ColumnInfo[]>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const fetchSchemas = useCallback(
    async (database: string) => {
      if (!connectionConfig) return;
      setScanning(true);
      setScanProgress('Scanning schemas...');

      try {
        const res = await fetch('/api/schemas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...connectionConfig,
            action: 'full-scan',
            database,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setSchemas(data.schemas);
        setScanProgress(`Found ${data.schemas.length} schemas`);
      } catch (err) {
        setScanProgress(`Error: ${(err as Error).message}`);
      } finally {
        setScanning(false);
      }
    },
    [connectionConfig, setSchemas, setScanning, setScanProgress]
  );

  const fetchColumns = useCallback(
    async (database: string, schema: string, table: string) => {
      if (!connectionConfig) return;
      const key = `${schema}.${table}`;
      if (tableColumns[key]) return;

      try {
        const res = await fetch('/api/schemas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...connectionConfig,
            action: 'columns',
            database,
            schema,
            table,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setTableColumns((prev) => ({ ...prev, [key]: data.columns }));
        }
      } catch {
        // Silently fail for column fetch
      }
    },
    [connectionConfig, tableColumns]
  );

  function handleDatabaseSelect(db: string) {
    setSelectedDatabase(db);
    setSchemas([]);
    setSelectedSchema(null);
    setSelectedTable(null);
    fetchSchemas(db);
  }

  function toggleSchema(schemaName: string) {
    const next = new Set(expandedSchemas);
    if (next.has(schemaName)) {
      next.delete(schemaName);
    } else {
      next.add(schemaName);
    }
    setExpandedSchemas(next);
  }

  function toggleTable(schemaName: string, tableName: string) {
    const key = `${schemaName}.${tableName}`;
    const next = new Set(expandedTables);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
      if (selectedDatabase) {
        fetchColumns(selectedDatabase, schemaName, tableName);
      }
    }
    setExpandedTables(next);
  }

  function handleTableSelect(schema: string, table: string) {
    setSelectedSchema(schema);
    setSelectedTable(table);
  }

  // Filter schemas/tables based on search
  const filteredSchemas = schemas.filter((s) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    if (s.schema.toLowerCase().includes(term)) return true;
    return s.tables.some(
      (t) =>
        t.name.toLowerCase().includes(term) ||
        t.columns.some((c) => c.name.toLowerCase().includes(term))
    );
  });

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">
          Schema Browser
        </h3>

        {/* Database selector */}
        {databases.length > 0 && (
          <select
            className="input-field text-sm mb-2"
            value={selectedDatabase || ''}
            onChange={(e) => handleDatabaseSelect(e.target.value)}
          >
            <option value="">Select database...</option>
            {databases.map((db) => (
              <option key={db} value={db}>
                {db}
              </option>
            ))}
          </select>
        )}

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            className="input-field text-sm pl-9"
            placeholder="Search tables, columns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Scan progress */}
      {isScanning && (
        <div className="px-3 py-2 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <svg className="animate-spin h-3 w-3 text-snow-400" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-xs text-gray-400">{scanProgress}</span>
          </div>
        </div>
      )}

      {/* Schema tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredSchemas.length === 0 && !isScanning && selectedDatabase && (
          <p className="text-xs text-gray-500 p-2">No schemas found. Select a database to scan.</p>
        )}

        {filteredSchemas.map((schemaInfo) => (
          <div key={schemaInfo.schema} className="mb-1">
            {/* Schema node */}
            <button
              type="button"
              className="sidebar-item w-full text-left flex items-center gap-1.5 text-gray-300"
              onClick={() => toggleSchema(schemaInfo.schema)}
            >
              <svg
                className={`h-3 w-3 transition-transform ${expandedSchemas.has(schemaInfo.schema) ? 'rotate-90' : ''}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M6 6L14 10L6 14V6Z" />
              </svg>
              <svg className="h-3.5 w-3.5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
              <span className="truncate">{schemaInfo.schema}</span>
              <span className="text-xs text-gray-600 ml-auto">{schemaInfo.tables.length}</span>
            </button>

            {/* Tables */}
            {expandedSchemas.has(schemaInfo.schema) && (
              <div className="ml-4">
                {schemaInfo.tables.map((table) => {
                  const tableKey = `${schemaInfo.schema}.${table.name}`;
                  const isSelected =
                    selectedSchema === schemaInfo.schema && selectedTable === table.name;
                  const cols = tableColumns[tableKey];

                  return (
                    <div key={table.name}>
                      <button
                        type="button"
                        className={`sidebar-item w-full text-left flex items-center gap-1.5 ${
                          isSelected ? 'active' : 'text-gray-400'
                        }`}
                        onClick={() => {
                          handleTableSelect(schemaInfo.schema, table.name);
                          toggleTable(schemaInfo.schema, table.name);
                        }}
                      >
                        <svg
                          className={`h-3 w-3 transition-transform ${
                            expandedTables.has(tableKey) ? 'rotate-90' : ''
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M6 6L14 10L6 14V6Z" />
                        </svg>
                        <svg
                          className={`h-3.5 w-3.5 ${table.type === 'VIEW' ? 'text-purple-400' : 'text-blue-400'}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          {table.type === 'VIEW' ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M3 6h18M3 18h18" />
                          )}
                        </svg>
                        <span className="truncate">{table.name}</span>
                        {table.rowCount > 0 && (
                          <span className="text-xs text-gray-600 ml-auto">
                            {formatRowCount(table.rowCount)}
                          </span>
                        )}
                      </button>

                      {/* Columns */}
                      {expandedTables.has(tableKey) && cols && (
                        <div className="ml-7 py-1">
                          {cols.map((col) => (
                            <div
                              key={col.name}
                              className="flex items-center gap-1.5 px-2 py-0.5 text-xs text-gray-500"
                            >
                              <span className="text-gray-600">
                                {getTypeIcon(col.type)}
                              </span>
                              <span className="text-gray-400 truncate">{col.name}</span>
                              <span className="text-gray-600 ml-auto text-[10px]">{col.type}</span>
                              {col.nullable && (
                                <span className="text-yellow-700 text-[10px]">?</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {expandedTables.has(tableKey) && !cols && (
                        <div className="ml-7 py-1">
                          <div className="shimmer h-3 rounded w-3/4 mb-1" />
                          <div className="shimmer h-3 rounded w-1/2 mb-1" />
                          <div className="shimmer h-3 rounded w-2/3" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatRowCount(count: number): string {
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1)}B`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

function getTypeIcon(type: string): string {
  const t = type.toUpperCase();
  if (['NUMBER', 'INT', 'INTEGER', 'FLOAT', 'DECIMAL', 'NUMERIC', 'DOUBLE', 'BIGINT'].includes(t)) return '#';
  if (['VARCHAR', 'STRING', 'TEXT', 'CHAR'].includes(t)) return 'T';
  if (['DATE', 'TIMESTAMP', 'TIMESTAMP_LTZ', 'TIMESTAMP_NTZ', 'TIMESTAMP_TZ', 'DATETIME', 'TIME'].includes(t)) return 'D';
  if (['BOOLEAN'].includes(t)) return 'B';
  if (['VARIANT', 'OBJECT', 'ARRAY'].includes(t)) return 'J';
  if (['BINARY', 'VARBINARY'].includes(t)) return 'X';
  return 'C';
}
