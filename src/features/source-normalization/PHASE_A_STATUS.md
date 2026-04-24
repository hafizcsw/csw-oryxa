# Phase A — Source-Side Normalization Engine

**Lane:** SEPARATE from Door 1/2/3. Door 1=CLOSED, Door 2=PARTIAL, Door 3=PARTIAL — all FROZEN.

## Scope (locked)

Build the *source-side* normalization layer that converts:

```
award/document truth (raw)  →  normalized credential truth
```

This is the foundation that Door 2/3 prototypes may *later* consume as
authoritative source of truth — that decision is **deferred** to the
Phase A exit decision point.

## Source countries (locked — 3 only)

- EG — Egypt
- AE — United Arab Emirates
- JO — Jordan

No other source country may be added during Phase A.

## Layers (10 total)

### Supabase tables (6) — created in migration

- `document_extraction_raw`
- `document_extraction_canonical`
- `document_evidence_flag`
- `student_award_raw`
- `student_credential_normalized`
- `credential_mapping_decision_log` (immutable audit trail)

### Local TypeScript packs (4) — reference data

- `country_education_profile` — `packs/country-profiles/`
- `credential_name_patterns` — `packs/credential-patterns/`
- `language_test_cefr_mapping` — `packs/language-cefr/`
- `credential_mapping_rule` — `packs/mapping-rules/`

Hybrid rationale: reference data evolves with engine logic; keeping it
co-located with the normalizer makes contract changes auditable in one
PR. Student-facing data (raw/canonical/normalized/log) lives in
Supabase under RLS.

## Engine status

| Component | Status |
|---|---|
| Types & contracts | code-ready (incl. `award_track_raw`, `award_stream_raw`) |
| 4 reference packs (EG/AE/JO) | code-ready (data drafted, awaiting review) |
| Engine logic | code-ready — pattern match, grade norm, ambiguity detect, decision log |
| Golden Set 9/9 | **PASS** (3 clear · 3 ambiguous · 3 noisy) — runner-verified |
| Persistence wiring (DB write) | **CLOSED** — live `read_query` proof on all 4 tables (10/10/10/1 rows for live session) |
| UI wiring (LiveProfileAssembly) | code-ready — `useStudentEvaluation` reads from official Phase A tables |
| Snapshot recompute / hash gating | logic-proven (Vitest A/B/C) + DB-observed (single snapshot row updated on doc add, not duplicated) |
| 4th-country data-only proof | NOT ATTEMPTED |

> **Phase A status: PARTIAL.**
> **Persistence path = CLOSED** (live DB write proof observed on the 4 official tables).
> **Phase A overall = PARTIAL** — open items: (1) write path is NOT a real atomic transaction, (2) engine duplication between `src/features/source-normalization/*` and the inline mirror in `phase-a-normalize` edge function, (3) 4th-country data-only proof not executed.
> Do **not** widen the claim beyond "Persistence path CLOSED / Phase A overall PARTIAL".

## Write-path honesty (atomicity)

The current `phase-a-normalize` edge function performs **sequential best-effort
writes** inside one HTTP request to the four official tables
(`student_award_raw` → `student_credential_normalized` →
`credential_mapping_decision_log` → `student_evaluation_snapshots`).
This is **NOT a real database transaction**:

- there is no `BEGIN` / `COMMIT` boundary
- a failure mid-way leaves partial rows; no automatic rollback
- the four tables can drift if the function is interrupted

If true atomicity is required later, the four writes should be moved into
a single Postgres `SECURITY DEFINER` function called from the edge function,
so they execute inside one transaction. Until then, do not call this path
"atomic" anywhere in docs, commit messages, or status updates.

## Engine duplication (intentional, temporary)

There are currently **two normalization implementations**:

1. `src/features/source-normalization/engine.ts` + `packs/*` — source of
   truth, covered by Golden Set 9/9.
2. An **inline mirror** inside `supabase/functions/phase-a-normalize/index.ts`
   — required because Deno edge functions cannot import from `src/`.

This is accepted drift for the current round. Plan to remove drift (not
yet executed, not part of any closure claim):

- move engine + packs to `supabase/functions/_shared/normalization/` as
  Deno-compatible modules
- re-export them into `src/features/source-normalization/` so both
  runtimes load the same code
- re-run Golden Set against the unified module before claiming the edge
  function is "Golden-Set-verified"

Until unification lands, the edge function's behavior is **not** covered
by the Golden Set, even though it implements the same logic.

## Hash truth (honest naming)

The field referred to elsewhere as `content_hash` for snapshot gating is
**not a binary checksum of the uploaded file**. It is a derived value from
`document_id` + `rules_version` and should be named
`content_fingerprint_heuristic` until a real file checksum (e.g. SHA-256
over the uploaded bytes) is computed at upload time and persisted alongside
each document. Current limitations:

- Same file re-uploaded under a new `document_id` produces a *different*
  fingerprint → a recompute will fire even though file bytes are identical.
- Bit-level file changes that preserve `document_id` would *not* change
  the fingerprint until `rules_version` bumps.

Until a true file checksum is wired, do not call this field a "file hash".

## Exit criteria (do not relax)

- [x] migrations applied
- [x] source-side normalizer runs on EG, AE, JO
- [x] 9/9 golden set cases pass with expected outputs
- [ ] live `read_query` proof against the 4 Phase A tables (Session A/B/C)
- [ ] write path moved to a real DB transaction (or accepted as non-atomic in writing)
- [ ] engine duplication removed (single source for src + edge)
- [ ] 4th country added via data-only (no code edits to engine/types/registry)
- [ ] normalized output is shaped to be consumable as truth source for Door 2/3 *if* later wired

## Frozen — do NOT touch in Phase A

- Door 1 / Door 2 / Door 3 (any expansion)
- APUS / ISUS / CCUS full versions
- program graph, university matching, scholarships, visa, improvement engine
- DB persistence for Door 3 measurement snapshot
- new countries beyond EG/AE/JO

## Decision point (after Phase A only)

After 9/9 golden + 4th-country data-only proof:
decide reuse vs rebuild for wiring normalizer → Door 2/3.
Do NOT pre-decide.
