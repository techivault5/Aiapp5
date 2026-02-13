'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  category: string;
  action: () => void;
}

export default function CommandPalette() {
  const store = useAppStore();
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: Command[] = [
    {
      id: 'toggle-debug',
      label: store.showDebugPanel ? 'Hide Debug Panel' : 'Show Debug Panel',
      shortcut: 'Ctrl+Shift+D',
      category: 'View',
      action: () => store.setShowDebugPanel(!store.showDebugPanel),
    },
    {
      id: 'toggle-history',
      label: store.showQueryHistory ? 'Hide Query History' : 'Show Query History',
      shortcut: 'Ctrl+H',
      category: 'View',
      action: () => store.setShowQueryHistory(!store.showQueryHistory),
    },
    {
      id: 'toggle-formula',
      label: store.showFormulaBuilder ? 'Hide Formula Builder' : 'Show Formula Builder',
      shortcut: 'Ctrl+F',
      category: 'View',
      action: () => store.setShowFormulaBuilder(!store.showFormulaBuilder),
    },
    {
      id: 'toggle-stats',
      label: store.showColumnStats ? 'Hide Column Stats' : 'Show Column Stats',
      shortcut: 'Ctrl+I',
      category: 'View',
      action: () => store.setShowColumnStats(!store.showColumnStats),
    },
    {
      id: 'toggle-preview',
      label: 'Preview Table Data',
      shortcut: 'Ctrl+P',
      category: 'Data',
      action: () => store.setShowPreview(!store.showPreview),
    },
    {
      id: 'clear-query',
      label: 'Clear Query',
      category: 'Query',
      action: () => {
        store.setEnglishQuery('');
        store.setGeneratedSQL('');
        store.setQueryResult(null);
      },
    },
    {
      id: 'clear-logs',
      label: 'Clear Debug Logs',
      category: 'Debug',
      action: () => store.clearDebugLogs(),
    },
    {
      id: 'clear-history',
      label: 'Clear Query History',
      category: 'History',
      action: () => store.clearQueryHistory(),
    },
    {
      id: 'disconnect',
      label: 'Disconnect from Snowflake',
      category: 'Connection',
      action: () => store.reset(),
    },
    {
      id: 'export-csv',
      label: 'Export Results as CSV',
      category: 'Data',
      action: () => {
        if (store.queryResult) {
          exportCSV(store.queryResult.columns, store.queryResult.rows);
        }
      },
    },
    {
      id: 'export-json',
      label: 'Export Results as JSON',
      category: 'Data',
      action: () => {
        if (store.queryResult) {
          exportJSON(store.queryResult.rows);
        }
      },
    },
  ];

  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(search.toLowerCase()) ||
      cmd.category.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    inputRef.current?.focus();
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    setSelectedIndex(0);
    setSearch('');
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
        store.setShowCommandPalette(false);
      }
    } else if (e.key === 'Escape') {
      store.setShowCommandPalette(false);
    }
  }

  if (!store.showCommandPalette) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={() => store.setShowCommandPalette(false)}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-[#111827] border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
          <svg className="h-5 w-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-gray-100 text-sm placeholder-gray-500 focus:outline-none"
            placeholder="Type a command..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className="kbd">Esc</span>
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto py-2">
          {filteredCommands.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-600 text-sm">
              No commands found
            </div>
          )}
          {filteredCommands.map((cmd, i) => (
            <button
              key={cmd.id}
              type="button"
              className={`w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors ${
                i === selectedIndex ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
              }`}
              onMouseEnter={() => setSelectedIndex(i)}
              onClick={() => {
                cmd.action();
                store.setShowCommandPalette(false);
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-gray-600 uppercase tracking-wider w-16">{cmd.category}</span>
                <span className="text-sm text-gray-200">{cmd.label}</span>
              </div>
              {cmd.shortcut && <span className="kbd">{cmd.shortcut}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function exportCSV(columns: { name: string }[], rows: Record<string, unknown>[]): void {
  const header = columns.map((c) => `"${c.name}"`).join(',');
  const body = rows.map((row) =>
    columns.map((c) => {
      const val = row[c.name];
      if (val === null || val === undefined) return '';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',')
  ).join('\n');
  downloadBlob(`${header}\n${body}`, 'text/csv', `query_results_${Date.now()}.csv`);
}

function exportJSON(rows: Record<string, unknown>[]): void {
  downloadBlob(JSON.stringify(rows, null, 2), 'application/json', `query_results_${Date.now()}.json`);
}

function downloadBlob(content: string, type: string, filename: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
