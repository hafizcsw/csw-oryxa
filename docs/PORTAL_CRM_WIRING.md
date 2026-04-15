# PORTAL ↔ CRM Wiring Snapshot

## Portal ingress functions
- `supabase/functions/assistant-process/index.ts`
- `supabase/functions/assistant-process/logic.ts`
- `supabase/functions/assistant-process-stream/index.ts`
- `supabase/functions/student-portal-api/index.ts`
- `supabase/functions/search-programs/index.ts`

## Referenced CRM endpoints / RPC names (names only)
- `chat`
- `cards_query`
- `search_programs`

## Required headers (names only)
- `authorization`
- `apikey`
- `content-type`
- `x-client-info`
- `x-request-id`
- `x-client-trace-id`

## Trace propagation
- Client trace id is generated on portal side and attached to requests as `x-client-trace-id`.
- Edge functions forward the same header downstream when present.

## Evidence notes
- This snapshot is intentionally names-only and excludes token values, URLs, and secrets.
