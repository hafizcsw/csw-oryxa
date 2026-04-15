# E2E Runbook (Lav / Lovable)

## Goal
Validate end-to-end behavior for Portal doors with zero code edits during execution.

## Scenario 1 — Stream success
1. Open chat UI.
2. Send a normal user prompt.
3. Verify streaming response appears progressively.
4. Capture:
   - UI screenshot during stream
   - Browser network request/response
   - Console logs with trace id

## Scenario 2 — cards_query payload
1. Trigger a cards/programs request from chat.
2. Verify outbound payload contains only:
   - `params` (Hard16 + optional `keyword`)
   - `rank_filters` (Rank10 only, omitted if empty)
   - `filters_hash` (optional)
   - `limit` / `page` (paging)
3. Capture:
   - Request payload screenshot
   - Response payload with cards list

## Scenario 3 — render-safe ACK
1. Receive cards response.
2. Confirm ACK is sent only after cards render (no pre-render ACK).
3. Capture:
   - Timing/sequence logs (`query_id`, `sequence`)
   - UI screenshot of rendered cards
4. Verify ACK payload contains top-level `ack_id` in deterministic human format:
   - `cards_rendered:<query_id>:<sequence>`

## Scenario 4 — contract reject
1. Reproduce contract violation path (unknown/blocked key).
2. Verify UI shows contract-safe rejection state.
3. Capture:
   - UI message screenshot
   - Telemetry log (reason code only)

## Scenario 5 — fallback flow
1. Reproduce channel/contract reject.
2. Verify fallback action is shown (re-auth or continue guest).
3. Capture:
   - UI screenshot (EN + AR)
   - Result after fallback action

## Trace-id correlation
- Confirm every relevant request includes `x-client-trace-id`.
- Use the same trace id to correlate:
  - Browser network logs
  - Portal console/telemetry logs
  - CRM-side observability tools

## Artifacts checklist
- Screenshots
- Network HAR or request snapshots
- Console logs with redacted sensitive data
- Trace-id mapping table
