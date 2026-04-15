/**
 * ✅ EXEC ORDER: Workflow Tracing Module
 * Provides client_trace_id and client_action_id for end-to-end tracking
 */

// Session-level trace ID (persists for the entire workflow session)
let _clientTraceId: string | null = null;

/**
 * Get or create client_trace_id for the current workflow session
 * This ID persists until clearWorkflowSession() is called
 */
export function getClientTraceId(): string {
  if (!_clientTraceId) {
    _clientTraceId = crypto.randomUUID();
    console.log('[WF:TRACE] 🆕 Created new client_trace_id:', _clientTraceId);
  }
  return _clientTraceId;
}

/**
 * Generate a unique action ID for each discrete action
 */
export function createActionId(): string {
  return crypto.randomUUID();
}

/**
 * Clear the workflow session (call after successful submission or explicit reset)
 */
export function clearWorkflowSession(): void {
  console.log('[WF:TRACE] 🧹 Clearing workflow session, old trace:', _clientTraceId);
  _clientTraceId = null;
}

/**
 * Build trace headers for Edge Function calls
 */
export function buildTraceHeaders(): Record<string, string> {
  return {
    'x-client-trace-id': getClientTraceId(),
  };
}

/**
 * Build trace body fields for Edge Function payloads
 */
export function buildTraceBody(actionType: 'program_select' | 'service_select' | 'submit'): {
  client_trace_id: string;
  client_action_id: string;
  action_type: string;
} {
  return {
    client_trace_id: getClientTraceId(),
    client_action_id: createActionId(),
    action_type: actionType,
  };
}
