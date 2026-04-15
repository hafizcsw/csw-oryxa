/**
 * DebugOverlay - P0 Traceability Component
 * Shows when ?debug=1 is in URL
 * Displays: BUILD_ID, trace_id, cards_query, api_payload, results_source
 */

import { useMalakChat } from '@/contexts/MalakChatContext';
import { useState } from 'react';
import { X, ChevronDown, ChevronUp, Bug } from 'lucide-react';

// Build info from env
const BUILD_ID = import.meta.env.VITE_BUILD_ID || 'dev_local';
const DEPLOY_TARGET = import.meta.env.VITE_DEPLOY_TARGET || 'preview';
const UX_MODE = import.meta.env.VITE_UX_MODE || 'chat_first';
const FUNCTIONS_BASE = import.meta.env.VITE_FUNCTIONS_BASE || 'auto';

export function DebugOverlay() {
  const { debugInfo, resultsSource } = useMalakChat();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // Only show if ?debug=1 is in URL
  const urlParams = new URLSearchParams(window.location.search);
  const debugEnabled = urlParams.get('debug') === '1';

  if (!debugEnabled || !isVisible) return null;

  return (
    <div className="fixed top-20 left-4 z-[9999] bg-slate-900/95 text-white text-xs font-mono rounded-lg shadow-xl border border-slate-700 max-w-sm backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700 bg-slate-800 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-amber-400">Debug Panel</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-slate-700 rounded"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 hover:bg-slate-700 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2 space-y-1.5">
        {/* Build Info */}
        <div className="grid grid-cols-2 gap-x-2">
          <span className="text-slate-400">BUILD_ID:</span>
          <span className="text-green-400 truncate">{BUILD_ID}</span>
          
          <span className="text-slate-400">TARGET:</span>
          <span className={DEPLOY_TARGET === 'production' ? 'text-red-400' : 'text-yellow-400'}>
            {DEPLOY_TARGET}
          </span>
          
          <span className="text-slate-400">UX_MODE:</span>
          <span className="text-blue-400">{UX_MODE}</span>
        </div>

        <hr className="border-slate-700" />

        {/* Results Source - Key indicator */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400">results_source:</span>
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
            resultsSource === 'chat_cards' ? 'bg-green-600 text-white' :
            resultsSource === 'manual_search' ? 'bg-blue-600 text-white' :
            'bg-slate-600 text-slate-300'
          }`}>
            {resultsSource}
          </span>
        </div>

        {/* Trace IDs */}
        <div className="grid grid-cols-2 gap-x-2">
          <span className="text-slate-400">trace_id:</span>
          <span className="text-cyan-400 truncate">{debugInfo.last_trace_id?.slice(0, 12) || '—'}</span>
        </div>

        {/* Rendered count */}
        <div className="grid grid-cols-2 gap-x-2">
          <span className="text-slate-400">rendered:</span>
          <span className="text-white">{debugInfo.last_rendered_count}</span>
          
          <span className="text-slate-400">api_total:</span>
          <span className="text-white">{debugInfo.last_api_total ?? '—'}</span>
        </div>

        {/* Expanded: cards_query details */}
        {isExpanded && (
          <>
            <hr className="border-slate-700" />
            
            <div>
              <span className="text-slate-400 block mb-1">cards_query:</span>
              {debugInfo.last_cards_query ? (
                <pre className="bg-slate-800 p-2 rounded text-[10px] overflow-auto max-h-32">
                  {JSON.stringify(debugInfo.last_cards_query, null, 2)}
                </pre>
              ) : (
                <span className="text-slate-500 italic">No query</span>
              )}
            </div>

            <div>
              <span className="text-slate-400 block mb-1">api_payload:</span>
              {debugInfo.last_api_payload ? (
                <pre className="bg-slate-800 p-2 rounded text-[10px] overflow-auto max-h-32">
                  {JSON.stringify(debugInfo.last_api_payload, null, 2)}
                </pre>
              ) : (
                <span className="text-slate-500 italic">—</span>
              )}
            </div>

            <div className="text-slate-500 text-[10px]">
              Last update: {new Date(debugInfo.timestamp).toLocaleTimeString()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
