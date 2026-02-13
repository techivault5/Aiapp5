'use client';

import { useState, useEffect } from 'react';
import ConnectionPanel from '@/components/ConnectionPanel';
import SchemaBrowser from '@/components/SchemaBrowser';
import QueryBuilder from '@/components/QueryBuilder';
import ResultsTable from '@/components/ResultsTable';
import DebugPanel from '@/components/DebugPanel';
import QueryHistory from '@/components/QueryHistory';
import ColumnStatsPanel from '@/components/ColumnStatsPanel';
import CommandPalette from '@/components/CommandPalette';
import TablePreview from '@/components/TablePreview';
import FormulaBuilder from '@/components/FormulaBuilder';
import { useAppStore } from '@/lib/store';

type Tab = 'connect' | 'query';

export default function Home() {
  const {
    isConnected, reset, showDebugPanel, setShowDebugPanel,
    showQueryHistory, setShowQueryHistory, showCommandPalette, setShowCommandPalette,
    showFormulaBuilder, setShowFormulaBuilder,
    queryHistory, debugLogs, savedFormulas,
  } = useAppStore();
  const [activeTab, setActiveTab] = useState<Tab>('connect');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Auto-switch to query tab on connection
  if (isConnected && activeTab === 'connect') {
    setActiveTab('query');
  }

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+K / Cmd+K - Command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(!showCommandPalette);
      }
      // Ctrl+Shift+D - Debug panel
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setShowDebugPanel(!showDebugPanel);
      }
      // Ctrl+H - History
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        setShowQueryHistory(!showQueryHistory);
      }
      // Ctrl+F - Formula builder
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowFormulaBuilder(!showFormulaBuilder);
      }
      // Escape - close overlays
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCommandPalette, showDebugPanel, showQueryHistory, showFormulaBuilder, setShowCommandPalette, setShowDebugPanel, setShowQueryHistory, setShowFormulaBuilder]);

  return (
    <div className="h-screen flex flex-col">
      {/* Command Palette Overlay */}
      <CommandPalette />
      <TablePreview />

      {/* Top navigation bar */}
      <header className="h-12 glass border-b border-white/[0.06] flex items-center justify-between px-4 flex-shrink-0 z-20">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-snow-500 to-snow-700 flex items-center justify-center">
              <svg className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2L3 7v6l7 5 7-5V7l-7-5zM5 8.5L10 5.5l5 3-5 3-5-3z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-gray-200 tracking-tight">SnowQuery</span>
          </div>

          {/* Tabs */}
          {isConnected && (
            <nav className="flex gap-1 ml-2 bg-white/[0.03] rounded-lg p-0.5">
              <button type="button" className={`tab-button text-xs ${activeTab === 'query' ? 'active' : ''}`} onClick={() => setActiveTab('query')}>
                <span className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                  Query
                </span>
              </button>
              <button type="button" className={`tab-button text-xs ${activeTab === 'connect' ? 'active' : ''}`} onClick={() => setActiveTab('connect')}>
                <span className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                  Connection
                </span>
              </button>
            </nav>
          )}
        </div>

        {/* Right toolbar */}
        <div className="flex items-center gap-1">
          {isConnected && (
            <>
              {/* Command palette trigger */}
              <button type="button" className="btn-ghost text-xs flex items-center gap-2" onClick={() => setShowCommandPalette(true)} title="Command palette (Ctrl+K)">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <span className="kbd">Ctrl+K</span>
              </button>

              <div className="w-px h-5 bg-white/[0.06] mx-1" />

              {/* Toggle buttons */}
              <button type="button" className={`btn-ghost text-xs relative ${showQueryHistory ? 'text-snow-400' : ''}`} onClick={() => setShowQueryHistory(!showQueryHistory)} title="Query History (Ctrl+H)">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {queryHistory.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-snow-600 text-[8px] text-white rounded-full flex items-center justify-center">{queryHistory.length}</span>}
              </button>

              <button type="button" className={`btn-ghost text-xs relative ${showFormulaBuilder ? 'text-purple-400' : ''}`} onClick={() => setShowFormulaBuilder(!showFormulaBuilder)} title="Formula Builder (Ctrl+F)">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                {savedFormulas.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-purple-600 text-[8px] text-white rounded-full flex items-center justify-center">{savedFormulas.length}</span>}
              </button>

              <button type="button" className={`btn-ghost text-xs ${showDebugPanel ? 'text-snow-400' : ''}`} onClick={() => setShowDebugPanel(!showDebugPanel)} title="Debug Console (Ctrl+Shift+D)">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                {debugLogs.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
              </button>

              <button type="button" className="btn-ghost text-xs" onClick={() => setSidebarOpen(!sidebarOpen)} title="Toggle sidebar">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
              </button>

              <div className="w-px h-5 bg-white/[0.06] mx-1" />

              <button type="button" className="btn-ghost text-xs text-red-400/80 hover:text-red-300" onClick={() => { reset(); setActiveTab('connect'); }}>
                Disconnect
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Schema Browser */}
        {isConnected && sidebarOpen && activeTab === 'query' && (
          <aside className="w-72 border-r border-white/[0.06] bg-[#0c1019] flex-shrink-0 overflow-hidden">
            <SchemaBrowser />
          </aside>
        )}

        {/* Main panel */}
        <main className="flex-1 overflow-y-auto grid-bg">
          {activeTab === 'connect' ? (
            <div className="p-8">
              <ConnectionPanel />
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <QueryBuilder />
              <FormulaBuilder />
              <ColumnStatsPanel />
              <ResultsTable />
            </div>
          )}
        </main>

        {/* Query History sidebar */}
        {isConnected && activeTab === 'query' && <QueryHistory />}
      </div>

      {/* Debug Panel */}
      <DebugPanel />

      {/* Status bar */}
      <footer className="h-7 glass border-t border-white/[0.06] flex items-center justify-between px-4 text-[10px] text-gray-600 flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <span className="font-medium">SnowQuery v1.0</span>
          {isConnected && (
            <>
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <span className="text-emerald-600">Connected</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span><span className="kbd text-[8px]">Ctrl+K</span> Commands</span>
          <span><span className="kbd text-[8px]">Ctrl+Enter</span> Run</span>
          <span><span className="kbd text-[8px]">Ctrl+F</span> Formula</span>
          <span><span className="kbd text-[8px]">Ctrl+H</span> History</span>
        </div>
      </footer>
    </div>
  );
}
