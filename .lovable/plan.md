
# Plan: Hard "Save or Discard" semantics for uploaded documents

## Principle (from your message)
- Default = **DISCARD**. Anything uploaded but not explicitly saved must NOT survive page leave/refresh.
- On leaving the page, show a prompt: **"Save these documents?"** → Yes saves, No (or close) discards everything (Storage + Phase A rows).

## What's broken right now
1. `useUnsavedDocumentsGuard` only deletes Storage files — it does NOT purge the 4 Phase A tables. Result: 11 ghost rows still showing in the "Live Profile / Evaluation" UI even after Storage cleanup.
2. The browser `beforeunload` dialog fires, but there is no in-app modal when the user navigates between internal tabs/routes — so internal navigation silently leaves orphans.
3. `useDocumentAnalysis` regression: `Should have a queue` runtime error from the previous `authReady` patch (rules-of-hooks violation).

## Changes

### 1. New SQL function — atomic Phase A purge per user + doc-id set
File: `supabase/migrations/<ts>_phase_a_purge_rpc.sql`
- `public.phase_a_purge_for_documents(_doc_ids uuid[])` SECURITY DEFINER
- Deletes from `credential_mapping_decision_log`, `student_credential_normalized`, `student_award_raw`, `student_evaluation_snapshots` where `student_user_id = auth.uid()` AND `source_document_id = ANY(_doc_ids)` (snapshot recomputed by edge fn after).
- Returns counts per table.
- GRANT EXECUTE to `authenticated`.

### 2. Edge function `phase-a-normalize` — already supports recompute
After purge, client invokes `phase-a-normalize` with the remaining (saved) docs only → snapshot rewrites with `recompute_reason='document_removed'`. No edge-fn code change required (verified above).

### 3. `src/hooks/useUnsavedDocumentsGuard.ts` — extend cleanup
- On orphan-cleanup (mount) AND on `discardAll()`:
  1. Call `deleteFile(id)` for each pending id (Storage / Door 1) — already done.
  2. Call `supabase.rpc('phase_a_purge_for_documents', { _doc_ids: ids })`.
  3. Invoke `phase-a-normalize` with the remaining saved doc list to refresh snapshot.
- Add new exported `discardAll()` API for explicit "No, discard" button.
- Keep `confirmAllSaved()` for "Yes, save".

### 4. New component `UnsavedDocsLeaveDialog.tsx`
- Uses React Router `useBlocker` to intercept internal navigation when `pendingCount > 0`.
- Shadcn `<AlertDialog>` with three actions:
  - **Save & continue** → `confirmAllSaved()` then proceed.
  - **Discard & continue** → `discardAll()` then proceed.
  - **Stay** → cancel navigation.
- All strings via `t()` (12-locale). No hardcoded UI text.
- Translation keys added under `portal.unsavedDocs.*` in `public/locales/{en,ar}/common.json` (other 10 locales fall back per existing pattern).

### 5. `StudyFileTab.tsx` wiring
- Render `<UnsavedDocsLeaveDialog>` when `guard.pendingCount > 0`.
- Pass `guard.discardAll` to existing `SaveDocumentsBar` as a new optional secondary action ("Discard"), so the bar matches the modal.

### 6. Fix `useDocumentAnalysis.ts` regression
- Remove the conditional `if (!authReady) return` early-return path that was added inside `refetch` if it bypasses queue init. Instead:
  - Keep `authReady` state but always run the effect; gate only the network call, never hook ordering.
  - Verify no `useState/useEffect` is called conditionally.
- Re-test: refresh `/account?tab=study-file` → no `Should have a queue` error; saved cards persist.

## Out of scope (explicitly NOT touched)
- Phase A engine logic (still PARTIAL: non-atomic writes + engine duplication remain).
- Door 1 storage architecture.
- No new tables.

## Acceptance / runtime evidence required after build
1. Upload a doc → see card. Refresh → card **disappears** + Storage + Phase A rows = 0 (verified via `read_query`).
2. Upload a doc → click **Save** → refresh → card **persists** + Phase A rows present.
3. Upload a doc → navigate to another tab → modal appears with Save / Discard / Stay.
4. No `Should have a queue` runtime error in console after refresh.

## Status labels I will use afterwards
- This change = **scoped to lifecycle/UX**. Does not change Phase A persistence-path classification (still **Persistence path = CLOSED, Phase A overall = PARTIAL**).
