# Document Pipeline — Truth Table (Phase A)

Last updated as part of the Phase A live-path stabilization.
This file is the authoritative answer to: **what is the live document
path right now?** Anything not listed as `live` here is non-authoritative
until proven otherwise by runtime evidence.

## The single live path

```
client (file)
  → student-portal-api  (action: identity_upload_sign_url)
      → CRM customer_files row (truth of the file)
      → CRM signed GET URL
      → mistral-document-pipeline (this Supabase project)
          → Mistral OCR        (perception only)
          → Mistral extract    (perception only — no final mapping)
          → document_lane_facts          (recognized case)
          → document_review_queue        (review / unrecognized / error)
          ← inline facts in HTTP response
```

Forensic key for every request: `trace_id`.
- Header in / header out: `x-document-trace-id`.
- Persisted in: `document_lane_facts.trace_id`,
  `document_review_queue.trace_id`,
  `engine_metadata.trace_id` (lane_facts row).
- Emitted in every edge-function log line as a JSON field `trace_id`.

## Status table

| Component | Status | Notes |
|---|---|---|
| `student-portal-api` (case `identity_upload_sign_url`) | **live** | The only entry point that calls the pipeline today. |
| `mistral-document-pipeline` (edge fn) | **live** | OCR → extract → write `document_lane_facts` / `document_review_queue`. Logs every stage with `trace_id`. |
| `document_lane_facts` (table) | **live** | Receives recognized cases. Has `trace_id` column. |
| `document_review_queue` (table) | **live** | Receives review / unrecognized / pipeline_error cases. Has `trace_id` column. |
| `useDocumentLaneFacts` (hook) | **live** | Reads `document_lane_facts` for the live UI. |
| `LaneFactsCard` (component) | **live** | Renders live lane facts. Uses lane types from the deprecated lanes module — types only, not execution. |
| `src/features/documents/lanes/index.ts` `dispatchLane` | **deprecated** | Client-side Door 2 dispatcher. No live caller. |
| `src/features/documents/lanes/passport-lane.ts` `runPassportLane` | **deprecated** | No live caller. |
| `src/features/documents/lanes/simple-certificate-lane.ts` `runSimpleCertificateLane` | **deprecated** | No live caller. |
| `src/features/documents/lanes/persistence.ts` `persistLaneFacts` | **deprecated** | Replaced by server-side write inside `mistral-document-pipeline`. |
| `src/features/documents/door3/dispatcher.ts` `enqueueDoor3Job` | **deprecated** | Targeted `door3-enqueue` + `document_jobs`. No live caller. Emits `console.warn` if invoked. |
| `useDoor3Jobs` (hook) | **deprecated** | Reads `document_jobs`. Only consumed by `Door3TranscriptPanel` (legacy panel, not on the live document path). Emits `console.warn` on subscribe. |
| `door3-enqueue` (edge fn) | **deprecated** | No live caller from the website. |
| `door3-job-dispatcher` (edge fn) | **deprecated** | No live caller from the website. |
| `document_jobs` (table) | **deprecated-used** | Table still exists in DB; only read by the deprecated `useDoor3Jobs`. Not written to by the live path. |
| Phase A new tables (student_profile, student_application, student_document, document_extraction_raw / canonical, document_evidence_flag, student_award_raw, student_credential_normalized, credential_mapping_rule / decision_log, country_education_profile, credential_name_patterns, language_test_cefr_mapping) | **missing** | Not yet created. Out of scope for block A. Will be created in block B against an Evidence Pack. |

## Rules

1. **Mistral = perception only.** No final stage mapping inside the
   pipeline. Normalization belongs to the rule engine (block B+).
2. **No fabricated facts.** Every persisted field carries
   `source: 'mistral_ocr'` and a confidence.
3. **Machine-readable reasons only in backend.** When a row is in
   review, prefer `reason_code` + `params_json` over visible text.
   (Visible/i18n text is built later, not in backend logic tables.)
4. **trace_id is mandatory** on every new row written by the live path.
   A row without a trace_id is, by definition, not from the current
   live path.

## Out of scope for block A

- Matching engine
- Measurement snapshots
- Program graph
- Improvement engine
- Any new tables

These are tracked separately and will only be opened against an
explicit Evidence Pack.
