import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCrmHeaders, createAndStoreCrmTraceId, getCrmTraceId } from '../crmHeaders';

describe('crmHeaders trace-id helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('stores trace id in portal and legacy keys', () => {
    const traceId = createAndStoreCrmTraceId();
    expect(localStorage.getItem('portal_client_trace_id')).toBe(traceId);
    expect(localStorage.getItem('chat_last_trace_id')).toBe(traceId);
  });

  it('uses provided trace id and mirrors both keys', () => {
    const traceId = 'trace-123';
    const headers = buildCrmHeaders({ traceId }) as Record<string, string>;

    expect(headers['x-client-trace-id']).toBe(traceId);
    expect(getCrmTraceId()).toBe(traceId);
    expect(localStorage.getItem('portal_client_trace_id')).toBe(traceId);
    expect(localStorage.getItem('chat_last_trace_id')).toBe(traceId);
  });
});
