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
| Persistence wiring (DB write) | NOT WIRED |
| UI wiring (LiveProfileAssembly) | NOT WIRED |
| Snapshot recompute / hash gating | NOT WIRED |
| 4th-country data-only proof | NOT ATTEMPTED |

> **Phase A status: PARTIAL.** Engine + Golden Set are runtime-verified.
> Persistence, UI wiring, and runtime sessions A/B/C are still pending.

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
- [ ] persistence + UI wiring proven via runtime sessions A/B/C
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
