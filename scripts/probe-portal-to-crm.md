# Probe assistant-process → CRM (Zero Trust channel resolution)

> No secrets are committed here. Export environment variables locally before running.

## 1) Environment template

```bash
export SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_ANON_KEY="<anon-key>"
export ASSISTANT_PROCESS_URL="$SUPABASE_URL/functions/v1/assistant-process"
# Optional: a real student portal token to test authenticated flow
export STUDENT_PORTAL_TOKEN="<jwt-if-available>"
```

## 2) Guest flow (no token)

```bash
curl -sS "$ASSISTANT_PROCESS_URL" \
  -H "content-type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  --data '{
    "visitor_id":"probe_guest_001",
    "session_id":"probe_guest_session_001",
    "text":"guest probe",
    "session_type":"authenticated",
    "channel":"web_portal",
    "client_trace_id":"trace-guest-001",
    "client_build":"portal-probe"
  }'
```

Expected in edge logs / CRM payload:
- `channel=web_chat`
- `stamps.channel=web_chat`
- `stamps.entry_fn=portal-chat-ui`
- Header `x-orxya-ingress=portal`
- Header `x-client-trace-id=trace-guest-001`

## 3) Auth flow (valid token)

```bash
curl -sS "$ASSISTANT_PROCESS_URL" \
  -H "content-type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "authorization: Bearer $STUDENT_PORTAL_TOKEN" \
  --data '{
    "visitor_id":"probe_auth_001",
    "session_id":"probe_auth_session_001",
    "text":"auth probe",
    "session_type":"guest",
    "channel":"web_chat",
    "client_trace_id":"trace-auth-001",
    "client_build":"portal-probe"
  }'
```

Expected in edge logs / CRM payload:
- `channel=web_portal`
- `stamps.channel=web_portal`
- ACK payload (if sent) keeps `channel === stamps.channel`
