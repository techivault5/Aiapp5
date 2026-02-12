'use client';

import { useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { ColumnInfo } from '@/lib/snowflake';

export default function SchemaBrowser() {
  const {
    connectionConfig, databases, selectedDatabase, setSelectedDatabase,
    schemas, setSchemas, selectedSchema, setSelectedSchema, selectedTable,
    setSelectedTable, isScanning, setScanning, scanProgress, setScanProgress,
    addDebugLog, setShowPreview,
  } = useAppStore();

  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [tableColumns, setTableColumns] = useState<Record<string, ColumnInfo[]>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const fetchSchemas = useCallback(async (database: string) => {
    if (!connectionConfig) return;
    setScanning(true);
    setScanProgress('Scanning schemas...');
    addDebugLog({ level: 'info', message: `Full scan on database: ${database}` });
    try {
      const res = await fetch('/api/schemas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...connectionConfig, action: 'full-scan', database }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSchemas(data.schemas);
      const totalTables = data.schemas.reduce((a: number, s: { tables: unknown[] }) => a + s.tables.length, 0);
      setScanProgress(`${data.schemas.length} schemas, ${totalTables} tables`);
      addDebugLog({ level: 'success', message: `Scan complete: ${data.schemas.length} schemas, ${totalTables} tables` });
    } catch (err) {
      setScanProgress(`Error: ${(err as Error).message}`);
      addDebugLog({ level: 'error', message: `Scan failed: ${(err as Error).message}` });
    } finally { setScanning(false); }
  }, [connectionConfig, setSchemas, setScanning, setScanProgress, addDebugLog]);

  const fetchColumns = useCallback(async (database: string, schema: string, table: string) => {
    if (!connectionConfig) return;
    const key = `${schema}.${table}`;
    if (tableColumns[key]) return;
    try {
      const res = await fetch('/api/schemas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...connectionConfig, action: 'columns', database, schema, table }) });
      const data = await res.json();
      if (res.ok) setTableColumns((prev) => ({ ...prev, [key]: data.columns }));
    } catch { /* silent */ }
  }, [connectionConfig, tableColumns]);

  function handleDatabaseSelect(db: string) {
    setSelectedDatabase(db); setSchemas([]); setSelectedSchema(null); setSelectedTable(null); fetchSchemas(db);
  }

  function toggleSchema(schemaName: string) {
    const next = new Set(expandedSchemas);
    next.has(schemaName) ? next.delete(schemaName) : next.add(schemaName);
    setExpandedSchemas(next);
  }

  function toggleTable(schemaName: string, tableName: string) {
    const key = `${schemaName}.${tableName}`;
    const next = new Set(expandedTables);
    if (next.has(key)) { next.delete(key); } else { next.add(key); if (selectedDatabase) fetchColumns(selectedDatabase, schemaName, tableName); }
    setExpandedTables(next);
  }

  const filteredSchemas = schemas.filter((s) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return s.schema.toLowerCase().includes(term) || s.tables.some((t) => t.name.toLowerCase().includes(term) || t.columns.some((c) => c.name.toLowerCase().includes(term)));
  });

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-white/[0.06]">
        <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Explorer</h3>
        {databases.length > 0 && (
          <select className="input-field text-sm mb-2" value={selectedDatabase || ''} onChange={(e) => handleDatabaseSelect(e.target.value)}>
            <option value="">Select database...</option>
            {databases.map((db) => <option key={db} value={db}>{db}</option>)}
          </select>
        )}
        <div className="relative">
          <svg className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" className="input-field text-sm pl-9" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {isScanning && (
        <div className="px-3 py-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <svg className="animate-spin h-3 w-3 text-snow-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            <span className="text-xs text-gray-400">{scanProgress}</span>
          </div>
        </div>
      )}

      {!isScanning && scanProgress && (
        <div className="px-3 py-1.5 border-b border-white/[0.06]">
          <span className="text-[10px] text-gray-500">{scanProgress}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        {filteredSchemas.length === 0 && !isScanning && selectedDatabase && (
          <p className="text-xs text-gray-600 p-2">No schemas found.</p>
        )}

        {filteredSchemas.map((schemaInfo) => (
          <div key={schemaInfo.schema} className="mb-0.5">
            <button type="button" className="sidebar-item w-full text-left flex items-center gap-1.5 text-gray-300" onClick={() => toggleSchema(schemaInfo.schema)}>
              <svg className={`h-3 w-3 transition-transform ${expandedSchemas.has(schemaInfo.schema) ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path d="M6 6L14 10L6 14V6Z" /></svg>
              <svg className="h-3.5 w-3.5 text-yellow-500/70" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
              <span className="truncate">{schemaInfo.schema}</span>
              <span className="text-[10px] text-gray-600 ml-auto tabular-nums">{schemaInfo.tables.length}</span>
            </button>

            {expandedSchemas.has(schemaInfo.schema) && (
              <div className="ml-4">
                {schemaInfo.tables.map((table) => {
                  const tableKey = `${schemaInfo.schema}.${table.name}`;
                  const isSelected = selectedSchema === schemaInfo.schema && selectedTable === table.name;
                  const cols = tableColumns[tableKey];

                  return (
                    <div key={table.name}>
                      <div className="flex items-center group">
                        <button type="button" className={`sidebar-item flex-1 text-left flex items-center gap-1.5 ${isSelected ? 'active' : 'text-gray-400'}`}
                          onClick={() => { setSelectedSchema(schemaInfo.schema); setSelectedTable(table.name); toggleTable(schemaInfo.schema, table.name); }}>
                          <svg className={`h-3 w-3 transition-transform ${expandedTables.has(tableKey) ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path d="M6 6L14 10L6 14V6Z" /></svg>
                          <svg className={`h-3.5 w-3.5 ${table.type === 'VIEW' ? 'text-purple-400/70' : 'text-blue-400/70'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {table.type === 'VIEW' ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M3 6h18M3 18h18" />}
                          </svg>
                          <span className="truncate">{table.name}</span>
                          {table.rowCount > 0 && <span className="text-[10px] text-gray-600 ml-auto tabular-nums">{fmtCount(table.rowCount)}</span>}
                        </button>
                        {isSelected && (
                          <button type="button" className="opacity-0 group-hover:opacity-100 btn-ghost text-xs p-1 mr-1 transition-opacity" onClick={() => setShowPreview(true)} title="Preview data">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </button>
                        )}
                      </div>

                      {expandedTables.has(tableKey) && cols && (
                        <div className="ml-7 py-1 space-y-0.5">
                          {cols.map((col) => (
                            <div key={col.name} className="flex items-center gap-1.5 px-2 py-0.5 text-xs text-gray-500 rounded hover:bg-white/[0.03]">
                              <span className={`text-[10px] font-mono w-3 text-center ${getTypeColor(col.type)}`}>{getTypeIcon(col.type)}</span>
                              <span className="text-gray-400 truncate">{col.name}</span>
                              <span className="text-gray-600 ml-auto text-[10px]">{col.type}</span>
                              {col.nullable && <span className="text-yellow-600/50 text-[10px]">?</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      {expandedTables.has(tableKey) && !cols && (
                        <div className="ml-7 py-1 space-y-1">
                          <div className="shimmer h-3 rounded w-3/4" /><div className="shimmer h-3 rounded w-1/2" /><div className="shimmer h-3 rounded w-2/3" />
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

function fmtCount(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toString();
}

function getTypeIcon(t: string): string {
  const u = t.toUpperCase();
  if (['NUMBER','INT','INTEGER','FLOAT','DECIMAL','NUMERIC','DOUBLE','BIGINT'].includes(u)) return '#';
  if (['VARCHAR','STRING','TEXT','CHAR'].includes(u)) return 'T';
  if (['DATE','TIMESTAMP','TIMESTAMP_LTZ','TIMESTAMP_NTZ','TIMESTAMP_TZ','DATETIME','TIME'].includes(u)) return 'D';
  if (u === 'BOOLEAN') return 'B';
  if (['VARIANT','OBJECT','ARRAY'].includes(u)) return 'J';
  return 'C';
}

function getTypeColor(t: string): string {
  const u = t.toUpperCase();
  if (['NUMBER','INT','INTEGER','FLOAT','DECIMAL','NUMERIC','DOUBLE','BIGINT'].includes(u)) return 'text-amber-500/60';
  if (['VARCHAR','STRING','TEXT','CHAR'].includes(u)) return 'text-emerald-500/60';
  if (['DATE','TIMESTAMP','TIMESTAMP_LTZ','TIMESTAMP_NTZ','TIMESTAMP_TZ','DATETIME','TIME'].includes(u)) return 'text-blue-500/60';
  if (u === 'BOOLEAN') return 'text-purple-500/60';
  return 'text-gray-500/60';
}
