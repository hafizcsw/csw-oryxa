# Target-Country Lane — Truth Status

**Last reviewed:** 2026-04-23
**Authority:** explicit user judgment after repo + runtime verification.

This document is the **only** source of truth for closure status of Doors 1/2/3
in the target-country lane. Any other doc, code comment, or summary that
claims a different status is **stale and must be ignored**.

---

## Door 1 — Canonical Student File
**Status: CLOSED**

- Single canonical model is in place.
- Runtime hook + visible consumer + canonical-first name in account header.
- Not to be reopened in this lane.

---

## Door 2 — Target Country (after-secondary, country-level)
**Status: PARTIAL**

### What is in repo (code-ready)
- 10 country truth packs: `CN RU US CA DE GB ES FI IT CH`
- Pure declarative engine (`engine.ts`)
- Applicant normalization from canonical (`applicant-normalize.ts`)
- Fixture proof (deterministic, runs in admin surface)
- Admin debug surface at `/admin/target-country`

### What is runtime-proven
- Fixture path: end-to-end normalize → matrix produces deterministic artifact
  with `matched_rule_ids`, `evidence_ids`, country statuses.

### What is NOT runtime-proven (the open part)
- **Live smoke on a real target student from admin context is not authoritative.**
  The portal has no admin-side endpoint that returns a *target* student's
  canonical truth (citizenship, secondary completion, English score) by
  `target_user_id`. The portal's only path to this data is
  `student-portal-api` which returns the *current actor*. Building an
  admin proxy to the CRM is out of scope for this lane.
- The current "Target student" tab accepts pasted `ApplicantTruth` JSON.
  This is **NOT** target-student runtime closure — it is engine input
  forwarding. It is kept only as a developer convenience and is labeled
  as such on the surface.

### What would close Door 2
- An admin-gated CRM proxy that loads a target student's canonical-shaped
  truth by `target_user_id` (with audit trail), wired into the admin
  surface as the only source of `ApplicantTruth`.
- Until that exists, Door 2 stays **PARTIAL**.

---

## Door 3 — Measurement-Lite + Harness + Extensibility
**Status: PARTIAL**

Door 3 cannot be CLOSED before Door 2.

### Code-ready
- `measurement.ts`: CLUS, EIUS, LPUS-basic + non-governing placeholders
  for APUS / ISUS / CCUS.
- `harness.ts`: single entry point producing deterministic artifacts.
- Admin surface renders snapshot + top blockers + matrix.

### Runtime-proven
- Harness on **fixture** applicant: artifact emitted to console with
  full snapshot + matrix + matched_rule_ids + evidence_ids.

### NOT runtime-proven
- Harness on a **live target student** is not authoritative for the
  same reason Door 2 is partial: no admin-side target-student truth
  loader exists.

### Frozen (out of scope for this lane)
- APUS / ISUS / CCUS full implementations
- DB persistence of measurement snapshots
- Program graph, university matching, scholarships, visa
- Improvement engine

---

## Country-11 (Türkiye) — Extensibility Claim Correction

The TR pack was added to demonstrate adding a country. The honest scope
of what was data-only vs. what required code change:

### Data-only
- `src/features/target-country/packs/TR.ts` — new pack object only.

### Required code change (NOT data-only)
- `src/features/target-country/types.ts` — `CountryCode` union literal
  was extended to include `'TR'`.
- `src/features/target-country/packs/index.ts` — `COUNTRY_PACKS` map
  registry got a new entry.

**Therefore the phrase "data-only proof" must NOT be used for TR.**
A true data-only proof would require either:
- a `string` country code with runtime registration, or
- a separately-loaded country registry that does not require touching
  the union or the registry map.

Neither is in place. The current architecture requires two small code
edits per new country. That is acceptable, but it is not "data-only".

---

## Rule of judgment

- Do not call anything CLOSED without runtime evidence that matches the
  intent of the door.
- Distinguish: **code-ready**, **runtime-proven (fixture)**,
  **runtime-proven (live target)**, **partial**, **placeholder**.
- Do not reopen Door 1.
- Do not expand Door 3 before Door 2 is truthfully closed.
