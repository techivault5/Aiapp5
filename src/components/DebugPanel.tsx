'use client';

import { useRef, useEffect } from 'react';
import { useAppStore } from '@/lib/store';

export default function DebugPanel() {
  const { debugLogs, showDebugPanel, setShowDebugPanel, clearDebugLogs } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [debugLogs]);

  if (!showDebugPanel) return null;

  return (
    <div className="border-t border-white/[0.06] bg-[#0c1019] animate-slide-up flex flex-col" style={{ height: '240px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Debug Console</span>
          </div>
          <span className="badge badge-gray">{debugLogs.length} entries</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-ghost text-xs"
            onClick={clearDebugLogs}
          >
            Clear
          </button>
          <button
            type="button"
            className="btn-ghost text-xs"
            onClick={() => setShowDebugPanel(false)}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Log entries */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-1">
        {debugLogs.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-600 text-xs">
            No debug logs yet. Execute a query to see activity.
          </div>
        )}
        {debugLogs.map((log) => (
          <div key={log.id} className={`debug-line debug-line-${log.level} flex items-start gap-2 hover:bg-white/[0.02]`}>
            <span className="text-gray-600 text-[10px] flex-shrink-0 w-[70px] tabular-nums">
              {formatTimestamp(log.timestamp)}
            </span>
            <span className="flex-shrink-0 w-[14px]">{getLevelIcon(log.level)}</span>
            <span className="flex-1 break-all">{log.message}</span>
            {log.detail && (
              <span className="text-gray-600 flex-shrink-0 ml-2">{log.detail}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
}

function getLevelIcon(level: string): string {
  switch (level) {
    case 'info': return 'i';
    case 'success': return '\u2713';
    case 'error': return '\u2717';
    case 'warn': return '!';
    case 'sql': return '>';
    case 'timing': return '\u23f1';
    default: return '\u2022';
  }
}
