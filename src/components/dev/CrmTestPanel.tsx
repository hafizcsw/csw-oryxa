/**
 * CRM Test Mode Panel
 * Activated via ?testmode=1 query param
 * Allows manual trace_id and message sending
 * for CRM door testing (D2/D5/D8/D10)
 * 
 * ⚠️ NO SECRETS EXPOSED — only controls payload shape
 * ⚠️ NO Zero-Trust bypass — uses real session identity
 * ⚠️ i18n compliant — all UI strings use translation keys
 */

import { useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMalakChat } from '@/contexts/MalakChatContext';
import { sendChatMessage, sendChatAck, GatewayResponse } from '@/lib/chat/gateway';
import { getOrCreateGuestSessionId } from '@/lib/chat/session';
import { buildUiContextV1 } from '@/lib/uiContext';
import { ChevronDown, ChevronUp, FlaskConical, Send, CheckCircle, AlertTriangle, Copy } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  scenario: string;
  trace_id: string;
  direction: 'request' | 'response';
  status: 'ok' | 'error';
  payload: Record<string, unknown>;
  latency_ms?: number;
}

/**
 * Scenario definitions for CRM Door testing
 * Labels use i18n keys resolved at render time
 */
const SCENARIO_KEYS = {
  D10: {
    i18nKey: 'dev.crm_test.scenario_d10',
    defaultMessage: 'ماجستير إدارة أعمال في تركيا، ميزانية 12000، لغة إنجليزية',
    defaultTrace: 'ev_lav_portal_d10_001',
  },
  D5: {
    i18nKey: 'dev.crm_test.scenario_d5',
    defaultTrace: 'ev_lav_portal_d5_001',
  },
  D2_D8: {
    i18nKey: 'dev.crm_test.scenario_d2_d8',
    defaultMessage: 'ping',
    defaultTrace: 'ev_lav_portal_d8_001',
  },
  BASELINE: {
    i18nKey: 'dev.crm_test.scenario_baseline',
    defaultMessage: 'ping',
    defaultTrace: 'ev_lav_portal_baseline_001',
  },
} as const;

export function CrmTestPanel() {
  const [searchParams] = useSearchParams();
  const isTestMode = searchParams.get('testmode') === '1';

  if (!isTestMode) return null;

  return <CrmTestPanelInner />;
}

