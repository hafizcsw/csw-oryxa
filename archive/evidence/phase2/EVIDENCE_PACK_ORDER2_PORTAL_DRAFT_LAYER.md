# Evidence Pack — Order 2: Portal Draft Layer

**Status:** `Order 2 = code-ready / runtime proof missing`
**Scope:** Portal Draft Layer for Study File uploads. NO CRM contact.
**Date:** 2026-04-24 (revised after blockers fix)

---

## 0. Blockers raised by reviewer — RESOLVED

| Blocker | Status | Fix |
|---|---|---|
| Passport replacement still called `handleDeleteDoc` (CRM delete) before draft upload | **FIXED** | `handleFilesSelected` now contains zero CRM calls. The dedup/replace branch and the `window.confirm("…سيتم حذف الجواز القديم")` prompt were removed entirely. New passports land as draft "replacement candidates"; actual CRM deletion is deferred to Phase 6 (Confirm & Share). |
| i18n keys for `studyFile.drafts.*` not present in locale files | **FIXED** | Added `studyFile.drafts` block to `src/locales/en/common.json` (lines 1545–1552) and `src/locales/ar/common.json` (lines 1547–1554) with: `headline`, `subline`, `statusUploading`, `statusFailed`, `statusDraft`, `delete`. UI no longer relies on English fallback. |
| Migration file proof not provided | **PROVIDED** | See section 1.1 below. |

### Diff summary — `src/components/portal/tabs/StudyFileTab.tsx`

`handleFilesSelected` was reduced from 60 lines (including a CRM-delete branch
guarded by `window.confirm`) to 19 lines. The new body:

```
const filesToUpload = files;
for (const file of filesToUpload) {
  const key = uniqueFileKey(file);
  pendingFilesRef.current.set(key, { file, fileKey: key });
  const existing = fileNameToKeysRef.current.get(file.name) || [];
  existing.push(key);
  fileNameToKeysRef.current.set(file.name, existing);
}
drafts.enqueueFiles(filesToUpload);
```

Dependency array now `[drafts]` only — no `handleDeleteDoc`, no `documents`,
no `analysisHook.*`, no `refetchDocs`. The function cannot mutate CRM.

`bunx tsc --noEmit -p tsconfig.app.json` → **0 errors** after fix.

---

## 1. Code evidence

### 1.1 Migration file proof

**File:** `supabase/migrations/20260424165833_3e58da8c-297f-4e42-a133-2c43c3887005.sql`

Verified contents (grep):

```
7:  insert into storage.buckets values ('portal-drafts', 'portal-drafts', false)
11: create table if not exists public.portal_document_drafts (...)
19:    draft_storage_bucket text not null default 'portal-drafts',
33:    constraint portal_document_drafts_status_check check (...)
45: create index portal_document_drafts_student_idx on public.portal_document_drafts (student_user_id, created_at desc);
48: create index portal_document_drafts_active_idx on public.portal_document_drafts (student_user_id) where ...
53: create or replace function public.tg_portal_document_drafts_touch() ...
65: create trigger portal_document_drafts_touch before update on public.portal_document_drafts ...
71: alter table public.portal_document_drafts enable row level security;
75: policy "drafts_owner_select" on public.portal_document_drafts (auth.uid() = student_user_id)
82: policy "drafts_owner_insert" on public.portal_document_drafts (auth.uid() = student_user_id)
89: policy "drafts_owner_update" on public.portal_document_drafts (auth.uid() = student_user_id)
97: policy "drafts_owner_delete" on public.portal_document_drafts (auth.uid() = student_user_id)
102: -- Storage RLS for portal-drafts bucket
112,123,134,145: bucket_id = 'portal-drafts' AND foldername[1] = 'study-file' AND foldername[2] = auth.uid()::text
```

- Bucket: **`portal-drafts`** (private, `public = false`).
- Table: **`public.portal_document_drafts`** with full Order 2 column set.
- CHECK constraint on `status` allows the reserved set
  (`selected_local`, `portal_draft_uploaded`, `awaiting_extraction`,
  `discarded_by_student`, `expired_draft`, `shared_to_crm`).
  Phase 2 only writes: `selected_local` (transient) → `portal_draft_uploaded`
  → `discarded_by_student`. The remaining values are reserved.
