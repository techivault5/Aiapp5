'use client';

import { useState } from 'react';
import ConnectionPanel from '@/components/ConnectionPanel';
import SchemaBrowser from '@/components/SchemaBrowser';
import QueryBuilder from '@/components/QueryBuilder';
import ResultsTable from '@/components/ResultsTable';
import { useAppStore } from '@/lib/store';

type Tab = 'connect' | 'query';

export default function Home() {
  const { isConnected, reset } = useAppStore();
  const [activeTab, setActiveTab] = useState<Tab>('connect');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Auto-switch to query tab on connection
  if (isConnected && activeTab === 'connect') {
    setActiveTab('query');
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Top navigation bar */}
      <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-gray-100 flex items-center gap-2">
            <svg className="h-6 w-6 text-snow-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            SnowQuery
          </h1>

          {isConnected && (
            <nav className="flex gap-1 ml-4">
              <button
                type="button"
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  activeTab === 'query'
                    ? 'bg-gray-800 text-gray-100'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                onClick={() => setActiveTab('query')}
              >
                Query Builder
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  activeTab === 'connect'
                    ? 'bg-gray-800 text-gray-100'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                onClick={() => setActiveTab('connect')}
              >
                Connection
              </button>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isConnected && (
            <>
              <button
                type="button"
                className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                title="Toggle schema browser"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              </button>
              <button
                type="button"
                className="text-sm text-red-400 hover:text-red-300 transition-colors"
                onClick={() => {
                  reset();
                  setActiveTab('connect');
                }}
              >
                Disconnect
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Schema Browser */}
        {isConnected && sidebarOpen && activeTab === 'query' && (
          <aside className="w-72 border-r border-gray-800 bg-gray-900/50 flex-shrink-0 overflow-hidden">
            <SchemaBrowser />
          </aside>
        )}

        {/* Main panel */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === 'connect' ? (
            <div className="max-w-2xl mx-auto p-6">
              <ConnectionPanel />
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <QueryBuilder />
              <ResultsTable />
            </div>
          )}
        </main>
      </div>

      {/* Status bar */}
      <footer className="h-7 bg-gray-900 border-t border-gray-800 flex items-center px-4 text-xs text-gray-600 flex-shrink-0">
        <span>SnowQuery v1.0</span>
        <span className="mx-2">|</span>
        <span>Ctrl+Enter to run query</span>
        {isConnected && (
          <>
            <span className="mx-2">|</span>
            <span className="text-green-600">Connected</span>
          </>
        )}
      </footer>
    </div>
  );
}