function CrmTestPanelInner() {
  const { t } = useLanguage();
  const { sessionId, customerId } = useMalakChat();
  const [collapsed, setCollapsed] = useState(false);
  const [traceId, setTraceId] = useState('ev_lav_portal_test_001');
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastCardsQuery, setLastCardsQuery] = useState<{ query_id: string; sequence: number } | null>(null);
  const logIdRef = useRef(0);

  const addLog = useCallback((entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const newEntry: LogEntry = {
      ...entry,
      id: `log_${++logIdRef.current}`,
      timestamp: new Date().toISOString(),
    };
    setLogs(prev => [newEntry, ...prev].slice(0, 50));
  }, []);

  /**
   * Send message using REAL session identity (no bypass).
   * The gateway resolves channel from actual auth state.
   * CRM handles canonicalization for unknown channels server-side.
   */
  const handleSendMessage = useCallback(async (scenario: string, overrides?: { message?: string; trace?: string }) => {
    const text = overrides?.message || messageText || 'ping';
    const trace = overrides?.trace || traceId;
    
    setSending(true);

    addLog({
      scenario,
      trace_id: trace,
      direction: 'request',
      status: 'ok',
      payload: {
        type: 'message',
        message: text,
        client_trace_id: trace,
        session_id: sessionId,
        note: 'Channel resolved by gateway from real session identity',
      },
    });

    try {
      const visitorId = localStorage.getItem('malak_visitor_id') || getOrCreateGuestSessionId();
      const uiContext = buildUiContextV1({ pathname: window.location.pathname, tab: null, lang: 'ar' });

      const response: GatewayResponse = await sendChatMessage({
        text,
        message: text,
        visitor_id: visitorId,
        session_id: sessionId,
        customer_id: customerId || undefined,
        client_trace_id: trace,
        ui_context: uiContext,
        metadata: {
          scenario,
          // NO test_mode flag — Zero-Trust compliant
        },
      });

      // Check for cards_query in response
      const data = response.data as Record<string, unknown> | null;
      if (data?.cards_query) {
        const cq = data.cards_query as { query_id?: string; sequence?: number };
        if (cq.query_id && typeof cq.sequence === 'number') {
          setLastCardsQuery({ query_id: cq.query_id, sequence: cq.sequence });
        }
      }

      addLog({
        scenario,
        trace_id: trace,
        direction: 'response',
        status: response.ok ? 'ok' : 'error',
        latency_ms: response.latency_ms,
        payload: {
          ok: response.ok,
          error: response.error,
          reply: (data as any)?.reply?.substring(0, 100),
          search_mode: (data as any)?.ui_directives?.search_mode,
          cards_query: (data as any)?.cards_query,
          ap_version: (data as any)?.ap_version,
          upstream_status: (data as any)?.upstream_status,
        },
      });
    } catch (err) {
      addLog({
        scenario,
        trace_id: trace,
        direction: 'response',
        status: 'error',
        payload: { error: String(err) },
      });
    } finally {
      setSending(false);
    }
  }, [messageText, traceId, sessionId, customerId, addLog]);

  const handleSendACK = useCallback(async () => {
    if (!lastCardsQuery) return;

    const trace = traceId.replace('d10', 'd5').replace('baseline', 'd5');
    setSending(true);

    addLog({
      scenario: 'D5',
      trace_id: trace,
      direction: 'request',
      status: 'ok',
      payload: {
        type: 'ack',
        ack_name: 'cards_rendered',
        query_id: lastCardsQuery.query_id,
        sequence: lastCardsQuery.sequence,
      },
    });

    try {
      const visitorId = localStorage.getItem('malak_visitor_id') || getOrCreateGuestSessionId();
      const uiContext = buildUiContextV1({ pathname: window.location.pathname, tab: null, lang: 'ar' });

      const ackId = `cards_rendered:${lastCardsQuery.query_id}:${lastCardsQuery.sequence}`;
      const response = await sendChatAck({
        ack_name: 'cards_rendered',
        ack_ref: {
          query_id: lastCardsQuery.query_id,
          sequence: lastCardsQuery.sequence,
        },
        ack_id: ackId,
        ack_success: true,
        ack_metadata: {
          count: 5,
          program_ids: ['test_p1', 'test_p2'],
          reason: 'test_mode_d5',
        },
        visitor_id: visitorId,
        session_id: sessionId,
        customer_id: customerId || undefined,
        ui_context: uiContext,
        client_trace_id: trace,
      });

      addLog({
        scenario: 'D5',
        trace_id: trace,
        direction: 'response',
        status: response.ok ? 'ok' : 'error',
        latency_ms: response.latency_ms,
        payload: { ok: response.ok, error: response.error },
      });
    } catch (err) {
      addLog({
        scenario: 'D5',
        trace_id: trace,
        direction: 'response',
        status: 'error',
        payload: { error: String(err) },
      });
    } finally {
      setSending(false);
    }
  }, [lastCardsQuery, traceId, sessionId, customerId, addLog]);

  const runScenario = useCallback((key: keyof typeof SCENARIO_KEYS) => {
    const sc = SCENARIO_KEYS[key];
    const trace = 'defaultTrace' in sc ? sc.defaultTrace : traceId;
    const msg = 'defaultMessage' in sc ? sc.defaultMessage : messageText || 'ping';

    setTraceId(trace);
    if ('defaultMessage' in sc) setMessageText(msg);

    handleSendMessage(key, { message: msg, trace });
  }, [traceId, messageText, handleSendMessage]);

  const copyTraceIds = useCallback(() => {
    const traces = [...new Set(logs.map(l => l.trace_id))];
    navigator.clipboard.writeText(traces.join('\n'));
  }, [logs]);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed top-2 left-2 z-[9999] bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 shadow-lg hover:bg-amber-500 transition-colors"
      >
        <FlaskConical className="w-3.5 h-3.5" />
        {t('dev.crm_test.title')}
        <ChevronDown className="w-3 h-3" />
      </button>
    );
  }

  return (
    <div className="fixed top-2 left-2 z-[9999] w-[420px] max-h-[90vh] bg-gray-950 text-gray-100 border border-amber-600/50 rounded-xl shadow-2xl font-mono text-xs flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-amber-600/20 border-b border-amber-600/30">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-amber-300">{t('dev.crm_test.title')}</span>
          <span className="text-gray-500">{t('dev.crm_test.subtitle')}</span>
        </div>
        <button onClick={() => setCollapsed(true)} className="text-gray-400 hover:text-white">
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      {/* Controls */}
      <div className="p-3 space-y-2 border-b border-gray-800">
        {/* Trace ID */}
        <div className="flex items-center gap-2">
          <label className="text-gray-500 w-16 shrink-0">{t('dev.crm_test.trace_id')}</label>
          <Input
            value={traceId}
            onChange={e => setTraceId(e.target.value)}
            className="h-7 bg-gray-900 border-gray-700 text-amber-300 font-mono text-xs"
            placeholder="ev_lav_portal_xxx"
          />
        </div>

        {/* Message */}
        <div className="flex gap-2">
          <Textarea
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            className="h-14 bg-gray-900 border-gray-700 text-gray-100 font-mono text-xs resize-none"
            placeholder={t('dev.crm_test.message_placeholder')}
          />
          <Button
            onClick={() => handleSendMessage('MANUAL')}
            disabled={sending || !messageText.trim()}
            size="icon"
            className="h-14 w-10 bg-amber-600 hover:bg-amber-500 shrink-0"
            aria-label={t('dev.crm_test.send')}
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Quick Scenarios */}
      <div className="px-3 py-2 flex flex-wrap gap-1.5 border-b border-gray-800">
        {(Object.keys(SCENARIO_KEYS) as (keyof typeof SCENARIO_KEYS)[]).map(key => (
          <Button
            key={key}
            variant="outline"
            size="sm"
            onClick={() => runScenario(key)}
            disabled={sending}
            className="h-6 text-[10px] bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-amber-300"
          >
            {t(SCENARIO_KEYS[key].i18nKey)}
          </Button>
        ))}
        {lastCardsQuery && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSendACK}
            disabled={sending}
            className="h-6 text-[10px] bg-emerald-900/50 border-emerald-700 text-emerald-300 hover:bg-emerald-800"
          >
            ✅ {t('dev.crm_test.send_ack')} — {lastCardsQuery.query_id.slice(0, 12)}…
          </Button>
        )}
      </div>

      {/* Logs */}
      <ScrollArea className="flex-1 max-h-[40vh]">
        <div className="p-2 space-y-1.5">
          {logs.length === 0 && (
            <p className="text-gray-600 text-center py-4">{t('dev.crm_test.no_logs')}</p>
          )}
          {logs.map(log => (
            <div
              key={log.id}
              className={`p-2 rounded border text-[10px] ${
                log.status === 'ok'
                  ? 'border-gray-800 bg-gray-900/50'
                  : 'border-red-900 bg-red-950/30'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  {log.status === 'ok' ? (
                    <CheckCircle className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="w-3 h-3 text-red-500" />
                  )}
                  <span className="text-amber-400">{log.scenario}</span>
                  <span className="text-gray-600">{log.direction}</span>
                  {log.latency_ms !== undefined && (
                    <span className="text-gray-500">{log.latency_ms}ms</span>
                  )}
                </div>
                <span className="text-gray-600">{log.timestamp.split('T')[1]?.slice(0, 8)}</span>
              </div>
              <div className="text-gray-500">trace: <span className="text-amber-300/70">{log.trace_id}</span></div>
              <pre className="text-gray-400 mt-1 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(log.payload, null, 1)}
              </pre>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      {logs.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-800 flex items-center justify-between">
          <span className="text-gray-600">
            {logs.length} {t('dev.crm_test.entries')} · {new Set(logs.map(l => l.trace_id)).size} {t('dev.crm_test.traces')}
          </span>
          <div className="flex gap-2">
            <button
              onClick={copyTraceIds}
              className="text-gray-500 hover:text-amber-400 flex items-center gap-1"
            >
              <Copy className="w-3 h-3" /> {t('dev.crm_test.copy_traces')}
            </button>
            <button
              onClick={() => setLogs([])}
              className="text-gray-500 hover:text-red-400"
            >
              {t('dev.crm_test.clear')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
