# Order 3 — Extraction from Portal Drafts

**Status:** `Order 3 = code-ready / runtime not proven`

## Scope (enforced)

- ✅ Extraction runs on files in the `portal-drafts` bucket only.
- ✅ Result is keyed by `portal_document_drafts.id` (NOT a CRM file id).
- ✅ Persisted to new table `public.portal_document_draft_extractions`.
- ✅ Visible draft states: `extraction_pending` → `extraction_running` → `extraction_completed` | `extraction_failed`.
- 🚫 No write to `customer_files`, `student-docs`, `document_lane_facts`, `document_review_queue`, or any CRM table.
- 🚫 No identity match, no evaluation center, no Confirm & Share, no APUS/ISUS/CCUS, no translation generation.

## Surfaces touched

### Migration
`supabase/migrations/<timestamp>_*.sql`
- Added columns to `portal_document_drafts`:
  `extraction_started_at`, `extraction_completed_at`, `extraction_trace_id`, `extraction_error`.
- New table `portal_document_draft_extractions`:
  draft_id (UNIQUE FK → portal_document_drafts ON DELETE CASCADE),
  student_user_id, family, family_confidence, is_recognized,
  rejection_reason, truth_state, lane_confidence, facts (jsonb),
  ocr_pages, ocr_chars, engine_metadata, trace_id, timestamps.
- RLS enabled. Policy: `auth.uid() = student_user_id` for SELECT.
  Writes only via service role (edge function).

### Edge function
`supabase/functions/portal-draft-extract/index.ts`
- Auth-gated (Bearer token of caller).
- Loads draft, asserts `student_user_id == auth.uid`, asserts
  `draft_storage_bucket = 'portal-drafts'`.
- Refuses if `discarded_at` or `shared_to_crm_at` set.
- Signs URL from `portal-drafts` bucket via service role.
- Calls Mistral OCR + LLM tool-call extraction (same engine as
  mistral-document-pipeline, but **no lane writes**).
- Upserts into `portal_document_draft_extractions` keyed by `draft_id`.
- Updates `portal_document_drafts.extraction_status` and timestamps.

### Hook / UI
- `src/hooks/usePortalDrafts.ts`:
  Fires `supabase.functions.invoke('portal-draft-extract', { draft_id })`
  immediately after a successful upload (fire-and-forget; the persisted
  status on the draft row is the source of truth).
  Adds a 4s poll loop while any draft is `extraction_pending` or
  `extraction_running`.
- `src/components/portal/study-file/PortalDraftsList.tsx`:
  Added per-draft extraction badge with i18n keys.
- i18n keys added to `src/locales/{en,ar}/common.json`:
  `portal.studyFile.drafts.extractionPending`,
  `extractionRunning`, `extractionCompleted`, `extractionFailed`.

## Negative proofs (code-level)

```
$ rg -n "customer_files|student-docs|document_lane_facts|document_review_queue|crmStorage|prepareUpload|confirmUpload" \
    supabase/functions/portal-draft-extract/ \
    src/hooks/usePortalDrafts.ts \
    src/features/documents/portalDrafts.ts
(no matches)
```

The extraction code path can only read/write within:
- bucket: `portal-drafts`
- tables: `portal_document_drafts`, `portal_document_draft_extractions`

## Runtime tests (REQUIRED to promote to runtime-proven)

### Test 3A — Extraction kicks off after upload
1. Upload a passport PDF in Study File.
2. Expected:
   - draft row appears with `extraction_status = extraction_pending`
     (briefly), then `extraction_running`.
   - within ~30s, `extraction_completed` (or `extraction_failed` with
     a recorded `extraction_error`).
   - one row in `portal_document_draft_extractions` with the same
     `draft_id`.
   - **zero** writes to `customer_files`, `student-docs`,
     `document_lane_facts`, `document_review_queue`.

### Test 3B — Ownership gate
1. Authenticated user A invokes `portal-draft-extract` with a `draft_id`
   that belongs to user B.
2. Expected: HTTP 403 `{ error: "forbidden" }`. No DB mutation.

### Test 3C — Discarded draft rejection
1. Upload a draft, then delete it (discarded_by_student).
2. Invoke extraction for that `draft_id`.
3. Expected: HTTP 409 `{ error: "draft_inactive" }`. No DB mutation.

### Test 3D — Storage isolation
1. Inspect `extraction_trace_id` value on a successfully-extracted draft.
2. Search edge function logs for that trace_id.
3. Expected: `signed_url_resolved`, `ocr_completed`,
   `extraction_done`, `extraction_persisted`.
   No log line referencing CRM buckets/tables.

## Final status

- Repo: PASS
- Type-check: PASS (`tsc --noEmit` clean)
- Migration: applied
- Edge function: auto-deployed
- Runtime proof: **PENDING** — awaiting Tests 3A–3D from operator.