- Trigger `portal_document_drafts_touch` keeps `updated_at` fresh.
- Indexes on `(student_user_id, created_at desc)` and a partial active-drafts index.

### 1.2 RLS — table `public.portal_document_drafts`

| polname                   | command | qual                                |
|---------------------------|---------|-------------------------------------|
| drafts_owner_select       | SELECT  | auth.uid() = student_user_id        |
| drafts_owner_insert       | INSERT  | auth.uid() = student_user_id        |
| drafts_owner_update       | UPDATE  | auth.uid() = student_user_id        |
| drafts_owner_delete       | DELETE  | auth.uid() = student_user_id        |

### 1.3 RLS — `storage.objects` for bucket `portal-drafts`

| polname                       | command |
|-------------------------------|---------|
| portal_drafts_owner_select    | SELECT  |
| portal_drafts_owner_insert    | INSERT  |
| portal_drafts_owner_update    | UPDATE  |
| portal_drafts_owner_delete    | DELETE  |

All four enforce:
```
bucket_id = 'portal-drafts'
AND (storage.foldername(name))[1] = 'study-file'
AND (storage.foldername(name))[2] = auth.uid()::text
```
=> path layout enforced as `study-file/{auth.uid}/{draft_id}/{filename}`.
No public read. No service-role usage on the client.

### 1.4 Files added
- `src/features/documents/portalDrafts.ts` — `uploadPortalDraft`,
  `listActivePortalDrafts`, `deletePortalDraft`. NO calls to
  `prepareUpload` / `confirmUpload` / `markFilesSaved` / `crm_storage` /
  `student-docs` / `customer_files`.
- `src/hooks/usePortalDrafts.ts` — local queue + drafts state, refresh on mount.
- `src/components/portal/study-file/PortalDraftsList.tsx` — minimal UI:
  banner *"Draft uploaded — not shared with CSW"*, file name, MIME, size,
  status, **Delete Draft** button. Uses `studyFile.drafts.*` i18n keys.

### 1.5 Files modified
- `src/components/portal/tabs/StudyFileTab.tsx`
  - Imports added: `usePortalDrafts`, `PortalDraftsList`.
  - Hook `usePortalDrafts({ studentUserId: profile?.user_id ?? null })`.
  - `handleFilesSelected` rewritten — **no CRM mutation, no passport
    replacement delete, no `handleDeleteDoc` call**. Routes all selected
    files to `drafts.enqueueFiles(...)`.
  - `<PortalDraftsList />` rendered immediately under `<CentralUploadHub />`.
- `src/locales/en/common.json` — added `studyFile.drafts` block.
- `src/locales/ar/common.json` — added `studyFile.drafts` block.

### 1.6 Negative-proof grep
The new portal-draft path imports only `@/integrations/supabase/client` and
calls only:
- `supabase.from('portal_document_drafts')`
- `supabase.storage.from('portal-drafts')`

It does NOT import or call:
- `prepareUpload` / `confirmUpload` / `markFilesSaved` / `clear_pending_files`
- `crm_storage` / `student-portal-api` / `student-docs` / `customer_files`
- `uploadAndRegisterFile` / `deleteFile`

`handleFilesSelected` after fix does NOT reference `handleDeleteDoc`,
`existing.crmFileId`, `customer_files`, `student-docs`, `crm_storage`.

### 1.7 Type-check
`bunx tsc --noEmit -p tsconfig.app.json` → **0 errors**.

---

## 2. Runtime evidence — REQUIRED (now unblocked)

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
- Storage path proof.
- CRM negative proof:
  ```sql
  select count(*) from customer_files where created_at > '<test_start>';
  -- expected 0 for this user
  ```
- `trace_id` of each upload (visible in the inserted row).
- Timestamp.

---

## 3. Final status

`Order 2 = code-ready / runtime proof missing`

All three reviewer blockers (CRM-delete in passport replacement, missing i18n
keys, missing migration proof) are now resolved. Awaiting the user's runtime
capture (Tests 2A / 2B / 2C) to upgrade to `Order 2 = runtime-proven`.
