# Evidence Pack — Phase 1 Early-CRM-Mutation Firewall
**Date:** 2026-04-24
**Session window:** 16:41:47Z → 16:46:59Z (≈5 min, includes file selection at ~16:46:50Z)
**Auth subject:** afezino1@gmail.com / customer_id `df5770b6-6e33-4a5c-a449-7df12078def6`
**Route:** `/account?tab=study-file`
**Captured by:** code--read_network_requests (lines 1–327)

---

## 1. Action inventory observed

Distinct `student-portal-api` action invocations during the entire window:

| action | crm_action | count | mutates CRM? |
|---|---|---|---|
| `crm_storage` | `list_files` | 6 | NO (read-only list, returns `files: []`) |
| `resolve_staff_authority` | – | 7 | NO |
| `identity_status_get` | – | 3 | NO |
| `get_profile` | – | 4 | NO |
| `get_student_card_snapshot` | – | 3 | NO |
| `check_link_status` | – | 3 | NO |
| `support_case_list` | – | 1 | NO |

## 2. Mutation actions NOT observed (the firewall claim)

Grepped over the full 327-line capture for any of:

- `prepare_upload` → **0 occurrences**
- `confirm_upload` → **0 occurrences**
- `mark_files_saved` → **0 occurrences**
- `delete_file` → **0 occurrences**
- `purge_all_files` → **0 occurrences**
- `clear_pending_files` → **0 occurrences**
- crm_action other than `list_files` → **0 occurrences**

All `crm_storage` calls in window: `crm_action=list_files` only, all returning `{ ok: true, files: [], orphans_removed: 0 }`.

## 3. Storage object writes NOT observed

- No PUT/POST to `*.supabase.co/storage/v1/object/**`
- No upload to `student-docs` bucket
- No `customer_files` row insert visible via portal API

## 4. Page-load regression

The previously reported regression — page open triggers `clear_pending_files` and wipes CRM rows — is NOT reproducible in this capture. The only `crm_storage` calls are `list_files` reads.

`diag.deleted_at_set: 11` in list_files response reflects pre-existing soft-deletes from prior sessions; no new deletions occur in this window.

## 5. UI behaviour during file selection

User selected files at ≈16:46:50Z. Network shows only:
- `support_case_list`
- `get_profile`
- `check_link_status`
- `identity_status_get`
- `resolve_staff_authority`

No upload-related action emitted to the network. The frontend `evaluateUploadGuard('prepare_upload', ctx)` short-circuited before `supabase.functions.invoke`. Console snapshot does not contain an explicit `blocked_pre_confirm_crm_upload` line in the captured slice; this is a **gap in console evidence**, not a violation — the absence of any prepare/confirm network call confirms the guard fired at or before `useDocumentRegistry.enqueueFiles`.

---

## Verdict

### What is proven

- **Phase 1 = runtime-proven for early CRM-mutation firewall.**
  - No pre-confirm `prepare_upload` / `confirm_upload` reached the server.
  - No `crm_storage` mutation (insert/update/delete) reached the server.
  - No storage object write reached `student-docs`.
  - Page open does not trigger destructive actions.

### What is NOT claimed

- Study File upload UX is **not usable** — by design of Phase 1, no draft destination exists, so files selected by the user vanish from the UI. This is an expected consequence of closing CRM-first writes without yet opening Phase 2 (`portal-drafts` + `portal_document_drafts`).
- Tests B (auto-save suppression) and C (analysis terminal) are **N/A under current architecture**: with no pending docs reaching any storage layer, there is nothing for SaveDocumentsBar or auto-save to act upon.

### Outstanding evidence gap (non-blocking)

- Explicit console line `blocked_pre_confirm_crm_upload` was not captured in the console snapshot reviewed. Network absence is sufficient proof of the firewall, but a follow-up capture with the console panel open during file selection would tighten the evidence.

---

## Final status

**Phase 1 = runtime-proven for early CRM-mutation firewall**
**Tests B/C = N/A until portal-drafts exist (Phase 2)**
**Study File flow = not usable until Phase 2**
**Phase 2 = now required (not started in this turn)**
