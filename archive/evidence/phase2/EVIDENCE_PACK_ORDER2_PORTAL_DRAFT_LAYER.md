# Evidence Pack — Order 2: Portal Draft Layer

**Status:** `Order 2 = code-ready only / runtime proof missing`
**Scope:** Portal Draft Layer for Study File uploads. NO CRM contact.
**Date:** 2026-04-24

---

## 1. Code evidence

### Migration
- Bucket created: **`portal-drafts`** (private, `public = false`).
- Table created: **`public.portal_document_drafts`** with columns matching the Order 2 spec
  (id, student_user_id, document_type, original_file_name, mime_type, file_size, file_sha256,
  draft_storage_bucket, draft_storage_path, status, extraction_status, identity_match_status,
  evaluation_status, source_surface, trace_id, created_at, updated_at, expires_at,
  confirmed_at, discarded_at, shared_to_crm_at).
- CHECK constraint on `status` allows the full reserved set
  (`selected_local`, `portal_draft_uploaded`, `awaiting_extraction`,
   `discarded_by_student`, `expired_draft`, `shared_to_crm`).
  Phase 2 only writes: `selected_local` (transient) → `portal_draft_uploaded` →
  `discarded_by_student`. The other values are reserved for later phases.
- Trigger `portal_document_drafts_touch` keeps `updated_at` fresh.
- Indexes on `(student_user_id, created_at desc)` and a partial active-drafts index.

### RLS — table `public.portal_document_drafts`
Verified via `pg_policy`:

| polname                   | command |
|---------------------------|---------|
| drafts_owner_select       | SELECT  |
| drafts_owner_insert       | INSERT  |
| drafts_owner_update       | UPDATE  |
| drafts_owner_delete       | DELETE  |

All four policies require `auth.uid() = student_user_id`.

### RLS — `storage.objects` for bucket `portal-drafts`
Verified via `pg_policy`:

| polname                       | command |
|-------------------------------|---------|
| portal_drafts_owner_select    | SELECT  |
| portal_drafts_owner_insert    | INSERT  |
| portal_drafts_owner_update    | UPDATE  |
| portal_drafts_owner_delete    | DELETE  |

All four require:
```
bucket_id = 'portal-drafts'
AND (storage.foldername(name))[1] = 'study-file'
AND (storage.foldername(name))[2] = auth.uid()::text
```
=> path layout enforced as `study-file/{auth.uid}/{draft_id}/{filename}`.
No public read. No service-role usage on the client.

### Files added
- `src/features/documents/portalDrafts.ts` — `uploadPortalDraft`,
  `listActivePortalDrafts`, `deletePortalDraft`. NO calls to
  `prepareUpload` / `confirmUpload` / `markFilesSaved` / `crm_storage` /
  `student-docs` / `customer_files`.
- `src/hooks/usePortalDrafts.ts` — local queue + drafts state, refresh on mount.
- `src/components/portal/study-file/PortalDraftsList.tsx` — minimal UI:
  banner *"Draft uploaded — not shared with CSW"*, file name, MIME, size,
  status, **Delete Draft** button.

### Files modified
- `src/components/portal/tabs/StudyFileTab.tsx`
  - Imports added: `usePortalDrafts`, `PortalDraftsList`.
  - Hook `usePortalDrafts({ studentUserId: profile?.user_id ?? null })`.
  - `handleFilesSelected` now calls `drafts.enqueueFiles(filesToUpload)`
    instead of `registry.enqueueFiles(filesToUpload, 'upload_hub')`.
  - `<PortalDraftsList />` rendered immediately under `<CentralUploadHub />`.

### Negative-proof grep (no CRM mutation in the new path)
The new portal-draft path imports only `@/integrations/supabase/client` and
calls only:
- `supabase.from('portal_document_drafts')`
- `supabase.storage.from('portal-drafts')`

It does NOT import or call:
- `prepareUpload` / `confirmUpload` / `markFilesSaved` / `clear_pending_files`
- `crm_storage` / `student-portal-api` / `student-docs` / `customer_files`
- `uploadAndRegisterFile`

### Type-check
`bunx tsc --noEmit -p tsconfig.app.json` → **0 errors**.

---

## 2. Runtime evidence — REQUIRED

The user must perform the following in the live preview while signed in as a
student. Each test must be captured with HAR/network logs and a SQL snapshot.

### Test 2A — Draft upload
1. Sign in as a student.
2. Go to `/account?tab=study-file`.
3. Drop a file into the Central Upload Hub.

**Expected:**
- A row exists in `portal_document_drafts` with
  `status = 'portal_draft_uploaded'`, `student_user_id = auth.uid()`,
  `draft_storage_bucket = 'portal-drafts'`,
  `draft_storage_path = 'study-file/{uid}/{draft_id}/{filename}'`.
- An object exists at that path in the `portal-drafts` bucket.
- **No** row appears in `customer_files`.
- **No** object appears under `student-docs`.
- UI shows the draft with the banner *"Draft uploaded — not shared with CSW"*.

### Test 2B — Refresh
1. Reload the page.

**Expected:**
- Draft is still visible in the list (loaded via `listActivePortalDrafts`).
- No CRM mutation, no `clear_pending_files`, no auto-save.

### Test 2C — Delete Draft
1. Click the trash icon on a draft.

**Expected:**
- Row updated: `status = 'discarded_by_student'`, `discarded_at` set.
- Storage object removed (or made inaccessible by the RLS scope).
- No CRM mutation.

### Required proof format
For each test capture:
- HTTP/network log (filter: `supabase.co`).
- SQL snapshot:
  ```sql
  select id, status, draft_storage_path, created_at, discarded_at
  from portal_document_drafts
  where student_user_id = auth.uid()
  order by created_at desc;
  ```
- Storage path proof (Supabase Storage browser screenshot or
  `select name from storage.objects where bucket_id='portal-drafts'`).
- CRM negative proof:
  ```sql
  select count(*) from customer_files where created_at > '<test_start>';
  -- expected 0 for this user
  ```
- `trace_id` of each upload (visible in the inserted row).
- Timestamp.

---

## 3. Final status

`Order 2 = code-ready only / runtime proof missing`

Awaiting the user's runtime capture (Tests 2A / 2B / 2C) to upgrade to
`Order 2 = runtime-proven`.
