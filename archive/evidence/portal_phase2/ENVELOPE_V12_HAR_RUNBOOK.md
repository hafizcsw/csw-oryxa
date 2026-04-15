# Envelope Builder v1.2 – Manual HAR Runbook

## Proxy mode switches
- Set `CRM_ENVELOPE_V12_MODE=unwrap` (default shim) to flatten `payload` and drop `envelope_version` / `envelope_type` before CRM.
- Set `CRM_ENVELOPE_V12_MODE=passthrough` to forward Envelope v1.2 untouched.
- Validate both `portal-chat-proxy` and `portal-chat-proxy-stream` logs show the same `envelope_mode` for parity.

## HAR capture checklist
1. Open browser DevTools → **Network**.
2. Keep **Preserve log** enabled.
3. Send a normal message (non-stream).
4. Send another chat_message with `?forceStream=1` in URL (forceStream applies to chat_message only).
5. Trigger cards rendering path (CRM response with `cards_query.query_id` + `cards_query.sequence`).
6. Export HAR and annotate `trace_id` values.
7. Confirm in every sample: header trace (`x-client-trace-id`) matches body `trace_id`.
8. Confirm edge logs show `envelope_mode=unwrap` or `envelope_mode=passthrough` and contain no secrets.

## Expected payload excerpts

### chat_message
```json
{
  "envelope_version": "1.2",
  "envelope_type": "chat_message",
  "trace_id": "trace_xxx",
  "client_request_id": "req_xxx",
  "session_id": "session_xxx",
  "channel": "web_chat",
  "ui_locale": "ar",
  "output_locale": "ar",
  "payload": {
    "type": "message",
    "message": "..."
  }
}
```

### render_receipt (ACK-after-render)
```json
{
  "envelope_version": "1.2",
  "envelope_type": "render_receipt",
  "trace_id": "trace_xxx",
  "client_request_id": "req_xxx",
  "session_id": "session_xxx",
  "payload": {
    "type": "ack",
    "ack_name": "cards_rendered",
    "ack_ref": {
      "query_id": "cq_123",
      "sequence": 3
    },
    "ack_meta": {
      "ack_id": "cards_rendered:cq_123:3",
      "count": 12,
      "rendered_at": "2026-01-31T10:22:11.120Z",
      "entry_fn": "portal-chat-ui"
    }
  }
}
```

### control_patch (CAS + patch)
```json
{
  "envelope_version": "1.2",
  "envelope_type": "control_patch",
  "trace_id": "trace_xxx",
  "client_request_id": "req_xxx",
  "session_id": "session_xxx",
  "expected_state_rev": 42,
  "filters_patch": [
    { "op": "replace", "path": "/filters/country_code", "value": "de" },
    { "op": "remove", "path": "/filters/tuition_usd_max" }
  ],
  "payload": {
    "type": "event"
  }
}
```

## QA evidence pointers
- Non-stream evidence: request URL contains `/portal-chat-proxy`.
- Force-stream evidence: request URL contains `/portal-chat-proxy-stream` only for `chat_message` while `forceStream=1` is in page URL.
- Render receipt evidence: request payload includes `ack_ref.query_id` + `ack_ref.sequence` and `ack_meta`.


## Ack ID convention
- Canonical `ack_id` format: `cards_rendered:<query_id>:<sequence>`.
- Ensure dedupe and payload use the exact same value.
